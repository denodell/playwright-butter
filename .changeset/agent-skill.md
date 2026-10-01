---
'playwright-smoothness': minor
'smoothness-core': minor
---

`npx playwright-smoothness init-agents` adds a skill that teaches coding agents to fix what the checks find: how to read a fix brief, recipes for the usual causes (forced layout, work on every scroll event or animation frame, scripted scrolling, re-rendering every component, slow rows in a virtualized list, drags that redraw everything, long tasks), and how to prove a fix on the agent's own machine without loosening the check. It's written to `.claude/skills/` and `.agents/skills/`, with a pointer in `AGENTS.md`, and ships in the package under `skills/playwright-smoothness/`, the layout TanStack Intent and skills-npm look for.

Fix briefs no longer list scripts with no source, such as the library's own measuring code.
