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

export interface SessionData {
  cwd?: string;
  session_id?: string;
  session_name?: string;
  model?: {
    id?: string;
    display_name?: string;
  };
  cost?: {
    total_duration_ms?: number;
    total_premium_requests?: number;
  };
  context_window?: {
    used_percentage?: number;
    remaining_percentage?: number;
    remaining_tokens?: number;
    context_window_size?: number;
    total_tokens?: number;
  };
}

export interface RenderContext {
  state: HudState;
  session: SessionData;
  gitStatus: GitStatus | null;
  config: HudConfig;
  now: number;
}
