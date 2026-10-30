import { homedir } from 'node:os';
import { basename, sep } from 'node:path';
import { colorize, RESET, levelColor, renderBar, rainbow } from './colors.js';
import { loadSessionEffort, summariseTools } from './state.js';
import { loadConfiguredEffort } from './config.js';
import { joinFit, truncateVisible, KEEP, type Segment } from './width.js';
import { sanitize } from './sanitize.js';
import type { HudConfig } from './config.js';
import type { QuotaEntry, RenderContext } from './types.js';

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

/**
 * A denied tool is neither a success nor a failure — the user declined it — so
 * it gets its own color rather than falling through to the success green.
 */
function statusColor(status: string, colors: HudConfig['colors']): string {
  switch (status) {
    case 'failure': return colors.failure;
    case 'running': return colors.running;
    case 'denied': return colors.denied;
    default: return colors.success;
  }
}

/** Session-scoped state (tools, agents, prompt) must not bleed across sessions. */
function stateMatchesSession(ctx: RenderContext): boolean {
  const stateSessionId = ctx.state.sessionId;
  const sessionId = ctx.session.session_id;
  return Boolean(stateSessionId && sessionId && stateSessionId === sessionId);
}

function formatProjectPath(cwd: string, levels: 0 | 1 | 2 | 3, abbreviateHome: boolean): string {
  if (levels === 0) {
    const home = homedir();
    if (abbreviateHome && (cwd === home || cwd.startsWith(home + sep))) {
      return `~${cwd.slice(home.length)}`;
    }
    return cwd;
  }
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
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
}

// Build a short display name from a model id like "claude-opus-4.7-1m" -> "opus-4.7-1m".
function shortenModelId(id: string): string {
  return id.replace(/^claude-/i, '').trim();
}

// Parse effort level and multiplier from display_name like "Claude Opus 4.7 (1M context) (10x) (high)".
// The short name is derived from the model id when available, since display_name often contains
// extra qualifiers (e.g. "(1M context)") that make it too long for a status line badge.
function parseModelMeta(
  id: string | undefined,
  displayName: string | undefined,
  explicitEffort?: string,
): { shortName: string; multiplier?: string; effort?: string } {
  const source = displayName ?? id ?? '';
  let multiplier: string | undefined;
  let effort: string | undefined;

  const mxMatch = source.match(/\((\d+x)\)/i);
  if (mxMatch) {
    multiplier = mxMatch[1].toLowerCase();
  }

  // Effort arrives in three shapes: "(high)" from older CLIs, "effort: high", and the
  // middot form "claude-opus-4.8 · high" that current Copilot CLI emits.
  const effortMatch = source.match(/\((low|medium|high|xhigh|default)\)/i)
    ?? source.match(/\b(?:reasoning|effort)(?:[_ -]?level)?\s*[:=]\s*(low|medium|high|xhigh|default)\b/i)
    ?? source.match(/[·•]\s*(low|medium|high|xhigh|default)\b/i);
  if (effortMatch) {
    effort = effortMatch[1].toLowerCase();
  }

  const normalizedExplicitEffort = explicitEffort?.match(/^(low|medium|high|xhigh|default)$/i)?.[1];
  if (normalizedExplicitEffort) {
    effort = normalizedExplicitEffort.toLowerCase();
  }

  // Without an id we fall back to display_name, so drop any trailing effort suffix first —
  // otherwise "claude-opus-4.8 · high" renders as "[claude-opus-4.8 · high·high]".
  const shortName = id
    ? shortenModelId(id)
    : (displayName ?? '').replace(/\s*[·•]\s*(low|medium|high|xhigh|default)\s*$/i, '').trim();

  return { shortName, multiplier, effort };
}

