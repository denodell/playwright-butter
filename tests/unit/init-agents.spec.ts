import { test, expect } from '@playwright/test';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  initAgents,
  skillSource,
  updateAgentsMd,
} from '../../packages/playwright-smoothness/src/init-agents.js';

const SKILL = '.agents/skills/playwright-smoothness/SKILL.md';

test('the shipped skill has the frontmatter agents read, and its recipes link resolves', () => {
  const skill = readFileSync(join(skillSource(), 'SKILL.md'), 'utf8');
  expect(skill).toMatch(/^---\nname: playwright-smoothness\ndescription: .{50,1024}\n---\n/);
  expect(existsSync(join(skillSource(), 'references', 'recipes.md'))).toBe(true);
  expect(skill).toContain('](references/recipes.md)');
});

test('AGENTS.md: created, appended to, and replaced in place on a second run', () => {
  const fresh = updateAgentsMd(null, SKILL);
  expect(fresh).toContain('## Smoothness checks');
  expect(fresh).toContain(SKILL);

  const appended = updateAgentsMd('# Project\n\nUse pnpm.\n', SKILL);
  expect(appended.startsWith('# Project\n\nUse pnpm.\n\n<!-- playwright-smoothness:start -->')).toBe(true);

  const edited = appended.replace('Use pnpm.', 'Use pnpm.\n\nMore notes.') + '\n## Later\n';
  const again = updateAgentsMd(edited, 'skills/playwright-smoothness/SKILL.md');
  expect(again.match(/playwright-smoothness:start/g)).toHaveLength(1);
  expect(again).toContain('skills/playwright-smoothness/SKILL.md');
  expect(again).not.toContain(SKILL);
  expect(again).toContain('More notes.');
  expect(again.endsWith('\n## Later\n')).toBe(true);
});

test('initAgents copies the skill to each folder and replaces an older copy', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'init-agents-'));
  try {
    writeFileSync(join(cwd, 'AGENTS.md'), '# Agents\n');
    const stale = join(cwd, '.claude/skills/playwright-smoothness/old.md');
    initAgents({ cwd });
    writeFileSync(stale, 'from an older version');
    const written = initAgents({ cwd });
    expect(written).toEqual([
      '.claude/skills/playwright-smoothness/',
      '.agents/skills/playwright-smoothness/',
      'AGENTS.md',
    ]);
    for (const dir of ['.claude/skills', '.agents/skills']) {
      expect(existsSync(join(cwd, dir, 'playwright-smoothness/SKILL.md'))).toBe(true);
      expect(existsSync(join(cwd, dir, 'playwright-smoothness/references/recipes.md'))).toBe(true);
    }
    expect(existsSync(stale)).toBe(false);
    const agents = readFileSync(join(cwd, 'AGENTS.md'), 'utf8');
    expect(agents.startsWith('# Agents\n')).toBe(true);
    expect(agents).toContain(SKILL);

    expect(initAgents({ cwd, dirs: ['tools/skills'], agentsMd: false })).toEqual([
      'tools/skills/playwright-smoothness/',
    ]);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
