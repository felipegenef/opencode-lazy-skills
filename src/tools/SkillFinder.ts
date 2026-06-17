/**
 * SkillFinder Tool - Natural Language Skill Discovery
 *
 * WHY: This tool wraps SkillSearcher with ready-state synchronization.
 * Users call skillsearch("git commits") to search for relevant skills.
 * The tool must block until the registry is fully initialized before searching.
 *
 * CRITICAL PATTERN: `await provider.controller.ready.whenReady()`
 * This line ensures that skill discovery has completed before we attempt to
 * search. Without this, early calls would search an empty registry.
 *
 * RETURN VALUE: Object with:
 * - query: original query for user reference
 * - skills: matched skill NAMES only (token-cheap discovery step). To see a
 *   skill's description before committing to load it, the caller follows up
 *   with `skillinfo`; to load it, with `skill`.
 * - summary: metadata (total skills, matches found, feedback message)
 * - debug: registry debug info (only if enabled in config)
 *
 * TOOL REGISTRATION: This factory is called in api.ts like:
 *   findSkills: createSkillFinder(registry)
 * Which returns an async function that OpenCode registers as a tool.
 *
 * FEEDBACK: The feedback message explains the query interpretation to the user:
 *   "Searching for: **git commit** | Found 3 matches"
 *
 * @param provider SkillRegistry instance (must be initialized first)
 * @returns Async function callable by OpenCode as skillsearch tool
 */

import type { SkillRegistry } from '../types';

/**
 * Creates a tool function that searches for skills
 */
export function createSkillFinder(provider: SkillRegistry) {
  return async (args: { query: string | string[] }) => {
    await provider.controller.ready.whenReady();

    const result = provider.search(args.query);

    // Names only — descriptions are fetched on demand via `skillinfo` so the
    // discovery step stays cheap even when many skills match.
    const skills = result.matches.map((skill) => skill.toolName);

    return {
      query: args.query,
      skills,
      summary: {
        total: provider.controller.skills.length,
        matches: result.totalMatches,
        feedback: result.feedback,
      },
      debug: provider.debug,
    };
  };
}
