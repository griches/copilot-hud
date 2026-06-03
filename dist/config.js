import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
const COPILOT_HOME = process.env.COPILOT_HOME ?? join(homedir(), '.copilot');
const CONFIG_FILE = join(COPILOT_HOME, 'plugins', 'copilot-hud', 'config.json');
const DEFAULTS = {
    pathLevels: 1,
    gitStatus: {
        enabled: true,
        showDirty: true,
        showAheadBehind: true,
    },
    display: {
        showTools: true,
        showAgents: true,
        maxAgents: 5,
        showProjectName: true,
        showSessionName: true,
        showSessionDuration: true,
        showTokenBreakdown: true,
        showOutputSpeed: true,
        showPromptPreview: false,
        showLinesChanged: true,
        showEffort: true,
        showLastCall: false,
        showCacheBreakdown: false,
        rainbowPath: false,
        showRemote: true,
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
        rainbowPathBg: '189',
    },
};
export function loadConfig() {
    if (!existsSync(CONFIG_FILE)) {
        return DEFAULTS;
    }
    try {
        const raw = readFileSync(CONFIG_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return deepMerge(DEFAULTS, parsed);
    }
    catch {
        return DEFAULTS;
    }
}
export function saveConfig(config) {
    const dir = dirname(CONFIG_FILE);
    mkdirSync(dir, { recursive: true });
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}
function deepMerge(base, override) {
    const result = { ...base };
    for (const key of Object.keys(override)) {
        const overrideVal = override[key];
        const baseVal = base[key];
        if (overrideVal !== undefined) {
            if (typeof overrideVal === 'object' &&
                !Array.isArray(overrideVal) &&
                overrideVal !== null &&
                typeof baseVal === 'object' &&
                !Array.isArray(baseVal) &&
                baseVal !== null) {
                result[key] = deepMerge(baseVal, overrideVal);
            }
            else {
                result[key] = overrideVal;
            }
        }
    }
    return result;
}
