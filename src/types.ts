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
  transcript_path?: string;
  workspace?: {
    current_dir?: string;
  };
  model?: {
    id?: string;
    display_name?: string;
  };
  cost?: {
    total_api_duration_ms?: number;
    total_duration_ms?: number;
    total_premium_requests?: number;
    total_lines_added?: number;
    total_lines_removed?: number;
  };
  context_window?: {
    used_percentage?: number;
    remaining_percentage?: number;
    remaining_tokens?: number;
    context_window_size?: number;
    total_tokens?: number;
    total_input_tokens?: number;
    total_output_tokens?: number;
    total_cache_read_tokens?: number;
    total_cache_write_tokens?: number;
    last_call_input_tokens?: number;
    last_call_output_tokens?: number;
    current_usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
}

export interface RenderContext {
  state: HudState;
  session: SessionData;
  gitStatus: GitStatus | null;
  config: HudConfig;
  now: number;
}
