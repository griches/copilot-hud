// End-to-end tests for scripts/setup.mjs and the launcher it installs. Every
// test runs against a throwaway COPILOT_HOME; nothing touches the real one.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SETUP = path.join(ROOT, 'scripts', 'setup.mjs');
const posixOnly = { skip: process.platform === 'win32' };

function makeHome(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-hud-test-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  return home;
}

function setup(home, ...args) {
  const result = spawnSync(process.execPath, [SETUP, ...args], {
    env: { ...process.env, COPILOT_HOME: home },
    encoding: 'utf8',
  });
  return { ...result, report: result.status === 0 ? JSON.parse(result.stdout) : undefined };
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const backups = (home) => fs.readdirSync(home).filter((name) => name.includes('.bak.'));

/** A stand-in plugin install that prints its own version when rendered. */
function fakePlugin(home, marketplace, version) {
  const dir = path.join(home, 'installed-plugins', marketplace, 'copilot-hud');
  fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'copilot-hud', type: 'module', version }));
  fs.writeFileSync(path.join(dir, 'dist', 'index.js'), `export async function main() { console.log('hud ${version}'); }\n`);
  return dir;
}

test('inspect reports and changes nothing', (t) => {
  const home = makeHome(t);
  const { report } = setup(home, 'inspect');
  assert.equal(report.existing, 'none');
  assert.equal(report.settingsPath, path.join(home, 'settings.json'));
  assert.equal(report.plugin, null);
  assert.deepEqual(fs.readdirSync(home), []);
});

test('install writes the launcher, wrapper, extension and settings', (t) => {
  const home = makeHome(t);
  const { report } = setup(home, 'install');
  assert.ok(fs.existsSync(path.join(home, 'plugins', 'copilot-hud', 'statusline.mjs')));
  assert.ok(fs.existsSync(report.wrapperPath));
  assert.ok(fs.existsSync(path.join(home, 'extensions', 'copilot-hud', 'extension.mjs')));
  assert.equal(report.extensionChanged, true);

  const settings = readJson(path.join(home, 'settings.json'));
  assert.deepEqual(settings.statusLine, { type: 'command', command: report.command });
  assert.equal(settings.experimental, true);
  // Nothing existed to back up.
  assert.equal(report.backupPath, undefined);
});

test('install keeps every other setting and backs the file up first', (t) => {
  const home = makeHome(t);
  const file = path.join(home, 'settings.json');
  const before = { allowedUrls: ['https://example.com'], enabledPlugins: { a: true } };
  fs.writeFileSync(file, JSON.stringify(before), { mode: 0o600 });

  const { report } = setup(home, 'install');
  const after = readJson(file);
  assert.deepEqual(after.allowedUrls, before.allowedUrls);
  assert.deepEqual(after.enabledPlugins, before.enabledPlugins);
  assert.deepEqual(readJson(report.backupPath), before);
  if (process.platform !== 'win32') assert.equal(fs.statSync(file).mode & 0o777, 0o600);
});

test('a second install is a no-op: no rewrite, no extra backup', (t) => {
  const home = makeHome(t);
  fs.writeFileSync(path.join(home, 'settings.json'), '{}');
  setup(home, 'install');
  const count = backups(home).length;

  const { report } = setup(home, 'install');
  assert.equal(report.settingsChanged, false);
  assert.equal(report.extensionChanged, false);
  assert.equal(report.existing, 'copilot-hud');
  assert.equal(backups(home).length, count);
});

test('re-install keeps statusLine keys the user added', (t) => {
  const home = makeHome(t);
  setup(home, 'install');
  const file = path.join(home, 'settings.json');
  const settings = readJson(file);
  settings.statusLine.refreshInterval = 5;
  settings.statusLine.padding = 2;
  fs.writeFileSync(file, JSON.stringify(settings));

  setup(home, 'install');
  const { statusLine } = readJson(file);
  assert.equal(statusLine.refreshInterval, 5);
  assert.equal(statusLine.padding, 2);
});

