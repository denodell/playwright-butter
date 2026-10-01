// npx playwright-smoothness calibrate [--runs 5] [--out smoothness-calibration.json] [-- <playwright test args>]
// npx playwright-smoothness summary [--results test-results] [--out <file>] [--title <title>] [--github-summary]
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative } from 'node:path';
import {
  CALIBRATE_ENV,
  buildMarkdown,
  calibrate,
  formatCalibration,
  forwardSlashes,
  type ReportEntry,
  type SmoothnessResult,
} from 'smoothness-core';
import { PACKAGE_NAME } from './constants.js';

const HELP = `Usage: npx ${PACKAGE_NAME} <command> [options]

Commands:
  calibrate   How much each check varies between runs, with a suggested maxIncrease
  summary     The Markdown summary of the last run, from its result files

Run a command with --help for its options.
`;

const CALIBRATE_HELP = `Usage: npx ${PACKAGE_NAME} calibrate [options] [-- <playwright test arguments>]

Runs your Playwright suite several times on unchanged code, and prints how much each
smoothness check varies between runs, with a suggested maxIncrease for each.

Options:
  --runs <n>     How many times to run the suite (default 5, at least 2)
  --out <file>   Where to write the results as JSON (default smoothness-calibration.json)
  --help         Show this help

Example:
  npx ${PACKAGE_NAME} calibrate --runs 5 -- --project=chromium tests/lists.spec.ts
`;

function jsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? jsonFiles(p) : p.endsWith('.json') ? [p] : [];
  });
}

function collect(outputDir: string): Map<string, SmoothnessResult> {
  const root = join(outputDir, 'smoothness');
  const results = new Map<string, SmoothnessResult>();
  for (const file of jsonFiles(root)) {
    const id = forwardSlashes(relative(root, file));
    if (/-retry\d+\//.test(id)) continue; // a retry is a different attempt, not another sample
    try {
      const r = JSON.parse(readFileSync(file, 'utf8')) as SmoothnessResult;
      if (r.schemaVersion === 1) results.set(id, r);
    } catch {
      // unreadable file: skipped
    }
  }
  return results;
}

const SUMMARY_HELP = `Usage: npx ${PACKAGE_NAME} summary [options]

Writes the Markdown summary of the last run from its result files, the same summary the
reporter writes, for runs that didn't use the reporter.

Options:
  --results <dir>    Playwright's output directory (default test-results)
  --out <file>       Where to write it (default <results>/smoothness/summary.md)
  --title <title>    The summary's heading (default Smoothness)
  --github-summary   Also add it to the GitHub Actions job summary
  --help             Show this help
`;

export function readResults(results: string): ReportEntry[] {
  const root = join(results, 'smoothness');
  const latest = new Map<string, { retry: number; files: string[] }>();
  for (const file of jsonFiles(root)) {
    const dir = dirname(file);
    const m = /^(.*)-retry(\d+)$/.exec(basename(dir));
    const key = m ? join(dirname(dir), m[1]!) : dir;
    const retry = m ? Number(m[2]) : 0;
    const seen = latest.get(key);
    if (!seen || retry > seen.retry) latest.set(key, { retry, files: [file] });
    else if (retry === seen.retry) seen.files.push(file);
  }
  const entries: ReportEntry[] = [];
  for (const { files } of latest.values()) {
    for (const file of files.sort()) {
      try {
        const r = JSON.parse(readFileSync(file, 'utf8')) as SmoothnessResult;
        if (r.schemaVersion !== 1 || typeof r.label !== 'string') continue;
        entries.push({
          test: r.test?.title ?? basename(dirname(file)),
          file: r.test?.file ?? '',
          project: r.test?.project ?? '',
          result: r,
        });
      } catch {
        continue;
      }
    }
  }
  return entries;
}

function summary(args: string[]): number {
  const { values } = parseArgs({
    args,
    options: {
      results: { type: 'string', default: 'test-results' },
      out: { type: 'string' },
      title: { type: 'string' },
      'github-summary': { type: 'boolean' },
      help: { type: 'boolean' },
    },
  });
  if (values.help) {
    console.log(SUMMARY_HELP);
    return 0;
  }
  const entries = readResults(values.results!);
  const out = values.out ?? join(values.results!, 'smoothness', 'summary.md');
  const md = buildMarkdown(entries, values.title);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, md);
  const jobSummary = process.env.GITHUB_STEP_SUMMARY;
  if (values['github-summary'] && jobSummary) appendFileSync(jobSummary, md + '\n');
  console.log(`Smoothness summary of ${entries.length} result(s): ${out}`);
  return 0;
}

export function main(argv: string[]): number {
  const [command, ...rest] = argv;
  if (!command || command === '--help' || command === '-h') {
    console.log(HELP);
    return command ? 0 : 1;
  }
  if (command === 'summary') return summary(rest);
  if (command !== 'calibrate') {
    console.error(`Unknown command '${command}'.\n\n${HELP}`);
    return 1;
  }
  const dash = rest.indexOf('--');
  const own = dash < 0 ? rest : rest.slice(0, dash);
  const passthrough = dash < 0 ? [] : rest.slice(dash + 1);
  const { values } = parseArgs({
    args: own,
    options: {
      runs: { type: 'string', default: '5' },
      out: { type: 'string', default: 'smoothness-calibration.json' },
      help: { type: 'boolean' },
    },
  });
  if (values.help) {
    console.log(CALIBRATE_HELP);
    return 0;
  }
  const runs = Number(values.runs);
  if (!Number.isInteger(runs) || runs < 2) {
    console.error('--runs must be a whole number, 2 or more.');
    return 1;
  }

  // Playwright's CLI script, from the project being calibrated. It's run with node directly:
  // on Windows, Node won't spawn npx.cmd without a shell.
  let playwrightCli: string;
  try {
    playwrightCli = createRequire(join(process.cwd(), 'package.json')).resolve('@playwright/test/cli');
  } catch {
    console.error("Couldn't find @playwright/test in this project. Run calibrate from the project's folder.");
    return 1;
  }
  const work = mkdtempSync(join(tmpdir(), 'smoothness-calibrate-'));
  const collected: Map<string, SmoothnessResult>[] = [];
  try {
    for (let i = 1; i <= runs; i++) {
      const outputDir = join(work, `run-${i}`);
      console.log(`Run ${i} of ${runs}…`);
      const child = spawnSync(
        process.execPath,
        [playwrightCli, 'test', `--output=${outputDir}`, ...passthrough],
        {
          stdio: ['ignore', 'ignore', 'inherit'],
          env: { ...process.env, [CALIBRATE_ENV]: '1' },
        },
      );
      if (child.error) {
        console.error(`Couldn't run Playwright: ${child.error.message}`);
        return 1;
      }
      const results = collect(outputDir);
      if (child.status !== 0)
        console.warn(`  Run ${i}: some tests failed; their smoothness results are still used.`);
      console.log(`  ${results.size} smoothness result(s)`);
      collected.push(results);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }

  const checks = calibrate(collected);
  console.log('\n' + formatCalibration(checks, runs));
  writeFileSync(
    values.out!,
    JSON.stringify(
      { schemaVersion: 1, kind: `${PACKAGE_NAME}-calibration`, invocations: runs, checks },
      null,
      2,
    ) + '\n',
  );
  console.log(`Written to ${values.out}`);
  return 0;
}
