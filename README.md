# Copilot HUD

A GitHub Copilot CLI plugin that displays a real-time status line inside your Copilot session — project path, git branch, context usage, and tool activity.

```
  ~/Documents/Source/my-project [↙ main]                    Claude Haiku 4.5
──────────────────────────────────────────────────────────────────────────────
  [Haiku 4.5] │ my-project │ git:(main*)
  Context ████░░░░░░ 35% │ Usage 3 reqs
```

## Install

### Prerequisites

- [GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli) v1.0.12+ installed and authenticated
- Node.js 18+

### Quick Start

In your terminal, install the plugin:

```bash
copilot plugin install griches/copilot-hud
```

Then configure the native status line. Add the following to `~/.copilot/config.json`:

```json
{
  "experimental": true,
  "statusLine": {
    "type": "command",
    "command": "~/.copilot/copilot-hud.sh"
  }
}
```

Create the wrapper script at `~/.copilot/copilot-hud.sh`:

```bash
#!/bin/bash
cat | node ~/.copilot/installed-plugins/_direct/dist/index.js
```

Make it executable:

```bash
chmod +x ~/.copilot/copilot-hud.sh
```

Start Copilot with the experimental flag:

```bash
copilot --experimental
```

The HUD will appear at the bottom of the Copilot CLI interface.

> **Note:** The `statusLine` feature in Copilot CLI requires the `--experimental` flag as of v1.0.12.

### Install from Source

```bash
git clone https://github.com/griches/copilot-hud.git
cd copilot-hud
npm install
npm run build
copilot plugin install ./
```

---

## What You See

### Line 1 — Session Info

```
[Haiku 4.5] │ my-project │ git:(main*)
```

| Element | Description |
|---------|-------------|
| `[Haiku 4.5]` | Current model (cyan) |
| `my-project` | Project directory name (yellow) |
| `git:(main*)` | Branch name (cyan) with dirty indicator (magenta) |

### Line 2 — Context and Usage

```
Context ████░░░░░░ 35% │ Usage 3 reqs
```

| Element | Description |
|---------|-------------|
| Context bar | Visual progress bar of context window usage |
| `35%` | Percentage of context window used (green/yellow/red) |
| `3 reqs` | Number of premium API requests this session |

Context bar colors:
| Color | Threshold |
|-------|-----------|
| Green | < 70% |
| Yellow | 70–84% |
| Red | >= 85% |

### Line 3 — Tool Activity (when active)

```
✓ ✎ Edit: auth.ts | ✓ ⌨ Bash ×2 | ◐ ◉ View: index.ts
```

| Icon | Meaning |
|------|---------|
| `◐` | Running |
| `✓` | Success |
| `✗` | Failed |
| `⊘` | Denied |

The tools line shows real user-facing tool calls only. Internal tools (`report_intent`, `task_complete`, `thinking`) are filtered out. For `bash` calls, any leading `cd /path && ` prefix is stripped so you see the actual command.

---

## How It Works

```
Copilot CLI session
  │
  ├─ statusLine (experimental) ──→ copilot-hud.sh
  │    pipes session JSON on stdin     │
  │    (model, context_window, cost)   ▼
  │                              node dist/index.js
  │                                    │
  ├─ hooks ──→ hud-state.json          │ reads state + git
  │  (sessionStart, toolUse events)    │
  │                                    ▼
  └─────────────────────────────── rendered status line
```

- **statusLine** receives session data (model, context window, costs) as JSON on stdin
- **Hooks** fire on `sessionStart`, `userPromptSubmitted`, `preToolUse`, `postToolUse`, and `sessionEnd`, writing to `~/.copilot/hud-state.json`
- The HUD script merges both data sources and renders colorized output

---

## Configuration

Edit `~/.copilot/plugins/copilot-hud/config.json`:

```json
{
  "pathLevels": 2,
  "gitStatus": {
    "enabled": true,
    "showDirty": true,
    "showAheadBehind": true
  },
  "display": {
    "showTools": true,
    "showSessionDuration": true,
    "showPromptPreview": false
  },
  "colors": {
    "header": "cyan",
    "project": "yellow",
    "git": "magenta",
    "gitBranch": "cyan",
    "tools": "green",
    "success": "green",
    "failure": "red",
    "label": "dim"
  }
}
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `pathLevels` | `1` | Directory depth: `my-project` (1), `apps/my-project` (2) |
| `gitStatus.enabled` | `true` | Show git branch |
| `gitStatus.showDirty` | `true` | Show `*` for uncommitted changes |
| `gitStatus.showAheadBehind` | `false` | Show `↑N ↓N` ahead/behind remote |
| `display.showTools` | `true` | Show tool activity line |
| `display.showSessionDuration` | `true` | Show session timer |
| `display.showPromptPreview` | `false` | Show last submitted prompt |

### Colors

Colors can be specified as:
- Named colors: `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `dim`
- 256-color indices: `208` (orange), `99` (purple)

---

## Uninstall

```bash
# 1. Remove the plugin
copilot plugin uninstall copilot-hud

# 2. Remove the wrapper script
rm ~/.copilot/copilot-hud.sh

# 3. Remove the statusLine config from ~/.copilot/config.json
#    Delete the "statusLine" and "experimental" keys if no longer needed

# 4. Remove plugin config (optional)
rm -rf ~/.copilot/plugins/copilot-hud
```

---

## Development

```bash
# Build
npm run build

# Test with mock session data
echo '{"cwd":"/tmp/myapp","model":{"display_name":"claude-haiku-4.5"},"context_window":{"context_window_size":160000,"remaining_tokens":104000}}' | node dist/index.js
```

---

## Inspired By

Layout and colors based on [jarrodwatts/claude-hud](https://github.com/jarrodwatts/claude-hud).

---

## License

MIT
