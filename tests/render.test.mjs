// Unit tests for the pieces of the renderer that parse or clean outside input.
// They import the build, so run them through `npm test`.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveConfig } from '../dist/config.js';
import { parseStatus } from '../dist/git.js';
import { renderLines } from '../dist/render.js';
import { sanitize } from '../dist/sanitize.js';
import { stripAnsi } from '../dist/width.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('sanitize strips escapes, controls and bidi overrides', () => {
  assert.equal(sanitize('a\x1b[31mb\x1b[0mc'), 'abc');
  assert.equal(sanitize('x\x1b]0;title\x07y'), 'xy');
  assert.equal(sanitize('x\x1b]8;;http://e.test\x1b\\link\x1b]8;;\x1b\\y'), 'xlinky');
  assert.equal(sanitize('one\ntwo\tthree\x00four'), 'one two three four');
  assert.equal(sanitize('safe‮gpj.exe'), 'safegpj.exe');
  assert.equal(sanitize('  spaced   out  '), 'spaced out');
  assert.equal(sanitize('abcdef', 3), 'abc');
});

test('sanitize leaves ordinary text alone', () => {
  assert.equal(sanitize('fix the auth redirect — 修复 ✓'), 'fix the auth redirect — 修复 ✓');
});

test('parseStatus reads branch, ahead/behind and file counts from one call', () => {
  const status = parseStatus([
    '# branch.oid 1234',
    '# branch.head feat/x',
    '# branch.upstream origin/feat/x',
    '# branch.ab +2 -1',
    '1 .M N... 100644 100644 100644 a b src/a.ts',
    '1 M. N... 100644 100644 100644 a b src/b.ts',
    '1 A. N... 000000 100644 100644 a b src/new.ts',
    '1 .D N... 100644 100644 000000 a b src/gone.ts',
    '2 R. N... 100644 100644 100644 a b R100 src/to.ts\tsrc/from.ts',
    'u UU N... 100644 100644 100644 100644 a b c src/conflict.ts',
    '? notes.txt',
    '? scratch/',
    '',
  ].join('\n'));
  assert.deepEqual(status, {
    branch: 'feat/x',
    dirty: true,
    ahead: 2,
    behind: 1,
    fileStats: { modified: 4, added: 1, deleted: 1, untracked: 2 },
  });
});

test('parseStatus: clean tree, no upstream', () => {
  const status = parseStatus('# branch.oid 1234\n# branch.head main\n');
  assert.equal(status.dirty, false);
  assert.equal(status.ahead, 0);
  assert.equal(status.behind, 0);
});

test('parseStatus: a detached HEAD has no branch to show', () => {
  assert.equal(parseStatus('# branch.oid 1234\n# branch.head (detached)\n'), null);
});

test('session-start refreshes a stale installed extension, and only an installed one', (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-hud-test-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const installed = path.join(home, 'extensions', 'copilot-hud', 'extension.mjs');
  const hook = () => spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'hud-hook.mjs'), 'session-start'], {
    env: { ...process.env, COPILOT_HOME: home },
    input: JSON.stringify({ sessionId: 's1', timestamp: Date.now(), cwd: home }),
  });

  // Not installed: the user opted out of the quota bar, so nothing appears.
  assert.equal(hook().status, 0);
  assert.ok(!fs.existsSync(installed));

  fs.mkdirSync(path.dirname(installed), { recursive: true });
  fs.writeFileSync(installed, '// an older release\n');
  assert.equal(hook().status, 0);
  assert.deepEqual(fs.readFileSync(installed), fs.readFileSync(path.join(ROOT, 'extension', 'extension.mjs')));
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, 'hud-state', 's1.json'), 'utf8')).sessionId, 's1');
});

/** Run one hook against a scratch COPILOT_HOME. */
function runHook(home, name, payload) {
  const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'hud-hook.mjs'), name], {
    env: { ...process.env, COPILOT_HOME: home },
    input: JSON.stringify({ timestamp: Date.now(), cwd: home, ...payload }),
  });
  assert.equal(result.status, 0);
}

function scratchHome(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-hud-test-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  return home;
}

const readSession = (home, id) => JSON.parse(fs.readFileSync(path.join(home, 'hud-state', `${id}.json`), 'utf8'));