test('another status line is reported redacted, saved, and replaced cleanly', (t) => {
  const home = makeHome(t);
  const file = path.join(home, 'settings.json');
  const other = 'curl -H "Authorization: Bearer abc123secret" https://x.test?token=hunter2';
  fs.writeFileSync(file, JSON.stringify({ statusLine: { type: 'command', command: other, padding: 3 } }));

  const inspect = setup(home, 'inspect').report;
  assert.equal(inspect.existing, 'other');
  assert.ok(!inspect.existingPreview.includes('abc123secret'));
  assert.ok(!inspect.existingPreview.includes('hunter2'));

  const { report } = setup(home, 'install');
  assert.equal(fs.readFileSync(report.previousCommandPath, 'utf8'), other);
  // The replaced command's own options don't carry over to ours.
  assert.deepEqual(readJson(file).statusLine, { type: 'command', command: report.command });
});

test('legacy CLI: an unmanaged config.json with no settings.json is the target', (t) => {
  const home = makeHome(t);
  fs.writeFileSync(path.join(home, 'config.json'), JSON.stringify({ trusted_folders: ['/x'] }));
  const { report } = setup(home, 'install');
  assert.equal(report.settingsPath, path.join(home, 'config.json'));
  assert.deepEqual(readJson(report.settingsPath).trusted_folders, ['/x']);
  assert.ok(!fs.existsSync(path.join(home, 'settings.json')));
});

test('current CLI: a managed config.json is left alone', (t) => {
  const home = makeHome(t);
  const managed = '// User settings belong in settings.json.\n// This file is managed automatically.\n{\n  "installedPlugins": []\n}\n';
  fs.writeFileSync(path.join(home, 'config.json'), managed);
  const { report } = setup(home, 'install');
  assert.equal(report.settingsPath, path.join(home, 'settings.json'));
  assert.equal(fs.readFileSync(path.join(home, 'config.json'), 'utf8'), managed);
});

test('leading comment lines in the settings file survive the rewrite', (t) => {
  const home = makeHome(t);
  const file = path.join(home, 'settings.json');
  fs.writeFileSync(file, '// mine\n{ "theme": "dark" }\n');
  setup(home, 'install');
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(text.startsWith('// mine\n{'));
  assert.equal(JSON.parse(text.slice(text.indexOf('{'))).theme, 'dark');
});

test('invalid settings stop the install without writing anything', (t) => {
  const home = makeHome(t);
  const file = path.join(home, 'settings.json');
  fs.writeFileSync(file, '{ "theme": ');
  const result = setup(home, 'install');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /not valid JSON/);
  assert.equal(fs.readFileSync(file, 'utf8'), '{ "theme": ');
  assert.deepEqual(fs.readdirSync(home), ['settings.json']);
});

test('settings.json behind a symlink is written through, not replaced', posixOnly, (t) => {
  const home = makeHome(t);
  const real = path.join(makeHome(t), 'dotfiles-settings.json');
  fs.writeFileSync(real, '{}');
  fs.symlinkSync(real, path.join(home, 'settings.json'));
  setup(home, 'install');
  assert.ok(fs.lstatSync(path.join(home, 'settings.json')).isSymbolicLink());
  assert.equal(readJson(real).statusLine.type, 'command');
});

test('--no-extension skips the quota extension', (t) => {
  const home = makeHome(t);
  const { report } = setup(home, 'install', '--no-extension');
  assert.equal(report.extensionPath, undefined);
  assert.ok(!fs.existsSync(path.join(home, 'extensions')));
});

test('bad arguments fail with usage', (t) => {
  const home = makeHome(t);
  assert.equal(setup(home, 'uninstall').status, 1);
  assert.equal(setup(home, 'install', '--force').status, 1);
});

test('the installed command renders the registered plugin', posixOnly, (t) => {
  const home = makeHome(t);
  const dir = fakePlugin(home, 'copilot-hud', '1.2.3');
  fs.writeFileSync(
    path.join(home, 'config.json'),
    `// This file is managed automatically.\n${JSON.stringify({ installedPlugins: [{ name: 'copilot-hud', enabled: true, cache_path: dir }] })}\n`,
  );
  const { report } = setup(home, 'install');
  assert.deepEqual(report.plugin, { version: '1.2.3', path: dir });

  const out = execFileSync(report.wrapperPath, { env: { ...process.env, COPILOT_HOME: home }, input: '{}', encoding: 'utf8' });
  assert.equal(out, 'hud 1.2.3\n');
});

