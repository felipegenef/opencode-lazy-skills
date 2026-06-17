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

MANDATORY WORKFLOW — follow it for every task before you act:

1. SEARCH FIRST — IT IS THE FIRST STEP OF THE TASK, NOT A CHOICE. Before you write, edit, run, review, evaluate, debug, or explain anything involving a technology, library, tool, file format, or workflow, call \`skillsearch\` with a few precise keywords for it.
   This applies to EVERY kind of request — not just "build X" tasks. Reading, reviewing, evaluating, debugging, and explaining code all count: you need the correct technical context just as much before you analyze something as before you write it. "This is only exploration, not a real task" is NOT an exception — there are no exceptions.
   **Do NOT decide for yourself whether a skill is needed — that judgment is not yours to make here.** You cannot know which skills exist, or whether one overrides your usual approach, until you search; so "I already know how to do this" is never a reason to skip. Your own knowledge may be outdated or wrong for this project, and the search is the only way to find out. It returns only skill NAMES, so it costs almost nothing. The one unacceptable outcome is doing the task the wrong way because the right skill existed and you never looked.
   If you do not yet know which technology is involved (e.g. "what's in this repo?"), explore just enough to identify it, then \`skillsearch\` each technology you find BEFORE acting on it or drawing conclusions. The requirement is continuous, not only at the start: search for technologies named in the request AND for any you discover while working.
   <example>I have to write a PDF file → skillsearch("pdf")</example>
   <example>I have to build a React app with Tailwind CSS → skillsearch("react tailwind css javascript")</example>
   <example>Review/evaluate this code → I read enough to see it uses Postgres and Express → skillsearch("postgres") and skillsearch("express node") BEFORE forming any conclusions</example>
   <example>What's in this repo? → glob/read to learn the stack → it's a Go + SQLite project → skillsearch("go") and skillsearch("sqlite") before evaluating it</example>
   <example>Debug why this test fails → it uses matter.js → skillsearch("matter.js physics") first</example>

2. DECIDE FROM THE NAMES.
   - If a returned name clearly matches the task, load it with \`skill\` (see below).
   - If a name looks relevant but you are not certain it fits, use \`skillinfo\` to read its description before deciding.
   - If nothing returned is relevant, proceed without a skill.

3. CHECK A DESCRIPTION WHEN UNSURE. \`skillinfo\` returns each named skill's one-line description WITHOUT loading its full content. Use it when a name alone is ambiguous — when several names look plausible and you need to pick, or when a name is generic and you cannot tell from it whether the skill covers your case. Pass one name or several at once to compare them. Then confirm the match and load it with \`skill\`, or rule it out. Never load a skill with \`skill\` just to find out what it is — that is what \`skillinfo\` is for.
   <example>I need to fill a PDF form; skillsearch returned "pdf-tools". The name is generic → skillinfo("pdf-tools") → "Extract text from PDFs for analysis." That is reading, not form-filling → do not load.</example>
   <example>I need to fill a PDF form; skillsearch returned "pdf-forms". Unsure if it covers filling → skillinfo("pdf-forms") → "Fill and flatten PDF form fields." Exact match → load it.</example>

4. LOAD AND OBEY. Call \`skill\` with the exact name to load the full instructions, then follow them in preference to your own defaults.

In short: every task — building, reviewing, debugging, exploring, or explaining — begins with \`skillsearch\`, and you search again for any technology you discover along the way. No exceptions.
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
        description:
          'REQUIRED first step before any task: search available skills by keyword. ' +
          'Returns only the NAMES of matching skills (token-cheap). ' +
          'If a name clearly fits, load it with `skill`. If you need a name\'s description ' +
          'before deciding, call `skillinfo` first. Accepts natural query syntax ' +
          '(quoted phrases, -exclusions, multiple terms). Use "*" to list every skill.',
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

      skillinfo: tool({
        description:
          'Get the description(s) for one or more skill names returned by `skillsearch`, ' +
          'WITHOUT loading their full content. Use this when a skill name alone is not ' +
          'enough to decide whether it fits the task. To actually load a skill, use `skill`.',
        args: {
          names: tool.schema
            .union([tool.schema.string(), tool.schema.array(tool.schema.string())])
            .describe('A skill name, or array of names, from skillsearch.'),
        },
        execute: async (args, _toolCtx: ToolContext) => {
          const renderer = promptRenderer.getFormatter();
          const results = await api.skillInfo(args);
          return renderer({ data: results, type: 'SkillInfoResults' });
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
