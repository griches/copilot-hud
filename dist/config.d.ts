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
type DeepPartial<T> = {
    [K in keyof T]?: T[K] extends unknown[] ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K];
};
/** The looks offered by setup. Standard is the defaults, spelled out as a name. */
export declare const PRESETS: Record<string, DeepPartial<HudConfig>>;
/** Layer a parsed config file over its preset and the defaults. */
export declare function resolveConfig(parsed: DeepPartial<HudConfig>): HudConfig;
export declare function loadConfig(): HudConfig;
export declare function loadConfiguredEffort(): string | undefined;
export declare function saveConfig(config: HudConfig): void;
export {};
