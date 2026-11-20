import { readState, readQuota } from './state.js';
import { getGitStatus } from './git.js';
import { loadConfig } from './config.js';
import { render } from './render.js';
import { detectWidth } from './width.js';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
function readStdin() {
    return new Promise((resolve) => {
        let data = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (chunk) => { data += chunk; });
        process.stdin.on('end', () => resolve(data));
        if (process.stdin.isTTY)
            resolve('');
    });
}
/** `COPILOT_HUD_DISABLE=1 copilot` blanks the HUD for one session, settings untouched. */
function isDisabled() {
    const value = process.env.COPILOT_HUD_DISABLE?.trim().toLowerCase();
    return Boolean(value) && !['0', 'false', 'off', 'no'].includes(value);
}
export async function main() {
    if (isDisabled())
        return;
    try {
        const stdinData = await readStdin();
        let stdinJson = {};
        try {
            stdinJson = JSON.parse(stdinData);
        }
        catch { /* ignore */ }
        const session = stdinJson;
        const state = readState(session.session_id);
        const config = loadConfig();
        const cwd = session.cwd ?? state.cwd ?? process.cwd();
        const gitStatus = config.gitStatus.enabled ? getGitStatus(cwd) : null;
        const ctx = {
            state,
            session,
            gitStatus,
            config,
            now: Date.now(),
            quota: config.display.showQuota ? readQuota() : null,
            width: config.display.fitWidth ? detectWidth(config.display.maxWidth) : undefined,
        };
        render(ctx);
    }
    catch {
        process.exit(0);
    }
}
const scriptPath = fileURLToPath(import.meta.url);
const argvPath = process.argv[1];
function isSamePath(a, b) {
    try {
        return realpathSync(a) === realpathSync(b);
    }
    catch {
        return a === b;
    }
}
if (argvPath && isSamePath(argvPath, scriptPath)) {
    void main();
}
