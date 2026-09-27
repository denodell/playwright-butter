// Turns a measured run's trace screenshots into a WebM replay: each frame with a panel saying how
// drawn the list was, a red BLANK marker on blank frames, and a timeline of the whole run.
import type { Browser } from '@playwright/test';
import { PACKAGE_NAME } from '../constants.js';
import { muxWebM, type EncodedFrame } from './webm.js';

/** Replays play this many times slower than real time: at 60fps, blank frames flash past unseen. */
const REPLAY_SLOWDOWN = 4;
/** A key frame this often, so the report's player can seek. */
const KEY_FRAME_EVERY = 30;
const REPLAY_BITRATE = 2_000_000;

/** WebCodecs needs a secure context; http://localhost is one, and Playwright serves it itself. */
const REPLAY_URL = 'http://localhost/__playwright-smoothness-replay';

export interface ReplayInput {
  /** Base64 JPEGs of the viewport, in order. */
  jpegs: string[];
  /** Each frame's time from the first, in real ms. */
  timesMs: number[];
  /** scroll() only: each frame's drawn share relative to the list at rest, 0..1. Empty otherwise. */
  drawn: number[];
  /** Below this share a frame is blank. */
  blankShare: number;
  /** The compositor's presented and dropped frames, in ms from the first screenshot. */
  frames: { tMs: number; dropped: boolean }[];
  /** measure() only: when each input arrived, and each long frame, in ms from the first screenshot. */
  markers: { inputs: number[]; longFrames: { tMs: number; durMs: number }[] };
  /** scroll() only: whether the list is virtualized, so blank frames mean rows that weren't built. */
  virtualized: boolean;
  /** scroll() only: the list's client area in CSS pixels, to outline it. Null for measure(). */
  rect: { x: number; y: number; width: number; height: number } | null;
  viewport: { width: number; height: number };
  title: string;
}

interface Chunk {
  timeMs: number;
  key: boolean;
  data: string;
}

