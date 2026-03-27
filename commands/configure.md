---
description: Configure which elements appear in the Copilot HUD
allowed-tools: Read, Edit
---

# Copilot HUD Configuration

This command lets you customize what the Copilot HUD displays.

## Read Current Config

First, read the existing config (if any):

```bash
COPILOT_HOME="${COPILOT_HOME:-$HOME/.copilot}"
cat "$COPILOT_HOME/plugins/copilot-hud/config.json" 2>/dev/null || echo "(no config — using defaults)"
```

## Configuration Options

Present the user with configuration choices using AskUserQuestion for each group.

### Display Elements

Ask which elements to show:
- header: "Display Elements"
- question: "Which elements should appear in the HUD?"
- multiSelect: true
- options:
  - "Project path and git branch (always shown)"
  - "Tool activity line (✓ Edit: file.ts | ✓ Bash ×2)"
  - "Session duration (⏱ 5m)"
  - "Prompt preview (last submitted prompt)"

### Git Status Detail

Ask about git display:
- header: "Git Status"
- question: "What git information should be shown?"
- options:
  - "Branch name only: git:(main)"
  - "Branch + dirty indicator: git:(main*)"
  - "Branch + dirty + ahead/behind: git:(main* ↑2 ↓1)"

### Project Path Depth

Ask about path levels:
- header: "Project Path"
- question: "How many directory levels to show in the path?"
- options:
  - "1 level (my-project)"
  - "2 levels (apps/my-project)"
  - "3 levels (dev/apps/my-project)"

## Write Config

Construct a config JSON from the answers and write it to:
`$COPILOT_HOME/plugins/copilot-hud/config.json`

Example resulting config:
```json
{
  "pathLevels": 2,
  "gitStatus": {
    "enabled": true,
    "showDirty": true,
    "showAheadBehind": false
  },
  "display": {
    "showTools": true,
    "showSessionDuration": true,
    "showPromptPreview": false
  }
}
```

Create the parent directory if it doesn't exist.

## Preview

After writing, run the HUD and show the user what it looks like:

```bash
COPILOT_HOME="${COPILOT_HOME:-$HOME/.copilot}"
PLUGIN_DIR=$(ls -d "$COPILOT_HOME/state/installed-plugins/copilot-hud/"*/ 2>/dev/null | tail -1)
if [ -n "$PLUGIN_DIR" ]; then
  node "${PLUGIN_DIR}dist/index.js" 2>/dev/null || echo "(build not found — run /copilot-hud:setup first)"
fi
```

Tell the user:
> ✅ Config saved! The HUD will reflect these settings on the next render.
> Run `/copilot-hud:setup` if you haven't set up your terminal integration yet.
