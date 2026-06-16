# opencode-lazy-skills

> Lazy-loads opencode skills: swaps the always-on `<available_skills>` catalog for on-demand
> skill search and loading, so you pay for the skills you actually use — not the whole catalog
> on every turn.
>
> - **Optimized token usage** — skills are discovered on demand instead of listed on every turn.
> - **Works alongside opencode's native `skill` tool** rather than replacing it.
> - **Brings the skill feature to older opencode versions** that don't ship the native tool.

## The problem

Opencode injects an `<available_skills>` catalog into **every** agent's system prompt,
listing every installed skill's name and description — on every request, whether the agent
needs a skill or not. With a large skill collection that is a lot of tokens, burned before
the agent has done anything.

```
BEFORE (without plugin) ── every system prompt includes:
┌────────────────────────────────────────────────────────┐
│ You are opencode, an interactive CLI tool...            │
│ # Tone and style...                                     │
│ # Proactiveness...                                      │
│ # Doing tasks...                                        │
│ <available_skills>                                      │
│   <skill name="recipe-coffee"... />                     │
│   <skill name="chess-openings"... />                    │
│   <skill name="bicycle-maintenance"... />               │
│   <!-- ... many many tokens that go to waste ... -->    │
│ </available_skills>                                     │
└────────────────────────────────────────────────────────┘

AFTER (with plugin) ── catalog replaced by a short on-demand note:
┌────────────────────────────────────────────────────────┐
│ You are opencode, an interactive CLI tool...            │
│ # Tone and style...                                     │
│ # Proactiveness...                                      │
│ # Doing tasks...                                        │
│ <skills>                                                │
│   Specialized skills are available on demand.           │
│   - skillsearch <topic>  → find a skill                 │
│   - skill <name>         → load its instructions        │
│ </skills>                                               │
└────────────────────────────────────────────────────────┘
The full catalog (and its tokens) is gone; the agent fetches only
the one skill it actually needs, only when it needs it.
```

## What this plugin does

1. **Replaces the catalog with a one-line instruction.** The `<available_skills>` block is
   stripped from the system prompt and replaced with a short note telling the agent that skills
   exist and how to find them on demand. You pay for the skills you actually use, not the whole
   catalog on every turn.
2. **Adds `skillsearch`** — search/discovery, which opencode has no native equivalent for.
3. **Provides `skill` only when opencode doesn't.** See below.

## Works *with* opencode's native skill tool

Since v1.16.0, opencode ships its own `skill` tool. This plugin detects that and gets out of
its way:

| Your opencode version | Loading a skill | Why |
|-----------------------|-----------------|-----|
| **≥ 1.16.0** | opencode's **native** `skill` tool | It already exists and discovers skills from more locations (including `~/.claude/skills` and skill URLs). We defer to it. |
| **< 1.16.0** | this plugin's **`skill` polyfill** | No native tool exists, so we register one whose name, arguments **and output are matched to native's** (inline `<skill_content>` with the skill's base directory and file list). Upgrading opencode later changes nothing you can see. |

Either way, `skillsearch` is always provided, and the catalog-replacement instruction refers to
`skill` — which resolves to whichever tool is active. A loaded skill reports its base directory
and file paths, so any resource files (`scripts/`, `assets/`, `references/`) are read with
opencode's normal file-read tool — exactly as the native `skill` tool intends.

### Which tool you get

Detection is automatic — it reads your installed opencode version and uses the native `skill`
tool from 1.16.0 onward, the polyfill below it. You don't need to configure anything. If your
version can't be determined, it falls back to the polyfill, which is always safe.

To force a branch, set an environment variable:

```bash
OPENCODE_SKILL_POLYFILL=off   # always defer to opencode's native skill tool
OPENCODE_SKILL_POLYFILL=on    # always use this plugin's skill polyfill
```

## Install

```bash
opencode plugin opencode-lazy-skills --global
```

## Updating

Opencode resolves this plugin to whatever `latest` was at install time and caches it locally —
it does **not** re-check the registry on later launches. To pick up a new release, force a
re-fetch:

```bash
opencode plugin opencode-lazy-skills --global --force
```

Without `--force`, opencode sees the plugin is already configured and skips re-fetching, even if
a newer version has been published.

## Tools

| Tool | What it does | Always available? |
|------|--------------|-------------------|
| `skillsearch` | Search skills by topic (returns name + description) | Yes |
| `skill` | Load a skill's full content into context (and report its base directory + file paths) | Native on ≥1.16.0; polyfill on <1.16.0 |

A typical session:

```
Agent: "I need to write Go tests. Let me find the right skill."
  → skillsearch("go testing")

Plugin returns:
   - go-testing: Table-driven tests, subtests, parallel, testdata...
   - go-benchmarking: Benchmarks, fuzzing

Agent: "Load the main testing skill."
  → skill({ name: "go-testing" })

The skill's full content is now in context, along with its base
directory and the paths of any bundled files.

Agent: "Grab the test helper script that skill mentioned."
  → read("/path/to/go-testing/scripts/testutil.go")   (opencode's built-in read tool)
```

## Skills directory

Place `SKILL.md` files in:

- `~/.config/opencode/skills/` — global
- `.opencode/skills/` — project-local (takes priority)

## Configuration

By default, the plugin discovers skills from these directories (in order):

| Priority | Path |
|----------|------|
| 1st | `$XDG_CONFIG_HOME/opencode/skills/` (if set) |
| 2nd | `~/.config/opencode/skills/` |
| 3rd | `~/.opencode/skills/` |
| 4th | `.opencode/skills/` (project-local, always appended) |

To override, create `.opencode-skillful.json` in your project root:

```json
{
  "debug": false,
  "basePaths": ["~/.config/opencode/skills", ".opencode/skills"]
}
```

See [`examples/full-opencode-system-prompt.md`](examples/full-opencode-system-prompt.md) for the
full opencode system prompt, including the `<available_skills>` catalog this plugin replaces.

## Building

```bash
bun install
bun run build    # produces dist/
bun test
```

## License

MIT
