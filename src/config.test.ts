import { describe, it, expect } from 'bun:test';
import { expandTildePath, resolveBasePath, normalizeBasePaths, getDefaultBasePaths } from './config';
import { homedir } from 'node:os';
import { sep } from 'node:path';

describe('expandTildePath', () => {
  it('expands ~ to home directory', () => {
    expect(expandTildePath('~')).toBe(homedir());
  });

  it('expands ~/ to home directory with path', () => {
    expect(expandTildePath('~/skills')).toBe(`${homedir()}${sep}skills`);
  });

  it('leaves absolute paths unchanged', () => {
    expect(expandTildePath('/usr/local/skills')).toBe('/usr/local/skills');
  });

  it('leaves relative paths unchanged', () => {
    expect(expandTildePath('./skills')).toBe('./skills');
  });
});

describe('resolveBasePath', () => {
  it('resolves absolute path', () => {
    const result = resolveBasePath('/home/user/skills', '/project');
    expect(result).toBe('/home/user/skills');
  });

  it('resolves tilde path', () => {
    const result = resolveBasePath('~/skills', '/project');
    expect(result).toBe(`${homedir()}${sep}skills`);
  });

  it('resolves relative path against project directory', () => {
    const result = resolveBasePath('.opencode/skills', '/project');
    expect(result).toBe('/project/.opencode/skills');
  });

  it('returns empty string for empty path', () => {
    expect(resolveBasePath('', '/project')).toBe('');
  });

  it('normalizes double slashes', () => {
    const result = resolveBasePath('/home//user/skills', '/project');
    expect(result).toBe('/home/user/skills');
  });
});

describe('normalizeBasePaths', () => {
  it('deduplicates paths', () => {
    const result = normalizeBasePaths(
      ['/home/user/skills', '/home/user/skills'],
      '/project'
    );
    expect(result).toHaveLength(1);
  });

  it('resolves all paths', () => {
    const result = normalizeBasePaths(
      ['~/skills', '.opencode/skills'],
      '/project'
    );
    expect(result).toEqual([
      `${homedir()}${sep}skills`,
      '/project/.opencode/skills',
    ]);
  });
});

describe('getDefaultBasePaths', () => {
  it('returns XDG path when env set', () => {
    process.env.XDG_CONFIG_HOME = '/custom/config';
    const paths = getDefaultBasePaths();
    expect(paths).toContain('/custom/config/opencode/skills');
    delete process.env.XDG_CONFIG_HOME;
  });

  it('includes home-based paths', () => {
    const paths = getDefaultBasePaths();
    expect(paths).toContain(`${homedir()}${sep}.config${sep}opencode${sep}skills`);
    expect(paths).toContain(`${homedir()}${sep}.opencode${sep}skills`);
  });
});
