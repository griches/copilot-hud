#!/bin/bash
# Copilot HUD: pre-tool-use hook
# Called before Copilot uses any tool — marks tool as "running"

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.toolName // empty')
TOOL_ARGS=$(echo "$INPUT" | jq -r '.toolArgs // "{}"')
TIMESTAMP=$(echo "$INPUT" | jq -r '.timestamp // 0')

COPILOT_HOME="${COPILOT_HOME:-$HOME/.copilot}"
STATE_FILE="$COPILOT_HOME/hud-state.json"
LOCK_DIR="$STATE_FILE.lock"

if [ ! -f "$STATE_FILE" ]; then
  exit 0
fi

# Skip internal tools
case "$TOOL_NAME" in
  report_intent|task_complete|thinking|read_agent|list_agents|write_agent) exit 0 ;;
esac

# Acquire lock (mkdir is atomic)
RETRIES=0
while ! mkdir "$LOCK_DIR" 2>/dev/null; do
  sleep 0.05
  RETRIES=$((RETRIES + 1))
  if [ $RETRIES -ge 40 ]; then
    rmdir "$LOCK_DIR" 2>/dev/null
    break
  fi
done
trap 'rmdir "$LOCK_DIR" 2>/dev/null' EXIT

# Handle subagent spawns separately
if [ "$TOOL_NAME" = "task" ]; then
  DESCRIPTION=$(echo "$TOOL_ARGS" | jq -r '.description // empty' 2>/dev/null)
  SUBAGENT_TYPE=$(echo "$TOOL_ARGS" | jq -r '.agent_type // empty' 2>/dev/null)

  if [ -n "$DESCRIPTION" ]; then
    AGENT_ENTRY=$(jq -n \
      --arg desc "$DESCRIPTION" \
      --arg type "$SUBAGENT_TYPE" \
      --argjson ts "$TIMESTAMP" \
      '{description: $desc, subagentType: (if $type == "" then null else $type end), status: "running", startTime: $ts}')

    CURRENT=$(cat "$STATE_FILE")
    echo "$CURRENT" | jq \
      --argjson entry "$AGENT_ENTRY" \
      '.agents = ((.agents // []) + [$entry])' \
      > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"
  fi
  exit 0
fi

# Extract a human-readable "target" from common tool args
TARGET=""
if [ "$TOOL_NAME" = "edit" ] || [ "$TOOL_NAME" = "view" ] || [ "$TOOL_NAME" = "create" ]; then
  TARGET=$(echo "$TOOL_ARGS" | jq -r '.path // .file_path // empty' 2>/dev/null)
elif [ "$TOOL_NAME" = "bash" ]; then
  # Strip "cd /path && " prefix that Copilot prepends, then truncate
  TARGET=$(echo "$TOOL_ARGS" | jq -r '.command // empty' 2>/dev/null | head -1 | sed 's|^cd [^ ]* && ||' | cut -c1-60)
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
  > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"
