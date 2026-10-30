import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

export type BarStyle = 'block' | 'shade' | 'dots' | 'line' | 'ascii';

export interface HudConfig {
  /**
   * A named starting point, layered between the defaults and the rest of the
   * file — so any key set alongside it still wins. See `PRESETS`.
   */
  preset?: string;
  pathLevels: 0 | 1 | 2 | 3;
  gitStatus: {
    enabled: boolean;
    showDirty: boolean;
    showAheadBehind: boolean;
    /** Append changed-file counts to the branch: `!3 +1 ✘2 ?4`. */
    showFileStats: boolean;
    /** Wrap the branch in `git:(…)`. Disable to show just `main*`. */
    showPrefix: boolean;
    /** Cut long branch names to this many columns with `…`. `0` never cuts. */
    maxBranchLength: number;
  };
  display: {
    /**
     * Which info segments appear, on which line, in which order. One array per
     * line; a segment left out is hidden. Ids: model, remote, project, git,
     * session, duration, lines, context, quota, credits, tokens, speed, lastCall.
     */
    layout: string[][];
    showTools: boolean;
    /** Show each tool's `✎`-style type icon. Status icons always stay. */
    showToolIcons: boolean;
    /** Show what each tool acted on (`: auth.ts`). Disable when screen sharing. */
    showToolTargets: boolean;
    /** Most tools on the activity line. `0` shows every recent one. */
    maxTools: number;
    showAgents: boolean;
    maxAgents: number;
    /**
     * How long (in seconds) a completed sub-agent stays visible after it
     * finishes. Running agents are always shown. `0` disables fading (legacy
     * behavior: keep completed agents until pushed out by `maxAgents`).
     */
    completedAgentFadeSec: number;
    showProjectName: boolean;
    showSessionName: boolean;
    showSessionDuration: boolean;
    showTokenBreakdown: boolean;
    showOutputSpeed: boolean;
    showPromptPreview: boolean;
    showLinesChanged: boolean;
    showEffort: boolean;
    /**
     * Show the request multiplier (`3x`) in the model badge. Unset follows
     * `showEffort`, which used to control both.
     */
    showMultiplier?: boolean;
    /** Show `Credits 1.42`, the usage of this session alone. */
    showCredits: boolean;
    /** Show `70.0k/200.0k` next to the context percentage. */
    showContextCounts: boolean;
    showLastCall: boolean;
    showCacheBreakdown: boolean;
    rainbowPath: boolean;
    /** With `pathLevels: 0`, write the home directory as `~`. */
    abbreviateHome: boolean;
    showRemote: boolean;
    /** Characters for the context and quota bars. */
    barStyle: BarStyle;
    /** Columns for the context and quota bars. */
    barWidth: number;
    /** Divider between segments, drawn with a space either side. */
    separator: string;
    /** Monthly entitlement bar. Needs the session extension installed. */
    showQuota: boolean;
    /** Entitlement id to draw, e.g. `premium_interactions`. Empty picks the most used. */
    quotaBucket: string;
    /** Append `4770/7500` to the quota bar alongside the percentage. */
    showQuotaCounts: boolean;
    /** Append days remaining until the entitlement resets. */
    showQuotaReset: boolean;
    /**
     * Flag the quota bar with `▲` when usage is on track to run out before the
     * entitlement resets — amber when it would end the month at 90% or more,
     * red when it would hit the limit first.
     */
    showQuotaPace: boolean;
    /** Show where usage is heading by the reset date: `40% →240%`. */
    showQuotaProjection: boolean;
    /**
     * Keep every HUD line within the terminal width, dropping the least
     * important segments rather than letting the line wrap. Disable to get the
     * previous behavior of always drawing everything.
     */
    fitWidth: boolean;
    /**
     * Column budget for `fitWidth`. `0` auto-detects the terminal width; set a
     * positive number to pin it (useful when the terminal can't be probed, or
     * when the HUD shares a split pane).
     */
    maxWidth: number;
  };
  /** Percentages where the bars change color. */
  thresholds: {
    contextWarn: number;
    contextCritical: number;
    quotaWarn: number;
    quotaCritical: number;
    /** Projected usage at the reset date that raises an amber `▲`. */
    paceWarn: number;
    /** Projected usage at the reset date that raises a red `▲`. */
    paceCritical: number;
    /** No projection below this much usage; early on it is mostly noise. */
    paceMinUsed: number;
  };
  colors: {
    project: string;
    git: string;
    gitBranch: string;
    tools: string;
    success: string;
    failure: string;
    running: string;
    denied: string;
    label: string;
    /** Secondary values: session name, duration, token counts, tool targets. */
    muted: string;
    header: string;
    remote: string;
    credits: string;
    added: string;
    removed: string;
    agentType: string;
    prompt: string;
    contextOk: string;
    contextWarn: string;
    contextCritical: string;
    quotaOk: string;
    quotaWarn: string;
    quotaCritical: string;
    paceWarn: string;
    paceCritical: string;
    rainbowPathBg: string;
  };
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends unknown[] ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K] };

const COPILOT_HOME = process.env.COPILOT_HOME ?? join(homedir(), '.copilot');
const CONFIG_FILE = join(COPILOT_HOME, 'plugins', 'copilot-hud', 'config.json');
const COPILOT_SETTINGS_FILE = join(COPILOT_HOME, 'settings.json');

const DEFAULTS: HudConfig = {
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

const MINIMAL: DeepPartial<HudConfig> = {
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
export const PRESETS: Record<string, DeepPartial<HudConfig>> = {
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
export function resolveConfig(parsed: DeepPartial<HudConfig>): HudConfig {
  const preset = typeof parsed.preset === 'string' && Object.hasOwn(PRESETS, parsed.preset)
    ? PRESETS[parsed.preset]
    : {};
  return deepMerge(deepMerge(DEFAULTS, preset as Partial<HudConfig>), parsed as Partial<HudConfig>);
}

export function loadConfig(): HudConfig {
  if (!existsSync(CONFIG_FILE)) {
    return DEFAULTS;
  }

  try {
    const raw = readFileSync(CONFIG_FILE, 'utf8');
    return resolveConfig(JSON.parse(raw) as DeepPartial<HudConfig>);
  } catch {
    return DEFAULTS;
  }
}

export function loadConfiguredEffort(): string | undefined {
  if (!existsSync(COPILOT_SETTINGS_FILE)) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(readFileSync(COPILOT_SETTINGS_FILE, 'utf8')) as {
      effortLevel?: unknown;
      reasoningEffort?: unknown;
    };
    const effort = parsed.effortLevel ?? parsed.reasoningEffort;
    return typeof effort === 'string' ? effort : undefined;
  } catch {
    return undefined;
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
