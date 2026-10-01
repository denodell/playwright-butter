---
'playwright-smoothness': patch
'smoothness-core': patch
---

The reporter counts baselines re-recorded by `--update-snapshots` as re-recorded. It had counted them as within baseline, then listed their checks as worse against the baselines they replaced. Each is now listed with what changed against the old baseline.
