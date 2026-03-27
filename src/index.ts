import { readState } from './state.js';
import { getGitStatus } from './git.js';
import { loadConfig } from './config.js';
import { render } from './render.js';
import type { RenderContext } from './types.js';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';

export async function main(): Promise<void> {
  try {
    const state = readState();
    const config = loadConfig();

    const cwd = state.cwd ?? process.cwd();
    const gitStatus = config.gitStatus.enabled ? getGitStatus(cwd) : null;

    const ctx: RenderContext = {
      state,
      gitStatus,
      config,
      now: Date.now(),
    };

    render(ctx);
  } catch (error) {
    console.error('[copilot-hud] Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

const scriptPath = fileURLToPath(import.meta.url);
const argvPath = process.argv[1];

function isSamePath(a: string, b: string): boolean {
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    return a === b;
  }
}

if (argvPath && isSamePath(argvPath, scriptPath)) {
  void main();
}
