import { defineConfig } from '@playwright/test';
import type { ButterTestOptions } from 'playwright-butter';

export default defineConfig<ButterTestOptions>({
  testDir: 'tests',
  // The butter summary (test-results/butter/summary.md, and the GitHub job summary).
  reporter: [['list'], ['playwright-butter/reporter']],
  // A measurement is a warm-up plus several reloaded runs; a traced fast scroll through a list takes a while.
  timeout: 120_000,
  // Timing tests shouldn't compete with each other for the CPU.
  workers: 1,
  use: {
    baseURL: 'http://localhost:4180',
    browserName: 'chromium',
    channel: 'chromium', // new headless: closer to real Chrome than the headless shell
    butterOptions: {
      // Baselines downloaded from main (see ../../docs/ci.md); unset locally.
      baselineDir: process.env.BUTTER_BASELINE_DIR,
      enforce: process.env.BUTTER_ENFORCE === 'fail' ? 'fail' : 'warn',
    },
  },
  webServer: {
    command: 'node server.mjs',
    url: 'http://localhost:4180',
    reuseExistingServer: !process.env.CI,
  },
});
