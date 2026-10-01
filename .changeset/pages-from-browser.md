---
'playwright-smoothness': minor
'smoothness-core': minor
---

Pages a test opens itself are measured. Automatic mode streams every context a test creates with `browser.newPage()` or `browser.newContext()`, and collects a page's last input before the test closes it. `measure()` takes a `page` option for such a page, and `scroll()` measures the page its locator is on. When nothing was measured, the summary says where results come from.
