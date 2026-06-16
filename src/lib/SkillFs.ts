/**
 * SkillFs - Abstract filesystem access for skills
 *
 * This module encapsulates all filesystem operations related to skill discovery and loading.
 * It provides a mockable interface that works across different Node.js implementations,
 * enabling unit tests to stub filesystem operations without complex mocking libraries.
 *
 * Each function is designed as a pure export to be easily replaced in test environments
 * (e.g., via mocking FS access in test suites).
 */

import { join } from 'node:path';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import mime from 'mime';

// Recursively lists absolute file paths under `dir`, skipping directories that don't exist.
const walkFiles = (dir: string): string[] => {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const results: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
};

export const readSkillFile = async (path: string): Promise<string> => {
  return readFileSync(path, 'utf-8');
};

/**
 * List all files in a skill subdirectory (e.g., scripts/, resources/)
 * Returns a flat array of absolute file paths
 *
 * @param skillPath - Base path to the skill directory
 * @param subdirectory - Subdirectory to scan (e.g., 'scripts', 'resources')
 * @returns Array of absolute file paths
 */
export const listSkillFiles = (skillPath: string, subdirectory: string): string[] => {
  // using cwd in the skillPath, because we should have already
  // confirmed it exists.
  return walkFiles(join(skillPath, subdirectory));
};

export const findSkillPaths = async (basePath: string): Promise<string[]> => {
  return walkFiles(basePath).filter((path) => path.endsWith('SKILL.md'));
};

// purely so we can mock it in tests
export const doesPathExist = (path: string): boolean => {
  return existsSync(path);
};

/**
 * Detect MIME type from file extension
 * Used for skill resources to identify content type
 *
 * @param filePath - Path to the file
 * @returns MIME type string
 */
export const detectMimeType = (filePath: string): string => {
  return mime.getType(filePath) || 'application/octet-stream';
};
