// Copies the licence and the package's README into a package folder before `npm pack` or
// `npm publish`. playwright-smoothness gets the repository's README; smoothness-core has its own.
// Run by each package's prepack script: node ../../scripts/copy-package-docs.mjs <package>
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(import.meta.dirname, '..');
const pkg = process.argv[2];
const dir = join(repo, 'packages', pkg);
copyFileSync(join(repo, 'LICENSE'), join(dir, 'LICENSE'));
if (pkg === 'playwright-smoothness') copyFileSync(join(repo, 'README.md'), join(dir, 'README.md'));
