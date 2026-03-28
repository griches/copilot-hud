import { basename, sep } from 'node:path';
import { colorize, dim, RESET, getContextColor, renderBar } from './colors.js';
import { summariseTools } from './state.js';
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

function formatProjectPath(cwd: string, levels: 1 | 2 | 3): string {
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
  return `${hours}h ${rem}m`;
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
}

// Line 1: [Model] │ project │ git:(branch*) │ session-name │ ⏱ 5m
export function renderProjectLine(ctx: RenderContext): string {
  const { session, gitStatus, config } = ctx;
  const cwd = session.cwd ?? ctx.state.cwd ?? process.cwd();
  const parts: string[] = [];

  // Model badge
  const modelName = session.model?.display_name ?? session.model?.id ?? 'Copilot';
  const shortModel = modelName
    .replace(/^claude-/i, '')
    .replace(/^(opus|sonnet|haiku)/i, (m) => m.charAt(0).toUpperCase() + m.slice(1))
    .replace(/-/g, ' ');
  parts.push(colorize(`[${shortModel}]`, config.colors.header));

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

  return `${RESET}${parts.join(dim(' │ '))}`;
}

// Line 2: Context █████░░░░░ 17% │ Reqs 3 │ (in: 24k, cache: 15k) │ out: 42 tok/s
export function renderContextLine(ctx: RenderContext): string | null {
  const { session, config } = ctx;
  const parts: string[] = [];

  // Context bar
  if (session.context_window?.context_window_size && session.context_window.remaining_tokens !== undefined) {
    const remaining = session.context_window.remaining_tokens;
    const fullSize = session.context_window.context_window_size;
    const used = fullSize - remaining;
    const usableSize = Math.round(fullSize * 0.80);
    const pct = used > 0 ? Math.round((used / usableSize) * 100) : 0;
    const bar = renderBar(pct, 10, getContextColor);
    parts.push(`${dim('Context')} ${bar} ${colorize(`${pct}%`, getContextColor(pct))}`);
  } else {
    const bar = renderBar(0, 10, getContextColor);
    parts.push(`${dim('Context')} ${bar} ${colorize('0%', getContextColor(0))}`);
  }

  // Premium requests this session
  if (session.cost?.total_premium_requests !== undefined) {
    const reqs = session.cost.total_premium_requests;
    parts.push(`${dim('Reqs')} ${colorize(`${reqs}`, 'brightBlue')}`);
  }

  // Token breakdown
  if (config.display.showTokenBreakdown && session.context_window?.current_usage) {
    const cu = session.context_window.current_usage;
    const inTokens = cu.input_tokens ?? 0;
    const cacheRead = cu.cache_read_input_tokens ?? 0;
    const cacheWrite = cu.cache_creation_input_tokens ?? 0;
    const totalCache = cacheRead + cacheWrite;
    if (inTokens > 0) {
      let breakdown = `in: ${formatTokens(inTokens)}`;
      if (totalCache > 0) {
        breakdown += `, cache: ${formatTokens(totalCache)}`;
      }
      parts.push(dim(`(${breakdown})`));
    }
  }

  // Output speed
  if (config.display.showOutputSpeed && session.context_window?.total_output_tokens !== undefined && session.cost?.total_api_duration_ms) {
    const outputTokens = session.context_window.total_output_tokens;
    const apiMs = session.cost.total_api_duration_ms;
    if (apiMs > 0 && outputTokens > 0) {
      const tokPerSec = (outputTokens / apiMs) * 1000;
      parts.push(dim(`out: ${tokPerSec.toFixed(1)} tok/s`));
    }
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
