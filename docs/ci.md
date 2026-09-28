# Baselines in CI

A baseline only means something on the machine that gates, so in CI the baselines come from CI runs on your main branch, never from developer laptops:

1. On the main branch, the suite runs with `--update-snapshots=all`, so every baseline is re-recorded from main, and the snapshot files are uploaded as an artifact.
2. On pull requests, the latest artifact from main is downloaded into a directory, and `baselineDir` points at it. Each check then compares against main.

`baselineDir` mirrors your snapshot layout: a baseline at `<snapshotDir>/<path>` is looked for at `<baselineDir>/<path>` first. Baselines are matched on CPU model, so an artifact built on one hosted-runner CPU won't be used on another. The recipe below keeps each CPU model's files by merging them, and a dedicated runner avoids the problem.

## GitHub Actions

```yaml
# .github/workflows/smoothness.yml
name: Smoothness
on:
  push:
    branches: [main]
  pull_request:

jobs:
  smoothness:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium

      # Start from main's latest baselines, on every branch. On main this keeps other CPU
      # models' baselines, so the artifact accumulates one file per CPU model.
      - uses: dawidd6/action-download-artifact@v6
        continue-on-error: true # the very first run has no artifact yet
        with:
          workflow: smoothness.yml
          branch: main
          name: smoothness-baselines
          path: smoothness-baselines

      - name: 'Pull request: compare with main'
        if: github.event_name == 'pull_request'
        run: npx playwright test
        env:
          SMOOTHNESS_BASELINE_DIR: smoothness-baselines

      - name: 'Main: re-record baselines'
        if: github.ref == 'refs/heads/main'
        run: |
          # Keep baselines for other CPU models, then re-record this machine's.
          if [ -d smoothness-baselines ]; then cp -R smoothness-baselines/. tests/; fi
          npx playwright test --update-snapshots=all

      # upload-artifact trims paths to the files' common directory, which would lose the
      # <spec>-snapshots/ part. Copy the baselines into a staging directory with their paths
      # relative to the snapshot directory intact.
      - name: 'Main: collect baselines'
        if: github.ref == 'refs/heads/main'
        run: |
          mkdir -p baselines-out
          # Portable: GNU cp --parents doesn't exist on macOS runners.
          (cd tests && find . -path '*-snapshots/smoothness/*' -type f | while read -r f; do
            mkdir -p "../baselines-out/$(dirname "$f")" && cp "$f" "../baselines-out/$f"
          done)
          test -n "$(find baselines-out -type f)" || { echo 'no baselines were collected'; exit 1; }
      - name: 'Main: publish baselines'
        if: github.ref == 'refs/heads/main'
        uses: actions/upload-artifact@v4
        with:
          name: smoothness-baselines
          path: baselines-out
          retention-days: 90
```

The config reads the directory from the environment. The type parameter lets `use` accept `smoothnessOptions`:

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';
import type { SmoothnessTestOptions } from 'playwright-smoothness';

export default defineConfig<SmoothnessTestOptions>({
  use: {
    channel: 'chromium',
    smoothnessOptions: { baselineDir: process.env.SMOOTHNESS_BASELINE_DIR },
  },
});
```

The workflow assumes `snapshotDir` is `tests`, which is the default when `testDir` is `tests`. `dawidd6/action-download-artifact` is a third-party action, used because GitHub's own `actions/download-artifact` can only read artifacts from the same workflow run.

## Use a dedicated runner if you can

GitHub's hosted `ubuntu-latest` runners landed on three different AMD EPYC models in this project's CI, with up to 1.5x difference in speed ([measurements.md](measurements.md) has the numbers). The recipe still works on hosted runners, because the artifact collects a baseline per CPU model over time. A pull request that lands on a model with no baseline yet isn't compared, and its result says "No baseline for this machine".

A self-hosted or larger dedicated runner (`runs-on: [self-hosted, linux]`, or a GitHub larger runner) runs every job on the same hardware, so every check is compared every time. The tests measure CPU time, so other work on that machine while they run makes the numbers noisier.

## Post the summary on the pull request

With the reporter in your config (`reporter: [['list'], ['playwright-smoothness/reporter']]`), each run adds the smoothness summary to the GitHub Actions job summary. This step also posts it as a comment on the pull request:

```yaml
- name: 'Pull request: comment with the summary'
  if: github.event_name == 'pull_request' && always()
  env:
    GH_TOKEN: ${{ github.token }}
  run: gh pr comment ${{ github.event.pull_request.number }} --body-file test-results/smoothness/summary.md --edit-last --create-if-none
```

The job needs `permissions: pull-requests: write`. `--edit-last` updates the previous comment, so each push doesn't add a new one.

## Run full mode on a schedule

Scheduled runs use full mode automatically ([mode detection](mode-detection.md)), and full-mode baselines are kept separately from quick-mode ones. Gating them takes a `schedule:` trigger under `on:` and a step that compares before the main-branch steps re-record:

```yaml
- name: 'Scheduled: compare with the last scheduled run'
  if: github.event_name == 'schedule'
  run: npx playwright test
  env:
    SMOOTHNESS_BASELINE_DIR: smoothness-baselines
```

This step goes before the "Main" steps. A scheduled run on the default branch has `github.ref` set to `refs/heads/main`, so the "Main" steps run afterwards, re-record, and the artifact carries both quick-mode and full-mode baselines.

## Recipe tests

`scripts/verify-ci-recipe.sh` runs these steps against `examples/plain-site` on every pull request to this project, in the Examples workflow. It records on "main", collects the baselines as above, runs as a fresh pull request with `baselineDir`, checks that every result was compared against the collected baseline, and checks that a deliberate regression fails. The one step it can't exercise is downloading an artifact from a different workflow run.
