---
'playwright-smoothness': patch
'smoothness-core': patch
---

`scroll()` starts every run from the same place on a page that scrolls itself. Chrome restored the scroll position on each reload, and a smooth-scrolling script took that position as its own, so each run scrolled a different part of the page. Scroll restoration is now off while `scroll()` runs, and the result notes any run that didn't start where the first did.
