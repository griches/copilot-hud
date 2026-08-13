#!/bin/bash
# Copilot HUD: user-prompt hook
# Called when the user submits a prompt

# NOTE: do not gate on `[ -t 1 ]` here. Copilot forks hooks with piped stdio
# so it can capture their output, which means stdin, stdout and stderr are ALL
# pipes even in a fully interactive session — the test can never be true, and
# gating on it silently disables every hook. Cross-session bleed is already
# prevented in render.ts, which only draws state whose sessionId matches the
# session currently being rendered.

INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // empty')
TIMESTAMP=$(echo "$INPUT" | jq -r '.timestamp // 0')

COPILOT_HOME="${COPILOT_HOME:-$HOME/.copilot}"
STATE_FILE="$COPILOT_HOME/hud-state.json"
LOCK_DIR="$STATE_FILE.lock"

if [ ! -f "$STATE_FILE" ]; then
  exit 0
fi

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

# Update prompt info in state, keep other fields
CURRENT=$(cat "$STATE_FILE")
echo "$CURRENT" | jq \
  --arg prompt "$PROMPT" \
  --argjson ts "$TIMESTAMP" \
  '.lastPrompt = $prompt | .lastPromptTime = $ts' \
  > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"
