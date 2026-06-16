import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createSkillRegistry } from '../services/SkillRegistry';
import { createSkillFinder } from './SkillFinder';
import { createSkillLoader } from './SkillUser';

let tmpDir: string;

beforeAll(() => {
  tmpDir = join('/tmp', `tool-test-${Date.now()}`);
  const skillsDir = join(tmpDir, 'skills');
  mkdirSync(join(skillsDir, 'git'), { recursive: true });
  writeFileSync(join(skillsDir, 'git', 'SKILL.md'), [
    '---',
    'description: Write good commit messages following best practices',
    '---',
    '# Git Commit',
  ].join('\n'));

  mkdirSync(join(skillsDir, 'python'), { recursive: true });
  writeFileSync(join(skillsDir, 'python', 'SKILL.md'), [
    '---',
    'description: Async Python patterns for efficient concurrency',
    '---',
    '# Python Async',
  ].join('\n'));
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('createSkillFinder', () => {
  it('searches skills by query', async () => {
    const registry = await createSkillRegistry(
      { debug: false, basePaths: [join(tmpDir, 'skills')] },
      { debug: () => {}, log: () => {}, error: () => {}, warn: () => {} }
    );
    await registry.initialise();

    const finder = createSkillFinder(registry);
    const result = await finder({ query: 'git' });
    expect(result.skills.length).toBeGreaterThanOrEqual(1);
    expect(result.skills[0].description).toContain('commit');
    expect(result.summary.total).toBeGreaterThanOrEqual(2);
  });

  it('returns empty for no match', async () => {
    const registry = await createSkillRegistry(
      { debug: false, basePaths: [join(tmpDir, 'skills')] },
      { debug: () => {}, log: () => {}, error: () => {}, warn: () => {} }
    );
    await registry.initialise();

    const finder = createSkillFinder(registry);
    const result = await finder({ query: 'nonexistent12345' });
    expect(result.skills).toHaveLength(0);
    expect(result.summary.matches).toBe(0);
  });
});

describe('createSkillLoader', () => {
  it('loads existing skills', async () => {
    const registry = await createSkillRegistry(
      { debug: false, basePaths: [join(tmpDir, 'skills')] },
      { debug: () => {}, log: () => {}, error: () => {}, warn: () => {} }
    );
    await registry.initialise();

    const loader = createSkillLoader(registry);
    const result = await loader(['git']);
    expect(result.loaded).toHaveLength(1);
    expect(result.notFound).toHaveLength(0);
    expect(result.loaded[0].name).toBe('git');
  });

  it('reports not found skills', async () => {
    const registry = await createSkillRegistry(
      { debug: false, basePaths: [join(tmpDir, 'skills')] },
      { debug: () => {}, log: () => {}, error: () => {}, warn: () => {} }
    );
    await registry.initialise();

    const loader = createSkillLoader(registry);
    const result = await loader(['nonexistent_skill']);
    expect(result.loaded).toHaveLength(0);
    expect(result.notFound).toEqual(['nonexistent_skill']);
  });

  it('partial load with some found', async () => {
    const registry = await createSkillRegistry(
      { debug: false, basePaths: [join(tmpDir, 'skills')] },
      { debug: () => {}, log: () => {}, error: () => {}, warn: () => {} }
    );
    await registry.initialise();

    const loader = createSkillLoader(registry);
    const result = await loader(['git', 'nonexistent']);
    expect(result.loaded).toHaveLength(1);
    expect(result.notFound).toEqual(['nonexistent']);
  });
});
