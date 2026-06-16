import { tool, ToolContext, type Plugin } from '@opencode-ai/plugin';

import { createApi } from './api';
import { getPluginConfig } from './config';
import { createPromptRenderer } from './lib/createPromptRenderer';
import { findOpencodeVersion, supportsNativeSkill } from './lib/OpencodeVersion';
import { formatSkillContent } from './lib/SkillContentFormat';

/**
 * Decide whether opencode already provides a native `skill` tool (so we should
 * defer to it) or not (so we register our polyfill). Detection is by opencode
 * version read from disk — NOT via `ctx.client.tool.ids()`, which deadlocks at
 * setup time (see lib/OpencodeVersion.ts for why).
 *
 * Escape hatch: OPENCODE_SKILL_POLYFILL=on forces our polyfill on (native
 * treated as absent); =off forces deferring to native. Anything else auto-detects.
 */
const hasNativeSkillTool = (): boolean => {
  const override = (process.env.OPENCODE_SKILL_POLYFILL ?? '').toLowerCase();
  if (override === 'on') return false; // force polyfill → register our `skill`
  if (override === 'off') return true; // force defer → use native `skill`
  return supportsNativeSkill(findOpencodeVersion());
};

// Replaces opencode's token-heavy `<available_skills>` catalog. Skills are
// discovered on demand instead of listed exhaustively. `skill` resolves to
// opencode's native tool when present, or our polyfill otherwise — same name,
// same single-name contract, so this instruction reads correctly either way.
const SKILLS_INSTRUCTION = `<skills>
A skill is a set of reusable, expert instructions for one kind of task — a specific library, tool, workflow, file format, or domain. When a skill covers the task at hand it carries the correct, current way to do it, and proceeding from your own assumptions instead risks a confident but wrong result.

IMPORTANT: When a task has a recognizable specialty — a named library or tool, a defined workflow, a particular format — call \`skillsearch\` first with a few precise keywords for that specialty (e.g. "git commit message", "postgres migration", "pdf form fill"). If a result fits, call \`skill\` with its exact name to load its full instructions, then follow them in preference to your own defaults. For routine work with no such specialty, proceed without searching.
</skills>`;

export const SkillsPlugin: Plugin = async (ctx) => {
  const config = await getPluginConfig(ctx);
  const api = await createApi(config);
  const promptRenderer = createPromptRenderer();

  api.registry.initialise();

  const nativeSkillTool = hasNativeSkillTool();

  return {
    'experimental.chat.system.transform': async (
      _input: { sessionID?: string; model?: unknown },
      output: { system: string[] },
    ) => {
      const text = output.system.join('\n');
      // Strip opencode's native catalog (if present, i.e. opencode >= 1.16.0)...
      const stripped = text.replace(
        /<available_skills>[\s\S]*?<\/available_skills>\s*/g,
        '',
      );
      // ...and ensure our short instruction block is present in its place. This
      // runs in both branches: catalog stripped + instruction added, or (older
      // opencode with no catalog) instruction simply added. Idempotent.
      const next = stripped.includes('<skills>')
        ? stripped
        : `${stripped.replace(/\s+$/, '')}\n\n${SKILLS_INSTRUCTION}\n`;
      if (next !== text) {
        output.system.length = 0;
        output.system.push(next);
      }
    },

    tool: {
      skillsearch: tool({
        description: 'Search for skills using natural query syntax',
        args: {
          query: tool.schema
            .union([tool.schema.string(), tool.schema.array(tool.schema.string())])
            .describe('The search query string or array of strings.'),
        },
        execute: async (args, toolCtx: ToolContext) => {
          const renderer = promptRenderer.getFormatter();
          const results = await api.findSkills(args);
          return renderer({ data: results, type: 'SkillSearchResults' });
        },
      }),

      ...(nativeSkillTool
        ? {}
        : {
            // Polyfill for opencode's native `skill` tool (absent before 1.16.0).
            // Description, args and output are kept identical to native
            // (packages/opencode/src/tool/skill.ts) so the transition is
            // invisible to the model — the skill content is returned as the
            // tool's output, not injected via a side channel. See
            // lib/SkillContentFormat.ts for the shared output shape.
            skill: tool({
              description:
                'Load a specialized skill when the task at hand matches one of the skills available on demand. ' +
                'Use this tool to inject the skill\'s instructions and resources into the current conversation. ' +
                'The output may contain detailed workflow guidance as well as references to scripts, files, etc in the same directory as the skill. ' +
                'Find the exact name first with skillsearch. Hyphens and underscores both resolve to the same skill.',
              args: {
                name: tool.schema
                  .string()
                  .describe('The name of the skill from skillsearch.'),
              },
              execute: async (args, _toolCtx: ToolContext) => {
                const results = await api.loadSkill([args.name]);
                if (results.notFound.length > 0 || results.loaded.length === 0) {
                  throw new Error(`Skill not found: ${args.name}`);
                }
                // Mirror native: one skill, returned inline as the tool output.
                return results.loaded.map((skill) => formatSkillContent(skill!)).join('\n');
              },
            }),
          }),
    },
  };
};

export default SkillsPlugin;
