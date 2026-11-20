#!/usr/bin/env node
/**
 * copilot-hud hooks — every hook, in one place.
 *
 *   node hud-hook.mjs <session-start|user-prompt|pre-tool-use|post-tool-use|session-end>
 *
 * This replaces the jq pipelines the shell hooks used to run. jq was the only
 * thing in the project a user had to install separately; node is already
 * required, because the statusline renderer is a node program. The shell and
 * PowerShell hooks are now thin wrappers around this file, so the two platforms
 * share one implementation instead of two that drift apart.
 *
 * Hook payloads (verified against live stdin, not the session event log — the
 * event log records Copilot's *internal* shape, which is different and has
 * caused a regression before):
 *
 *   sessionStart         {sessionId, timestamp, cwd}
 *   userPromptSubmitted  {sessionId, timestamp, cwd, prompt}
 *   preToolUse           {sessionId, timestamp, cwd, toolName, toolArgs, toolCallId}
 *   postToolUse          {sessionId, timestamp, cwd, toolName, toolArgs, toolCallId,
 *                         toolResult: {resultType, textResultForLlm}}
 *   sessionEnd           {sessionId, timestamp, cwd}
 *
 * `toolArgs` arrives as a JSON *string*, not an object.
 *
 * State is one file per session, `$COPILOT_HOME/hud-state/<sessionId>.json`.
 * Concurrent sessions each run their own hooks, so a single shared file let one
 * session's tools and agents land in another's HUD.
 *
 * A hook must never take the session down with it: every failure path exits 0.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const COPILOT_HOME = process.env.COPILOT_HOME ?? join(homedir(), '.copilot');
const STATE_DIR = join(COPILOT_HOME, 'hud-state');
const EXTENSION_SOURCE = join(dirname(fileURLToPath(import.meta.url)), '..', 'extension', 'extension.mjs');
const EXTENSION_INSTALLED = join(COPILOT_HOME, 'extensions', 'copilot-hud', 'extension.mjs');

const MAX_RECENT_TOOLS = 8;
const LOCK_RETRIES = 40;
const LOCK_RETRY_MS = 50;
const STALE_STATE_MS = 7 * 24 * 60 * 60 * 1000;
/** The session id becomes a file name, so it must not be able to name a path. */
const SAFE_SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Copilot's own bookkeeping tools — noise on a status line. */
const INTERNAL_TOOLS = new Set(['report_intent', 'task_complete', 'thinking', 'list_agents', 'write_agent']);

// ---------------------------------------------------------------------------
// plumbing

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    // No stdin, or a TTY that would block — treat as an empty payload.
    return '';
  }
}

