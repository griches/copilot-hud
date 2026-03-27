---
description: Set up Copilot HUD as a statusline for your terminal or tmux
allowed-tools: Bash, Read, Edit
---

# Copilot HUD Setup

This command sets up `copilot-hud` to display a live status bar showing your project path, git branch, tool activity, and session duration.

## Step 1: Detect Runtime and Plugin Path

Detect the Node.js runtime and plugin installation path:

**macOS/Linux:**
```bash
# Find Node.js
command -v node 2>/dev/null

# Find the installed plugin
COPILOT_HOME="${COPILOT_HOME:-$HOME/.copilot}"
ls -d "$COPILOT_HOME/state/installed-plugins/copilot-hud/"*/ 2>/dev/null | tail -1
```

If Node.js is not found, ask the user to install it from https://nodejs.org/ and re-run setup.

If the plugin path is empty, the plugin is not installed. Ask the user to run:
```
copilot plugin install OWNER/copilot-hud
```

## Step 2: Build the HUD Script (if needed)

Check if `dist/index.js` exists in the plugin directory. If not, build it:
```bash
cd "$PLUGIN_DIR" && node --version && npm ci && npm run build
```

## Step 3: Detect Terminal Environment

Run the following to understand the user's environment:
```bash
echo "tmux: ${TMUX:-not running}"
echo "shell: $SHELL"
echo "term: $TERM"
```

## Step 4: Choose Integration Method

Ask the user which method they prefer using AskUserQuestion:
- header: "HUD Integration"
- question: "How would you like to display the Copilot HUD?"
- options:
  - "tmux status bar (recommended — always visible, live updates)"
  - "Shell prompt (updates after each command)"
  - "Manual — I'll run `node dist/index.js` myself"

### Option A: tmux Status Bar

Add the HUD to tmux's status bar. This updates every 2 seconds automatically.

Detect tmux config file: `~/.tmux.conf` or `~/.config/tmux/tmux.conf`.

Add these lines (substitute actual `NODE_PATH` and `PLUGIN_DIR`):

```
# Copilot HUD
set -g status-right-length 200
set -g status-interval 2
set -g status-right "#(node {PLUGIN_DIR}/dist/index.js 2>/dev/null | tr '\\n' ' │ ' | sed 's/ │ $//')"
```

After writing, instruct user to reload tmux config:
```bash
tmux source-file ~/.tmux.conf
```

Or if tmux is not running, tell them to start tmux and the HUD will appear automatically.

### Option B: Shell Prompt

Add the HUD below the shell prompt. Detect shell:

**zsh** (`~/.zshrc`):
```bash
# Copilot HUD
copilot_hud_precmd() {
  local hud
  hud=$(node {PLUGIN_DIR}/dist/index.js 2>/dev/null)
  if [ -n "$hud" ]; then
    printf '\n%s\n' "$hud"
  fi
}
autoload -Uz add-zsh-hook
add-zsh-hook precmd copilot_hud_precmd
```

**bash** (`~/.bashrc`):
```bash
# Copilot HUD
copilot_hud_prompt() {
  local hud
  hud=$(node {PLUGIN_DIR}/dist/index.js 2>/dev/null)
  if [ -n "$hud" ]; then
    printf '\n%s\n' "$hud"
  fi
}
PROMPT_COMMAND="copilot_hud_prompt${PROMPT_COMMAND:+;$PROMPT_COMMAND}"
```

After writing, instruct user to source their rc file:
```bash
source ~/.zshrc   # or ~/.bashrc
```

## Step 5: Verify

Run the HUD script manually and check output:
```bash
node {PLUGIN_DIR}/dist/index.js
```

Expected output (example):
```
[Copilot] │ my-project │ git:(main*)
```

If the output looks correct, setup is complete. ✅

## Step 6: Optional Features

Ask if the user wants to enable optional features (currently off by default):

Use AskUserQuestion:
- header: "Optional features"
- question: "Enable any optional HUD features?"
- multiSelect: true
- options:
  - "Show tool activity (✓ Edit: file.ts | ✓ Bash ×2)"
  - "Show session duration (⏱ 5m)"
  - "Show prompt preview (last user prompt, truncated)"
  - "Show git ahead/behind counts (↑2 ↓1)"

Write the selected options to `$COPILOT_HOME/plugins/copilot-hud/config.json`.

| Selection | Config keys |
|-----------|-------------|
| Show tool activity | `display.showTools: true` |
| Show session duration | `display.showSessionDuration: true` |
| Show prompt preview | `display.showPromptPreview: true` |
| Show git ahead/behind | `gitStatus.showAheadBehind: true` |

Merge with any existing config. Only write selected keys.
