# Changelog

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