/** PowerShell can prepend a UTF-8 BOM when piping; JSON.parse chokes on it. */
function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function parseJson(text, fallback) {
  if (!text) return fallback;
  try {
    const parsed = JSON.parse(text);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

/** Synchronous sleep — hooks are short-lived, single-shot processes. */
function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Acquire the state lock. `mkdir` is atomic, and the directory form is kept
 * from the shell implementation so a lock left behind by an older version is
 * still understood.
 *
 * After ~2s we assume the holder died and take the lock anyway: a stuck lock
 * would freeze the HUD for the rest of the session, which is worse than the
 * torn update it protects against.
 */
function acquireLock(lockDir) {
  for (let attempt = 0; attempt < LOCK_RETRIES; attempt++) {
    try {
      mkdirSync(lockDir);
      return;
    } catch {
      sleep(LOCK_RETRY_MS);
    }
  }
  try {
    rmdirSync(lockDir);
  } catch {
    // Someone else cleared it; either way we proceed.
  }
}

function releaseLock(lockDir) {
  try {
    rmdirSync(lockDir);
  } catch {
    // Already released.
  }
}

/** The payload's own session file, or null when it has no usable session id. */
function stateFileFor(payload) {
  const id = payload.sessionId;
  return typeof id === 'string' && SAFE_SESSION_ID.test(id) ? join(STATE_DIR, `${id}.json`) : null;
}

function readState(file) {
  try {
    return parseJson(readFileSync(file, 'utf8'), null);
  } catch {
    return null;
  }
}

function freshState(payload) {
  return {
    sessionId: payload.sessionId,
    sessionStart: timestampOf(payload),
    cwd: typeof payload.cwd === 'string' ? payload.cwd : '',
    lastPrompt: null,
    lastPromptTime: null,
    recentTools: [],
    agents: [],
    sessionActive: true,
  };
}

/**
 * Write-then-rename. The statusline reads this file on every render, and a
 * torn read would blank the HUD mid-session. The pid in the temp name keeps
 * two hooks from clobbering each other's scratch file.
 */
function writeState(file, state) {
  mkdirSync(STATE_DIR, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(state));
  renameSync(tmp, file);
}

/**
 * Read, mutate, write the payload's session file under that session's lock.
 * `mutate` returning false abandons the update, leaving the file untouched.
 * A missing file (pruned, or a session that began before the HUD was set up)
 * starts fresh rather than leaving the session without a HUD.
 */
function updateState(payload, mutate) {
  const file = stateFileFor(payload);
  if (!file) return;

  const lockDir = `${file}.lock`;
  mkdirSync(STATE_DIR, { recursive: true });
  acquireLock(lockDir);
  try {
    const state = readState(file) ?? freshState(payload);
    if (mutate(state) === false) return;
    writeState(file, state);
  } finally {
    releaseLock(lockDir);
  }
}

/**
 * Hook timestamps are epoch ms. The field has been present on every payload
 * observed, but a missing one would otherwise be stored as 0 and render as a
 * ~56-year duration, so fall back to now.
 */
function timestampOf(payload) {
  const ts = payload.timestamp;
  return typeof ts === 'number' && ts > 0 ? ts : Date.now();
}

/** `toolArgs` is a JSON string in practice; tolerate an object too. */
function parseToolArgs(payload) {
  const args = payload.toolArgs;
  if (args && typeof args === 'object') return args;
  if (typeof args === 'string') return parseJson(args, {});
  return {};
}

// ---------------------------------------------------------------------------
// hooks

/**
 * Keep the installed session extension in step with the plugin.
 *
 * Copilot only loads extensions from its own extensions directory, so setup
 * has to *copy* ours there — and a copy goes stale the moment the plugin
 * updates. This hook always runs from the current plugin, so it can notice and
 * replace it. Only an extension setup already installed is touched: its
 * absence means the user opted out of the quota bar. Extensions load at
 * startup, so the new copy takes effect on the next launch.
 */
function refreshExtension() {
  try {
    if (!existsSync(EXTENSION_INSTALLED)) return;
    const current = readFileSync(EXTENSION_SOURCE);
    if (readFileSync(EXTENSION_INSTALLED).equals(current)) return;
    const tmp = `${EXTENSION_INSTALLED}.${process.pid}.tmp`;
    writeFileSync(tmp, current);
    renameSync(tmp, EXTENSION_INSTALLED);
  } catch {
    // The old extension keeps working; the quota bar just misses an update.
  }
}

/**
 * Sessions that crash never fire sessionEnd, so their files are swept here by
 * age instead. A week is far longer than any session goes without a hook.
 */
function pruneStaleState() {
  let names = [];
  try {
    names = readdirSync(STATE_DIR);
  } catch {
    return;
  }
  const cutoff = Date.now() - STALE_STATE_MS;
  for (const name of names) {
    const path = join(STATE_DIR, name);
    try {
      if (statSync(path).mtimeMs < cutoff) rmSync(path, { recursive: true, force: true });
    } catch {
      // Removed by another session's sweep.
    }
  }
}

function sessionStart(payload) {
  refreshExtension();

  const file = stateFileFor(payload);
  if (!file) return;
  try {
    pruneStaleState();
  } catch {
    // Housekeeping only; the session's own state matters more.
  }

  // Resuming the same session keeps its agents.
  const previous = readState(file);
  const state = freshState(payload);
  if (previous && Array.isArray(previous.agents)) state.agents = previous.agents;
  writeState(file, state);
}

function userPrompt(payload) {
  updateState(payload, (state) => {
    state.lastPrompt = typeof payload.prompt === 'string' ? payload.prompt : '';
    state.lastPromptTime = timestampOf(payload);
  });
}

/** A readable label for what a tool is acting on. */
function targetFor(toolName, args) {
  if (toolName === 'edit' || toolName === 'view' || toolName === 'create') {
    const path = args.path ?? args.file_path;
    return typeof path === 'string' ? path : '';
  }

  if (toolName === 'bash') {
    const command = typeof args.command === 'string' ? args.command : '';
    // Copilot prepends `cd <path> && ` to shell commands; it's the same for
    // every call and crowds out the part worth reading.
    return command.split('\n')[0].replace(/^cd [^ ]* && /, '').slice(0, 60);
  }

  return '';
}

function preToolUse(payload) {
  const toolName = typeof payload.toolName === 'string' ? payload.toolName : '';
  if (!toolName) return;
  // read_agent is skipped here but not in postToolUse: its *result* is how a
  // hook learns a sub-agent finished.
  if (INTERNAL_TOOLS.has(toolName) || toolName === 'read_agent') return;

  const args = parseToolArgs(payload);
  const timestamp = timestampOf(payload);

  // A `task` call is a sub-agent spawn, tracked on its own line rather than as
  // a tool. This is the only place a running agent is recorded; postToolUse
  // only updates the entry made here.
  if (toolName === 'task') {
    const description = typeof args.description === 'string' ? args.description : '';
    if (!description) return;
    const subagentType = typeof args.agent_type === 'string' && args.agent_type ? args.agent_type : null;

    const id = typeof payload.toolCallId === 'string' ? payload.toolCallId : undefined;

    updateState(payload, (state) => {
      if (!Array.isArray(state.agents)) state.agents = [];
      state.agents.push({ id, description, subagentType, status: 'running', startTime: timestamp });
    });
    return;
  }

  const target = targetFor(toolName, args);
  updateState(payload, (state) => {
    if (!Array.isArray(state.recentTools)) state.recentTools = [];
    state.recentTools.unshift({ name: toolName, target: target || null, status: 'running', timestamp });
    state.recentTools = state.recentTools.slice(0, MAX_RECENT_TOOLS);
  });
}

/**
 * Agent status without the session extension, which sees the real
 * `subagent.completed` events and supersedes this in the renderer. The tool
 * results are the only signal a hook gets, so they are matched by the agent id
 * they name. Text that doesn't match leaves the agent alone rather than
 * guessing which one it was.
 */
function trackAgent(payload, toolName, status, timestamp) {
  const args = parseToolArgs(payload);
  const text = typeof payload.toolResult?.textResultForLlm === 'string' ? payload.toolResult.textResultForLlm : '';

  updateState(payload, (state) => {
    const agents = Array.isArray(state.agents) ? state.agents : [];

    if (toolName === 'task') {
      // The newest running entry for this call; pre-tool-use recorded it.
      const agent = agents.findLast((a) => a.status === 'running' && !a.agentId
        && (a.id ? a.id === payload.toolCallId : a.description === args.description));
      if (!agent) return false;
      // A background task returns at once with its id; a sync one returns when the agent is done.
      const started = /^Agent started in background with agent_id: ([^\s.,]+)/.exec(text);
      if (started) {
        agent.agentId = started[1];
      } else {
        agent.status = status;
        agent.endTime = timestamp;
      }
      return;
    }

    // read_agent also answers for agents that are still running.
    const agentStatus = /\bstatus: (\w+)/.exec(text.split('\n')[0])?.[1];
    if (!agentStatus || agentStatus === 'running') return false;
    const agent = agents.find((a) => a.agentId && a.agentId === args.agent_id);
    if (!agent || agent.status !== 'running') return false;
    agent.status = agentStatus === 'idle' || agentStatus === 'completed' ? 'success' : 'failure';
    agent.endTime = timestamp;
  });
}

function postToolUse(payload) {
  const toolName = typeof payload.toolName === 'string' ? payload.toolName : '';
  if (!toolName) return;
  if (INTERNAL_TOOLS.has(toolName)) return;

  const resultType = payload.toolResult?.resultType;
  const status = resultType === 'failure' || resultType === 'denied' ? resultType : 'success';
  const timestamp = timestampOf(payload);

  if (toolName === 'task' || toolName === 'read_agent') {
    trackAgent(payload, toolName, status, timestamp);
    return;
  }

  updateState(payload, (state) => {
    if (!Array.isArray(state.recentTools)) state.recentTools = [];
    // recentTools is newest-first, so the first match is the call that just
    // finished. Without a running entry — a hook that never fired, or a tool
    // started before the HUD did — record the completion on its own.
    const running = state.recentTools.find((t) => t.name === toolName && t.status === 'running');
    if (running) {
      running.status = status;
      running.timestamp = timestamp;
      return;
    }
    state.recentTools.unshift({ name: toolName, status, timestamp });
    state.recentTools = state.recentTools.slice(0, MAX_RECENT_TOOLS);
  });
}

function sessionEnd(payload) {
  updateState(payload, (state) => {
    state.sessionActive = false;
  });
}

// ---------------------------------------------------------------------------

const HOOKS = {
  'session-start': sessionStart,
  'user-prompt': userPrompt,
  'pre-tool-use': preToolUse,
  'post-tool-use': postToolUse,
  'session-end': sessionEnd,
};

function main() {
  const hook = HOOKS[process.argv[2]];
  if (!hook) return;

  // Unparseable stdin is not the same as an empty payload. Falling back to `{}`
  // would let `user-prompt` overwrite a real prompt with a blank one, so a
  // payload we can't read means we do nothing at all.
  const payload = parseJson(stripBom(readStdin()), null);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return;

  hook(payload);
}

try {
  main();
} catch {
  // Never fail a hook: a broken HUD update must not disturb the session.
}
process.exit(0);
