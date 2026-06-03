import type { HudState, ToolEntry } from './types.js';
export declare const STATE_FILE: string;
export declare const MAX_RECENT_TOOLS = 8;
export declare function readState(): HudState;
export declare function summariseTools(tools: ToolEntry[]): Map<string, {
    count: number;
    lastStatus: ToolEntry['status'];
    lastTarget?: string;
}>;
