import {
  test as base,
  type Fixtures,
  type Locator,
  type Page,
  type PlaywrightTestArgs,
  type PlaywrightTestOptions,
  type TestInfo,
} from '@playwright/test';
import {
  defaultScrollLabel,
  emptyResult,
  encodeReplay,
  measure,
  measureScroll,
  preparePage,
  resolveOptions,
  resolveScroll,
  resultPath,
  takeReplaySource,
  warnInGitHubActions,
  writeResult,
  type MeasureContext,
  type PageDriver,
  type ScrollOptions,
  type SmoothnessOptions as CoreOptions,
  type SmoothnessResult,
} from 'smoothness-core';
import { resultDir } from './testinfo.js';
import { basename } from 'node:path';
import { writeFileSync } from 'node:fs';
import { locatorTarget, playwrightDriver } from './driver.js';

/** Options for a measurement. A `reset` function is given the Playwright page. */
export type SmoothnessOptions = CoreOptions<Page>;

export interface Smoothness {
  /**
   * Measures an interaction. `action` runs once as a warm-up and then `runs` more times,
   * with the page reset (reloaded, by default) and settled before each run. The label names
   * the baseline, so it must be unique within a test.
   */
  measure(label: string, action: () => Promise<void>, options?: SmoothnessOptions): Promise<SmoothnessResult>;
  /**
   * Scrolls a list (or the page) and measures it: long frames and input in quick mode, plus
   * dropped frames and blank rows from trace screenshots in full mode. Each run reloads the page,
   * so the list starts from the top.
   */
  scroll(target: Locator, options?: ScrollOptions & SmoothnessOptions): Promise<SmoothnessResult>;
}

/**
 * The option fixture on its own, for typing `playwright.config.ts`:
 * `defineConfig<SmoothnessTestOptions>({ use: { smoothnessOptions: { ... } } })`.
 */
export type SmoothnessTestOptions = Pick<SmoothnessFixtures, 'smoothnessOptions'>;

export interface SmoothnessFixtures {
  /** Options for every measurement in the test. Set with `test.use({ smoothnessOptions: {...} })`. */
  smoothnessOptions: SmoothnessOptions;
  smoothness: Smoothness;
}

/** Adds an annotation to the test once per type and description. */
function annotateOnce(testInfo: TestInfo, type: string, description: string): void {
  if (!testInfo.annotations.some((a) => a.type === type && a.description === description)) {
    testInfo.annotations.push({ type, description });
  }
}

function warn(testInfo: TestInfo, message: string): void {
  annotateOnce(testInfo, 'smoothness-warning', message);
  warnInGitHubActions(message, testInfo);
}

async function createSmoothness(
  page: Page,
  driver: PageDriver,
  defaults: SmoothnessOptions,
  testInfo: TestInfo,
  outputs: Map<string, { path: string; result: SmoothnessResult }>,
): Promise<Smoothness> {
  const environment = await driver.environment();
  if (environment.browserName === 'chromium' && environment.headlessMode === 'headless-shell') {
    warn(
      testInfo,
      "Running in Chromium's headless shell. Measurements are closer to real Chrome in new headless: set channel: 'chromium'.",
    );
  }
  const record = async (
    label: string,
    overrides: SmoothnessOptions | undefined,
    run: (ctx: MeasureContext) => Promise<SmoothnessResult>,
  ): Promise<SmoothnessResult> => {
    if (outputs.has(label)) {
      throw new Error(
        `smoothness: the label "${label}" is already used in this test. Labels name baselines, so each must be unique.`,
      );
    }
    const options = resolveOptions([defaults, overrides]);
    let result: SmoothnessResult;
    if (environment.browserName !== 'chromium') {
      const reason = `smoothness is measured in Chromium only; this is ${environment.browserName}`;
      annotateOnce(testInfo, 'smoothness-skipped', `${label}: ${reason}`);
      result = emptyResult({ label, options, environment }, reason);
    } else {
      result = await run({ page: driver, label, options, environment });
    }
    const path = resultPath(resultDir(testInfo), label);
    writeResult(result, path);
    outputs.set(label, { path, result });
    return result;
  };

  return {
    measure(label, action, overrides) {
      return record(label, overrides, (ctx) => measure(ctx, action));
    },

    async scroll(locator, all = {}) {
      const { distance, direction, input, speed, label: givenLabel, ...overrides } = all;
      const s = resolveScroll({ distance, direction, input, speed });
      const target = locatorTarget(locator);
      const label = givenLabel ?? defaultScrollLabel(target, s);
      return record(label, overrides, async (ctx) => {
        if (s.input === 'touch' && (await page.evaluate(() => navigator.maxTouchPoints)) === 0) {
          // Touch events on a page that reports no touch support aren't what a phone does:
          // pages branch on touch support (pointer: coarse, touch handlers).
          throw new Error(
            "smoothness.scroll(): input: 'touch' needs a touch-enabled browser context. Use test.use({ hasTouch: true }) or a mobile device, such as devices['Pixel 7'].",
          );
        }
        return measureScroll(ctx, target, s);
      });
    },
  };
}

/**
 * Encodes and attaches a scroll() replay when the result asks for one: always with
 * `replay: 'on'`, and when a check got worse with `'on-regression'` (the default).
 */
async function attachReplay(
  driver: PageDriver,
  testInfo: TestInfo,
  label: string,
  path: string,
  result: SmoothnessResult,
) {
  const source = takeReplaySource(result);
  if (!source) return;
  const status = result.comparison?.status;
  const wanted =
    result.settings.replay === 'on' ||
    (result.settings.replay === 'on-regression' && (status === 'warn' || status === 'fail'));
  if (!wanted) return;
  const video = await encodeReplay(driver, source);
  if ('unavailable' in video) {
    result.notes.push(`No replay: ${video.unavailable}.`);
  } else {
    const file = path.replace(/\.json$/, '.replay.webm');
    writeFileSync(file, video);
    result.replay = basename(file);
    await testInfo.attach(`smoothness replay: ${label}`, { path: file, contentType: 'video/webm' });
  }
  writeResult(result, path);
}

/** The fixture definitions, shared by `test` and `withSmoothness()`. */
export const smoothnessFixtures: Fixtures<
  SmoothnessFixtures,
  object,
  PlaywrightTestArgs & PlaywrightTestOptions
> = {
  smoothnessOptions: [{}, { option: true }],
  smoothness: async ({ page, smoothnessOptions }, use, testInfo) => {
    const driver = playwrightDriver(page);
    if (page.context().browser()?.browserType().name() === 'chromium') await preparePage(driver);
    const outputs = new Map<string, { path: string; result: SmoothnessResult }>();
    await use(await createSmoothness(page, driver, smoothnessOptions, testInfo, outputs));
    // Attached after the test body, so each file includes toBeSmooth()'s comparison.
    for (const [label, { path, result }] of outputs) {
      await attachReplay(driver, testInfo, label, path, result);
      await testInfo.attach(`smoothness: ${label}`, { path, contentType: 'application/json' });
    }
  },
};

export const test = base.extend<SmoothnessFixtures>(smoothnessFixtures);
