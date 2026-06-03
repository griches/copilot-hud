import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
const COPILOT_HOME = process.env.COPILOT_HOME ?? join(homedir(), '.copilot');
export const STATE_FILE = join(COPILOT_HOME, 'hud-state.json');
export const MAX_RECENT_TOOLS = 8;
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
