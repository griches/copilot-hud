#!/bin/bash
# Copilot HUD: session-start hook
# Called when a new Copilot CLI session begins

# NOTE: do not gate on `[ -t 1 ]` here. Copilot forks hooks with piped stdio
# so it can capture their output, which means stdin, stdout and stderr are ALL
# pipes even in a fully interactive session — the test can never be true, and
# gating on it silently disables every hook. Cross-session bleed is already
# prevented in render.ts, which only draws state whose sessionId matches the
# session currently being rendered.

if ! command -v jq &>/dev/null; then
  echo "copilot-hud: jq is required but not installed. See https://jqlang.github.io/jq/download/" >&2
  exit 1
fi

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
TIMESTAMP=$(echo "$INPUT" | jq -r '.timestamp // 0')
SESSION_ID=$(echo "$INPUT" | jq -r '.sessionId // empty')

COPILOT_HOME="${COPILOT_HOME:-$HOME/.copilot}"
STATE_FILE="$COPILOT_HOME/hud-state.json"

# Preserve agents if resuming the same session
PREV_AGENTS="[]"
if [ -f "$STATE_FILE" ]; then
  PREV_SID=$(cat "$STATE_FILE" | jq -r '.sessionId // empty')
  if [ "$PREV_SID" = "$SESSION_ID" ] && [ -n "$SESSION_ID" ]; then
    PREV_AGENTS=$(cat "$STATE_FILE" | jq -c '.agents // []')
  fi
fi

# Write initial session state
jq -n \
  --arg cwd "$CWD" \
  --arg sid "$SESSION_ID" \
  --argjson ts "$TIMESTAMP" \
  --argjson agents "$PREV_AGENTS" \
  '{
    sessionId: $sid,
    sessionStart: $ts,
    cwd: $cwd,
    lastPrompt: null,
    lastPromptTime: null,
    recentTools: [],
    agents: $agents,
    sessionActive: true
  }' > "$STATE_FILE"