/** Renders and encodes in the page. Self-contained: it's serialized into the browser. */
async function renderInPage(args: ReplayInput & { slowdown: number; keyEvery: number; bitrate: number }) {
  const bytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const decode = (b64: string) => createImageBitmap(new Blob([bytes(b64)], { type: 'image/jpeg' }));
  const first = await decode(args.jpegs[0]!);
  const imgW = first.width;
  const imgH = first.height;
  first.close();
  const n = args.jpegs.length;
  const total = args.timesMs[n - 1] ?? 0;
  // Frames count as blank (rows not drawn) only on a virtualized list.
  const rowsMatter = args.rect !== null && args.virtualized;
  const blankCount = rowsMatter ? args.drawn.filter((d) => d < args.blankShare).length : 0;

  const pad = 28;
  const even = (v: number) => Math.ceil(v) + (Math.ceil(v) % 2);
  const width = even(imgW + pad * 2);
  const height = even(pad + imgH + 250);
  const sx = imgW / args.viewport.width;
  const sy = imgH / args.viewport.height;
  const sans = '"Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif';
  const c = {
    paper: '#ffffff',
    ink: '#1a1a1a',
    graphite: '#77776f',
    off: '#ecebe6',
    future: '#d8d7d1',
    blank: '#ff4f00',
  };

  const canvas = new OffscreenCanvas(width, height);
  const g = canvas.getContext('2d')!;
  const label = (
    s: string,
    x: number,
    y: number,
    fill = c.graphite,
    align: CanvasTextAlign = 'left',
    size = 9,
  ) => {
    g.font = `600 ${size}px ${sans}`;
    g.letterSpacing = '1.4px';
    g.fillStyle = fill;
    g.textAlign = align;
    g.fillText(s.toUpperCase(), x, y);
    g.letterSpacing = '0px';
  };
  const fit = (s: string, max: number) => {
    if (g.measureText(s).width <= max) return s;
    while (s.length > 1 && g.measureText(s + '…').width > max) s = s.slice(0, -1);
    return s + '…';
  };

  // A 5x7 dot-matrix face for readouts, like a device's display. Unlit dots are drawn faintly.
  const glyphs: Record<string, string> = {
    '0': '01110100011001110101110011000101110',
    '1': '00100011000010000100001000010001110',
    '2': '01110100010000100010001000100011111',
    '3': '11110000010000101110000010000111110',
    '4': '00010001100101010010111110001000010',
    '5': '11111100001111000001000011000101110',
    '6': '00110010001000011110100011000101110',
    '7': '11111000010001000100010000100001000',
    '8': '01110100011000101110100011000101110',
    '9': '01110100011000101111000010001001100',
    '%': '11001110100001000100010000101110011',
    '/': '00001000100001000100010000100010000',
    '.': '00000000000000000000000000110001100',
    s: '00000000000111110000011100000111110',
    ' ': '00000000000000000000000000000000000',
  };
  const dotText = (s: string, x: number, y: number, cell: number, on: string, off: string | null) => {
    const r = cell * 0.36;
    for (const ch of s) {
      const bits = glyphs[ch] ?? glyphs[' ']!;
      for (let k = 0; k < 35; k++) {
        const lit = bits[k] === '1';
        if (!lit && !off) continue;
        g.fillStyle = lit ? on : off!;
        g.beginPath();
        g.arc(x + (k % 5) * cell + cell / 2, y + Math.floor(k / 5) * cell + cell / 2, r, 0, Math.PI * 2);
        g.fill();
      }
      x += cell * 6;
    }
    return x;
  };
  const meter = (x: number, y: number, h: number, drawn: number, blank: boolean) => {
    const lit = Math.round(drawn * 10);
    for (let k = 0; k < 10; k++) {
      g.fillStyle = k < lit ? (blank ? c.blank : c.ink) : c.off;
      g.fillRect(x + k * 7, y, 4, h);
    }
  };
  const secs = (ms: number) => `${(ms / 1000).toFixed(2)}s`;
  const pad3 = (v: number) => String(v).padStart(String(n).length, '0');

  // The list on the screenshot: a hairline when drawn; when its rows aren't drawn (a blank frame),
  // an orange outline and a tag that says so. The empty list itself is the evidence, so it isn't
  // covered.
  const markList = (ox: number, oy: number, blank: boolean) => {
    if (!args.rect) return;
    const x = ox + args.rect.x * sx;
    const y = oy + args.rect.y * sy;
    const w = args.rect.width * sx;
    const h = args.rect.height * sy;
    if (!blank) {
      g.strokeStyle = 'rgba(26, 26, 26, 0.35)';
      g.lineWidth = 1;
      g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      return;
    }
    g.strokeStyle = c.blank;
    g.lineWidth = 2;
    g.strokeRect(x + 1, y + 1, w - 2, h - 2);
    g.font = `700 10px ${sans}`;
    g.letterSpacing = '1.2px';
    const tag = 'ROWS NOT DRAWN YET';
    const tagW = g.measureText(tag).width + 14;
    g.letterSpacing = '0px';
    g.fillStyle = c.blank;
    g.fillRect(x + 2, y + 2, tagW, 20);
    label(tag, x + 9, y + 16, c.paper, 'left', 10);
  };

  // Frame rate over a short trailing window, from the compositor's presented frames.
  const FPS_WINDOW_MS = 250;
  const presented = args.frames.filter((f) => !f.dropped).map((f) => f.tMs);
  const droppedTimes = args.frames.filter((f) => f.dropped).map((f) => f.tMs);
  const droppedTotal = droppedTimes.length;
  const countBetween = (times: number[], from: number, to: number) =>
    times.reduce((k, t) => (t > from && t <= to ? k + 1 : k), 0);
  const droppedBetween = (from: number, to: number) => countBetween(droppedTimes, from, to);
  // Frames per second while there's something to show: of the frames that had an update, the
  // share presented, at 60Hz. When nothing on screen changes, Chrome makes no new frames, and
  // that isn't a low frame rate, so it's null rather than zero.
  const fpsBetween = (from: number, to: number) => {
    const shown = countBetween(presented, from, to);
    const missed = countBetween(droppedTimes, from, to);
    return shown + missed === 0 ? null : Math.round((60 * shown) / (shown + missed));
  };
  const fpsAt = (t: number) => fpsBetween(t - FPS_WINDOW_MS, t);
  // What the strip under the graph shows: rows not drawn (virtualized lists), long frames
  // (measure()), or nothing (other scrolls).
  const strip: 'rows' | 'long' | null = args.rect === null ? 'long' : rowsMatter ? 'rows' : null;
  // One mark per interaction: its entries (pointerdown, click) arrive within a few ms.
  const inputs = [...args.markers.inputs]
    .sort((a, b) => a - b)
    .filter((t, k, all) => k === 0 || t - all[k - 1]! > 30);
  const GRAPH_COLS = 60;
  const colOf = (ms: number) => Math.min(GRAPH_COLS - 1, Math.floor((ms / (total || 1)) * GRAPH_COLS));
  const slices = Array.from({ length: GRAPH_COLS }, (_, cI) => {
    const from = (cI / GRAPH_COLS) * total;
    const to = ((cI + 1) / GRAPH_COLS) * total;
    const mid = (from + to) / 2;
    return {
      fps: fpsBetween(Math.max(0, mid - FPS_WINDOW_MS / 2), Math.min(total, mid + FPS_WINDOW_MS / 2)),
      blank: args.drawn.some((d, j) => d < args.blankShare && colOf(args.timesMs[j]!) === cI),
      long: args.markers.longFrames.some((f) => f.tMs < to && f.tMs + f.durMs > from),
    };
  });

  const chunks: Chunk[] = [];
  let failure = '';
  const encoder = new VideoEncoder({
    output: (chunk) => {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      let s = '';
      for (let i = 0; i < data.length; i += 0x8000) s += String.fromCharCode(...data.subarray(i, i + 0x8000));
      chunks.push({ timeMs: chunk.timestamp / 1000, key: chunk.type === 'key', data: btoa(s) });
    },
    error: (e) => {
      failure = String(e);
    },
  });
  encoder.configure({ codec: 'vp8', width, height, bitrate: args.bitrate, framerate: 60 / args.slowdown });

  for (let i = 0; i < n; i++) {
    const img = await decode(args.jpegs[i]!);
    const drawn = args.drawn[i]!;
    const blank = rowsMatter && drawn < args.blankShare;
    const pct = `${Math.round(drawn * 100)}%`;
    g.fillStyle = c.paper;
    g.fillRect(0, 0, width, height);

    // Device: screenshot, then a display of dot-matrix readouts and a dot waveform.
    g.drawImage(img, pad, pad);
    img.close();
    g.strokeStyle = c.ink;
    g.lineWidth = 1;
    g.strokeRect(pad - 0.5, pad - 0.5, imgW + 1, imgH + 1);
    markList(pad, pad, blank);
    const left = pad;
    const right = width - pad;
    let y = pad + imgH + 30;
    g.font = `500 12px ${sans}`;
    g.fillStyle = c.ink;
    g.textAlign = 'left';
    g.fillText(fit(args.title, right - left - 120), left, y);
    label(`${args.slowdown}× slower`, right, y, c.graphite, 'right');

    y += 26;
    // Readouts. Frames per second leads, larger than the rest; the others share a baseline with it.
    const fps = fpsAt(args.timesMs[i]!);
    const droppingNow = droppedBetween(args.timesMs[i]! - FPS_WINDOW_MS, args.timesMs[i]!) > 0;
    const listWentBlank = blankCount > 0;
    const droppedSoFar = droppedBetween(-1, args.timesMs[i]!);
    const colB = left + (right - left) * 0.36;
    const colC = left + (right - left) * 0.7;
    const big = 5;
    const cell = 3;
    const smallTop = y + 10 + 7 * big - 7 * cell; // bottom-aligned with the large digits
    label('Frames per second', left, y);
    label(listWentBlank ? 'List drawn' : 'Dropped frames', colB, y);
    label('Elapsed time', colC, y);
    dotText(
      fps === null ? '  ' : String(fps).padStart(2, ' '),
      left,
      y + 10,
      big,
      droppingNow ? c.blank : c.ink,
      c.off,
    );
    if (listWentBlank) {
      const endX = dotText(pct.padStart(4, ' '), colB, smallTop, cell, blank ? c.blank : c.ink, c.off);
      meter(endX + 6, smallTop, 21, drawn, blank);
    } else {
      dotText(
        String(droppedSoFar).padStart(3, ' '),
        colB,
        smallTop,
        cell,
        droppedSoFar ? c.blank : c.ink,
        c.off,
      );
    }
    dotText(secs(args.timesMs[i]!), colC, smallTop, cell, c.ink, c.off);

    // LCD graph of the frame rate: a fixed grid of segments, unlit ones faintly visible. Each
    // column covers a slice of the run and lights the one segment at its frames per second, so
    // the lit segments read as a line: black at 60fps, orange below it, where frames were
    // dropped. It draws in as the replay plays. A one-row strip underneath marks slices with blank frames.
    const top = y + 72;
    const gl = left + 36; // a gutter for the graph's labels
    const xAt = (ms: number) => gl + (ms / (total || 1)) * (right - gl);
    const rows = 12;
    const cellH = 3;
    const gapY = 1.5;
    const pitch = cellH + gapY;
    const colW = (right - gl) / GRAPH_COLS;
    const base = top + rows * pitch;
    const playCol = colOf(args.timesMs[i]!);
    for (let cI = 0; cI < GRAPH_COLS; cI++) {
      const sl = slices[cI]!;
      const played = cI <= playCol;
      const level = sl.fps === null || !played ? -1 : Math.max(0, Math.round((sl.fps / 60) * rows) - 1);
      for (let r = 0; r < rows; r++) {
        // Black at the top row (60fps); orange anywhere below it, where frames were dropped.
        g.fillStyle = r !== level ? c.off : level < rows - 1 ? c.blank : c.ink;
        g.fillRect(gl + cI * colW + 0.75, base - (r + 1) * pitch, colW - 1.5, cellH);
      }
      if (strip) {
        g.fillStyle = played && (strip === 'rows' ? sl.blank : sl.long) ? c.blank : c.off;
        g.fillRect(gl + cI * colW + 0.75, base + 4, colW - 1.5, cellH);
      }
    }
    // Key: what orange means, on the line and in the strip underneath.
    let keyX = right;
    const keyItems = strip === 'rows' ? ['Rows not drawn'] : strip === 'long' ? ['Long frames'] : [];
    for (const item of [...keyItems, 'Frames dropped']) {
      g.font = `600 7px ${sans}`;
      g.letterSpacing = '1.4px';
      const w = g.measureText(item.toUpperCase()).width;
      g.letterSpacing = '0px';
      label(item, keyX, top - 8, c.graphite, 'right', 7);
      g.fillStyle = c.blank;
      g.fillRect(keyX - w - 12, top - 12, 7, cellH);
      keyX -= w + 26;
    }
    label('60 fps', gl - 6, base - rows * pitch + 4, c.graphite, 'right', 7);
    label('30', gl - 6, base - (rows / 2) * pitch + 3, c.graphite, 'right', 7);
    label('0', gl - 6, base, c.graphite, 'right', 7);
    if (strip) label(strip === 'rows' ? 'Not drawn' : 'Long', gl - 6, base + 7.5, c.graphite, 'right', 6);
    // measure(): a small mark above the graph where each input arrived.
    for (const t of inputs) {
      if (t > args.timesMs[i]!) continue;
      const ix = Math.round(xAt(Math.max(0, t))) + 0.5; // an input just before the first frame sits at the start
      g.fillStyle = c.ink;
      g.beginPath();
      g.moveTo(ix - 3, top - 9);
      g.lineTo(ix + 3, top - 9);
      g.lineTo(ix, top - 4);
      g.closePath();
      g.fill();
    }
    if (inputs.length) label('input', gl - 12, top - 4, c.graphite, 'right', 6);

    // Playhead: a small triangle under the graph.
    const hx = xAt(args.timesMs[i]!);
    const markY = base + 4 + cellH;
    g.fillStyle = c.ink;
    g.beginPath();
    g.moveTo(hx, markY + 4);
    g.lineTo(hx - 4, markY + 10);
    g.lineTo(hx + 4, markY + 10);
    g.closePath();
    g.fill();
    const parts = [`${droppedTotal} frames dropped`];
    if (strip === 'rows') parts.push(`${blankCount} of ${n} with rows not drawn`);
    if (strip === 'long') parts.push(`${args.markers.longFrames.length} long frames`);
    label(
      parts.join(' · '),
      left,
      markY + 28,
      droppedTotal || blankCount || args.markers.longFrames.length ? c.blank : c.graphite,
    );
    label(`Frame ${pad3(i + 1)}/${n}`, right, markY + 28, c.graphite, 'right');

    const frame = new VideoFrame(canvas, { timestamp: Math.round(args.timesMs[i]! * args.slowdown * 1000) });
    encoder.encode(frame, { keyFrame: i % args.keyEvery === 0 });
    frame.close();
  }
  // Hold the last frame briefly so the replay doesn't end abruptly.
  const hold = new VideoFrame(canvas, { timestamp: Math.round((total * args.slowdown + 1000) * 1000) });
  encoder.encode(hold, { keyFrame: false });
  hold.close();
  await encoder.flush();
  encoder.close();
  return { width, height, chunks, failure };
}

