export type SkillResource = {
  relativePath: string;
  absolutePath: string;
  mimeType: string;
};
export type SkillResourceMap = Map<string, Omit<SkillResource, 'relativePath'>>;

export const ResourceTypes = ['script', 'asset', 'reference'] as const;
export type ResourceType = (typeof ResourceTypes)[number];

export const assertIsValidResourceType: (type: string) => asserts type is ResourceType = (type) => {
  if (!ResourceTypes.includes(type as ResourceType)) {
    throw new Error(`Invalid resource type: ${type}`);
  }
};

export type Skill = {
  name: string;
  fullPath: string;
  toolName: string;
  description: string;
  allowedTools?: string[];
  metadata?: Record<string, string>;
  license?: string;
  content: string;
  path: string;
  scripts: SkillResourceMap;
  references: SkillResourceMap;
  assets: SkillResourceMap;
};

export type TextSegment = {
  text: string;
  negated: boolean;
};

export type ParsedSkillQuery = {
  include: string[];
  exclude: string[];
  originalQuery: string[];
  hasExclusions: boolean;
  termCount: number;
};

export type SkillSearchResult = {
  matches: Skill[];
  totalMatches: number;
  totalSkills: number;
  feedback: string;
  query: ParsedSkillQuery;
};

export type SkillRank = {
  skill: Skill;
  nameMatches: number;
  descMatches: number;
  totalScore: number;
};

export type PluginConfig = {
  debug: boolean;
  basePaths: string[];
};

export type LogType = 'log' | 'debug' | 'error' | 'warn';
export type PluginLogger = Record<LogType, (...message: unknown[]) => void>;

export type SkillSearcher = (_query: string | string[]) => SkillSearchResult;

export type SkillRegistryController = {
  ready: ReadyStateMachine;
  skills: Skill[];
  ids: string[];
  clear: () => void;
  delete: (_key: string) => void;
  has: (_key: string) => boolean;
  get: (_key: string) => Skill | undefined;
  set: (_key: string, _skill: Skill) => void;
};

export type SkillRegistryDebugInfo = {
  discovered: number;
  parsed: number;
  rejected: number;
  errors: string[];
};

export type SkillRegistry = {
  initialise: () => Promise<void>;
  config: PluginConfig;
  register: (...skillPaths: string[]) => Promise<SkillRegistryDebugInfo>;
  controller: SkillRegistryController;
  isSkillPath: (_path: string) => boolean;
  getToolnameFromSkillPath: (_path: string) => string | null;
  search: SkillSearcher;
  debug?: SkillRegistryDebugInfo;
  logger: PluginLogger;
};

import { ReadyStateMachine } from './lib/ReadyStateMachine';
