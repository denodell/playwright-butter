# Demo apps

Six small apps, each with a fast version (`?v=good`) and a slow one (`?v=bad`), for checking that playwright-smoothness catches the kinds of problem real apps have. The README's replay GIFs come from two of them.

| App        | What it is                    | What the slow version does                                                      |
| ---------- | ----------------------------- | ------------------------------------------------------------------------------- |
| `invoices` | A letterpress shop's invoices | Rebuilds the table on every keystroke and forces a layout for each row          |
| `kanban`   | A bakery's production board   | Re-renders 400 React cards without memoization when you sort                    |
| `parallax` | A coast road travel story     | Measures and moves every image on every scroll event                            |
| `drawer`   | A home energy monitor         | Rebuilds the usage chart on every frame of the panel's slide-in                 |
| `feed`     | A cycling club feed           | Builds each post slowly, with nothing built ahead of the viewport               |
| `journal`  | A trail journal               | Takes over the mouse wheel and scrolls the page itself, with work on each frame |

## Run them

From the repository root, after `npm run build`:

```bash
APP_VARIANT=good npx playwright test -c demos
```

```bash
APP_VARIANT=bad npx playwright test -c demos
```

The first run records baselines on your machine and the second compares the slow versions with them. The slow runs take about 10 minutes, most of it the invoice search. `demos/server.mjs` serves the apps on http://localhost:4300 if you want to open them yourself.

## Regenerate the docs images

```bash
npm run docs:images
```

This rebuilds the two README GIFs from the journal and feed demos, and `docs/replay-frame.png` and `docs/hero.png` from the test pages. The GIFs need ImageMagick 7 (`magick`).
