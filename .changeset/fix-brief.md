---
'playwright-smoothness': minor
'smoothness-core': minor
---

A check that gets worse or misses its budget now writes a fix brief next to its result (`<result>.fix.md`) and attaches it to the test: what got worse, the interactions, scripts and functions behind it with file and line, and the commands to check a fix on the same machine. It's written to be pasted into a coding agent. `npx playwright-smoothness brief` collects a run's briefs into one file, and the GitHub Action adds them to its pull request comment.
