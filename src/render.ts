import { basename, sep } from 'node:path';
import { colorize, dim, RESET } from './colors.js';
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

function formatDuration(startMs: number, nowMs: number): string {
  const ms = nowMs - startMs;
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hours}h ${rem}m`;
}

export function renderProjectLine(ctx: RenderContext): string {
  const { state, gitStatus, config } = ctx;
  const parts: string[] = [];

  // Header badge
  parts.push(colorize('[Copilot]', config.colors.header));

  // Project path
  const cwd = state.cwd ?? process.cwd();
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
    const gitPart = `${colorize('git:(', config.colors.git)}${colorize(branchText, config.colors.gitBranch)}${colorize(')', config.colors.git)}`;
    parts.push(gitPart);
  }

  // Session duration
  if (config.display.showSessionDuration && state.sessionStart) {
    const duration = formatDuration(state.sessionStart, ctx.now);
    parts.push(dim(`⏱ ${duration}`));
  }

  return `${RESET}${parts.join(' │ ')}`;
}

export function renderToolsLine(ctx: RenderContext): string | null {
  const { state, config } = ctx;

  if (!config.display.showTools) return null;

  const { recentTools } = state;
  if (recentTools.length === 0) return null;

  const summary = summariseTools(recentTools);
  const segments: string[] = [];

  for (const [toolName, info] of summary.entries()) {
    const icon = getToolIcon(toolName);
    const sIcon = statusIcon(info.lastStatus);
    const colorName = info.lastStatus === 'failure' ? config.colors.failure : config.colors.success;
    const inProgress = info.lastStatus === 'running';

    let part = colorize(`${inProgress ? '◐' : sIcon} ${icon} ${toolName.charAt(0).toUpperCase() + toolName.slice(1)}`, colorName);

    if (info.lastTarget) {
      const shortTarget = basename(info.lastTarget);
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