// Default line 1: [Model 3x·high] │ project │ git:(branch*) │ session-name │ ⏱ 5m │ +42/-3
function projectSegments(ctx: RenderContext): Map<string, Segment> {
  const { session, gitStatus, config } = ctx;
  const { colors } = config;
  const cwd = sanitize(session.cwd ?? ctx.state.cwd ?? process.cwd(), 1024);
  // Priorities are the drop order when the terminal is too narrow: the model
  // badge is pinned, and the further right a segment sits the sooner it goes.
  const parts = new Map<string, Segment>();

  // Model badge with optional effort + multiplier
  const meta = parseModelMeta(
    session.model?.id,
    session.model?.display_name,
    session.model?.reasoningEffort
      ?? session.model?.reasoning_effort
      ?? session.model?.reasoning
      ?? session.model?.effort
      ?? session.reasoningEffort
      ?? session.reasoning_effort
      ?? loadSessionEffort(session.session_id ?? ctx.state.sessionId)
      ?? loadConfiguredEffort(),
  );
  let modelBadge = sanitize(meta.shortName, 80) || 'Copilot';
  if (config.display.showMultiplier ?? config.display.showEffort) {
    if (meta.multiplier) modelBadge += ` ${meta.multiplier}`;
  }
  if (config.display.showEffort) {
    if (meta.effort) modelBadge += `·${meta.effort}`;
  }
  parts.set('model', { text: colorize(`[${modelBadge}]`, colors.header), priority: KEEP });

  // Remote-control indicator — someone is attached to this session via --remote/--connect
  if (config.display.showRemote && session.remote?.connected) {
    // Pinned: a second driver on the session is never the thing to hide.
    parts.set('remote', { text: colorize('◉ remote', colors.remote), priority: KEEP });
  }

  // Project path — rainbow gradient or solid color based on config
  if (config.display.showProjectName) {
    const path = formatProjectPath(cwd, config.pathLevels, config.display.abbreviateHome);
    parts.set('project', {
      text: config.display.rainbowPath
        ? rainbow(path, colors.rainbowPathBg)
        : colorize(path, colors.project),
      priority: 1,
    });
  }

  // Git status
  if (config.gitStatus.enabled && gitStatus) {
    const branch = sanitize(gitStatus.branch);
    const maxBranch = config.gitStatus.maxBranchLength;
    let branchText = maxBranch > 0 && branch.length > maxBranch ? `${branch.slice(0, maxBranch - 1)}…` : branch;
    if (config.gitStatus.showDirty && gitStatus.dirty) {
      branchText += '*';
    }
    if (config.gitStatus.showAheadBehind) {
      if (gitStatus.ahead > 0) branchText += ` ↑${gitStatus.ahead}`;
      if (gitStatus.behind > 0) branchText += ` ↓${gitStatus.behind}`;
    }
    if (config.gitStatus.showFileStats && gitStatus.fileStats) {
      const { modified, added, deleted, untracked } = gitStatus.fileStats;
      if (modified > 0) branchText += ` !${modified}`;
      if (added > 0) branchText += ` +${added}`;
      if (deleted > 0) branchText += ` ✘${deleted}`;
      if (untracked > 0) branchText += ` ?${untracked}`;
    }
    const branchSegment = colorize(branchText, colors.gitBranch);
    parts.set('git', {
      text: config.gitStatus.showPrefix
        ? `${colorize('git:(', colors.git)}${branchSegment}${colorize(')', colors.git)}`
        : branchSegment,
      priority: 2,
    });
  }

  // Session name
  const sessionName = config.display.showSessionName && session.session_name
    ? sanitize(session.session_name)
    : '';
  if (sessionName) {
    parts.set('session', { text: colorize(sessionName, colors.muted), priority: 5 });
  }

  // Session duration
  if (config.display.showSessionDuration && session.cost?.total_duration_ms !== undefined) {
    const duration = formatDuration(session.cost.total_duration_ms);
    parts.set('duration', { text: colorize(`⏱ ${duration}`, colors.muted), priority: 4 });
  }

  // Lines added/removed
  if (config.display.showLinesChanged && session.cost) {
    const added = session.cost.total_lines_added ?? 0;
    const removed = session.cost.total_lines_removed ?? 0;
    if (added > 0 || removed > 0) {
      parts.set('lines', {
        text: `${colorize(`+${added}`, colors.added)}${colorize('/', colors.muted)}${colorize(`-${removed}`, colors.removed)}`,
        priority: 3,
      });
    }
  }

  return parts;
}

