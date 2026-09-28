# Automatic mode

Automatic mode measures every test you already have, with one change to your fixtures file:

```ts
// tests/fixtures.ts
import { test as base } from '@playwright/test';
import { withSmoothness } from 'playwright-smoothness';

export const test = withSmoothness(base, { auto: true });
export { expect } from '@playwright/test';
```

Tests that import `test` from this file get `smoothness` and `smoothnessOptions` too, for explicit `measure()` and `scroll()` calls.

## What's measured

Each test that opens a page is measured once, for its whole run, with no warm-up and no reloads. The in-page collector streams what it sees to Playwright as it happens, so nothing is lost when the test navigates.

- `auto.interactions` lists each click, tap or key press with its element and input-to-paint time (`click on button#checkout: 180ms`), in order, across every page and navigation. `input.byTarget` summarizes them per element.
- Long frames caused by those interactions are listed with the scripts responsible, as in `measure()`. Frames from page loads and background timers are left out.
- The result is written to `test-results/smoothness/<test>/auto.json` and attached as `smoothness: auto`, so the [reporter](../README.md#reporter) includes it.

Tests that never open a page, such as API tests, produce no result.

CPU throttling is off by default in automatic mode (`cpuThrottling: 1`), because slowing every test 4x would slow the whole suite and could break its timeouts. If the suite can take it, `withSmoothness(base, { auto: true, cpuThrottling: 4 })` turns it on.

## Rolling history from main

Each test's baseline is the median of its last 10 passing runs on the main branch (`history`). A run is compared once the history has at least 3 runs (`minHistory`). Until then, the result says "building history".

- Runs are recorded on push builds of the main (or master) branch in CI. GitHub Actions, GitLab CI, Azure Pipelines and CircleCI are detected. `record: true` or `SMOOTHNESS_RECORD=1` forces recording, and `record: false` turns it off. Pull requests only compare, so they never change main's history.
- Only runs where the test itself passed are recorded.
- Histories are keyed by test, project, platform, CPU model and CPU throttling, like `measure()` baselines, because hosted runners differ in speed ([measurements.md](measurements.md)).
- Files live in `historyDir`. By default that's `baselineDir` if you set one, and otherwise `smoothness-history` next to your Playwright config.

### Changed spec files

When a spec file changes, the histories of the tests in it start again instead of failing, since the tests may now do different things. The whole spec file is hashed, so editing one test resets its neighbors too, which is conservative but simple. The result notes the reset, and the test gets a `smoothness-baseline-reset` annotation.

## Keep the history in CI

The history has to outlive each CI run, so `historyDir` is kept as an artifact. The pattern is the same as for [baselines in CI](ci.md), and simpler, because history files are used where they're downloaded:

```yaml
- uses: dawidd6/action-download-artifact@v6
  continue-on-error: true # the first run has no history yet
  with:
    workflow: smoothness.yml
    branch: main
    name: smoothness-history
    path: smoothness-history

- run: npx playwright test # records on main, compares on pull requests

- name: 'Main: keep the history'
  if: github.ref == 'refs/heads/main'
  uses: actions/upload-artifact@v4
  with:
    name: smoothness-history
    path: smoothness-history
    retention-days: 90
```

## Limitations

- An input followed straight away by a navigation isn't measured. The browser only measures an input (in Event Timing and in Long Animation Frames) once the next frame paints, and a test that clicks and then immediately calls `page.goto()` navigates before that paint. The result says "The last input before a navigation (pointerdown on …) wasn't measured" when the next document on the same page started within 250ms of the input and nothing measured it.
- Each test is measured once, with no warm-up and no median across runs. The rolling median across main-branch runs takes their place. On a developer Mac, the first interaction on a page read about twice as long as later ones, but on GitHub's runners it didn't ([measurements.md](measurements.md)), so CI histories aren't affected.
- It only uses quick mode. Full mode (tracing, screenshots, the CPU profile) is for explicit `measure()` and `scroll()` calls.
- The [README's limitations](../README.md#limitations) apply too: Chromium only, and no interactions under 16ms.
