---
'playwright-butter': minor
'butter-core': minor
---

playwright-smoothness is now playwright-butter, and smoothness-core is now butter-core. To move over, install `playwright-butter` in place of `playwright-smoothness`, then:

- import from `playwright-butter`, and use `playwright-butter/reporter` and `npx playwright-butter`
- use `withButter()` in place of `withSmoothness()`
- use the `butter` fixture (`butter.measure()`, `butter.scroll()`) in place of `smoothness`
- set `butterOptions` (typed with `ButterTestOptions`) in place of `smoothnessOptions`
- set `BUTTER_MODE`, `BUTTER_BASELINE_DIR`, `BUTTER_RECORD_BASELINES`, `BUTTER_RECORD` and `BUTTER_CALIBRATE` in place of their `SMOOTHNESS_` names
- use the GitHub Action as `denodell/playwright-butter@v1`, or its `setup` and `report` steps

The old names still work for now. `toBeSmooth()` keeps its name, existing baselines and automatic-mode histories still load, and `npx playwright-butter init-agents` replaces a skill added under the old name.
