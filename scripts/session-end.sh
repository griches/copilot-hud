#!/bin/bash
# Copilot HUD: session-end hook
# Called when a Copilot CLI session ends

COPILOT_HOME="${COPILOT_HOME:-$HOME/.copilot}"
STATE_FILE="$COPILOT_HOME/hud-state.json"

if [ ! -f "$STATE_FILE" ]; then
  exit 0
fi

CURRENT=$(cat "$STATE_FILE")
echo "$CURRENT" | jq '.sessionActive = false' > "$STATE_FILE"
