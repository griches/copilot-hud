#!/bin/bash
# Copilot HUD: user-prompt hook
# Called when the user submits a prompt

INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // empty')
TIMESTAMP=$(echo "$INPUT" | jq -r '.timestamp // 0')

COPILOT_HOME="${COPILOT_HOME:-$HOME/.copilot}"
STATE_FILE="$COPILOT_HOME/hud-state.json"

if [ ! -f "$STATE_FILE" ]; then
  exit 0
fi

# Update prompt info in state, keep other fields
CURRENT=$(cat "$STATE_FILE")
echo "$CURRENT" | jq \
  --arg prompt "$PROMPT" \
  --argjson ts "$TIMESTAMP" \
  '.lastPrompt = $prompt | .lastPromptTime = $ts' \
  > "$STATE_FILE"