test('concurrent sessions keep their tools, agents and end apart', (t) => {
  const home = scratchHome(t);

  runHook(home, 'session-start', { sessionId: 'a' });
  runHook(home, 'session-start', { sessionId: 'b' });
  runHook(home, 'pre-tool-use', { sessionId: 'a', toolName: 'bash', toolArgs: '{"command":"ls"}' });
  runHook(home, 'pre-tool-use', { sessionId: 'a', toolName: 'task', toolCallId: 't1', toolArgs: '{"description":"audit"}' });
  runHook(home, 'session-end', { sessionId: 'a' });
  runHook(home, 'pre-tool-use', { sessionId: '../escape', toolName: 'bash', toolArgs: '{}' });

  const a = readSession(home, 'a');
  const b = readSession(home, 'b');
  assert.deepEqual(a.recentTools.map((tool) => tool.name), ['bash']);
  assert.deepEqual(a.agents.map((agent) => agent.description), ['audit']);
  assert.equal(a.sessionActive, false);
  assert.deepEqual([b.recentTools, b.agents, b.sessionActive], [[], [], true]);
  assert.ok(!fs.existsSync(path.join(home, 'escape.json')));
});

test('without the extension, an agent completes only when read_agent says so', (t) => {
  const home = scratchHome(t);
  const session = { sessionId: 's' };
  const spawn = (id, description) => {
    runHook(home, 'pre-tool-use', { ...session, toolName: 'task', toolCallId: id, toolArgs: JSON.stringify({ description, mode: 'background' }) });
    runHook(home, 'post-tool-use', {
      ...session, toolName: 'task', toolCallId: id, toolArgs: JSON.stringify({ description }),
      toolResult: { resultType: 'success', textResultForLlm: `Agent started in background with agent_id: agent-${id}. You'll be notified when it completes.` },
    });
  };
  const read = (id, status) => runHook(home, 'post-tool-use', {
    ...session, toolName: 'read_agent', toolArgs: JSON.stringify({ agent_id: `agent-${id}` }),
    toolResult: { resultType: 'success', textResultForLlm: `Agent is ${status}. agent_id: agent-${id}, agent_type: explore, status: ${status}, description: x\n\nstatus: idle` },
  });
  const statuses = () => readSession(home, 's').agents.map((agent) => agent.status);

  runHook(home, 'session-start', session);
  spawn('t1', 'first');
  spawn('t2', 'second');
  read('t2', 'running');
  assert.deepEqual(statuses(), ['running', 'running']);
  read('t2', 'idle');
  assert.deepEqual(statuses(), ['running', 'success'], 'the named agent, not the oldest');
  read('nope', 'idle');
  assert.deepEqual(statuses(), ['running', 'success']);

  // A sync task's result arrives when the agent is done.
  runHook(home, 'pre-tool-use', { ...session, toolName: 'task', toolCallId: 't3', toolArgs: '{"description":"sync"}' });
  runHook(home, 'post-tool-use', { ...session, toolName: 'task', toolCallId: 't3', toolArgs: '{"description":"sync"}', toolResult: { resultType: 'failure', textResultForLlm: 'boom' } });
  assert.deepEqual(statuses(), ['running', 'success', 'failure']);
});

