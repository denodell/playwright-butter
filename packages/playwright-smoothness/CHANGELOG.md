# playwright-smoothness

## 1.0.0

The first release. The public API and the JSON result format (`schemaVersion: 1`) follow semantic versioning from here. The public API is the `smoothness` fixture with `measure()` and `scroll()`, `smoothnessOptions`, `toBeSmooth()`, `withSmoothness()`, the reporter and the `calibrate` command. The measuring engine is published separately as [`smoothness-core`](https://github.com/denodell/playwright-smoothness/tree/main/packages/smoothness-core), which this package depends on at the same version.

### Measuring

- `smoothness.measure(label, action)` measures input-to-paint time with Event Timing, and long frames with the Long Animation Frames API, naming the scripts that ran in them. It slows the CPU 4x, makes a warm-up run, and reports the median of 5 reloaded runs. Frames from page loads and background timers are left out. Each script lists the interactions it blocked, which names the right element even behind a framework's event dispatcher.
- Full mode (`mode: 'full'`, the default on scheduled CI runs) also traces each run. It adds on-time and dropped frames from Chrome's frame reporter and the hottest functions from V8's sampling profiler, mapped back through source maps when the build is minified. With `refreshRate: 120` it adds a 120Hz prediction that's reported but never gated.
- `smoothness.scroll(locator, options)` scrolls a list by mouse wheel, touch or arrow keys, in either direction, at a named or numeric speed, to a pixel distance or to the end of the list (at most 20,000px). In full mode it counts blank frames from the trace's screenshots, with `list.background` and `list.placeholders` to say what counts as blank. Blank frames are only gated on a virtualized list, which is detected while scrolling (`list.virtualized`).
- `withSmoothness(base, { auto: true })` in a fixtures file measures every test that opens a page, once, across navigations, without changing the tests. Each test is compared with the median of its recent passing runs on the main branch, and editing a spec file starts its history again.

### Comparing

- `toBeSmooth()` compares a result with its stored baseline. Baselines are keyed by label, test, project, platform, mode, refresh rate, CPU throttling and CPU model, and `baselineDir` reads the main branch's baselines in CI. A check gets worse when it grows past `maxIncrease` (15% by default) and a small floor, so rounding can't fail it. By default it warns, with an annotation and a GitHub Actions `::warning`, and `enforce: 'fail'` fails the test instead. Failure messages start with what got worse and the scripts responsible.
- A measurement that couldn't be taken is `null`, and its reason is listed in `unavailable`.

### Reporting and tuning

- `playwright-smoothness/reporter` writes a Markdown summary for pull requests, and adds it to the GitHub Actions job summary.
- When a full-mode `measure()` or `scroll()` check gets worse, a WebM replay of one run is attached to the test (`replay: 'on-regression' | 'on' | 'off'`). It plays at a quarter of real speed and shows the frame rate, dropped frames, and blank frames for lists or inputs and long frames for `measure()`.
- `npx playwright-smoothness calibrate` runs the suite several times on unchanged code and suggests a `maxIncrease` for each check.
