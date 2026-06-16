import { describe, it, expect } from 'bun:test';
import { toolName } from './Identifiers';
import { sep } from 'node:path';

describe('toolName', () => {
  it('converts path with SKILL.md to underscore-separated name', () => {
    expect(toolName(`skills${sep}writing${sep}git-commits${sep}SKILL.md`)).toBe('skills_writing_git_commits');
  });

  it('replaces hyphens with underscores', () => {
    expect(toolName(`skills${sep}image-processing${sep}SKILL.md`)).toBe('skills_image_processing');
  });

  it('handles single-level path', () => {
    expect(toolName(`skills${sep}brand-guidelines${sep}SKILL.md`)).toBe('skills_brand_guidelines');
  });

  it('returns empty string for root SKILL.md', () => {
    expect(toolName('SKILL.md')).toBe('');
  });
});
