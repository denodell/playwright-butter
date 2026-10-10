---
'playwright-butter': minor
'butter-churn': minor
---

playwright-smoothness is now playwright-butter, and smoothness-core is now butter-churn. To move over, install `playwright-butter` in place of `playwright-smoothness`, then:

- import from `playwright-butter`, and use `playwright-butter/reporter` and `npx playwright-butter`
- use `withButter()` in place of `withSmoothness()`
- use the `butter` fixture (`butter.measure()`, `butter.scroll()`) in place of `smoothness`
- set `butterOptions` (typed with `ButterTestOptions`) in place of `smoothnessOptions`
- use the `ButterResult`, `ButterOptions`, `ButterMode`, `ButterFixtures` and `Butter` types in place of their `Smoothness` names
- set `BUTTER_MODE`, `BUTTER_BASELINE_DIR`, `BUTTER_RECORD_BASELINES`, `BUTTER_RECORD` and `BUTTER_CALIBRATE` in place of their `SMOOTHNESS_` names
- use the GitHub Action as `denodell/playwright-butter@v1`, or its `setup` and `report` steps
- look for `butter-` annotations, results in `test-results/butter`, baselines in `<spec>-snapshots/butter`, the `butter-baselines` artifact, and the automatic-mode history in `node_modules/.cache/playwright-butter/history`

The old names no longer work. Baselines and histories recorded by playwright-smoothness aren't read, so each check records a new baseline on its first run, and `npx playwright-butter init-agents` adds the skill under its new name. `toBeSmooth()` keeps its name.
