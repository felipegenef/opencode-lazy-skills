/**
 * Opencode version detection — used to decide whether to register our own
 * `skill` polyfill tool or defer to opencode's native one.
 *
 * WHY NOT `ctx.client.tool.ids()`: that was the original detection idea, but it
 * is an HTTP call to the opencode server, and plugin setup is awaited
 * synchronously DURING server bootstrap. The server cannot answer the request
 * until bootstrap finishes, and bootstrap cannot finish until setup returns —
 * a circular deadlock. Any `ctx.client.*` call at setup time hangs forever (it
 * does not throw, so a try/catch around it does not help). Verified empirically.
 *
 * So we detect the version WITHOUT touching the server: opencode ships as the
 * npm package `opencode-ai`, so its `package.json` (carrying the version) sits
 * on disk next to the running binary. We read it synchronously. We verify
 * `name === "opencode-ai"` so we never mistake some other package.json for it.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Native skill discovery + the built-in `skill` tool landed in opencode 1.16.0.
export const NATIVE_SKILL_MIN_VERSION = '1.16.0';

export function parseVersion(version: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version.trim().replace(/^v/, ''));
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function gte(a: string, b: string): boolean {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return false;
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return true;
    if (pa[i] < pb[i]) return false;
  }
  return true; // equal
}

// Walk up from a file path, returning the version of the first package.json
// whose name is exactly "opencode-ai". The name check prevents matching this
// plugin's own package.json (or any other) when running from inside node_modules.
function versionFromPackageJson(startPath: string): string | null {
  let dir = dirname(startPath);
  for (let i = 0; i < 6; i++) {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        if (pkg && pkg.name === 'opencode-ai' && typeof pkg.version === 'string') {
          return pkg.version;
        }
      } catch {
        // unreadable/malformed package.json — keep walking up
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * Best-effort opencode version, or null if it can't be determined.
 * Tries the running binary path first, then the entry script path.
 */
export function findOpencodeVersion(
  execPath: string = process.execPath,
  argv1: string | undefined = process.argv[1],
): string | null {
  for (const start of [execPath, argv1].filter((p): p is string => Boolean(p))) {
    const version = versionFromPackageJson(start);
    if (version) return version;
  }
  return null;
}

/**
 * Whether the running opencode provides a native `skill` tool.
 *
 * Unknown version (detection failed) returns FALSE on purpose: registering our
 * polyfill when native already exists merely overrides it cleanly (a no-harm
 * redundancy — a plugin tool named `skill` cleanly shadows the native one),
 * whereas NOT registering it when native is absent leaves skill-loading broken.
 * So we fail toward polyfill.
 */
export function supportsNativeSkill(version: string | null): boolean {
  if (!version) return false;
  return gte(version, NATIVE_SKILL_MIN_VERSION);
}