/**
 * Encodes a replay in a throwaway page of the same Chromium (no dependency). Returns the WebM
 * bytes, or a reason it couldn't be made.
 */
export async function encodeReplay(
  browser: Browser,
  input: ReplayInput,
): Promise<Uint8Array | { unavailable: string }> {
  if (input.jpegs.length === 0) return { unavailable: 'no frames to replay' };
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.route(REPLAY_URL, (r) =>
      r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>replay</title>' }),
    );
    await page.goto(REPLAY_URL);
    if (!(await page.evaluate(() => typeof VideoEncoder !== 'undefined'))) {
      return { unavailable: "this browser has no WebCodecs VideoEncoder, so replays can't be encoded" };
    }
    const out = await page.evaluate(renderInPage, {
      ...input,
      slowdown: REPLAY_SLOWDOWN,
      keyEvery: KEY_FRAME_EVERY,
      bitrate: REPLAY_BITRATE,
    });
    if (out.failure) return { unavailable: `the replay couldn't be encoded: ${out.failure}` };
    const frames: EncodedFrame[] = out.chunks
      .sort((a, b) => a.timeMs - b.timeMs)
      .map((c) => ({ timeMs: c.timeMs, key: c.key, data: Uint8Array.from(Buffer.from(c.data, 'base64')) }));
    if (!frames[0]?.key) return { unavailable: "the replay's first frame wasn't a key frame" };
    return muxWebM(frames, out.width, out.height, PACKAGE_NAME);
  } catch (err) {
    return { unavailable: `the replay couldn't be made: ${String(err).split('\n')[0]}` };
  } finally {
    await context.close();
  }
}
