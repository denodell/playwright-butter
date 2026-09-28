# smoothness-core

The measuring engine behind [playwright-smoothness](https://www.npmjs.com/package/playwright-smoothness). It measures how smooth a web page is in Chromium: dropped frames, slow input, long animation frames, and list rows that aren't drawn while you scroll. It then compares the numbers with a baseline.

If you test with Playwright, install `playwright-smoothness` instead. It includes this package, and its [README](https://github.com/denodell/playwright-smoothness#readme) covers everything you need.

## Who this package is for

This package is for people writing an adapter for another browser automation library, such as Puppeteer. The engine never talks to a browser library directly. It uses two small interfaces from `driver.ts`, and your adapter implements them:

- **`PageDriver`** is the page being measured. It covers running a function in the page, adding an init script, reloading, a Chrome DevTools Protocol session, screenshots, tracing, a click, a key press, fetching a source map, and opening a scratch page.
- **`ElementTarget`** is the element to scroll. It covers running a function against the element, scrolling it into view, and focusing it.

With those in place, `measure()` measures an interaction, and `measureScroll()` scrolls a list and measures it. Both return the same versioned result that playwright-smoothness writes. `evaluate()` compares a result with its baseline, and `formatMessage()` explains what changed.

The engine needs Chromium, because it relies on the Chrome DevTools Protocol and Chrome's trace events. The Playwright adapter, [`packages/playwright-smoothness/src/driver.ts`](https://github.com/denodell/playwright-smoothness/blob/main/packages/playwright-smoothness/src/driver.ts), is about 130 lines and a good starting point.

## Licence

MIT
