import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
const COPILOT_HOME = process.env.COPILOT_HOME ?? join(homedir(), '.copilot');
const CONFIG_FILE = join(COPILOT_HOME, 'plugins', 'copilot-hud', 'config.json');
const COPILOT_SETTINGS_FILE = join(COPILOT_HOME, 'settings.json');
const DEFAULTS = {
    pathLevels: 1,
    gitStatus: {
        enabled: true,
        showDirty: true,
        showAheadBehind: true,
        showFileStats: false,
        showPrefix: true,
        maxBranchLength: 0,
    },
    display: {
        layout: [
            ['model', 'remote', 'project', 'git', 'session', 'duration', 'lines'],
            ['context', 'quota', 'credits', 'tokens', 'speed', 'lastCall'],
        ],
        showTools: true,
        showToolIcons: true,
        showToolTargets: true,
        maxTools: 0,
        showAgents: true,
        maxAgents: 5,
        completedAgentFadeSec: 30,
        showProjectName: true,
        showSessionName: true,
        showSessionDuration: true,
        showTokenBreakdown: true,
        showOutputSpeed: true,
        showPromptPreview: false,
        showLinesChanged: true,
        showEffort: true,
        showCredits: true,
        showContextCounts: true,
        showLastCall: false,
        showCacheBreakdown: false,
        rainbowPath: false,
        abbreviateHome: false,
        showRemote: true,
        barStyle: 'block',
        barWidth: 10,
        separator: '│',
        showQuota: true,
        quotaBucket: '',
        showQuotaCounts: true,
        showQuotaReset: true,
        showQuotaPace: false,
        showQuotaProjection: false,
        fitWidth: true,
        maxWidth: 0,
    },
    thresholds: {
        contextWarn: 70,
        contextCritical: 85,
        quotaWarn: 75,
        quotaCritical: 90,
        paceWarn: 90,
        paceCritical: 100,
        paceMinUsed: 10,
    },
    colors: {
        project: 'yellow',
        git: 'magenta',
        gitBranch: 'cyan',
        tools: 'green',
        success: 'green',
        failure: 'red',
        running: 'yellow',
        denied: 'brightMagenta',
        label: 'dim',
        muted: 'dim',
        header: 'cyan',
        remote: 'brightMagenta',
        credits: 'brightBlue',
        added: 'green',
        removed: 'red',
        agentType: 'cyan',
        prompt: 'cyan',
        contextOk: 'green',
        contextWarn: 'yellow',
        contextCritical: 'red',
        quotaOk: 'brightBlue',
        quotaWarn: 'brightMagenta',
        quotaCritical: 'red',
        paceWarn: 'yellow',
        paceCritical: 'red',
        rainbowPathBg: '189',
    },
};
const MINIMAL = {
    gitStatus: { showAheadBehind: false },
    display: {
        showSessionName: false,
        showSessionDuration: false,
        showTokenBreakdown: false,
        showOutputSpeed: false,
        showLinesChanged: false,
        showCredits: false,
        showTools: false,
        showQuotaCounts: false,
    },
};
/** The looks offered by setup. Standard is the defaults, spelled out as a name. */
export const PRESETS = {
    compact: deepMerge(MINIMAL, {
        display: {
            layout: [['model', 'remote', 'project', 'git', 'context', 'quota']],
            showContextCounts: false,
            barWidth: 5,
        },
    }),
    minimal: MINIMAL,
    standard: {},
    full: {
        pathLevels: 0,
        gitStatus: { showFileStats: true },
        display: {
            abbreviateHome: true,
            maxAgents: 8,
            showLastCall: true,
            showCacheBreakdown: true,
            showPromptPreview: true,
            showQuotaPace: true,
            showQuotaProjection: true,
        },
    },
};
/** Layer a parsed config file over its preset and the defaults. */
export function resolveConfig(parsed) {
    const preset = typeof parsed.preset === 'string' && Object.hasOwn(PRESETS, parsed.preset)
        ? PRESETS[parsed.preset]
        : {};
    return deepMerge(deepMerge(DEFAULTS, preset), parsed);
}
export function loadConfig() {
    if (!existsSync(CONFIG_FILE)) {
        return DEFAULTS;
    }
    try {
        const raw = readFileSync(CONFIG_FILE, 'utf8');
        return resolveConfig(JSON.parse(raw));
    }
    catch {
        return DEFAULTS;
    }
}
export function loadConfiguredEffort() {
    if (!existsSync(COPILOT_SETTINGS_FILE)) {
        return undefined;
    }
    try {
        const parsed = JSON.parse(readFileSync(COPILOT_SETTINGS_FILE, 'utf8'));
        const effort = parsed.effortLevel ?? parsed.reasoningEffort;
        return typeof effort === 'string' ? effort : undefined;
    }
    catch {
        return undefined;
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
