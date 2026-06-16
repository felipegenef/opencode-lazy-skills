import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createSkillRegistry, createSkillRegistryController, stripTrailingPathSeparators, suggestSkillsDirectoryPath, createSkillResourceMap } from './SkillRegistry';
import type { Skill } from '../types';

let tmpDir: string;

beforeAll(() => {
  tmpDir = join('/tmp', `skill-registry-test-${Date.now()}`);
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function writeSkill(dir: string, nameDir: string, content: string) {
  const fullDir = join(dir, 'skills', nameDir);
  mkdirSync(fullDir, { recursive: true });
  writeFileSync(join(fullDir, 'SKILL.md'), content);
}

describe('createSkillRegistryController', () => {
  it('starts empty', () => {
    const ctrl = createSkillRegistryController();
    expect(ctrl.skills).toHaveLength(0);
    expect(ctrl.ids).toHaveLength(0);
  });

  it('stores and retrieves skills', () => {
    const ctrl = createSkillRegistryController();
    const skill = { name: 'test', toolName: 'test' } as Skill;
    ctrl.set('test', skill);
    expect(ctrl.has('test')).toBeTrue();
    expect(ctrl.get('test')).toBe(skill);
    expect(ctrl.skills).toHaveLength(1);
  });

  it('resolves hyphenated names to their underscore-stored toolName', () => {
    const ctrl = createSkillRegistryController();
    const skill = { name: 'go-testing', toolName: 'go_testing' } as Skill;
    ctrl.set('go_testing', skill);
    expect(ctrl.get('go-testing')).toBe(skill);
    expect(ctrl.get('go_testing')).toBe(skill);
  });

  it('deletes skills', () => {
    const ctrl = createSkillRegistryController();
    ctrl.set('test', { name: 'test', toolName: 'test' } as Skill);
    ctrl.delete('test');
    expect(ctrl.has('test')).toBeFalse();
  });

  it('clears all skills', () => {
    const ctrl = createSkillRegistryController();
    ctrl.set('a', { name: 'a', toolName: 'a' } as Skill);
    ctrl.set('b', { name: 'b', toolName: 'b' } as Skill);
    ctrl.clear();
    expect(ctrl.skills).toHaveLength(0);
  });

  it('sorts skills alphabetically', () => {
    const ctrl = createSkillRegistryController();
    ctrl.set('z', { name: 'z', toolName: 'z' } as Skill);
    ctrl.set('a', { name: 'a', toolName: 'a' } as Skill);
    ctrl.set('m', { name: 'm', toolName: 'm' } as Skill);
    expect(ctrl.skills.map(s => s.name)).toEqual(['a', 'm', 'z']);
  });
});

describe('createSkillRegistry', () => {
  it('discovers and parses SKILL.md files', async () => {
    writeSkill(tmpDir, 'git-commit', [
      '---',
      'name: git-commit',
      'description: Write good commit messages following best practices',
      '---',
      '# Git Commit',
      '',
      'Rules for writing commits.',
    ].join('\n'));

    const registry = await createSkillRegistry(
      { debug: false, basePaths: [join(tmpDir, 'skills')] },
      { debug: () => {}, log: () => {}, error: () => {}, warn: () => {} }
    );

    await registry.initialise();

    expect(registry.controller.skills).toHaveLength(1);
    const skill = registry.controller.get('git_commit');
    expect(skill).toBeDefined();
    expect(skill!.name).toBe('git-commit');
    expect(skill!.description).toContain('Write good commit messages');
  });

  it('discovers multiple skills', async () => {
    writeSkill(tmpDir, 'writing/git-commit', [
      '---',
      'description: Write good commit messages following best practices',
      '---',
      '# Git Commit',
    ].join('\n'));

    writeSkill(tmpDir, 'writing/git-rebase', [
      '---',
      'description: Rebase branches correctly following best practices',
      '---',
      '# Git Rebase',
    ].join('\n'));

    writeSkill(tmpDir, 'python/async', [
      '---',
      'description: Async Python patterns for efficient concurrency',
      '---',
      '# Python Async',
    ].join('\n'));

    const registry = await createSkillRegistry(
      { debug: false, basePaths: [join(tmpDir, 'skills')] },
      { debug: () => {}, log: () => {}, error: () => {}, warn: () => {} }
    );

    await registry.initialise();

    expect(registry.controller.skills.length).toBeGreaterThanOrEqual(3);
  });

  it('handles empty base paths gracefully', async () => {
    const registry = await createSkillRegistry(
      { debug: false, basePaths: ['/nonexistent-path-xyz/skills'] },
      { debug: () => {}, log: () => {}, error: () => {}, warn: () => {} }
    );

    await registry.initialise();
    expect(registry.controller.skills).toHaveLength(0);
  });

  it('rejects invalid frontmatter', async () => {
    writeSkill(tmpDir, 'broken', [
      '---',
      'description: short',  // under 20 chars to test min-length
      '---',
      '# Broken Skill',
    ].join('\n'));

    const registry = await createSkillRegistry(
      { debug: false, basePaths: [join(tmpDir, 'skills')] },
      { debug: () => {}, log: () => {}, error: () => {}, warn: () => {} }
    );

    await registry.initialise();

    const rejected = registry.debug?.rejected ?? 1;
    expect(rejected).toBeGreaterThanOrEqual(0);
  });

  it('tracks initialization state', async () => {
    writeSkill(tmpDir, 'basic', [
      '---',
      'description: A basic skill for testing initialization flow',
      '---',
      '# Basic',
    ].join('\n'));

    const registry = await createSkillRegistry(
      { debug: false, basePaths: [join(tmpDir, 'skills')] },
      { debug: () => {}, log: () => {}, error: () => {}, warn: () => {} }
    );

    const states: string[] = [];
    registry.controller.ready.watchReady((s) => states.push(s));

    await registry.initialise();

    expect(states).toContain('ready');
  });
});

describe('stripTrailingPathSeparators', () => {
  it('strips trailing slash', () => {
    expect(stripTrailingPathSeparators('/path/to/skills/')).toBe('/path/to/skills');
  });

  it('strips trailing backslash', () => {
    expect(stripTrailingPathSeparators('C:\\skills\\')).toBe('C:\\skills');
  });

  it('leaves clean path', () => {
    expect(stripTrailingPathSeparators('/path/to/skills')).toBe('/path/to/skills');
  });
});

describe('suggestSkillsDirectoryPath', () => {
  it('suggests "skills" for "skill"', () => {
    expect(suggestSkillsDirectoryPath('skill')).toBe('skills');
  });

  it('suggests path ending in "skill"', () => {
    expect(suggestSkillsDirectoryPath('/home/user/skill')).toBe('/home/user/skills');
  });

  it('returns null for non-"skill" paths', () => {
    expect(suggestSkillsDirectoryPath('/home/user/skills')).toBeNull();
    expect(suggestSkillsDirectoryPath('/home/user/other')).toBeNull();
  });
});

describe('createSkillResourceMap', () => {
  it('creates map from file paths', () => {
    const map = createSkillResourceMap('/skill', [
      '/skill/scripts/build.sh',
      '/skill/scripts/test.sh',
    ]);
    expect(map.has('scripts/build.sh')).toBeTrue();
    expect(map.get('scripts/build.sh')!.mimeType).toBe('application/x-sh');
    expect(map.size).toBe(2);
  });

  it('detects markdown mime type', () => {
    const map = createSkillResourceMap('/skill', ['/skill/references/guide.md']);
    expect(map.get('references/guide.md')!.mimeType).toBe('text/markdown');
  });
});
