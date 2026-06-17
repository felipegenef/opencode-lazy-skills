/**
 * SkillInfo Tool - On-demand skill descriptions
 *
 * WHY: `skillsearch` returns only skill NAMES to keep discovery token-cheap.
 * When a name alone isn't enough to decide whether a skill fits, the caller
 * uses `skillinfo` to read the description(s) for one or more named skills
 * WITHOUT loading their full content (which is what `skill` does).
 *
 * This is the "header" payload that `skillsearch` used to return inline:
 * { name, description } per skill — now fetched only when actually needed.
 *
 * RETURN VALUE: Object with:
 * - skills: [{ name, description }] for every requested name that exists
 * - notFound: names that matched no skill
 *
 * @param provider SkillRegistry instance (must be initialized first)
 * @returns Async function callable by OpenCode as the skillinfo tool
 */

import type { SkillRegistry } from '../types';

export function createSkillInfo(provider: SkillRegistry) {
  const registry = provider.controller;

  return async (args: { names: string | string[] }) => {
    await provider.controller.ready.whenReady();

    const names = Array.isArray(args.names) ? args.names : [args.names];

    const skills: { name: string; description: string }[] = [];
    const notFound: string[] = [];

    for (const name of names) {
      const skill = registry.get(name);
      if (skill) {
        skills.push({ name: skill.toolName, description: skill.description });
      } else {
        notFound.push(name);
      }
    }

    return { skills, notFound };
  };
}
