export interface GitStatus {
    branch: string;
    dirty: boolean;
    ahead: number;
    behind: number;
}
export declare function getGitStatus(cwd?: string): GitStatus | null;
