import { sep } from 'node:path';

export function toolName(skillPath: string): string {
  return skillPath
    .replace(/SKILL\.md$/, '')
    .split(sep)
    .filter(Boolean)
    .join('_')
    .replace(/-/g, '_');
}
