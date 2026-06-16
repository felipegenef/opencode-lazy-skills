import type { PluginInput } from '@opencode-ai/plugin';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, normalize, resolve } from 'node:path';
import type { PluginConfig } from './types';

export function getDefaultBasePaths(): string[] {
  const home = homedir();
  const paths: string[] = [];

  const xdgConfig = process.env.XDG_CONFIG_HOME;
  if (xdgConfig) {
    paths.push(join(xdgConfig, 'opencode', 'skills'));
  }

  paths.push(join(home, '.config', 'opencode', 'skills'));
  paths.push(join(home, '.opencode', 'skills'));

  return paths;
}

export function expandTildePath(path: string): string {
  if (path === '~') return homedir();
  if (path.startsWith('~/')) return join(homedir(), path.slice(2));
  return path;
}

export function resolveBasePath(basePath: string, projectDirectory: string): string {
  const trimmedPath = basePath.trim();
  if (!trimmedPath) return '';
  const expandedPath = expandTildePath(trimmedPath);
  if (isAbsolute(expandedPath)) return normalize(expandedPath);
  return resolve(projectDirectory, expandedPath);
}

export function normalizeBasePaths(basePaths: string[], projectDirectory: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const bp of basePaths) {
    const resolved = resolveBasePath(bp, projectDirectory);
    if (!resolved || seen.has(resolved)) continue;
    seen.add(resolved);
    result.push(resolved);
  }
  return result;
}

export async function getPluginConfig(ctx: PluginInput): Promise<PluginConfig> {
  const config: PluginConfig = {
    debug: false,
    basePaths: getDefaultBasePaths(),
  };

  const configPath = join(ctx.directory, '.opencode-skillful.json');
  if (existsSync(configPath)) {
    const userConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
    if (typeof userConfig.debug === 'boolean') config.debug = userConfig.debug;
    if (Array.isArray(userConfig.basePaths)) config.basePaths = userConfig.basePaths;
  }

  config.basePaths = normalizeBasePaths(
    [...config.basePaths, join(ctx.directory, '.opencode', 'skills')],
    ctx.directory,
  );

  return config;
}
