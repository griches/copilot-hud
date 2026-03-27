import type { HudConfig } from './config.js';
import type { GitStatus } from './git.js';

export interface ToolEntry {
  name: string;
  target?: string;
  status: 'running' | 'success' | 'failure' | 'denied';
  timestamp: number;
}

export interface HudState {
  sessionId?: string;
  sessionStart?: number;
  cwd?: string;
  lastPrompt?: string;
  lastPromptTime?: number;
  recentTools: ToolEntry[];
  sessionActive: boolean;
}

export interface RenderContext {
  state: HudState;
  gitStatus: GitStatus | null;
  config: HudConfig;
  now: number;
}
