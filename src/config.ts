import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

export interface HudConfig {
  pathLevels: 1 | 2 | 3;
  gitStatus: {
    enabled: boolean;
    showDirty: boolean;
    showAheadBehind: boolean;
  };
  display: {
    showTools: boolean;
    showSessionDuration: boolean;
    showPromptPreview: boolean;
  };
  colors: {
    project: string;
    git: string;
    gitBranch: string;
    tools: string;
    success: string;
    failure: string;
    label: string;
    header: string;
  };
}

const COPILOT_HOME = process.env.COPILOT_HOME ?? join(homedir(), '.copilot');
const CONFIG_FILE = join(COPILOT_HOME, 'plugins', 'copilot-hud', 'config.json');

const DEFAULTS: HudConfig = {
  pathLevels: 1,
  gitStatus: {
    enabled: true,
    showDirty: true,
    showAheadBehind: true,
  },
  display: {
    showTools: true,
    showSessionDuration: true,
    showPromptPreview: true,
  },
  colors: {
    project: 'yellow',
    git: 'magenta',
    gitBranch: 'cyan',
    tools: 'green',
    success: 'green',
    failure: 'red',
    label: 'dim',
    header: 'cyan',
  },
};

export function loadConfig(): HudConfig {
  if (!existsSync(CONFIG_FILE)) {
    return DEFAULTS;
  }

  try {
    const raw = readFileSync(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<HudConfig>;
    return deepMerge(DEFAULTS, parsed);
  } catch {
    return DEFAULTS;
  }
}

export function saveConfig(config: HudConfig): void {
  const dir = dirname(CONFIG_FILE);
  mkdirSync(dir, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

function deepMerge<T extends object>(base: T, override: Partial<T>): T {
  const result = { ...base };
  for (const key of Object.keys(override) as Array<keyof T>) {
    const overrideVal = override[key];
    const baseVal = base[key];
    if (overrideVal !== undefined) {
      if (
        typeof overrideVal === 'object' &&
        !Array.isArray(overrideVal) &&
        overrideVal !== null &&
        typeof baseVal === 'object' &&
        !Array.isArray(baseVal) &&
        baseVal !== null
      ) {
        (result[key] as object) = deepMerge(baseVal as object, overrideVal as object);
      } else {
        result[key] = overrideVal as T[keyof T];
      }
    }
  }
  return result;
}