test('the launcher follows the plugin when it moves marketplaces', posixOnly, (t) => {
  const home = makeHome(t);
  const old = fakePlugin(home, 'old-marketplace', '1.0.0');
  const { report } = setup(home, 'install');
  const run = () => execFileSync(report.wrapperPath, { env: { ...process.env, COPILOT_HOME: home }, input: '{}', encoding: 'utf8' });
  assert.equal(run(), 'hud 1.0.0\n');

  fakePlugin(home, 'new-marketplace', '1.1.0');
  assert.equal(run(), 'hud 1.1.0\n');
  fs.rmSync(old, { recursive: true });
  assert.equal(run(), 'hud 1.1.0\n');
});

test('the launcher prints nothing when no plugin is installed', posixOnly, (t) => {
  const home = makeHome(t);
  const { report } = setup(home, 'install');
  const result = spawnSync(report.wrapperPath, { env: { ...process.env, COPILOT_HOME: home }, input: '{}', encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
});

test('the wrapper falls back to node on PATH when its runtime is gone', posixOnly, (t) => {
  const home = makeHome(t);
  fakePlugin(home, 'copilot-hud', '2.0.0');
  const { report } = setup(home, 'install');
  const source = fs.readFileSync(report.wrapperPath, 'utf8');
  fs.writeFileSync(report.wrapperPath, source.replace(/^RUNTIME='.*'$/m, "RUNTIME='/nonexistent/node'"));
  const env = { ...process.env, COPILOT_HOME: home, PATH: `${path.dirname(process.execPath)}:${process.env.PATH}` };
  assert.equal(execFileSync(report.wrapperPath, { env, input: '{}', encoding: 'utf8' }), 'hud 2.0.0\n');
});

test('preset points the HUD config at a look and reports what still overrides it', (t) => {
  const home = makeHome(t);
  const configPath = path.join(home, 'plugins', 'copilot-hud', 'config.json');

  let { report } = setup(home, 'preset', 'compact');
  assert.deepEqual(readJson(configPath), { preset: 'compact' });
  assert.deepEqual(report.overrides, []);

  fs.writeFileSync(configPath, JSON.stringify({ preset: 'compact', pathLevels: 2, display: { showEffort: false } }));
  ({ report } = setup(home, 'preset', 'full'));
  assert.deepEqual(readJson(configPath), { preset: 'full', pathLevels: 2, display: { showEffort: false } });
  assert.deepEqual(report.overrides, ['pathLevels', 'display.showEffort']);

  const rejected = setup(home, 'preset', 'constructor');
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /compact\|minimal\|standard\|full/);
});

test('preset refuses a config file it cannot parse, leaving it alone', (t) => {
  const home = makeHome(t);
  const configPath = path.join(home, 'plugins', 'copilot-hud', 'config.json');
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, '{ broken');
  assert.notEqual(setup(home, 'preset', 'full').status, 0);
  assert.equal(fs.readFileSync(configPath, 'utf8'), '{ broken');
});

test('preview draws every look as plain text and changes nothing', (t) => {
  const home = makeHome(t);
  const run = (...args) => spawnSync(process.execPath, [SETUP, 'preview', ...args], {
    env: { ...process.env, COPILOT_HOME: home },
    encoding: 'utf8',
  });
  const { status, stdout } = run();
  assert.equal(status, 0);
  for (const title of ['Standard:', 'Compact:', 'Minimal:', 'Full:']) assert.ok(stdout.includes(title), title);
  assert.ok(stdout.includes('[sonnet-4.6 1x·medium]'));
  assert.ok(!stdout.includes('\x1b'));
  assert.ok(run('--color').stdout.includes('\x1b['));
  assert.deepEqual(fs.readdirSync(home), []);

  fs.mkdirSync(path.join(home, 'plugins', 'copilot-hud'), { recursive: true });
  fs.writeFileSync(path.join(home, 'plugins', 'copilot-hud', 'config.json'), JSON.stringify({ preset: 'compact' }));
  const current = run('--current').stdout;
  assert.ok(current.includes('Ctx ██░░░ 35%'));
  assert.ok(!current.includes('Standard:'));
});
