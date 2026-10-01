---
'playwright-smoothness': minor
'smoothness-core': minor
---

A GitHub Action, `denodell/playwright-smoothness@v1`, runs the whole CI setup in one step: pull requests compare with baselines published from the default branch and get the summary as a comment, pushes to the default branch record and publish baselines (and automatic mode's history), and scheduled runs use full mode.

`baselineDir` now defaults to the `SMOOTHNESS_BASELINE_DIR` environment variable, so configs no longer need to read it themselves. `npx playwright-smoothness summary` writes the Markdown summary from a run's result files, for runs without the reporter, and each result file now records its test's title, file and project.
