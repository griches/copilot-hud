import { basename, sep } from 'node:path';
import { colorize, dim, RESET, getContextColor, renderBar, rainbow } from './colors.js';
import { summariseTools } from './state.js';
const TOOL_ICONS = {
    bash: '⌨',
    edit: '✎',
    view: '◉',
    create: '✚',
    glob: '⊛',
    rg: '⊛',
    grep: '⊛',
    task: '⟳',
};
function getToolIcon(name) {
    return TOOL_ICONS[name.toLowerCase()] ?? '◈';
}
function statusIcon(status) {
    switch (status) {
        case 'success': return '✓';
        case 'failure': return '✗';
        case 'running': return '◐';
        case 'denied': return '⊘';
        default: return '·';
    }
}
function formatProjectPath(cwd, levels) {
    if (levels === 0)
        return cwd;
    const parts = cwd.split(sep).filter(Boolean);
    const sliced = parts.slice(-levels);
    return sliced.join('/') || basename(cwd);
}
function formatDuration(ms) {
    const mins = Math.floor(ms / 60000);
    if (mins < 1)
        return '<1m';
    if (mins < 60)
        return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const rem = mins % 60;
    return `${hours}h ${rem}m`;
}
function formatTokens(n) {
    if (n >= 1000000)
        return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000)
        return `${(n / 1000).toFixed(1)}k`;
    return `${n}`;
}
// Build a short display name from a model id like "claude-opus-4.7-1m" -> "opus-4.7-1m".
function shortenModelId(id) {
    return id.replace(/^claude-/i, '').trim();
}
// Parse effort level and multiplier from display_name like "Claude Opus 4.7 (1M context) (10x) (high)".
// The short name is derived from the model id when available, since display_name often contains
// extra qualifiers (e.g. "(1M context)") that make it too long for a status line badge.
function parseModelMeta(id, displayName) {
    const source = displayName ?? id ?? '';
    let multiplier;
    let effort;
    const mxMatch = source.match(/\((\d+x)\)/i);
    if (mxMatch) {
        multiplier = mxMatch[1].toLowerCase();
    }
    const effortMatch = source.match(/\((low|medium|high|default)\)/i);
    if (effortMatch) {
        effort = effortMatch[1].toLowerCase();
    }
    const shortName = id ? shortenModelId(id) : (displayName ?? '').trim();
    return { shortName, multiplier, effort };
}
// Line 1: [Model 3x·high] │ project │ git:(branch*) │ session-name │ ⏱ 5m │ +42/-3
export function renderProjectLine(ctx) {
    const { session, gitStatus, config } = ctx;
    const cwd = session.cwd ?? ctx.state.cwd ?? process.cwd();
    const parts = [];
    // Model badge with optional effort + multiplier
    const meta = parseModelMeta(session.model?.id, session.model?.display_name);
    let modelBadge = meta.shortName || 'Copilot';
    if (config.display.showEffort) {
        if (meta.multiplier)
            modelBadge += ` ${meta.multiplier}`;
        if (meta.effort)
            modelBadge += `·${meta.effort}`;
    }
    parts.push(colorize(`[${modelBadge}]`, config.colors.header));
    // Remote-control indicator — someone is attached to this session via --remote/--connect
    if (config.display.showRemote && session.remote?.connected) {
        parts.push(colorize('◉ remote', 'brightMagenta'));
    }
    // Project path — rainbow gradient or solid color based on config
    if (config.display.showProjectName) {
        const path = formatProjectPath(cwd, config.pathLevels);
        parts.push(config.display.rainbowPath
            ? rainbow(path, config.colors.rainbowPathBg)
            : colorize(path, config.colors.project));
    }
    // Git status
    if (config.gitStatus.enabled && gitStatus) {
        let branchText = gitStatus.branch;
        if (config.gitStatus.showDirty && gitStatus.dirty) {
            branchText += '*';
        }
        if (config.gitStatus.showAheadBehind) {
            if (gitStatus.ahead > 0)
                branchText += ` ↑${gitStatus.ahead}`;
            if (gitStatus.behind > 0)
                branchText += ` ↓${gitStatus.behind}`;
        }
        parts.push(`${colorize('git:(', config.colors.git)}${colorize(branchText, config.colors.gitBranch)}${colorize(')', config.colors.git)}`);
    }
    // Session name
    if (config.display.showSessionName && session.session_name) {
        parts.push(dim(session.session_name));
    }
    // Session duration
    if (config.display.showSessionDuration && session.cost?.total_duration_ms !== undefined) {
        const duration = formatDuration(session.cost.total_duration_ms);
        parts.push(dim(`⏱ ${duration}`));
    }
    // Lines added/removed
    if (config.display.showLinesChanged && session.cost) {
        const added = session.cost.total_lines_added ?? 0;
        const removed = session.cost.total_lines_removed ?? 0;
        if (added > 0 || removed > 0) {
            parts.push(`${colorize(`+${added}`, 'green')}${dim('/')}${colorize(`-${removed}`, 'red')}`);
        }
    }
    return `${RESET}${parts.join(dim(' │ '))}`;
}
// Line 2: Ctx ██░░░░░░░░ 40.0k/200.0k 20% │ Credits 1.42 │ in:1.5M out:12.2k cache:1.5M │ 42 tok/s │ last:76.0k→200
export function renderContextLine(ctx) {
    const { session, config } = ctx;
    const cw = session.context_window;
    const parts = [];
    // Context bar — prefer live current-context fields (populated from render 1),
    // fall back to the cumulative/legacy fields when missing.
    const totalSize = cw?.displayed_context_limit ?? cw?.context_window_size;
    if (totalSize) {
        const pct = cw?.current_context_used_percentage ?? cw?.used_percentage ?? 0;
        const usedTokens = cw?.current_context_tokens
            ?? (cw?.remaining_tokens !== undefined ? totalSize - cw.remaining_tokens : Math.round((pct * totalSize) / 100));
        const bar = renderBar(pct, 10, getContextColor);
        const color = getContextColor(pct);
        parts.push(`${dim('Ctx')} ${bar} ${colorize(`${formatTokens(usedTokens)}/${formatTokens(totalSize)}`, color)} ${colorize(`${pct}%`, color)}`);
    }
    else {
        const bar = renderBar(0, 10, getContextColor);
        parts.push(`${dim('Ctx')} ${bar} ${colorize('0%', getContextColor(0))}`);
    }
    // Credits used this session (Copilot's usage-based billing, surfaced under
    // the top-level `ai_used` field — `formatted` is the display-ready AIU value,
    // e.g. "26.5" where 1 AIU = $0.01 USD). Falls back to the legacy
    // `cost.total_premium_requests` counter on older Copilot CLI builds.
    if (session.ai_used?.formatted !== undefined) {
        parts.push(`${dim('Credits')} ${colorize(session.ai_used.formatted, 'brightBlue')}`);
    }
    else if (session.cost?.total_premium_requests !== undefined) {
        parts.push(`${dim('Reqs')} ${colorize(`${session.cost.total_premium_requests}`, 'brightBlue')}`);
    }
    // Merged token breakdown (in / out / cache)
    if (config.display.showTokenBreakdown && cw) {
        const totalIn = cw.total_input_tokens ?? 0;
        const totalOut = cw.total_output_tokens ?? 0;
        const cacheRead = cw.total_cache_read_tokens ?? cw.current_usage?.cache_read_input_tokens ?? 0;
        const cacheWrite = cw.total_cache_write_tokens ?? cw.current_usage?.cache_creation_input_tokens ?? 0;
        if (totalIn > 0 || totalOut > 0) {
            let tokenInfo = `in:${formatTokens(totalIn)} out:${formatTokens(totalOut)}`;
            if (config.display.showCacheBreakdown && (cacheRead > 0 || cacheWrite > 0)) {
                tokenInfo += ` cache·R:${formatTokens(cacheRead)} W:${formatTokens(cacheWrite)}`;
            }
            else {
                const totalCache = cacheRead + cacheWrite;
                if (totalCache > 0) {
                    tokenInfo += ` cache:${formatTokens(totalCache)}`;
                }
            }
            parts.push(dim(tokenInfo));
        }
    }
    // Output speed (tok/s)
    if (config.display.showOutputSpeed && cw?.total_output_tokens && session.cost?.total_api_duration_ms) {
        const outputTokens = cw.total_output_tokens;
        const apiMs = session.cost.total_api_duration_ms;
        if (apiMs > 0 && outputTokens > 0) {
            const tokPerSec = (outputTokens / apiMs) * 1000;
            parts.push(dim(`${tokPerSec.toFixed(0)} tok/s`));
        }
    }
    // Last call stats
    if (config.display.showLastCall && cw?.last_call_input_tokens !== undefined) {
        const lastIn = cw.last_call_input_tokens;
        const lastOut = cw.last_call_output_tokens ?? 0;
        parts.push(dim(`last:${formatTokens(lastIn)}→${formatTokens(lastOut)}`));
    }
    if (parts.length === 0)
        return null;
    return `${RESET}${parts.join(dim(' │ '))}`;
}
// Line 3: Tool activity
export function renderToolsLine(ctx) {
    const { state, config } = ctx;
    if (!config.display.showTools)
        return null;
    const { recentTools, sessionId: stateSessionId } = state;
    if (recentTools.length === 0)
        return null;
    // Only show tools when state file session matches the current session
    const sessionId = ctx.session.session_id;
    if (!stateSessionId || !sessionId || stateSessionId !== sessionId)
        return null;
    const summary = summariseTools(recentTools);
    const segments = [];
    for (const [toolName, info] of summary.entries()) {
        const icon = getToolIcon(toolName);
        const sIcon = statusIcon(info.lastStatus);
        const colorName = info.lastStatus === 'failure' ? 'red' : info.lastStatus === 'running' ? 'yellow' : 'green';
        const inProgress = info.lastStatus === 'running';
        let part = colorize(`${inProgress ? '◐' : sIcon} ${icon} ${toolName.charAt(0).toUpperCase() + toolName.slice(1)}`, colorName);
        if (info.lastTarget) {
            const isPath = info.lastTarget.startsWith('/') || info.lastTarget.startsWith('.');
            const shortTarget = isPath ? basename(info.lastTarget) : info.lastTarget.slice(0, 30);
            part += dim(`: ${shortTarget}`);
        }
        if (info.count > 1) {
            part += dim(` ×${info.count}`);
        }
        segments.push(part);
    }
    if (segments.length === 0)
        return null;
    return `${RESET}${segments.join(dim(' | '))}`;
}
function formatAgentDuration(startTime, endTime, now) {
    const end = endTime ?? now ?? Date.now();
    const ms = end - startTime;
    const secs = Math.floor(ms / 1000);
    if (secs < 60)
        return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins}m ${remSecs}s`;
}
// Agent activity lines: one line per agent, most recent first
export function renderAgentLines(ctx) {
    const { state, config } = ctx;
    if (!config.display.showAgents)
        return [];
    const agents = state.agents ?? [];
    if (agents.length === 0)
        return [];
    // Only show agents when state file session matches the current session
    const sessionId = ctx.session.session_id;
    if (!state.sessionId || !sessionId || state.sessionId !== sessionId)
        return [];
    const lines = [];
    const max = config.display.maxAgents;
    const fadeSec = config.display.completedAgentFadeSec ?? 0;
    const now = ctx.now;
    // Filter: always keep running agents; keep completed ones only while still
    // within the fade window (fadeSec === 0 disables fading — legacy behavior).
    const visible = agents.filter((a) => {
        if (a.status === 'running')
            return true;
        if (fadeSec <= 0)
            return true;
        if (a.endTime === undefined)
            return true;
        return now - a.endTime < fadeSec * 1000;
    });
    if (visible.length === 0)
        return [];
    // Render most recent agents first (they're appended, so reverse), capped by maxAgents
    const start = Math.max(0, visible.length - max);
    for (let i = visible.length - 1; i >= start; i--) {
        const agent = visible[i];
        const sIcon = agent.status === 'running' ? '◐' : agent.status === 'success' ? '✓' : '✗';
        const color = agent.status === 'running' ? 'yellow' : agent.status === 'success' ? 'green' : 'red';
        const typeLabel = agent.subagentType ? agent.subagentType.toLowerCase() : 'agent';
        const duration = formatAgentDuration(agent.startTime, agent.endTime, ctx.now);
        let line = `${RESET}${colorize(sIcon, color)} ${colorize(`[${typeLabel}]`, 'cyan')} ${agent.description}`;
        if (agent.status === 'running') {
            line += dim(` (${duration}…)`);
        }
        else {
            line += dim(` (${duration})`);
        }
        lines.push(line);
    }
    return lines;
}
export function render(ctx) {
    const lines = [];
    lines.push(renderProjectLine(ctx));
    const contextLine = renderContextLine(ctx);
    if (contextLine) {
        lines.push(contextLine);
    }
    if (ctx.config.display.showTools) {
        const toolsLine = renderToolsLine(ctx);
        if (toolsLine) {
            lines.push(toolsLine);
        }
    }
    if (ctx.config.display.showAgents) {
        const agentLines = renderAgentLines(ctx);
        lines.push(...agentLines);
    }
    for (const line of lines) {
        console.log(line);
    }
}
