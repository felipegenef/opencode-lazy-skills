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
│   - skillsearch <topic>  → find skills (names only)     │
│   - skillinfo <name>     → read a skill's description   │
│   - skill <name>         → load its instructions        │
│ </skills>                                               │
└────────────────────────────────────────────────────────┘
The full catalog (and its tokens) is gone; the agent fetches only
the one skill it actually needs, only when it needs it.
```

See [`examples/full-opencode-system-prompt.md`](examples/full-opencode-system-prompt.md) for a real,
complete opencode system prompt — including the full `<available_skills>` catalog that this plugin
strips out (the `BEFORE` block above is an abbreviated version of it).

## What this plugin does

1. **Replaces the catalog with a one-line instruction.** The `<available_skills>` block is
   stripped from the system prompt and replaced with a short note telling the agent that skills
   exist and how to find them on demand. You pay for the skills you actually use, not the whole
   catalog on every turn.
2. **Adds `skillsearch`** — keyword discovery that returns matching skill **names only**, keeping
   the search cheap no matter how many skills match. opencode has no native equivalent.
3. **Adds `skillinfo`** — fetches a skill's description on demand, so the agent can confirm a
   match before paying to load the whole skill.
4. **Provides `skill` only when opencode doesn't.** See below.

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
opencode plugin @felipegenef/opencode-lazy-skills --global
```

## Updating

Opencode resolves this plugin to whatever `latest` was at install time and caches it locally —
it does **not** re-check the registry on later launches. Worse, the cache keeps a pinned
`package.json` + `package-lock.json` (e.g. `"@felipegenef/opencode-lazy-skills": "1.0.0"`), so
even `--force` can see the pin already satisfied and install nothing. The reliable way to pick up
a new release is to **delete the cached folder first, then re-install**:

```bash
rm -rf ~/.cache/opencode/packages/@felipegenef/opencode-lazy-skills@latest
opencode plugin @felipegenef/opencode-lazy-skills --global --force
```

Deleting the folder forces opencode to rebuild the cache from scratch and re-resolve `latest`. To
confirm afterwards, check the installed version:

```bash
cat ~/.cache/opencode/packages/@felipegenef/opencode-lazy-skills@latest/node_modules/@felipegenef/opencode-lazy-skills/package.json | grep version
```

(`--force` on its own only helps when no pinned lockfile is present; without it, opencode skips
re-fetching entirely.)

## Uninstalling

Remove the plugin entry from the `plugin` array in your opencode config
(`~/.config/opencode/opencode.jsonc` for a global install, or `.opencode/opencode.jsonc` for a
project-local one):

```jsonc
{
  "plugin": [
    "@felipegenef/opencode-lazy-skills"  // ← delete this line
  ]
}
```

On the next launch opencode stops loading the plugin and the original `<available_skills>` catalog
is back in the system prompt. To also drop the cached package from disk, delete its folder:

```bash
rm -rf ~/.cache/opencode/packages/@felipegenef/opencode-lazy-skills@latest
```

## Tools

| Tool | What it does | Always available? |
|------|--------------|-------------------|
| `skillsearch` | Search skills by topic — returns matching **names only** (token-cheap) | Yes |
| `skillinfo` | Return the **description(s)** for one or more named skills, without loading them | Yes |
| `skill` | Load a skill's full content into context (and report its base directory + file paths) | Native on ≥1.16.0; polyfill on <1.16.0 |

A typical session:

```
Agent: "I need to write Go tests. Let me find the right skill."
  → skillsearch("go testing")

Plugin returns names only:
   - go-testing
   - go-benchmarking

Agent: "The name fits, but let me confirm before loading."
  → skillinfo("go-testing")

Plugin returns:
   - go-testing: Table-driven tests, subtests, parallel, testdata...

Agent: "That's the one. Load it."
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

## Building

```bash
bun install
bun run build    # produces dist/
bun test
```

## License

MIT
