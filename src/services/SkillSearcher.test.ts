import { describe, it, expect } from 'bun:test';
import { parseQuery, rankSkill, shouldIncludeSkill, generateFeedback, createSkillSearcher } from './SkillSearcher';
import type { Skill, SkillRegistryController } from '../types';

function makeSkill(overrides: Partial<Skill>): Skill {
  return {
    name: 'test-skill',
    toolName: 'test_skill',
    description: 'A test skill for testing',
    content: '# Test\n\nContent here',
    fullPath: '/skills/test',
    path: '/skills/test/SKILL.md',
    scripts: new Map(),
    references: new Map(),
    assets: new Map(),
    ...overrides,
  };
}

function makeController(skills: Skill[]): SkillRegistryController {
  const map = new Map<string, Skill>();
  for (const s of skills) {
    map.set(s.toolName, s);
  }
  return {
    ready: null as any,
    get skills() { return Array.from(map.values()); },
    get ids() { return Array.from(map.keys()); },
    delete: (k) => { map.delete(k); },
    clear: () => map.clear(),
    has: (k) => map.has(k),
    get: (k) => map.get(k),
    set: (k, v) => { map.set(k, v); },
  };
}

describe('parseQuery', () => {
  it('parses single term', () => {
    const q = parseQuery('git');
    expect(q.include).toEqual(['git']);
    expect(q.exclude).toEqual([]);
  });

  it('parses multiple terms', () => {
    const q = parseQuery('git commit');
    expect(q.include).toEqual(['git', 'commit']);
  });

  it('parses negated terms', () => {
    const q = parseQuery('git -rebase');
    expect(q.include).toEqual(['git']);
    expect(q.exclude).toEqual(['rebase']);
  });

  it('parses quoted phrases', () => {
    const q = parseQuery('"git rebase"');
    expect(q.include).toEqual(['git rebase']);
  });

  it('handles wildcard', () => {
    const q = parseQuery('*');
    expect(q.include).toEqual(['*']);
  });

  it('handles string array', () => {
    const q = parseQuery(['go', 'testing']);
    expect(q.include).toEqual(['go', 'testing']);
  });

  it('excludes empty strings', () => {
    const q = parseQuery(['']);
    expect(q.include).toEqual([]);
  });
});

describe('rankSkill', () => {
  it('scores name match 3 points', () => {
    const skill = makeSkill({ name: 'git-commit' });
    const rank = rankSkill(skill, ['git']);
    expect(rank.nameMatches).toBe(1);
    expect(rank.totalScore).toBeGreaterThanOrEqual(3);
  });

  it('scores description match 1 point', () => {
    const skill = makeSkill({ name: 'x', description: 'handles git operations' });
    const rank = rankSkill(skill, ['git']);
    expect(rank.descMatches).toBe(1);
    expect(rank.nameMatches).toBe(0);
    expect(rank.totalScore).toBe(1);
  });

  it('gives exact name match bonus of 10', () => {
    const skill = makeSkill({ name: 'git' });
    const rank = rankSkill(skill, ['git']);
    expect(rank.totalScore).toBe(13); // 3 (name) + 10 (exact)
  });

  it('scores multiple terms', () => {
    const skill = makeSkill({ name: 'go-testing', description: 'testing tools for go' });
    const rank = rankSkill(skill, ['go', 'testing']);
    expect(rank.nameMatches).toBe(2);
    expect(rank.totalScore).toBe(6);
  });

  it('returns zero for no matches', () => {
    const skill = makeSkill({ name: 'python' });
    const rank = rankSkill(skill, ['rust']);
    expect(rank.totalScore).toBe(0);
  });
});

describe('shouldIncludeSkill', () => {
  it('includes skill when no exclusions', () => {
    expect(shouldIncludeSkill(makeSkill({}), [])).toBeTrue();
  });

  it('excludes skill matching exclusion term', () => {
    const skill = makeSkill({ name: 'git-rebase', description: 'rebase commits' });
    expect(shouldIncludeSkill(skill, ['rebase'])).toBeFalse();
  });

  it('excludes skill matching exclusion in name', () => {
    const skill = makeSkill({ name: 'python-async' });
    expect(shouldIncludeSkill(skill, ['python'])).toBeFalse();
  });

  it('includes skill not matching exclusion', () => {
    const skill = makeSkill({ name: 'git-commit' });
    expect(shouldIncludeSkill(skill, ['python'])).toBeTrue();
  });
});

describe('generateFeedback', () => {
  it('mentions search terms', () => {
    const query = parseQuery('git commit');
    const fb = generateFeedback(query, 0);
    expect(fb).toContain('git');
    expect(fb).toContain('commit');
  });

  it('mentions exclusion terms', () => {
    const query = parseQuery('git -rebase');
    const fb = generateFeedback(query, 0);
    expect(fb).toContain('rebase');
  });

  it('suggests wildcard on no matches', () => {
    const query = parseQuery('xyznonexistent');
    const fb = generateFeedback(query, 0);
    expect(fb).toContain('*');
  });
});

describe('createSkillSearcher', () => {
  const skills = [
    makeSkill({ name: 'git-commit', toolName: 'git_commit', description: 'Write good commit messages' }),
    makeSkill({ name: 'git-rebase', toolName: 'git_rebase', description: 'Rebase branches' }),
    makeSkill({ name: 'python-async', toolName: 'python_async', description: 'Async Python patterns' }),
    makeSkill({ name: 'docker-compose', toolName: 'docker_compose', description: 'Docker Compose deployment' }),
  ];

  it('lists all skills on wildcard', () => {
    const searcher = createSkillSearcher(makeController(skills));
    const result = searcher('*');
    expect(result.matches).toHaveLength(4);
    expect(result.totalMatches).toBe(4);
  });

  it('filters by search term', () => {
    const searcher = createSkillSearcher(makeController(skills));
    const result = searcher('git');
    expect(result.totalMatches).toBe(2);
    expect(result.matches.map(s => s.name)).toEqual(['git-commit', 'git-rebase']);
  });

  it('matches description content', () => {
    const searcher = createSkillSearcher(makeController(skills));
    const result = searcher('deployment');
    expect(result.totalMatches).toBe(1);
    expect(result.matches[0].name).toBe('docker-compose');
  });

  it('respects exclusion terms', () => {
    const searcher = createSkillSearcher(makeController(skills));
    const result = searcher('git -rebase');
    expect(result.totalMatches).toBe(1);
    expect(result.matches[0].name).toBe('git-commit');
  });

  it('returns empty for no match', () => {
    const searcher = createSkillSearcher(makeController(skills));
    const result = searcher('nonexistent');
    expect(result.totalMatches).toBe(0);
    expect(result.matches).toHaveLength(0);
  });

  it('returns empty when all excluded', () => {
    const searcher = createSkillSearcher(makeController(skills));
    const result = searcher('git -commit -rebase');
    expect(result.totalMatches).toBe(0);
  });

  it('sorts by relevance (exact match first)', () => {
    const searcher = createSkillSearcher(makeController(skills));
    const result = searcher('git-rebase');
    expect(result.matches[0].name).toBe('git-rebase');
  });
});
