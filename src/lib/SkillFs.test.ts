import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { readSkillFile, listSkillFiles, findSkillPaths, doesPathExist, detectMimeType } from './SkillFs';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

let testDir: string;

beforeAll(() => {
  testDir = join('/tmp', `skillfs-test-${Date.now()}`);
  mkdirSync(join(testDir, 'sub'), { recursive: true });
  writeFileSync(join(testDir, 'sub', 'SKILL.md'), '# Test');
});

afterAll(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe('detectMimeType', () => {
  it('detects JavaScript', () => {
    expect(detectMimeType('script.js')).toBe('text/javascript');
  });

  it('detects Markdown', () => {
    expect(detectMimeType('README.md')).toBe('text/markdown');
  });

  it('detects PNG', () => {
    expect(detectMimeType('image.png')).toBe('image/png');
  });

  it('returns octet-stream for unknown extension', () => {
    expect(detectMimeType('file.zzzzz')).toBe('application/octet-stream');
  });

  it('handles files without extension', () => {
    expect(detectMimeType('Makefile')).toBe('application/octet-stream');
  });
});

describe('doesPathExist', () => {
  it('returns true for existing path', () => {
    expect(doesPathExist('/tmp')).toBeTrue();
  });

  it('returns false for non-existing path', () => {
    expect(doesPathExist('/nonexistent-path-xyz-123')).toBeFalse();
  });
});

describe('readSkillFile', () => {
  it('reads a file with Bun.file', async () => {
    const content = await readSkillFile(import.meta.path);
    expect(content).toBeTruthy();
    expect(typeof content).toBe('string');
  });

  it('throws for nonexistent file', async () => {
    expect(readSkillFile('/nonexistent-file-xyz.md')).rejects.toThrow();
  });
});

describe('findSkillPaths', () => {
  it('scans recursively for SKILL.md files', async () => {
    const paths = await findSkillPaths(testDir);
    expect(paths.length).toBeGreaterThanOrEqual(1);
    expect(paths[0]).toEndWith('SKILL.md');
  });
});

describe('listSkillFiles', () => {
  it('lists files in a subdirectory', () => {
    const files = listSkillFiles(testDir, '');
    expect(Array.isArray(files)).toBeTrue();
    expect(files.length).toBeGreaterThanOrEqual(1);
  });
});
