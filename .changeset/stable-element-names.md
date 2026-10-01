---
'playwright-smoothness': patch
'smoothness-core': patch
---

Elements are named without ids a framework generates, such as React Aria's `react-aria6615417466-_r_r_` or React's `:r0:`, which change on every load. A control whose only id is generated is named by its text, such as `button:has-text("Filter")`. Scripts are grouped across runs without those ids too, so one handler's blocking time is no longer split across a separate entry per run.
