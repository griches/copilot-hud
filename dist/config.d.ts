export interface HudConfig {
    pathLevels: 0 | 1 | 2 | 3;
    gitStatus: {
        enabled: boolean;
        showDirty: boolean;
        showAheadBehind: boolean;
    };
    display: {
        showTools: boolean;
        showAgents: boolean;
        maxAgents: number;
        showProjectName: boolean;
        showSessionName: boolean;
        showSessionDuration: boolean;
        showTokenBreakdown: boolean;
        showOutputSpeed: boolean;
        showPromptPreview: boolean;
        showLinesChanged: boolean;
        showEffort: boolean;
        showLastCall: boolean;
        showCacheBreakdown: boolean;
        rainbowPath: boolean;
        showRemote: boolean;
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
        rainbowPathBg: string;
    };
}
export declare function loadConfig(): HudConfig;
export declare function saveConfig(config: HudConfig): void;
