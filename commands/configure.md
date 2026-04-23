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
  - "Full — session name, duration, token breakdown, output speed, lines changed, effort, last call, and cache breakdown"
  - "Standard — session name, duration, token breakdown, output speed, lines changed, and effort"
  - "Minimal — just the basics, nothing extra"

### Q2: Tool Activity

- header: "Tools"
- question: "Show live tool activity? (✓ Edit: auth.ts | ✓ Bash: git status ×3)"
- options:
  - "Yes — show running and completed tools"
  - "No — hide tool activity"

### Q2b: Agent Activity

- header: "Agents"
- question: "Show background agent tracking? (✓ [explore] Search codebase (12s))"
- options:
  - "Yes — show spawned agent status and duration"
  - "No — hide agent activity"

### Q2c: Agent History (only ask if Q2b is "Yes")

- header: "Agent History"
- question: "How many agents to show in the status line?"
- options:
  - "3 — compact"
  - "5 — default"
  - "8 — extended"
  - "10 — full history"

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
  - "1 level (default) — my-project"
  - "2 levels — projects/my-project"
  - "3 levels — you/projects/my-project"
  - "0 levels — full absolute path — /Users/you/projects/my-project"

### Q5: Code Stats

- header: "Lines Changed"
- question: "Show lines added/removed? (+42/-3 style)"
- options:
  - "Yes — show lines changed"
  - "No — hide lines changed"

### Q6: Effort Display

- header: "Effort"
- question: "Show model effort level and multiplier? (3x·high)"
- options:
  - "Yes — show effort info"
  - "No — hide effort info"

### Q7: Rainbow Project Path

- header: "Path Style"
- question: "Render the project path as a rainbow gradient with background?"
- options:
  - "Solid color (default) — classic single-color path"
  - "Rainbow + lavender bg — colorful path with subtle background"
  - "Rainbow, no bg — colorful path without background"

## Build Config from Answers

Map the answers to config keys:

| Q1 Selection | Config keys |
|-------------|------------|
| Full | `display.showSessionName: true, showSessionDuration: true, showTokenBreakdown: true, showOutputSpeed: true, showLinesChanged: true, showEffort: true, showLastCall: true, showCacheBreakdown: true` |
| Standard | `display.showSessionName: true, showSessionDuration: true, showTokenBreakdown: true, showOutputSpeed: true, showLinesChanged: true, showEffort: true, showLastCall: false, showCacheBreakdown: false` |
| Minimal | `display.showSessionName: false, showSessionDuration: false, showTokenBreakdown: false, showOutputSpeed: false, showLinesChanged: false, showEffort: false, showLastCall: false, showCacheBreakdown: false` |

| Q2 Selection | Config key |
|-------------|------------|
| Yes | `display.showTools: true` |
| No | `display.showTools: false` |

| Q2b Selection | Config key |
|-------------|------------|
| Yes | `display.showAgents: true` |
| No | `display.showAgents: false` |

| Q2c Selection | Config key |
|-------------|------------|
| 3 | `display.maxAgents: 3` |
| 5 | `display.maxAgents: 5` |
| 8 | `display.maxAgents: 8` |
| 10 | `display.maxAgents: 10` |

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
| 0 levels | `pathLevels: 0` |

| Q5 Selection | Config key |
|-------------|------------|
| Yes | `display.showLinesChanged: true` |
| No | `display.showLinesChanged: false` |

| Q6 Selection | Config key |
|-------------|------------|
| Yes | `display.showEffort: true` |
| No | `display.showEffort: false` |

| Q7 Selection | Config keys |
|-------------|------------|
| Solid color | `display.rainbowPath: false` |
| Rainbow + lavender bg | `display.rainbowPath: true, colors.rainbowPathBg: "189"` |
| Rainbow, no bg | `display.rainbowPath: true, colors.rainbowPathBg: "none"` |


## Write Config

Write to `$COPILOT_HOME/plugins/copilot-hud/config.json`. Create the parent directory if needed.
Merge with any existing config, preserving `colors` if present.

## After Writing

Show a preview of what the HUD will look like based on their choices, then say:
> Configuration saved! The HUD will reflect your changes on the next render.