/** Whole days until an entitlement resets; null when the date is missing or past. */
function daysUntil(resetDate: string | undefined, now: number): number | null {
  if (!resetDate) return null;
  const reset = Date.parse(resetDate);
  if (Number.isNaN(reset)) return null;
  const days = Math.ceil((reset - now) / 86_400_000);
  return days >= 0 ? days : null;
}

/**
 * Where is this bucket heading by the reset date? Projects the usage so far
 * linearly, as a percentage of the entitlement.
 *
 * Entitlements reset monthly, so the window is taken to have opened one
 * calendar month before `resetDate`. Returns null when there is nothing worth
 * projecting: at low usage a projection is mostly noise, and in the first hours
 * of a window any usage at all projects to exhaustion.
 */
function projectUsage(q: QuotaEntry, now: number, minUsed: number): number | null {
  if (!q.resetDate || q.usedPercentage < minUsed) return null;
  const reset = Date.parse(q.resetDate);
  if (Number.isNaN(reset) || reset <= now) return null;

  const opened = new Date(reset);
  opened.setUTCMonth(opened.getUTCMonth() - 1);
  const elapsed = (now - opened.getTime()) / (reset - opened.getTime());
  if (elapsed < 0.02) return null;

  return q.usedPercentage / Math.min(1, elapsed);
}

function barOf(config: HudConfig, percent: number, colorFn: (p: number) => string): string {
  return renderBar(percent, config.display.barWidth, colorFn, config.display.barStyle);
}

/**
 * Render the metered entitlement bucket as a bar. Returns null when quota is
 * unavailable — no extension installed, or every bucket is unlimited — so the
 * statusline degrades to exactly its current output.
 */
function renderQuota(ctx: RenderContext): string | null {
  const { quota, config, now } = ctx;
  const { colors, thresholds } = config;
  if (!config.display.showQuota || !quota) return null;

  // Pick the most-consumed metered bucket rather than a hardcoded id: the key
  // set is undocumented and plan-dependent. A configured id that isn't metered
  // on this plan falls back to the same choice.
  const metered = quota.quotas
    .filter((q) => !q.unlimited && q.entitlement > 0)
    .sort((a, b) => b.usedPercentage - a.usedPercentage);

  const q = metered.find((m) => m.id === config.display.quotaBucket) ?? metered[0];
  if (!q) return null;

  const pct = Math.round(q.usedPercentage);
  const projected = config.display.showQuotaPace || config.display.showQuotaProjection
    ? projectUsage(q, now, thresholds.paceMinUsed)
    : null;
  // Pace overrides the level colors: 40% used is calm on day 20 and a problem
  // on day 5, and the level alone can't tell those apart.
  let paceColor: string | null = null;
  if (config.display.showQuotaPace && projected !== null) {
    if (projected >= thresholds.paceCritical) paceColor = colors.paceCritical;
    else if (projected >= thresholds.paceWarn) paceColor = colors.paceWarn;
  }
  const colorFn = paceColor
    ? () => paceColor as string
    : levelColor(thresholds.quotaWarn, thresholds.quotaCritical, colors.quotaOk, colors.quotaWarn, colors.quotaCritical);
  const color = colorFn(pct);
  const segments = [`${colorize('Quota', colors.label)} ${barOf(config, pct, colorFn)}`];

  if (config.display.showQuotaCounts) {
    // Raw counts, not formatTokens — these are request counts, and `4785/7500`
    // is both shorter and more meaningful than `4.8k/7.5k`.
    segments.push(colorize(`${q.used}/${q.entitlement}`, color));
  }

  segments.push(colorize(paceColor ? `${pct}% ▲` : `${pct}%`, color));

  if (config.display.showQuotaProjection && projected !== null) {
    segments.push(colorize(`→${Math.round(projected)}%`, color));
  }

  // The percentage alone isn't actionable — 64% is alarming on day 3 and fine
  // on day 28 — so carry the reset horizon next to it.
  if (config.display.showQuotaReset) {
    const days = daysUntil(q.resetDate, now);
    if (days !== null) {
      segments.push(colorize(`· ${days}d`, colors.muted));
    }
  }

  // Overage only appears once the entitlement is exhausted; surface it loudly.
  if (q.overage > 0) {
    segments.push(colorize(`+${q.overage} over`, colors.quotaCritical));
  }

  return segments.join(' ');
}

