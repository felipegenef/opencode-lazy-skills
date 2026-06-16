/**
 * SkillContentFormat - Native-equivalent skill load output
 *
 * WHY: When this plugin polyfills the `skill` tool (on opencode < 1.16.0), the
 * transition to/from a real opencode that ships its own `skill` tool must be
 * invisible to the model. So the polyfill returns the *same* output shape that
 * opencode's native skill tool returns.
 *
 * Native source (packages/opencode/src/tool/skill.ts, since v1.16.0) builds:
 *
 *   <skill_content name="NAME">
 *   # Skill: NAME
 *
 *   {content}
 *
 *   Base directory for this skill: file://...
 *   Relative paths in this skill (e.g., scripts/, reference/) are relative to this base directory.
 *   Note: file list is sampled.
 *
 *   <skill_files>
 *   <file>/abs/path/one</file>
 *   <file>/abs/path/two</file>
 *   </skill_files>
 *   </skill_content>
 *
 * and returns that string as the tool's *output* (not as a side-channel message).
 * Native discovers files with ripgrep over the skill directory (hidden included,
 * SKILL.md excluded) and samples the first 10. We already index a skill's
 * scripts/, references/ and assets/ files at parse time, so we list those —
 * SKILL.md is never among them — and apply the same cap of 10.
 */

import { pathToFileURL } from 'node:url';
import type { Skill, SkillResourceMap } from '../types';

// Matches native opencode's sampled file cap.
const FILE_LIST_LIMIT = 10;

const collectAbsolutePaths = (...maps: SkillResourceMap[]): string[] => {
  const paths: string[] = [];
  for (const map of maps) {
    for (const entry of map.values()) {
      paths.push(entry.absolutePath);
    }
  }
  return paths;
};

/**
 * Render a loaded skill exactly as opencode's native `skill` tool would, so the
 * model cannot tell the polyfill apart from the real thing.
 */
export const formatSkillContent = (skill: Skill): string => {
  const base = pathToFileURL(skill.fullPath).href;

  const files = collectAbsolutePaths(skill.scripts, skill.references, skill.assets)
    .slice(0, FILE_LIST_LIMIT)
    .map((file) => `<file>${file}</file>`)
    .join('\n');

  return [
    `<skill_content name="${skill.name}">`,
    `# Skill: ${skill.name}`,
    '',
    skill.content.trim(),
    '',
    `Base directory for this skill: ${base}`,
    'Relative paths in this skill (e.g., scripts/, reference/) are relative to this base directory.',
    'Note: file list is sampled.',
    '',
    '<skill_files>',
    files,
    '</skill_files>',
    '</skill_content>',
  ].join('\n');
};
