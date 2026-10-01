# Releasing

Two packages are released together at the same version: `smoothness-core` and `playwright-smoothness`. Versions come from [changesets](https://github.com/changesets/changesets), which keeps the two in step (the `fixed` group in `.changeset/config.json`). Publishing is done by the release workflow, `.github/workflows/release.yml`, when a version tag is pushed.

1. Each user-facing change gets a changeset in its pull request. `npx changeset` asks for patch, minor or major and writes a file to `.changeset/`.
2. When it's time to release, `npx changeset version` bumps both `package.json` files and adds the pending changesets to each package's `CHANGELOG.md`. The changelogs can be edited for readability before the version bump is merged to `main`.
3. `npm run release:check` builds both packages and runs `npm publish --dry-run` for each. Each tarball should contain `dist/`, `README.md`, `LICENSE` and `package.json`, and `playwright-smoothness` also `skills/`. The licence, and `playwright-smoothness`'s README, are copied in when the package is packed, with the README's links pointing at GitHub so they work on npmjs.com.
4. Tagging the merged commit on `main` with the version, such as `git tag v1.1.0 && git push origin v1.1.0`, starts the release workflow. It checks the tag matches both packages and is on `main`, runs lint, the type check and the unit tests, and publishes each package that isn't on npm at that version yet, with provenance. It then creates the GitHub release from `playwright-smoothness`'s changelog section, and moves the major tag (`v1`) to the release, which is the tag the GitHub Action is used by.

## npm access

The workflow publishes with npm's trusted publishing, so no npm token is stored in GitHub. Trusted publishing is set up per package on npmjs.com, under the package's settings: the publisher is GitHub Actions, the repository `denodell/playwright-smoothness`, and the workflow `release.yml`.

npm only allows that once a package exists, so the first version of each package is published another way. Either `npm login` and then `npm publish --workspace smoothness-core --access public` followed by the same for `playwright-smoothness`, from the tagged commit, before pushing the tag; or an `NPM_TOKEN` repository secret holding a granular token that can publish both packages, which the workflow uses when it's set. The token can be deleted once trusted publishing is on.

The CI workflows pin Playwright, and so Chromium. The nightly `latest.yml` workflow runs the suite against the newest Playwright, so a change in Chrome's trace format or performance APIs shows up before users hit it.
