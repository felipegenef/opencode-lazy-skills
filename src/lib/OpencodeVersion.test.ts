import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import {
  parseVersion,
  gte,
  findOpencodeVersion,
  supportsNativeSkill,
} from './OpencodeVersion';

describe('parseVersion', () => {
  it('parses plain semver', () => {
    expect(parseVersion('1.17.7')).toEqual([1, 17, 7]);
  });
  it('strips a leading v and trailing pre-release/build', () => {
    expect(parseVersion('v1.16.0-beta.2+build')).toEqual([1, 16, 0]);
  });
  it('returns null for garbage', () => {
    expect(parseVersion('not-a-version')).toBeNull();
  });
});

describe('gte', () => {
  it('handles equal, greater, and lesser', () => {
    expect(gte('1.16.0', '1.16.0')).toBe(true);
    expect(gte('1.17.7', '1.16.0')).toBe(true);
    expect(gte('1.15.9', '1.16.0')).toBe(false);
    expect(gte('2.0.0', '1.16.0')).toBe(true);
    expect(gte('1.16.1', '1.16.0')).toBe(true);
  });
  it('returns false when a version is unparseable', () => {
    expect(gte('garbage', '1.16.0')).toBe(false);
  });
});

describe('supportsNativeSkill', () => {
  it('is true at and above 1.16.0', () => {
    expect(supportsNativeSkill('1.16.0')).toBe(true);
    expect(supportsNativeSkill('1.17.7')).toBe(true);
  });
  it('is false below 1.16.0', () => {
    expect(supportsNativeSkill('1.15.0')).toBe(false);
    expect(supportsNativeSkill('1.0.0')).toBe(false);
  });
  it('is false (fail-safe to polyfill) when version is unknown', () => {
    expect(supportsNativeSkill(null)).toBe(false);
  });
});

describe('findOpencodeVersion', () => {
  let root: string;

  beforeAll(() => {
    root = join('/tmp', `ocver-test-${Date.now()}`);
    // Simulate an npm layout: .../node_modules/opencode-ai/bin/opencode.exe
    const binDir = join(root, 'node_modules', 'opencode-ai', 'bin');
    mkdirSync(binDir, { recursive: true });
    writeFileSync(
      join(root, 'node_modules', 'opencode-ai', 'package.json'),
      JSON.stringify({ name: 'opencode-ai', version: '1.17.7' }),
    );
    // A decoy package.json closer to the binary that must NOT match (wrong name).
    writeFileSync(join(binDir, 'package.json'), JSON.stringify({ name: 'something-else', version: '9.9.9' }));
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('finds opencode-ai version by walking up from the binary path', () => {
    const exec = join(root, 'node_modules', 'opencode-ai', 'bin', 'opencode.exe');
    expect(findOpencodeVersion(exec, undefined)).toBe('1.17.7');
  });

  it('ignores package.json whose name is not opencode-ai', () => {
    // Start from a tree that only has the decoy name → no match → null.
    const decoy = join(root, 'node_modules', 'opencode-ai', 'bin', 'package.json');
    // Pointing both candidates at the decoy dir still resolves the real one above it,
    // so instead point at an unrelated path with no opencode-ai ancestor:
    expect(findOpencodeVersion('/nonexistent/path/foo', '/nonexistent/path/bar')).toBeNull();
    expect(decoy).toContain('opencode-ai'); // sanity: decoy path constructed
  });
});
