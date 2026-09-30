---
'playwright-smoothness': minor
'smoothness-core': minor
---

`toBeSmooth({ budget })` sets fixed limits as well as the baseline: `maxInputToPaintMs`, `maxLongFrames`, `minOnTimePercent` and `maxBlankFramePercent`. A missed budget fails the test whatever `enforce` says, and so does a budget that couldn't be checked, such as a full-mode metric in quick mode. Budget checks appear in the failure message and the reporter's summary, and in the result's `comparison.budget`.
