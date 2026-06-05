import { execSync } from 'node:child_process';
export function getGitStatus(cwd) {
    const base = { cwd: cwd ?? process.cwd(), encoding: 'utf8', stdio: 'pipe' };
    // Branch is the critical piece and `rev-parse` is effectively instant.
    // If it fails, this isn't a usable git repo — bail.
    let branch;
    try {
        branch = execSync('git rev-parse --abbrev-ref HEAD', { ...base, timeout: 3000 }).toString().trim();
    }
    catch {
        return null;
    }
    if (!branch || branch === 'HEAD') {
        return null;
    }
    // Dirty check is best-effort. On very large repos `git status` can take
    // several seconds; a slow or failed check must NOT drop the branch from the
    // HUD (it previously timed out and nulled the whole segment). Keep the
    // timeout short so it never blocks the status line for long — the `*` marker
    // is simply omitted if the check can't finish in time.
    let dirty = false;
    try {
        const status = execSync('git status --porcelain', { ...base, timeout: 2000 }).toString().trim();
        dirty = status.length > 0;
    }
    catch {
        // status too slow / unavailable — keep the branch, skip the dirty marker
    }
    // Ahead/behind is also best-effort (no upstream is common).
    let ahead = 0;
    let behind = 0;
    try {
        const counts = execSync('git rev-list --count --left-right @{upstream}...HEAD', { ...base, timeout: 2000 }).toString().trim();
        const parts = counts.split('\t');
        behind = parseInt(parts[0] ?? '0', 10) || 0;
        ahead = parseInt(parts[1] ?? '0', 10) || 0;
    }
    catch {
        // No upstream
    }
    return { branch, dirty, ahead, behind };
}
