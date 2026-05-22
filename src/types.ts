import type { HudConfig } from './config.js';
import type { GitStatus } from './git.js';

export interface ToolEntry {
  name: string;
  target?: string;
  status: 'running' | 'success' | 'failure' | 'denied';
  timestamp: number;
}

export interface AgentEntry {
  description: string;
  subagentType?: string;
  status: 'running' | 'success' | 'failure';
  startTime: number;
  endTime?: number;
}

export interface HudState {
  sessionId?: string;
  sessionStart?: number;
  cwd?: string;
  lastPrompt?: string;
  lastPromptTime?: number;
  recentTools: ToolEntry[];
  agents?: AgentEntry[];
  sessionActive: boolean;
}

export interface SessionData {
  cwd?: string;
  session_id?: string;
  session_name?: string;
  transcript_path?: string;
  username?: string | null;
  version?: string;
  remote?: {
    connected?: boolean;
  };
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
    /**
     * Legacy field — premium request count. Superseded by `ai_used` once
     * GitHub Copilot moved to usage-based ("credits") billing.
     * Kept for backward compatibility with older Copilot CLI versions.
     */
    total_premium_requests?: number;
    total_lines_added?: number;
    total_lines_removed?: number;
  };
  /**
   * Session-wide AI usage / "credits" under Copilot's usage-based billing.
   * `formatted` is the display-ready string (e.g. "26.5") in AIU,
   * where 1 AIU = $0.01 USD. `total_nano_aiu` is the raw count
   * (1 nano-AIU = 1e-9 AIU).
   */
  ai_used?: {
    total_nano_aiu?: number;
    formatted?: string;
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
    total_reasoning_tokens?: number;
    last_call_input_tokens?: number;
    last_call_output_tokens?: number;
    current_context_tokens?: number;
    current_context_used_percentage?: number;
    displayed_context_limit?: number;
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
