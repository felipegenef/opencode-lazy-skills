import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { SkillsPlugin } from './index';

let tmpDir: string;

beforeAll(() => {
  tmpDir = join('/tmp', `skillsplugin-test-${Date.now()}`);
  const skillDir = join(tmpDir, '.opencode', 'skills', 'go-testing');
  mkdirSync(join(skillDir, 'scripts'), { recursive: true });
  writeFileSync(join(skillDir, 'SKILL.md'), [
    '---',
    'description: Go testing patterns for table-driven tests and benchmarks',
    '---',
    '# Go Testing',
    '',
    'Run scripts/testutil.go for helpers.',
  ].join('\n'));
  writeFileSync(join(skillDir, 'scripts', 'testutil.go'), 'package main\n');
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

afterEach(() => {
  delete process.env.OPENCODE_SKILL_POLYFILL;
});

// Detection now reads the opencode version from disk (no ctx.client call, which
// would deadlock at setup). The OPENCODE_SKILL_POLYFILL env var is the escape
// hatch we use here to force each branch deterministically.
const makeCtx = () => ({
  directory: tmpDir,
  worktree: tmpDir,
  client: {
    app: { log: async () => ({}) },
    session: { prompt: async () => ({}) },
  },
  project: {},
  $: {},
});

describe('SkillsPlugin native skill tool detection', () => {
  it('defers to native (no own "skill" tool) when override forces native', async () => {
    process.env.OPENCODE_SKILL_POLYFILL = 'off';
    const hooks = await SkillsPlugin(makeCtx() as any);
    expect(hooks.tool).toBeDefined();
    expect(hooks.tool!.skill).toBeUndefined();
    expect(hooks.tool!.skillsearch).toBeDefined();
  });

  it('registers its own "skill" polyfill when override forces polyfill', async () => {
    process.env.OPENCODE_SKILL_POLYFILL = 'on';
    const hooks = await SkillsPlugin(makeCtx() as any);
    expect(hooks.tool!.skill).toBeDefined();
    expect(hooks.tool!.skillsearch).toBeDefined();
    expect(hooks.tool!.skillinfo).toBeDefined();
  });

  it('the polyfill "skill" tool returns native-shaped output inline', async () => {
    process.env.OPENCODE_SKILL_POLYFILL = 'on';
    const hooks = await SkillsPlugin(makeCtx() as any);
    const result = (await hooks.tool!.skill!.execute(
      { name: 'go-testing' },
      { sessionID: 'ses_test', agent: 'build' } as any,
    )) as string;
    // Mirrors opencode's native skill tool output (packages/opencode/src/tool/skill.ts).
    expect(result).toContain('<skill_content name="go-testing">');
    expect(result).toContain('# Skill: go-testing');
    expect(result).toContain('Base directory for this skill: file://');
    expect(result).toContain('<skill_files>');
    expect(result).toContain('<file>');
    expect(result).toContain('scripts/testutil.go');
    expect(result).toContain('</skill_content>');
    // Content must be inline (not a side-channel injection placeholder).
    expect(result).toContain('Run scripts/testutil.go for helpers.');
  });

  it('the polyfill "skill" tool throws a clear error for an unknown name', async () => {
    process.env.OPENCODE_SKILL_POLYFILL = 'on';
    const hooks = await SkillsPlugin(makeCtx() as any);
    await expect(
      hooks.tool!.skill!.execute({ name: 'does-not-exist' }, { sessionID: 'ses_test', agent: 'build' } as any),
    ).rejects.toThrow('Skill not found');
  });
});

describe('SkillsPlugin system prompt transform', () => {
  const transform = async (system: string[]) => {
    const hooks = await SkillsPlugin(makeCtx() as any);
    const output = { system };
    await (hooks as any)['experimental.chat.system.transform']({}, output);
    return output.system.join('\n');
  };

  it('strips the native <available_skills> catalog and injects our instruction', async () => {
    const result = await transform([
      'You are opencode.',
      '<available_skills>\n  <skill name="go-testing" description="x" />\n</available_skills>',
    ]);
    expect(result).not.toContain('<available_skills>');
    expect(result).toContain('<skills>');
    expect(result).toContain('skillsearch');
    expect(result).toContain('You are opencode.');
  });

  it('injects the instruction even when there is no native catalog (older opencode)', async () => {
    const result = await transform(['You are opencode.']);
    expect(result).toContain('<skills>');
    expect(result).toContain('skillsearch');
  });

  it('is idempotent — does not inject the instruction twice', async () => {
    const once = await transform(['You are opencode.']);
    const twice = await transform([once]);
    const occurrences = twice.split('<skills>').length - 1;
    expect(occurrences).toBe(1);
  });
});
