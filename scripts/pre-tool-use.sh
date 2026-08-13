#!/bin/bash
# Copilot HUD: pre-tool-use hook
# Called before Copilot uses any tool — marks tools as "running" and records
# sub-agent spawns.
#
# The preToolUse payload differs from postToolUse and is easy to get wrong:
#
#   preToolUse   {sessionId, cwd, toolCalls: [{id, name, args}]}
#   postToolUse  {sessionId, cwd, timestamp, toolName, toolArgs, toolResult}
#
# Three differences that matter: `toolCalls` is an array (one invocation can
# carry several calls — spawning three agents arrives as a single hook firing),
# each `args` is a JSON *string* rather than an object, and there is no
# `timestamp` field, so we stamp the time ourselves.

# Only run in an interactive terminal — skip headless/background runs (e.g. copilot -p)
if [ ! -t 1 ]; then exit 0; fi

INPUT=$(cat)

COPILOT_HOME="${COPILOT_HOME:-$HOME/.copilot}"
STATE_FILE="$COPILOT_HOME/hud-state.json"
LOCK_DIR="$STATE_FILE.lock"

if [ ! -f "$STATE_FILE" ]; then
  exit 0
fi

CALLS=$(echo "$INPUT" | jq -c '.toolCalls // []' 2>/dev/null)
if [ -z "$CALLS" ] || [ "$CALLS" = "[]" ]; then
  exit 0
fi

# postToolUse supplies epoch-ms timestamps; match that so durations line up.
TIMESTAMP=$(jq -n 'now * 1000 | floor')

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

# Fold every call in the batch into one state update, so a multi-agent spawn
# doesn't need N read-modify-write cycles.
echo "$CURRENT" | jq \
  --argjson calls "$CALLS" \
  --argjson ts "$TIMESTAMP" '
  # args arrives as a JSON string; tolerate anything unparseable.
  def parsed_args: (try (.args | fromjson) catch {}) | if type == "object" then . else {} end;

  def target($name; $a):
    if $name == "edit" or $name == "view" or $name == "create" then
      ($a.path // $a.file_path // null)
    elif $name == "bash" then
      # Strip the "cd /path && " prefix Copilot prepends, then truncate.
      (($a.command // "") | split("\n")[0] | sub("^cd [^ ]+ && "; "") | .[0:60])
    else
      null
    end;

  ["report_intent", "task_complete", "thinking", "read_agent", "list_agents", "write_agent"] as $internal
  # Compare with an explicit equality test: jq'"'"'s `inside`/`contains` fall back to
  # substring matching for strings, which would filter out "task" because it is
  # a substring of "task_complete".
  | reduce ($calls[] | select((.name // "") != "" and (.name as $n | $internal | any(. == $n) | not))) as $call (
      .;
      ($call | parsed_args) as $a
      | if $call.name == "task" then
          # A sub-agent spawn. postToolUse deliberately ignores `task`, so this
          # is the only place a running agent is recorded.
          if ($a.description // "") != "" then
            .agents = ((.agents // []) + [{
              description: $a.description,
              subagentType: (if ($a.agent_type // "") == "" then null else $a.agent_type end),
              status: "running",
              startTime: $ts
            }])
          else . end
        else
          (target($call.name; $a)) as $t
          | .recentTools = ([{
              name: $call.name,
              target: (if ($t // "") == "" then null else $t end),
              status: "running",
              timestamp: $ts
            }] + (.recentTools // []))[0:8]
        end
    )
' > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"
