#!/bin/bash
# Copilot HUD: session-start hook
# Called when a new Copilot CLI session begins

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
TIMESTAMP=$(echo "$INPUT" | jq -r '.timestamp // 0')

COPILOT_HOME="${COPILOT_HOME:-$HOME/.copilot}"
STATE_FILE="$COPILOT_HOME/hud-state.json"

# Write initial session state
jq -n \
  --arg cwd "$CWD" \
  --argjson ts "$TIMESTAMP" \
  '{
    sessionStart: $ts,
    cwd: $cwd,
    lastPrompt: null,
    lastPromptTime: null,
    recentTools: [],
    sessionActive: true
  }' > "$STATE_FILE"
