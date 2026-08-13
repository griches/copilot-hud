import type { HudState, QuotaState, ToolEntry } from './types.js';
export declare const STATE_FILE: string;
export declare const QUOTA_FILE: string;
export declare const MAX_RECENT_TOOLS = 8;
/**
 * Quota is written by the session extension (extension/extension.mjs), which is
 * the only component that can see it — `assistant.usage` is ephemeral, so quota
 * appears in neither the statusline stdin payload nor the on-disk event log.
 *
 * Returns null when the extension isn't installed, which is the common case for
 * existing users; the renderer simply omits the bar.
 */
export declare function readQuota(): QuotaState | null;
export declare function readState(): HudState;
export declare function loadSessionEffort(sessionId?: string): string | undefined;
export declare function summariseTools(tools: ToolEntry[]): Map<string, {
    count: number;
    lastStatus: ToolEntry['status'];
    lastTarget?: string;
}>;
