---
description: Configure which elements appear in the Copilot HUD
allowed-tools: Bash, Read, Edit
---

# Copilot HUD Configuration

This command lets you customize what the Copilot HUD displays.

## Read Current Config

First, read the existing config (if any):

```bash
COPILOT_HOME="${COPILOT_HOME:-$HOME/.copilot}"
cat "$COPILOT_HOME/plugins/copilot-hud/config.json" 2>/dev/null || echo "(no config — using defaults)"
```

## Configuration Flow

Present the user with configuration choices using AskUserQuestion.

### Q1: Display Preset

Ask which level of detail to show:
- header: "Display"
- question: "How much info should the HUD show? (Model, project, context bar, and reqs are always shown.)"
- multiSelect: false
- options:
  - "Full — session name, duration, token breakdown, and output speed"
  - "Standard — session name and duration"
  - "Minimal — just the basics, nothing extra"

### Q2: Tool Activity

- header: "Tools"
- question: "Show live tool activity? (✓ Edit: auth.ts | ✓ Bash: git status ×3)"
- options:
  - "Yes — show running and completed tools"
  - "No — hide tool activity"

### Q3: Git Style

- header: "Git"
- question: "How much git info to show?"
- options:
  - "Branch + dirty — git:(main*)"
  - "Branch + dirty + ahead/behind — git:(main* ↑2 ↓1)"
  - "Branch only — git:(main)"
  - "Disabled — hide git info"

### Q4: Project Path Depth

- header: "Path"
- question: "How many directory levels to show?"
- options:
  - "1 level — my-project"
  - "2 levels — apps/my-project"
  - "3 levels — dev/apps/my-project"

## Build Config from Answers

Map the answers to config keys:

| Q1 Selection | Config keys |
|-------------|------------|
| Full | `display.showSessionName: true, showSessionDuration: true, showTokenBreakdown: true, showOutputSpeed: true` |
| Standard | `display.showSessionName: true, showSessionDuration: true, showTokenBreakdown: false, showOutputSpeed: false` |
| Minimal | `display.showSessionName: false, showSessionDuration: false, showTokenBreakdown: false, showOutputSpeed: false` |

| Q2 Selection | Config key |
|-------------|------------|
| Yes | `display.showTools: true` |
| No | `display.showTools: false` |

| Q3 Selection | Config keys |
|-------------|------------|
| Branch + dirty | `gitStatus: { enabled: true, showDirty: true, showAheadBehind: false }` |
| Branch + dirty + ahead/behind | `gitStatus: { enabled: true, showDirty: true, showAheadBehind: true }` |
| Branch only | `gitStatus: { enabled: true, showDirty: false, showAheadBehind: false }` |
| Disabled | `gitStatus: { enabled: false, showDirty: false, showAheadBehind: false }` |

| Q4 Selection | Config key |
|-------------|------------|
| 1 level | `pathLevels: 1` |
| 2 levels | `pathLevels: 2` |
| 3 levels | `pathLevels: 3` |


## Write Config

Write to `$COPILOT_HOME/plugins/copilot-hud/config.json`. Create the parent directory if needed.
Merge with any existing config, preserving `colors` if present.

## After Writing

Show a preview of what the HUD will look like based on their choices, then say:
> Configuration saved! The HUD will reflect your changes on the next render.
