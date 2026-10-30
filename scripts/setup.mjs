// Installs the copilot-hud statusLine. Run under the runtime the status line
// should use:
//   node setup.mjs inspect
//   node setup.mjs install [--no-extension]
//   node setup.mjs preset <name>
// These print a JSON report on stdout. `inspect` changes nothing.
//   node setup.mjs preview [--current] [--width N] [--color]
// This prints sample HUD output as text, and changes nothing.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { copilotHome, parseCopilotJson, resolveHud } from './statusline.mjs';

const WINDOWS = process.platform === 'win32';
const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * Where Copilot reads `statusLine` from. Current CLIs keep user settings in
 * settings.json and mark config.json as managed; CLIs from before that split
 * have only config.json and read everything from it.
 */
function settingsFile(home) {
  const settings = path.join(home, 'settings.json');
  const config = path.join(home, 'config.json');
  if (fs.existsSync(settings) || !fs.existsSync(config)) return settings;
  const managed = /^\s*\/\//.test(fs.readFileSync(config, 'utf8').replace(/^﻿/, ''));
  return managed ? settings : config;
}

function readSettings(file) {
  if (!fs.existsSync(file)) return { header: '', value: {} };
  let parsed;
  try {
    parsed = parseCopilotJson(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${file} is not valid JSON (${error.message})`);
  }
  if (parsed.value === null || typeof parsed.value !== 'object' || Array.isArray(parsed.value)) {
    throw new Error(`${file} does not contain a JSON object`);
  }
  return parsed;
}

function redact(command) {
  const preview = command
    .replace(/\b(Bearer)\s+["']?[^"'\s]+/gi, '$1 [REDACTED]')
    .replace(/\b(Authorization\s*:\s*)["']?[^"'\s]+/gi, '$1[REDACTED]')
    .replace(/\b(token|api[_-]?key|secret|password|pass|auth)(=|:)\s*["']?[^"'\s]+/gi, '$1$2[REDACTED]')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, 'sk-[REDACTED]')
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{8,}\b/g, '[GITHUB_TOKEN_REDACTED]')
    .replace(/\s+/g, ' ')
    .trim();
  return preview.length > 160 ? `${preview.slice(0, 157)}...` : preview;
}

/**
 * The statusLine command. Copilot expands `~` and runs a command that is the
 * path of an existing file directly, with no shell in between — so on POSIX a
 * bare script path is the form with nothing to quote. On Windows it always
 * goes through cmd.exe, which needs the quotes.
 */
function buildCommand(wrapper) {
  if (WINDOWS) return `"${wrapper}"`;
  const home = os.homedir();
  return wrapper.startsWith(home + path.sep) ? `~${wrapper.slice(home.length)}` : wrapper;
}

function wrapperSource() {
  if (WINDOWS) {
    return `@echo off\r\nrem Written by /copilot-hud:setup. Runs the newest installed copilot-hud.\r\n"${process.execPath}" "%~dp0plugins\\copilot-hud\\statusline.mjs"\r\n`;
  }
  const runtime = process.execPath.replaceAll("'", `'\\''`);
  return [
    '#!/bin/sh',
    '# Written by /copilot-hud:setup. Runs the newest installed copilot-hud.',
    `RUNTIME='${runtime}'`,
    '# Version managers (nvm, mise, asdf) remove the old binary on upgrade.',
    '[ -x "$RUNTIME" ] || RUNTIME=node',
    'exec "$RUNTIME" "${COPILOT_HOME:-$HOME/.copilot}/plugins/copilot-hud/statusline.mjs"',
    '',
  ].join('\n');
}

/** Copy only when the bytes differ; reports whether anything was written. */
function sync(source, target, mode) {
  const next = typeof source === 'string' ? Buffer.from(source) : fs.readFileSync(source.file);
  if (fs.existsSync(target) && fs.readFileSync(target).equals(next)) {
    if (mode !== undefined) fs.chmodSync(target, mode);
    return false;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temp, next, mode === undefined ? {} : { mode });
  fs.renameSync(temp, target);
  return true;
}

/** Dotted paths of every value in the HUD config, so a report can name them. */
function configKeys(value, prefix = '') {
  return Object.entries(value).flatMap(([key, child]) => (
    child !== null && typeof child === 'object' && !Array.isArray(child)
      ? configKeys(child, `${prefix}${key}.`)
      : [`${prefix}${key}`]
  ));
}

/**
 * Point the HUD config at a preset. Everything else in the file stays, and
 * keeps winning over the preset, so the report lists those keys.
 */
async function applyPreset(name) {
  const { PRESETS } = await import('../dist/config.js');
  if (!Object.hasOwn(PRESETS, name ?? '')) {
    throw new Error(`usage: setup.mjs preset ${Object.keys(PRESETS).join('|')}`);
  }

  const configPath = path.join(copilotHome(), 'plugins', 'copilot-hud', 'config.json');
  const config = fs.existsSync(configPath) ? readSettings(configPath).value : {};
  const { preset: _previous, ...overrides } = config;
  sync(`${JSON.stringify({ ...config, preset: name }, null, 2)}\n`, configPath);
  return { configPath, preset: name, overrides: configKeys(overrides) };
}

function main(argv) {
  const [action, ...flags] = argv;
  if (!['inspect', 'install'].includes(action) || flags.some((flag) => flag !== '--no-extension')) {
    throw new Error('usage: setup.mjs inspect|install [--no-extension], preset <name>, or preview');
  }

  const home = copilotHome();
  const hudDir = path.join(home, 'plugins', 'copilot-hud');
  const launcher = path.join(hudDir, 'statusline.mjs');
  const wrapper = path.join(home, WINDOWS ? 'copilot-hud.cmd' : 'copilot-hud.sh');
  const extensionPath = path.join(home, 'extensions', 'copilot-hud', 'extension.mjs');
  const settingsPath = settingsFile(home);
  const { header, value: settings } = readSettings(settingsPath);
  const command = buildCommand(wrapper);
  const existing = typeof settings.statusLine?.command === 'string' ? settings.statusLine.command : '';
  const existingKind = existing === '' ? 'none' : existing.includes('copilot-hud') ? 'copilot-hud' : 'other';
  const hud = resolveHud(home);

  const report = {
    settingsPath,
    command,
    existing: existingKind,
    existingPreview: existing ? redact(existing) : '',
    runtime: process.execPath,
    // What the launcher will run. Null means the plugin isn't installed where
    // Copilot keeps plugins, and the status line would print nothing.
    plugin: hud ? { version: hud.version, path: hud.dir } : null,
    hudConfigExists: fs.existsSync(path.join(hudDir, 'config.json')),
  };
  if (action === 'inspect') return report;

  sync({ file: path.join(HERE, 'statusline.mjs') }, launcher);
  sync(wrapperSource(), wrapper, WINDOWS ? undefined : 0o755);
  report.launcherPath = launcher;
  report.wrapperPath = wrapper;

  if (!flags.includes('--no-extension')) {
    report.extensionPath = extensionPath;
    // Extensions load at startup, so a changed one needs a Copilot restart.
    report.extensionChanged = sync({ file: path.join(HERE, '..', 'extension', 'extension.mjs') }, extensionPath);
  }

  // A statusLine that is already ours keeps its other keys (padding,
  // refreshInterval); one we replace does not donate its to us.
  const statusLine = { ...(existingKind === 'copilot-hud' ? settings.statusLine : {}), type: 'command', command };
  const next = { ...settings, experimental: true, statusLine };
  report.settingsChanged = JSON.stringify(next) !== JSON.stringify(settings);
  if (!report.settingsChanged) return report;

  if (fs.existsSync(settingsPath)) {
    report.backupPath = `${settingsPath}.bak.${new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '')}`;
    fs.copyFileSync(settingsPath, report.backupPath);
  }
  if (existingKind === 'other') {
    report.previousCommandPath = path.join(hudDir, 'previous-statusline.txt');
    fs.writeFileSync(report.previousCommandPath, existing, { mode: 0o600 });
  }

  // Write the real file (settings.json is often a dotfiles symlink) and keep its permissions.
  const target = fs.existsSync(settingsPath) ? fs.realpathSync(settingsPath) : settingsPath;
  const mode = fs.existsSync(target) ? fs.statSync(target).mode & 0o777 : 0o600;
  const temp = `${target}.${process.pid}.tmp`;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(temp, `${header ? `${header}\n` : ''}${JSON.stringify(next, null, 2)}\n`, { mode });
  fs.chmodSync(temp, mode);
  fs.renameSync(temp, target);
  return report;
}

try {
  const [action, ...rest] = process.argv.slice(2);
  if (action === 'preview') {
    const { renderPreview } = await import('../dist/preview.js');
    process.stdout.write(renderPreview(rest));
  } else {
    const report = action === 'preset' ? await applyPreset(rest[0]) : main(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  }
} catch (error) {
  process.stderr.write(`copilot-hud setup: ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
}