// Default line 2: Ctx ██░░░░░░░░ 40.0k/200.0k 20% │ Quota ██████░░░░ 4.8k/7.5k 64% · 19d │ Credits 1.42 │ in:1.5M out:12.2k cache:1.5M │ 42 tok/s
function contextSegments(ctx: RenderContext): Map<string, Segment> {
  const { session, config } = ctx;
  const { colors, thresholds } = config;
  const cw = session.context_window;
  const parts = new Map<string, Segment>();
  const contextColor = levelColor(thresholds.contextWarn, thresholds.contextCritical, colors.contextOk, colors.contextWarn, colors.contextCritical);
  const ctxLabel = colorize('Ctx', colors.label);

  // Context bar — prefer live current-context fields (populated from render 1),
  // fall back to the cumulative/legacy fields when missing.
  const totalSize = cw?.displayed_context_limit ?? cw?.context_window_size;
  if (totalSize) {
    const pct = cw?.current_context_used_percentage ?? cw?.used_percentage ?? 0;
    const usedTokens = cw?.current_context_tokens
      ?? (cw?.remaining_tokens !== undefined ? totalSize - cw.remaining_tokens : Math.round((pct * totalSize) / 100));
    const bar = barOf(config, pct, contextColor);
    const color = contextColor(pct);
    const counts = config.display.showContextCounts
      ? ` ${colorize(`${formatTokens(usedTokens)}/${formatTokens(totalSize)}`, color)}`
      : '';
    parts.set('context', {
      text: `${ctxLabel} ${bar}${counts} ${colorize(`${pct}%`, color)}`,
      priority: KEEP,
    });
  } else {
    const bar = barOf(config, 0, contextColor);
    parts.set('context', { text: `${ctxLabel} ${bar} ${colorize('0%', contextColor(0))}`, priority: KEEP });
  }

  // Monthly entitlement bar, e.g. `Quota ██████░░░░ 4785/7500 64% · 19d`.
  //
  // Sits directly after Ctx so the two bars pair visually, and deliberately
  // mirrors the Ctx grammar (bar → counts → percent) so the line reads with one
  // vocabulary. Shows *used* rather than remaining, so both bars fill as you
  // consume. Only metered buckets get a bar — `chat` and `completions` are
  // typically unlimited and would render as a permanently empty one.
  const quotaSegment = renderQuota(ctx);
  if (quotaSegment) {
    parts.set('quota', { text: quotaSegment, priority: 2 });
  }

  // Credits used this session (Copilot's usage-based billing, surfaced under
  // the top-level `ai_used` field — `formatted` is the display-ready AIU value,
  // e.g. "26.5" where 1 AIU = $0.01 USD). Falls back to the legacy
  // `cost.total_premium_requests` counter on older Copilot CLI builds.
  if (config.display.showCredits) {
    if (session.ai_used?.formatted !== undefined) {
      parts.set('credits', { text: `${colorize('Credits', colors.label)} ${colorize(session.ai_used.formatted, colors.credits)}`, priority: 3 });
    } else if (session.cost?.total_premium_requests !== undefined) {
      parts.set('credits', {
        text: `${colorize('Reqs', colors.label)} ${colorize(`${session.cost.total_premium_requests}`, colors.credits)}`,
        priority: 3,
      });
    }
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
      } else {
        const totalCache = cacheRead + cacheWrite;
        if (totalCache > 0) {
          tokenInfo += ` cache:${formatTokens(totalCache)}`;
        }
      }
      parts.set('tokens', { text: colorize(tokenInfo, colors.muted), priority: 5 });
    }
  }

  // Output speed (tok/s)
  if (config.display.showOutputSpeed && cw?.total_output_tokens && session.cost?.total_api_duration_ms) {
    const outputTokens = cw.total_output_tokens;
    const apiMs = session.cost.total_api_duration_ms;
    if (apiMs > 0 && outputTokens > 0) {
      const tokPerSec = (outputTokens / apiMs) * 1000;
      parts.set('speed', { text: colorize(`${tokPerSec.toFixed(0)} tok/s`, colors.muted), priority: 4 });
    }
  }

  // Last call stats
  if (config.display.showLastCall && cw?.last_call_input_tokens !== undefined) {
    const lastIn = cw.last_call_input_tokens;
    const lastOut = cw.last_call_output_tokens ?? 0;
    parts.set('lastCall', { text: colorize(`last:${formatTokens(lastIn)}→${formatTokens(lastOut)}`, colors.muted), priority: 6 });
  }

  return parts;
}

