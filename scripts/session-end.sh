#!/bin/bash
# Copilot HUD: session-end hook
# Called when a Copilot CLI session ends

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

CURRENT=$(cat "$STATE_FILE")
echo "$CURRENT" | jq '.sessionActive = false' > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"
