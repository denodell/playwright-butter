// Regenerates the images in the README and docs from real runs:
//   docs/replay-frame-rate.gif   the journal demo's slow version, dropping frames
//   docs/replay-blank-rows.gif   the feed demo's slow version, with rows not drawn
//   docs/replay-frame.png        one frame of a costly list's replay (test-pages/list.html)
//   docs/hero.png                a drawn list frame next to a blank one
// Needs `npm run build` first, and ImageMagick 7 (`magick`) for the GIFs.
// Run from the repository root: node demos/make-images.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const repo = join(import.meta.dirname, '..');
const docs = join(repo, 'docs');
const playwright = join(repo, 'node_modules/.bin/playwright');
// The panel's own colours, kept in every GIF palette so its hairlines and text survive.
const PANEL_COLORS = ['#ffffff', '#0a0a0a', '#666666', '#a1a1a1', '#eaeaea', '#f5f5f5', '#b4413a'];

function run(cmd, args, env = {}) {
  execFileSync(cmd, args, { cwd: repo, stdio: 'inherit', env: { ...process.env, ...env } });
}

/** The newest .webm under a directory whose path contains `match`. */
function findVideo(dir, match) {
  const found = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.webm') && p.includes(match)) found.push(p);
    }
  };
  walk(dir);
  found.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (!found[0]) throw new Error(`no replay found under ${dir} for ${match}`);
  return found[0];
}

/** Frames of a WebM as PNG files: at `fps`, or at the given fractions of its length. */
async function extractFrames(video, outDir, { fps, fractions }) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const b64 = readFileSync(video).toString('base64');
    const pngs = await page.evaluate(
      async ({ b64, fps, fractions }) => {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const v = document.createElement('video');
        v.muted = true;
        v.src = URL.createObjectURL(new Blob([bytes], { type: 'video/webm' }));
        await new Promise((r) => (v.onloadedmetadata = r));
        const times = fractions ? fractions.map((f) => v.duration * f) : [];
        if (!fractions) for (let t = 0; t <= v.duration; t += 1 / fps) times.push(t);
        const c = document.createElement('canvas');
        c.width = v.videoWidth;
        c.height = v.videoHeight;
        const out = [];
        for (const t of times) {
          v.currentTime = t;
          await new Promise((r) => (v.onseeked = r));
          c.getContext('2d').drawImage(v, 0, 0);
          out.push(c.toDataURL('image/png').split(',')[1]);
        }
        return out;
      },
      { b64, fps, fractions },
    );
    return pngs.map((png, i) => {
      const file = join(outDir, `f${String(i).padStart(4, '0')}.png`);
      writeFileSync(file, Buffer.from(png, 'base64'));
      return file;
    });
  } finally {
    await browser.close();
  }
}

/** A looping GIF at the video's own width, on one fixed palette so light greys don't vanish. */
function makeGif(frames, dir, out) {
  const mid = frames[Math.floor(frames.length / 2)];
  const last = frames[frames.length - 1];
  const scene = join(dir, 'scene.png');
  const palette = join(dir, 'palette.png');
  run('magick', [frames[0], mid, last, '-append', '-colors', '56', '-unique-colors', scene]);
  run('magick', [scene, ...PANEL_COLORS.map((c) => `xc:${c}`), '+append', '-unique-colors', palette]);
  run('magick', [
    '-delay',
    '10',
    ...frames,
    '-delay',
    '150',
    last,
    '-loop',
    '0',
    '-dither',
    'None',
    '-remap',
    palette,
    '-layers',
    'Optimize',
    out,
  ]);
}

const work = mkdtempSync(join(tmpdir(), 'smoothness-images-'));
try {
  // GIFs: each demo's slow version, with a replay attached even without a baseline.
  for (const [test, match, gif] of [
    ['journal scroll', 'journal-scroll', 'replay-frame-rate.gif'],
    ['social feed', 'social-feed', 'replay-blank-rows.gif'],
  ]) {
    rmSync(join(repo, 'demos/results'), { recursive: true, force: true });
    run(playwright, ['test', '-c', 'demos', '-g', test], { APP_VARIANT: 'bad', REPLAY: 'on' });
    const dir = mkdtempSync(join(work, 'gif-'));
    const frames = await extractFrames(findVideo(join(repo, 'demos/results'), match), dir, { fps: 10 });
    makeGif(frames, dir, join(docs, gif));
    console.log(`wrote docs/${gif}`);
  }

  // The still: a frame 55% of the way through the costly list's replay.
  run(playwright, ['test', '--project=integration', 'replay-frame-image'], { REPLAY_FRAME_IMAGE: '1' });
  const [still] = await extractFrames(findVideo(join(repo, 'test-results'), 'replay-frame-image'), work, {
    fractions: [0.55],
  });
  writeFileSync(join(docs, 'replay-frame.png'), readFileSync(still));
  console.log('wrote docs/replay-frame.png');

  run(playwright, ['test', '--project=integration', 'hero-image'], { HERO_IMAGE: '1' });
  console.log('wrote docs/hero.png');
} finally {
  rmSync(work, { recursive: true, force: true });
}