/**
 * The info lines, arranged by `display.layout`. A segment's priority travels
 * with it, so one moved to another line keeps its place in the drop order.
 */
export function renderInfoLines(ctx: RenderContext): string[] {
  const { config } = ctx;
  const segments = new Map([...projectSegments(ctx), ...contextSegments(ctx)]);
  const separator = colorize(` ${sanitize(String(config.display.separator), 8)} `, config.colors.label);
  const layout = Array.isArray(config.display.layout) ? config.display.layout : [];

  const lines: string[] = [];
  for (const row of layout) {
    if (!Array.isArray(row)) continue;
    const parts = row.flatMap((id) => segments.get(id) ?? []);
    if (parts.length > 0) {
      lines.push(`${RESET}${joinFit(parts, separator, ctx.width)}`);
    }
  }
  return lines;
}

function formatElapsed(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins < 60) return `${mins}m ${remSecs}s`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/**
 * The prompt currently being worked on, e.g. `❯ fix the auth redirect (12s)`.
 *
 * The age is time since the prompt was submitted — during a turn that reads as
 * how long Copilot has been working, and afterwards as how long the session has
 * been idle. Timestamps come from the hook payload, so a missing or nonsensical
 * one (clock skew, a hook that never fired) drops the age rather than the line.
 */
export function renderPromptLine(ctx: RenderContext): string | null {
  const { state, config } = ctx;
  const { colors } = config;
  if (!config.display.showPromptPreview) return null;
  if (!stateMatchesSession(ctx)) return null;

  // Bounded well past any terminal width; the real cut is truncateVisible below.
  const prompt = state.lastPrompt ? sanitize(state.lastPrompt, 500) : '';
  if (!prompt) return null;

  let line = `${RESET}${colorize('❯', colors.prompt)} ${colorize(prompt, colors.muted)}`;

  const submitted = state.lastPromptTime;
  if (submitted && submitted > 0) {
    const age = ctx.now - submitted;
    // A day-old prompt means the state file outlived the session it describes.
    if (age >= 0 && age < 86_400_000) {
      line += colorize(` (${formatElapsed(age)})`, colors.muted);
    }
  }

  return ctx.width ? truncateVisible(line, ctx.width) : line;
}

