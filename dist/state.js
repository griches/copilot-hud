import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
const COPILOT_HOME = process.env.COPILOT_HOME ?? join(homedir(), '.copilot');
export const STATE_FILE = join(COPILOT_HOME, 'hud-state.json');
export const QUOTA_FILE = join(COPILOT_HOME, 'hud-quota.json');
export const MAX_RECENT_TOOLS = 8;
/**
 * Quota is written by the session extension (extension/extension.mjs), which is
 * the only component that can see it — `assistant.usage` is ephemeral, so quota
 * appears in neither the statusline stdin payload nor the on-disk event log.
 *
 * Returns null when the extension isn't installed, which is the common case for
 * existing users; the renderer simply omits the bar.
 */
export function readQuota() {
    if (!existsSync(QUOTA_FILE)) {
        return null;
    }
    try {
        const parsed = JSON.parse(readFileSync(QUOTA_FILE, 'utf8'));
        if (!Array.isArray(parsed.quotas)) {
            return null;
        }
        return parsed;
    }
    catch {
        return null;
    }
}
export function readState() {
    const empty = { recentTools: [], agents: [], sessionActive: false };
    if (!existsSync(STATE_FILE)) {
        return empty;
    }
    try {
        const raw = readFileSync(STATE_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return {
            ...empty,
            ...parsed,
            recentTools: Array.isArray(parsed.recentTools) ? parsed.recentTools : [],
            agents: Array.isArray(parsed.agents) ? parsed.agents : [],
        };
    }
    catch {
        return empty;
    }
}
export function loadSessionEffort(sessionId) {
    if (!sessionId) {
        return undefined;
    }
    const sessionEventsFile = join(COPILOT_HOME, 'session-state', sessionId, 'events.jsonl');
    if (!existsSync(sessionEventsFile)) {
        return undefined;
    }
    try {
        const lines = readFileSync(sessionEventsFile, 'utf8').trim().split(/\r?\n/).reverse();
        for (const line of lines) {
            const event = JSON.parse(line);
            if ((event.type === 'session.model_change' || event.type === 'session.start')
                && typeof event.data?.reasoningEffort === 'string') {
                return event.data.reasoningEffort;
            }
        }
    }
    catch {
        return undefined;
    }
    return undefined;
}
export function summariseTools(tools) {
    const summary = new Map();
    for (const tool of tools) {
        const key = tool.name;
        const existing = summary.get(key);
        if (existing) {
            existing.count += 1;
            existing.lastStatus = tool.status;
            existing.lastTarget = tool.target;
        }
        else {
            summary.set(key, { count: 1, lastStatus: tool.status, lastTarget: tool.target });
        }
    }
    return summary;
}
