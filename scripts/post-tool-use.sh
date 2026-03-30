#!/bin/bash
# Copilot HUD: post-tool-use hook
# Called after a tool completes — updates its status

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.toolName // empty')
RESULT_TYPE=$(echo "$INPUT" | jq -r '.toolResult.resultType // "success"')
TIMESTAMP=$(echo "$INPUT" | jq -r '.timestamp // 0')

COPILOT_HOME="${COPILOT_HOME:-$HOME/.copilot}"
STATE_FILE="$COPILOT_HOME/hud-state.json"
LOCK_DIR="$STATE_FILE.lock"

if [ ! -f "$STATE_FILE" ]; then
  exit 0
fi

# Skip internal tools
case "$TOOL_NAME" in
  report_intent|task_complete|thinking|list_agents|write_agent) exit 0 ;;
esac

# task postToolUse means the agent was SPAWNED, not completed — skip
if [ "$TOOL_NAME" = "task" ]; then
  exit 0
fi

# Map result type to our status values
case "$RESULT_TYPE" in
  "success") STATUS="success" ;;
  "failure") STATUS="failure" ;;
  "denied")  STATUS="denied"  ;;
  *)         STATUS="success" ;;
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

CURRENT=$(cat "$STATE_FILE")

# read_agent postToolUse means an agent has completed — mark oldest running agent as done
if [ "$TOOL_NAME" = "read_agent" ]; then
  echo "$CURRENT" | jq \
    --arg status "$STATUS" \
    --argjson ts "$TIMESTAMP" \
    '
    ((.agents // []) | to_entries | map(select(.value.status == "running")) | .[0].key) as $idx |
    if $idx != null then
      .agents[$idx].status = $status |
      .agents[$idx].endTime = $ts
    else .
    end
    ' \
    > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"
  exit 0
fi

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
  > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"
