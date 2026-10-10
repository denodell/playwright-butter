// Compile-only: the config usage shown in README and docs/ci.md must typecheck.
import { defineConfig } from '@playwright/test';
import type { ButterTestOptions } from '../../packages/playwright-butter/src/index.js';

export const plain = defineConfig({
  use: { channel: 'chromium' },
});

export const withOptions = defineConfig<ButterTestOptions>({
  use: {
    channel: 'chromium',
    butterOptions: { baselineDir: process.env.BUTTER_BASELINE_DIR, enforce: 'fail' },
  },
});
