import { readState } from './state.js';
import { getGitStatus } from './git.js';
import { loadConfig } from './config.js';
import { render } from './render.js';
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
export async function main() {
    try {
        const stdinData = await readStdin();
        let stdinJson = {};
        try {
            stdinJson = JSON.parse(stdinData);
        }
        catch { /* ignore */ }
        const session = stdinJson;
        const state = readState();
        const config = loadConfig();
        const cwd = session.cwd ?? state.cwd ?? process.cwd();
        const gitStatus = config.gitStatus.enabled ? getGitStatus(cwd) : null;
        const ctx = {
            state,
            session,
            gitStatus,
            config,
            now: Date.now(),
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
