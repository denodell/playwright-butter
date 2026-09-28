# Releasing

Two packages are released together at the same version: `smoothness-core` and `playwright-smoothness`. Releases use [changesets](https://github.com/changesets/changesets), which keeps the two versions in step (the `fixed` group in `.changeset/config.json`).

1. Each user-facing change gets a changeset in its pull request. `npx changeset` asks for patch, minor or major and writes a file to `.changeset/`.
2. On `main`, `npx changeset version` bumps both `package.json` files and adds the pending changesets to each package's `CHANGELOG.md`. The changelogs can be edited for readability before committing.
3. `npm run release:check` builds both packages and runs `npm publish --dry-run` for each. Each tarball should contain only `dist/`, `README.md`, `LICENSE` and `package.json`. The licence, and `playwright-smoothness`'s README (the repository's README), are copied in when the package is packed.
4. `npm run release` builds both packages and runs `changeset publish`, which publishes each version that isn't on npm yet and creates a git tag for it. It needs an npm login (`npm login`) with publish rights to both packages. `git push --follow-tags` then pushes the tags.
5. A GitHub release is made from the `playwright-smoothness` tag, with its changelog section as the body.

The CI workflows pin Playwright, and so Chromium. The nightly `latest.yml` workflow runs the suite against the newest Playwright, so a change in Chrome's trace format or performance APIs shows up before users hit it.
