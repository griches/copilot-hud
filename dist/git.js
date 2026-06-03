import { execSync } from 'node:child_process';
export function getGitStatus(cwd) {
    const options = { cwd: cwd ?? process.cwd(), encoding: 'utf8', stdio: 'pipe', timeout: 3000 };
    try {
        const branch = execSync('git rev-parse --abbrev-ref HEAD', options).toString().trim();
        if (!branch || branch === 'HEAD') {
            return null;
        }
        const status = execSync('git status --porcelain', options).toString().trim();
        const dirty = status.length > 0;
        let ahead = 0;
        let behind = 0;
        try {
            const counts = execSync('git rev-list --count --left-right @{upstream}...HEAD', options).toString().trim();
            const parts = counts.split('\t');
            behind = parseInt(parts[0] ?? '0', 10) || 0;
            ahead = parseInt(parts[1] ?? '0', 10) || 0;
        }
        catch {
            // No upstream
        }
        return { branch, dirty, ahead, behind };
    }
    catch {
        return null;
    }
}