// Line 3: Tool activity
export function renderToolsLine(ctx: RenderContext): string | null {
  const { state, config } = ctx;
  const { colors } = config;
  if (!config.display.showTools) return null;

  const { recentTools } = state;
  if (recentTools.length === 0) return null;

  // Only show tools when state file session matches the current session
  if (!stateMatchesSession(ctx)) return null;

  const summary = summariseTools(recentTools);
  const segments: Segment[] = [];

  for (const [rawName, info] of summary.entries()) {
    const toolName = sanitize(rawName, 40);
    if (!toolName) continue;
    const sIcon = statusIcon(info.lastStatus);
    const colorName = statusColor(info.lastStatus, colors);
    const icon = config.display.showToolIcons ? `${getToolIcon(toolName)} ` : '';
    const title = `${icon}${toolName.charAt(0).toUpperCase() + toolName.slice(1)}`;

    // A finished tool's name takes `colors.tools`; while it runs or after it
    // fails, the status color covers the whole label so it stands out.
    let part = `${colorize(sIcon, colorName)} ${colorize(title, info.lastStatus === 'success' ? colors.tools : colorName)}`;

    const target = config.display.showToolTargets && info.lastTarget ? sanitize(info.lastTarget) : '';
    if (target) {
      const isPath = target.startsWith('/') || target.startsWith('.');
      const shortTarget = isPath ? basename(target) : target.slice(0, 30);
      part += colorize(`: ${shortTarget}`, colors.muted);
    }
    if (info.count > 1) {
      part += colorize(` ×${info.count}`, colors.muted);
    }
    // `recentTools` is newest-first, so later entries are staler — drop those
    // first. The most recent tool is pinned; it's the point of the line.
    segments.push({ text: part, priority: segments.length === 0 ? KEEP : segments.length });
  }

  if (segments.length === 0) return null;
  const maxTools = config.display.maxTools;
  const shown = maxTools > 0 ? segments.slice(0, maxTools) : segments;
  return `${RESET}${joinFit(shown, colorize(' | ', colors.label), ctx.width)}`;
}

function formatAgentDuration(startTime: number, endTime?: number, now?: number): string {
  const end = endTime ?? now ?? Date.now();
  const ms = end - startTime;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return `${mins}m ${remSecs}s`;
}

// Agent activity lines: one line per agent, most recent first
export function renderAgentLines(ctx: RenderContext): string[] {
  const { state, config } = ctx;
  const { colors } = config;
  if (!config.display.showAgents) return [];

  const agents = state.agents ?? [];
  if (agents.length === 0) return [];

  // Only show agents when state file session matches the current session
  if (!stateMatchesSession(ctx)) return [];

  const lines: string[] = [];
  const max = config.display.maxAgents;
  const fadeSec = config.display.completedAgentFadeSec ?? 0;
  const now = ctx.now;

  // Filter: always keep running agents; keep completed ones only while still
  // within the fade window (fadeSec === 0 disables fading — legacy behavior).
  const visible = agents.filter((a) => {
    if (a.status === 'running') return true;
    if (fadeSec <= 0) return true;
    if (a.endTime === undefined) return true;
    return now - a.endTime < fadeSec * 1000;
  });
  if (visible.length === 0) return [];

  // Render most recent agents first (they're appended, so reverse), capped by maxAgents
  const start = Math.max(0, visible.length - max);
  for (let i = visible.length - 1; i >= start; i--) {
    const agent = visible[i];
    const sIcon = agent.status === 'running' ? '◐' : agent.status === 'success' ? '✓' : '✗';
    const color = agent.status === 'running' ? colors.running : agent.status === 'success' ? colors.success : colors.failure;

    const typeLabel = (agent.subagentType && sanitize(agent.subagentType, 40).toLowerCase()) || 'agent';
    const duration = formatAgentDuration(agent.startTime, agent.endTime, ctx.now);

    let line = `${RESET}${colorize(sIcon, color)} ${colorize(`[${typeLabel}]`, colors.agentType)} ${sanitize(String(agent.description ?? ''))}`;
    if (agent.status === 'running') {
      line += colorize(` (${duration}…)`, colors.muted);
    } else {
      line += colorize(` (${duration})`, colors.muted);
    }
    lines.push(ctx.width ? truncateVisible(line, ctx.width) : line);
  }

  return lines;
}

export function renderLines(ctx: RenderContext): string[] {
  const lines = renderInfoLines(ctx);

  const promptLine = renderPromptLine(ctx);
  if (promptLine) {
    lines.push(promptLine);
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

  return lines;
}

export function render(ctx: RenderContext): void {
  for (const line of renderLines(ctx)) {
    console.log(line);
  }
}
