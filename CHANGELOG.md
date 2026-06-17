# Changelog

## 1.3.0 — 2026-06-17

Makes the search instruction cover non-build tasks and technologies discovered mid-task.

- **Prompt covers non-build tasks and discovered technologies.** Agents were skipping `skillsearch`
  on "exploration"/review/debug requests because every example demonstrated a build task. The
  instruction now explicitly requires searching before reviewing, evaluating, debugging, or
  explaining too, and requires searching again for any technology discovered mid-task (not only
  ones named up front) — with examples for each (review, repo exploration, debugging).

## 1.2.0 — 2026-06-17

Fixes the search algorithm so descriptive, multi-keyword queries actually return results.

- **`skillsearch` now matches ANY query term (OR), not ALL of them (AND).** Previously every
  word in the query had to appear in a skill, so a query like
  `"nodejs static file server express project structure"` returned ZERO matches even when an
  obviously relevant skill existed — the more precisely the agent searched, the worse it matched.
  This directly conflicted with the v1.1.0 prompt that tells the agent to search with several
  keywords. Skills are now ranked by how many terms hit (name matches weighted 3×) and the best
  candidates float to the top.
- **Results are capped to the top 6** for keyword queries so OR-matching doesn't flood the caller;
  the wildcard list-all (`*`) query is never capped. Feedback notes when results were trimmed.
- **Exclusion-only queries work again** (e.g. `-rebase` = "everything except rebase"). The AND→OR
  switch had made an empty include-list match nothing; a query with no positive terms now browses
  all skills with exclusions applied.

## 1.1.0 — 2026-06-16

Reworks skill discovery into a three-step, compulsory workflow so agents (and subagents) reliably
look for skills before acting, while keeping the discovery step token-cheap.

- **`skillsearch` now returns matching skill NAMES only**, not name + description. Discovery stays
  cheap no matter how many skills match; descriptions are fetched only when actually needed.
- **New `skillinfo` tool** returns the description(s) for one or more named skills without loading
  them. The agent confirms a match before paying to load the full skill content.
- **The system-prompt instruction is now an emphatic, mandatory workflow**: search by keywords
  first on every task → decide from the names → `skillinfo` if unsure → `skill` to load and obey.
  This addresses agents/subagents skipping skill discovery and relying on their own assumptions.
- **Fixed a latent `jsonToXml` bug** where primitive array items (e.g. skill names) were rendered
  character-by-character instead of as whole values.

## 1.0.0 — 2026-06-16

First release of **`opencode-lazy-skills`** — a token-saving plugin that replaces opencode's
always-on `<available_skills>` catalog with on-demand skill search and loading, working
alongside opencode's native skill tool rather than replacing it.

What's in this release:

- **Works alongside opencode's native `skill` tool instead of shadowing it.** On opencode
  >= 1.16.0 (which ships a native `skill` tool), the plugin defers to it. On older opencode
  it registers a `skill` polyfill whose name, argument and **output are matched to native's**
  (`<skill_content>` wrapper, base-directory `file://` URL, and sampled `<skill_files>` list,
  returned inline as the tool output) so loading a skill is byte-for-byte identical either way.
- **Version detection reads from disk, never from the server.** A plugin cannot call back into
  the opencode server during setup — the call deadlocks bootstrap. Detection now reads the
  opencode version from `opencode-ai`'s `package.json` on disk. Override with
  `OPENCODE_SKILL_POLYFILL=on|off` if needed.
- **The stripped `<available_skills>` catalog is replaced with a short instruction**, not left
  empty. Removing the catalog without a replacement left the native `skill` tool with nothing to
  read; the new instruction tells the agent to discover skills via `skillsearch` and load them
  via `skill`.
- **Tools renamed to match opencode's lowercase, no-separator convention:**
  `skill_find` → `skillsearch`, `skill_use` → `skill` (the conditional polyfill above).
- **Removed the `skill_resource` / resource-reader tool.** A loaded skill now reports its base
  directory and bundled file paths (matching native opencode), so resource files are read with
  opencode's normal file-read tool instead of a dedicated plugin tool — one less always-on tool
  in the prompt, and identical to how the native `skill` tool works.

Also included: cross-runtime compatibility (Bun CLI + Node-based Desktop sidecar),
hyphen/underscore-insensitive skill lookup, and the core `<available_skills>` token savings.
