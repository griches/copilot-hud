/**
 * copilot-hud session extension — feeds the statusline data it cannot reach.
 *
 * The statusline contract is a JSON blob on stdin, and it carries no quota
 * fields. Neither does the on-disk event log: `assistant.usage` is declared
 * `ephemeral: true`, so the only place entitlement/usage/reset ever exists is
 * in-flight, on the live session. Attaching here is the only way to see it.
 *
 * Writes `$COPILOT_HOME/hud-quota.json` for `readQuota()` in src/state.ts, and
 * `$COPILOT_HOME/hud-state/<sessionId>.agents.json` for `readState()`: the
 * session's `subagent.*` events are the only reliable record of when a
 * background agent finishes, which the hooks can only guess at.
 * Set COPILOT_HUD_PROBE=1 to also append raw events to hud-probe.jsonl.
 *
 * Deployed by `/copilot-hud:setup` to `$COPILOT_HOME/extensions/copilot-hud/`.
 * The CLI only discovers extensions in `<config>/extensions` and
 * `<gitRoot>/.github/extensions`, so it cannot be loaded from the plugin dir.
 */

import { appendFileSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

// Copilot CLI 1.0.113 renamed the SDK from @github to @microsoft and dropped
// the old name; earlier releases only know the old one.
const SDK_EXTENSION_SPECIFIERS = ['@microsoft/copilot-sdk/extension', '@github/copilot-sdk/extension'];

function resolveSdkExtension() {
  for (const specifier of SDK_EXTENSION_SPECIFIERS) {
    try {
      return import.meta.resolve(specifier);
    } catch {
      // Try the next alias.
    }
  }
  throw new Error(`Copilot SDK not found under ${SDK_EXTENSION_SPECIFIERS.join(' or ')}`);
}

const { joinSession } = await import(resolveSdkExtension());

const COPILOT_HOME = process.env.COPILOT_HOME ?? join(homedir(), '.copilot');
const QUOTA_FILE = join(COPILOT_HOME, 'hud-quota.json');
const STATE_DIR = join(COPILOT_HOME, 'hud-state');
/** The session id becomes a file name, so it must not be able to name a path. */
const SAFE_SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const PROBE_FILE = join(COPILOT_HOME, 'hud-probe.jsonl');
const PROBE = process.env.COPILOT_HUD_PROBE === '1';

function probe(kind, data) {
  if (!PROBE) return;
  try {
    appendFileSync(PROBE_FILE, JSON.stringify({ at: new Date().toISOString(), kind, ...data }) + '\n');
  } catch {
    // A probe must never take the session down with it.
  }
}

/**
 * Normalise one `quotaSnapshots` entry.
 *
 * Two things the SDK's own type comments get wrong, confirmed against a live
 * session: `remainingPercentage` is 0–100, not "0.0 to 1.0", and unlimited
 * quotas report `entitlementRequests: -1` rather than a real ceiling. Derive
 * the used percentage from the raw counts so we never depend on either.
 */
function normalise(id, q) {
  const unlimited = q.isUnlimitedEntitlement || q.entitlementRequests < 0;
  const entitlement = q.entitlementRequests;
  const used = q.usedRequests ?? 0;

  return {
    id,
    unlimited,
    used,
    entitlement,
    usedPercentage: unlimited || !entitlement || entitlement <= 0
      ? 0
      : Math.min(100, (used / entitlement) * 100),
    resetDate: q.resetDate,
    overage: q.overage ?? 0,
  };
}

/** Write-then-rename: the statusline reads these files on every render. */
function writeJson(file, data) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(data));
  renameSync(tmp, file);
}

function writeQuota(snapshots) {
  // Observed keys: `chat`, `completions`, `premium_interactions`. Keep them all
  // — the renderer decides which to show — but the key set is undocumented, so
  // never hardcode a lookup.
  const quotas = Object.entries(snapshots).map(([id, q]) => normalise(id, q));
  const payload = { updatedAt: Date.now(), quotas };

  try {
    writeJson(QUOTA_FILE, payload);
  } catch {
    // Statusline falls back to hiding the bar; never break the session.
  }
}

const session = await joinSession();

probe('probe.start', { pid: process.pid, cwd: process.cwd() });

session.on('assistant.usage', (event) => {
  const d = event.data ?? {};

  probe('assistant.usage', {
    model: d.model,
    inputTokens: d.inputTokens,
    outputTokens: d.outputTokens,
    cost: d.cost,
    duration: d.duration,
    reasoningEffort: d.reasoningEffort,
    // Becomes "sub-agent" for agent-initiated calls — this is what makes
    // per-agent cost attribution possible, which the statusline cannot do.
    initiator: d.initiator,
    parentToolCallId: d.parentToolCallId,
    totalNanoAiu: d.copilotUsage?.totalNanoAiu,
    quotaSnapshots: d.quotaSnapshots,
  });

  if (d.quotaSnapshots) {
    writeQuota(d.quotaSnapshots);
  }
});

// ---------------------------------------------------------------------------
// sub-agents, keyed by the toolCallId of the `task` call that started them

const AGENTS_FILE = typeof session.sessionId === 'string' && SAFE_SESSION_ID.test(session.sessionId)
  ? join(STATE_DIR, `${session.sessionId}.agents.json`)
  : null;

function readAgents() {
  try {
    const parsed = JSON.parse(readFileSync(AGENTS_FILE, 'utf8'));
    return Array.isArray(parsed.agents) ? parsed.agents : [];
  } catch {
    return [];
  }
}

// Picks up where a reloaded extension left off, so its agents still complete.
const agents = AGENTS_FILE ? readAgents() : [];
/** `task` arguments by toolCallId: the HUD shows the task's description, not the agent's. */
const taskArgs = new Map();

function writeAgents() {
  try {
    writeJson(AGENTS_FILE, { agents });
  } catch {
    // The hooks' own agent tracking still shows something.
  }
}

function timeOf(event) {
  const ms = Date.parse(event.timestamp);
  return Number.isFinite(ms) ? ms : Date.now();
}

function finishAgent(event, status) {
  const agent = agents.find((a) => a.id === event.data?.toolCallId);
  if (!agent) return;
  agent.status = status;
  agent.endTime = timeOf(event);
  writeAgents();
}

if (AGENTS_FILE) {
  session.on('tool.execution_start', (event) => {
    const d = event.data ?? {};
    if (d.toolName === 'task' && d.toolCallId) taskArgs.set(d.toolCallId, d.arguments ?? {});
  });

  session.on('subagent.started', (event) => {
    const d = event.data ?? {};
    if (!d.toolCallId) return;
    const args = taskArgs.get(d.toolCallId) ?? {};
    taskArgs.delete(d.toolCallId);

    const entry = {
      id: d.toolCallId,
      description: args.description || d.agentDisplayName || d.agentName || '',
      subagentType: args.agent_type || d.agentName || null,
      status: 'running',
      startTime: timeOf(event),
    };
    const existing = agents.findIndex((a) => a.id === entry.id);
    if (existing >= 0) agents[existing] = entry;
    else agents.push(entry);
    writeAgents();
  });

  session.on('subagent.completed', (event) => finishAgent(event, 'success'));
  session.on('subagent.failed', (event) => finishAgent(event, 'failure'));
}
