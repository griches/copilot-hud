#!/bin/bash
# Copilot HUD: pre-tool-use hook
# Called before Copilot uses any tool — marks tool as "running"

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.toolName // empty')
TOOL_ARGS=$(echo "$INPUT" | jq -r '.toolArgs // "{}"')
TIMESTAMP=$(echo "$INPUT" | jq -r '.timestamp // 0')

COPILOT_HOME="${COPILOT_HOME:-$HOME/.copilot}"
STATE_FILE="$COPILOT_HOME/hud-state.json"

if [ ! -f "$STATE_FILE" ]; then
  exit 0
fi

# Extract a human-readable "target" from common tool args
TARGET=""
if [ "$TOOL_NAME" = "edit" ] || [ "$TOOL_NAME" = "view" ] || [ "$TOOL_NAME" = "create" ]; then
  TARGET=$(echo "$TOOL_ARGS" | jq -r '.path // .file_path // empty' 2>/dev/null)
elif [ "$TOOL_NAME" = "bash" ]; then
  TARGET=$(echo "$TOOL_ARGS" | jq -r '.command // empty' 2>/dev/null | cut -c1-40)
fi

NEW_ENTRY=$(jq -n \
  --arg name "$TOOL_NAME" \
  --arg target "$TARGET" \
  --argjson ts "$TIMESTAMP" \
  '{name: $name, target: (if $target == "" then null else $target end), status: "running", timestamp: $ts}')

# Prepend to recentTools, keep last 8
CURRENT=$(cat "$STATE_FILE")
echo "$CURRENT" | jq \
  --argjson entry "$NEW_ENTRY" \
  '.recentTools = ([$entry] + (.recentTools // [])) | .recentTools = .recentTools[0:8]' \
  > "$STATE_FILE"
