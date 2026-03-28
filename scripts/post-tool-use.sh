#!/bin/bash
# Copilot HUD: post-tool-use hook
# Called after a tool completes — updates its status

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.toolName // empty')
RESULT_TYPE=$(echo "$INPUT" | jq -r '.toolResult.resultType // "success"')
TIMESTAMP=$(echo "$INPUT" | jq -r '.timestamp // 0')

COPILOT_HOME="${COPILOT_HOME:-$HOME/.copilot}"
STATE_FILE="$COPILOT_HOME/hud-state.json"

if [ ! -f "$STATE_FILE" ]; then
  exit 0
fi

# Skip internal tools
case "$TOOL_NAME" in
  report_intent|task_complete|thinking) exit 0 ;;
esac

# Map result type to our status values
case "$RESULT_TYPE" in
  "success") STATUS="success" ;;
  "failure") STATUS="failure" ;;
  "denied")  STATUS="denied"  ;;
  *)         STATUS="success" ;;
esac

CURRENT=$(cat "$STATE_FILE")

# Update the most recent "running" entry matching this tool name
echo "$CURRENT" | jq \
  --arg name "$TOOL_NAME" \
  --arg status "$STATUS" \
  --argjson ts "$TIMESTAMP" \
  '
  # Find index of first "running" entry for this tool
  ((.recentTools // []) | map(select(.status == "running" and .name == $name)) | .[0]) as $match |
  if $match != null then
    .recentTools = (.recentTools | map(
      if .name == $name and .status == "running" and . == $match
      then . + {status: $status, timestamp: $ts}
      else .
      end
    ))
  else
    # No running entry — add completed entry
    .recentTools = ([{name: $name, status: $status, timestamp: $ts}] + (.recentTools // [])) | .recentTools = .recentTools[0:8]
  end
  ' \
  > "$STATE_FILE"
