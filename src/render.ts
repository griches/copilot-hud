import { basename, sep } from 'node:path';
import { colorize, dim, RESET, getContextColor, renderBar } from './colors.js';
import { summariseTools } from './state.js';
import { getModelPricing, estimateCost, formatCost } from './pricing.js';
import type { RenderContext } from './types.js';

const TOOL_ICONS: Record<string, string> = {
  bash: '⌨',
  edit: '✎',
  view: '◉',
  create: '✚',
  glob: '⊛',
  rg: '⊛',
  grep: '⊛',
  task: '⟳',
};

function getToolIcon(name: string): string {
  return TOOL_ICONS[name.toLowerCase()] ?? '◈';
}

function statusIcon(status: string): string {
  switch (status) {
    case 'success': return '✓';
    case 'failure': return '✗';
    case 'running': return '◐';
    case 'denied': return '⊘';
    default: return '·';
  }
}

function formatProjectPath(cwd: string, levels: 0 | 1 | 2 | 3): string {
  if (levels === 0) return cwd;
  const parts = cwd.split(sep).filter(Boolean);
  const sliced = parts.slice(-levels);
  return sliced.join('/') || basename(cwd);
}

function formatDuration(ms: number): string {
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hours}h${rem}m`;
}

function formatTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
}

/** Parse effort level and multiplier from display_name like "claude-opus-4.6 (3x) (high)" */
function parseModelMeta(displayName: string): { shortName: string; multiplier?: string; effort?: string } {
  let name = displayName;
  let multiplier: string | undefined;
  let effort: string | undefined;

  const mxMatch = name.match(/\((\d+x)\)/);
  if (mxMatch) {
    multiplier = mxMatch[1];
    name = name.replace(mxMatch[0], '').trim();
  }

  const effortMatch = name.match(/\((low|medium|high|default)\)/i);
  if (effortMatch) {
    effort = effortMatch[1];
    name = name.replace(effortMatch[0], '').trim();
  }

  const shortName = name
    .replace(/^claude-/i, '')
    .replace(/^(opus|sonnet|haiku)/i, (m) => m.charAt(0).toUpperCase() + m.slice(1))
    .replace(/-/g, ' ')
    .trim();

  return { shortName, multiplier, effort };
}

// Line 1: [Model (3x)(high)] │ project │ git:(branch*) │ session-name │ ⏱ 5m │ +42/-3
export function renderProjectLine(ctx: RenderContext): string {
  const { session, gitStatus, config } = ctx;
  const cwd = session.cwd ?? ctx.state.cwd ?? process.cwd();
  const parts: string[] = [];

  // Model badge with effort + multiplier
  const displayName = session.model?.display_name ?? session.model?.id ?? 'Copilot';
  const meta = parseModelMeta(displayName);
  let modelBadge = meta.shortName;
  if (config.display.showEffort) {
    if (meta.multiplier) modelBadge += ` ${meta.multiplier}`;
    if (meta.effort) modelBadge += `·${meta.effort}`;
  }
  parts.push(colorize(`[${modelBadge}]`, config.colors.header));

  // Project path
  const path = formatProjectPath(cwd, config.pathLevels);
  parts.push(colorize(path, config.colors.project));

  // Git status
  if (config.gitStatus.enabled && gitStatus) {
    let branchText = gitStatus.branch;
    if (config.gitStatus.showDirty && gitStatus.dirty) {
      branchText += '*';
    }
    if (config.gitStatus.showAheadBehind) {
      if (gitStatus.ahead > 0) branchText += ` ↑${gitStatus.ahead}`;
      if (gitStatus.behind > 0) branchText += ` ↓${gitStatus.behind}`;
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

// Line 2: Context ██░░░░░░░░ 40.0k/200.0k 20% │ Reqs 3 │ in: 1.5M out: 12.2k │ cache R:1.5M W:0 │ 42.1 tok/s │ last: 76.0k→200
export function renderContextLine(ctx: RenderContext): string | null {
  const { session, config } = ctx;
  const cw = session.context_window;
  const parts: string[] = [];

  // Context bar with exact tokens: ██░░░░░░░░ 40.0k/200.0k 20%
  if (cw?.context_window_size) {
    const pct = cw.used_percentage ?? 0;
    const totalSize = cw.context_window_size;
    const usedTokens = cw.remaining_tokens !== undefined
      ? totalSize - cw.remaining_tokens
      : Math.round(pct * totalSize / 100);
    const bar = renderBar(pct, 10, getContextColor);
    const color = getContextColor(pct);
    parts.push(`${dim('Ctx')} ${bar} ${colorize(`${formatTokens(usedTokens)}/${formatTokens(totalSize)}`, color)} ${colorize(`${pct}%`, color)}`);
  } else {
    const bar = renderBar(0, 10, getContextColor);
    parts.push(`${dim('Ctx')} ${bar} ${colorize('0%', getContextColor(0))}`);
  }

  // Premium requests
  if (session.cost?.total_premium_requests !== undefined) {
    parts.push(`${dim('Reqs')} ${colorize(`${session.cost.total_premium_requests}`, 'brightBlue')}`);
  }

  // Cumulative in/out + cache as one segment
  if (config.display.showTokenBreakdown && cw) {
    const totalIn = cw.total_input_tokens ?? 0;
    const totalOut = cw.total_output_tokens ?? 0;
    const cacheRead = cw.total_cache_read_tokens ?? cw.current_usage?.cache_read_input_tokens ?? 0;
    const cacheWrite = cw.total_cache_write_tokens ?? cw.current_usage?.cache_creation_input_tokens ?? 0;

    if (totalIn > 0 || totalOut > 0) {
      let tokenInfo = `in:${formatTokens(totalIn)} out:${formatTokens(totalOut)}`;
      if (config.display.showCacheBreakdown && (cacheRead > 0 || cacheWrite > 0)) {
        tokenInfo += ` cache·R:${formatTokens(cacheRead)} W:${formatTokens(cacheWrite)}`;
      } else {
        const totalCache = cacheRead + cacheWrite;
        if (totalCache > 0) {
          tokenInfo += ` cache:${formatTokens(totalCache)}`;
        }
      }
      parts.push(dim(tokenInfo));
    }
  }

  // Estimated API cost (right after token breakdown)
  if (config.display.showCost && cw && session.model?.id) {
    const pricing = getModelPricing(session.model.id, config.pricing);
    if (pricing) {
      const totalIn = cw.total_input_tokens ?? 0;
      const totalOut = cw.total_output_tokens ?? 0;
      const cacheRead = cw.total_cache_read_tokens ?? cw.current_usage?.cache_read_input_tokens ?? 0;
      const cost = estimateCost(pricing, totalIn, totalOut, cacheRead);
      if (cost > 0) {
        const costColor = cost >= 5 ? 'red' : cost >= 1 ? 'yellow' : 'green';
        parts.push(colorize(formatCost(cost), costColor));
      }
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

  if (parts.length === 0) return null;
  return `${RESET}${parts.join(dim(' │ '))}`;
}

// Line 3: Tool activity
export function renderToolsLine(ctx: RenderContext): string | null {
  const { state, config } = ctx;
  if (!config.display.showTools) return null;

  const { recentTools, sessionId: stateSessionId } = state;
  if (recentTools.length === 0) return null;

  // Only show tools when state file session matches the current session
  const sessionId = ctx.session.session_id;
  if (!stateSessionId || !sessionId || stateSessionId !== sessionId) return null;

  const summary = summariseTools(recentTools);
  const segments: string[] = [];

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

  if (segments.length === 0) return null;
  return `${RESET}${segments.join(dim(' | '))}`;
}

export function render(ctx: RenderContext): void {
  const lines: string[] = [];

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

  for (const line of lines) {
    console.log(line);
  }
}