for (const sdk of ['@microsoft/copilot-sdk', '@github/copilot-sdk']) {
  test(`the extension loads through ${sdk} and its agent events win over the hooks`, (t) => {
    const home = scratchHome(t);
    // A stand-in SDK beside a copy of the extension, so the alias is resolved the way the CLI would.
    const pkg = path.join(home, 'ext', 'node_modules', ...sdk.split('/'));
    fs.mkdirSync(pkg, { recursive: true });
    fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: sdk, type: 'module', exports: { './extension': './extension.js' } }));
    fs.writeFileSync(path.join(pkg, 'extension.js'),
      'export async function joinSession() { globalThis.handlers = {}; return { sessionId: "s", on: (type, fn) => { globalThis.handlers[type] = fn; } }; }');
    const extension = path.join(home, 'ext', 'extension.mjs');
    fs.copyFileSync(path.join(ROOT, 'extension', 'extension.mjs'), extension);

    runHook(home, 'session-start', { sessionId: 's' });
    runHook(home, 'pre-tool-use', { sessionId: 's', toolName: 'task', toolCallId: 'hook', toolArgs: '{"description":"guessed"}' });

    const driver = `
      await import(${JSON.stringify(pathToFileURL(extension).href)});
      const on = globalThis.handlers, at = (s) => ({ timestamp: '2026-06-06T00:00:0' + s + 'Z' });
      on['tool.execution_start']({ data: { toolCallId: 't1', toolName: 'task', arguments: { description: 'first', agent_type: 'explore' } } });
      on['subagent.started']({ ...at(1), data: { toolCallId: 't1', agentName: 'explore' } });
      on['subagent.started']({ ...at(2), data: { toolCallId: 't2', agentName: 'reviewer', agentDisplayName: 'Reviewer' } });
      on['subagent.completed']({ ...at(3), data: { toolCallId: 't2' } });
      on['subagent.failed']({ ...at(4), data: { toolCallId: 'unknown' } });
      const { readState } = await import(${JSON.stringify(pathToFileURL(path.join(ROOT, 'dist', 'state.js')).href)});
      console.log(JSON.stringify(readState('s').agents));
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', driver], { env: { ...process.env, COPILOT_HOME: home }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), [
      { id: 't1', description: 'first', subagentType: 'explore', status: 'running', startTime: Date.parse('2026-06-06T00:00:01Z') },
      { id: 't2', description: 'Reviewer', subagentType: 'reviewer', status: 'success', startTime: Date.parse('2026-06-06T00:00:02Z'), endTime: Date.parse('2026-06-06T00:00:03Z') },
    ]);
  });
}

const NOW = Date.parse('2026-06-06T00:00:00Z');

/** Render with a config file's contents, returning clean lines unless `raw` is set. */
function hud(file = {}, { raw = false, ...overrides } = {}) {
  const lines = renderLines({
    config: resolveConfig(file),
    now: NOW,
    gitStatus: { branch: 'main', dirty: true, ahead: 2, behind: 0, fileStats: { modified: 3, added: 0, deleted: 0, untracked: 0 } },
    quota: {
      updatedAt: NOW,
      quotas: [
        { id: 'small', unlimited: false, used: 1, entitlement: 100, usedPercentage: 1, resetDate: '2026-07-01T00:00:00Z', overage: 0 },
        { id: 'premium', unlimited: false, used: 400, entitlement: 1000, usedPercentage: 40, resetDate: '2026-07-01T00:00:00Z', overage: 0 },
      ],
    },
    state: {
      sessionId: 's',
      sessionActive: true,
      recentTools: [
        { name: 'edit', target: './auth.ts', status: 'success', timestamp: NOW },
        { name: 'bash', target: 'git status', status: 'failure', timestamp: NOW },
      ],
      agents: [],
    },
    session: {
      session_id: 's',
      session_name: 'Named',
      cwd: path.join(os.homedir(), 'code', 'proj'),
      model: { id: 'claude-opus-4.6', display_name: 'claude-opus-4.6 (3x) (high)', reasoningEffort: 'high' },
      context_window: { context_window_size: 200000, remaining_tokens: 130000, used_percentage: 35, total_input_tokens: 10, total_output_tokens: 20 },
      cost: { total_duration_ms: 300000, total_api_duration_ms: 1000, total_lines_added: 4, total_lines_removed: 1 },
      ai_used: { formatted: '1.42' },
    },
    ...overrides,
  });
  return raw ? lines : lines.map(stripAnsi);
}

test('an empty config still draws the default lines', () => {
  assert.deepEqual(hud(), [
    '[opus-4.6 3x·high] │ proj │ git:(main* ↑2) │ Named │ ⏱ 5m │ +4/-1',
    'Ctx ████░░░░░░ 70.0k/200.0k 35% │ Quota ████░░░░░░ 400/1000 40% · 25d │ Credits 1.42 │ in:10 out:20 │ 20 tok/s',
    '✓ ✎ Edit: auth.ts | ✗ ⌨ Bash: git status',
  ]);
});

test('a preset applies, and keys set beside it still win', () => {
  assert.deepEqual(hud({ preset: 'minimal' }), [
    '[opus-4.6 3x·high] │ proj │ git:(main*)',
    'Ctx ████░░░░░░ 70.0k/200.0k 35% │ Quota ████░░░░░░ 40% · 25d',
  ]);
  assert.equal(hud({ preset: 'compact' })[0], '[opus-4.6 3x·high] │ proj │ git:(main*) │ Ctx ██░░░ 35% │ Quota ██░░░ 40% · 25d');
  assert.ok(hud({ preset: 'minimal', display: { showCredits: true } })[1].includes('Credits 1.42'));
  assert.deepEqual(hud({ preset: 'no-such-preset' }), hud());
  assert.deepEqual(hud({ preset: 'constructor' }), hud());
});

test('layout moves and hides segments, and ignores ids it does not know', () => {
  const lines = hud({ display: { showTools: false, layout: [['context', 'model'], ['nope', 'constructor'], ['credits']] } });
  assert.deepEqual(lines, ['Ctx ████░░░░░░ 70.0k/200.0k 35% │ [opus-4.6 3x·high]', 'Credits 1.42']);
  assert.ok(hud({ display: { layout: 'not an array' } }).every((line) => !line.includes('opus')));
});

test('the multiplier follows showEffort until set on its own', () => {
  assert.ok(hud({ display: { showEffort: false } })[0].startsWith('[opus-4.6] '));
  assert.ok(hud({ display: { showMultiplier: false } })[0].startsWith('[opus-4.6·high] '));
  assert.ok(hud({ display: { showEffort: false, showMultiplier: true } })[0].startsWith('[opus-4.6 3x] '));
});

test('bars and separators take their style from the config', () => {
  const line = (display) => hud({ display: { showQuota: false, showCredits: false, showTokenBreakdown: false, showOutputSpeed: false, ...display } })[1];
  assert.equal(line({ barStyle: 'ascii', barWidth: 4 }), 'Ctx #--- 70.0k/200.0k 35%');
  assert.equal(line({ barStyle: 'no-such-style', barWidth: 'wide', showContextCounts: false }), 'Ctx ████░░░░░░ 35%');
  assert.ok(hud({ display: { separator: '·' } })[0].includes(' · proj · '));
});

test('quota: pace thresholds, projection and bucket are configurable', () => {
  const quota = (file) => hud(file)[1].split(' │ ')[1];
  // 40% used a sixth of the way into the month projects to about 240%.
  assert.equal(quota({ display: { showQuotaPace: true } }), 'Quota ████░░░░░░ 400/1000 40% ▲ · 25d');
  assert.equal(quota({ display: { showQuotaProjection: true } }), 'Quota ████░░░░░░ 400/1000 40% →240% · 25d');
  assert.equal(quota({ display: { showQuotaPace: true }, thresholds: { paceWarn: 300, paceCritical: 400 } }), 'Quota ████░░░░░░ 400/1000 40% · 25d');
  assert.equal(quota({ display: { showQuotaProjection: true }, thresholds: { paceMinUsed: 50 } }), 'Quota ████░░░░░░ 400/1000 40% · 25d');
  assert.equal(quota({ display: { quotaBucket: 'small' } }), 'Quota ░░░░░░░░░░ 1/100 1% · 25d');
  assert.equal(quota({ display: { quotaBucket: 'no-such-bucket' } }), quota({}));
});

test('bar colors follow the configured thresholds and colors', () => {
  const [, line] = hud({ thresholds: { contextWarn: 30 }, colors: { contextWarn: '208' } }, { raw: true });
  assert.ok(line.includes('\x1b[38;5;208m35%'));
});

test('every documented color reaches the output', () => {
  const lines = hud({ colors: { tools: '201', success: '202', failure: '203', label: '204' } }, { raw: true }).join('\n');
  assert.ok(lines.includes('\x1b[38;5;201m✎ Edit'));
  assert.ok(lines.includes('\x1b[38;5;202m✓'));
  assert.ok(lines.includes('\x1b[38;5;203m✗'));
  assert.ok(lines.includes('\x1b[38;5;204m │ '));
});

test('tools: count, icons and targets are optional', () => {
  assert.equal(hud({ display: { maxTools: 1 } })[2], '✓ ✎ Edit: auth.ts');
  assert.equal(hud({ display: { showToolIcons: false, showToolTargets: false } })[2], '✓ Edit | ✗ Bash');
});

test('git and path options', () => {
  assert.ok(hud({ gitStatus: { showPrefix: false } })[0].includes(' │ main* ↑2 │ '));
  const long = { branch: 'feature/a-long-name', dirty: false, ahead: 0, behind: 0 };
  assert.ok(hud({ gitStatus: { maxBranchLength: 8 } }, { gitStatus: long })[0].includes('git:(feature…)'));
  assert.ok(hud({ pathLevels: 0, display: { abbreviateHome: true } })[0].includes(`~${path.sep}code${path.sep}proj`));
  assert.ok(hud({ pathLevels: 0 })[0].includes(path.join(os.homedir(), 'code', 'proj')));
});

test('credits can be hidden', () => {
  assert.ok(!hud({ display: { showCredits: false } })[1].includes('Credits'));
});
