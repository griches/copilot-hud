# Copilot HUD

A GitHub Copilot CLI plugin that displays a real-time status line inside your Copilot session — project path, git branch, context usage, and tool activity.

```
  ~/Documents/Source/my-project [↙ main]               Claude Sonnet 4.6 (medium)
──────────────────────────────────────────────────────────────────────────────────
  [Sonnet 4.6 (medium)] │ my-project │ git:(main*) │ Creating README │ ⏱ 5m
  Context ████░░░░░░ 35% │ Reqs 3
  ✓ ✎ Edit: auth.ts | ✓ ⌨ Bash: git status ×3 | ◐ ◉ Read: index.ts
```

## Install

### Prerequisites

- [GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli) v1.0.12+ installed and authenticated
- Node.js 18+

### Quick Start

1. Install the plugin:
   ```bash
   copilot plugin install griches/copilot-hud
   ```

2. Start Copilot with the experimental flag and run the setup skill:
   ```bash
   copilot --experimental
   ```
   Then inside the session:
   ```
   /copilot-hud:setup
   ```

The setup will automatically create the wrapper script, configure the status line, and enable the experimental flag. Restart Copilot after setup and the HUD will appear at the bottom of the interface.

3. (Optional) Customize what the HUD shows:
   ```
   /copilot-hud:configure
   ```
   Choose which elements to display — session name, duration, token breakdown, output speed, tool activity, and git style.

> **Note:** The `statusLine` feature in Copilot CLI requires the `--experimental` flag as of v1.0.12. The setup skill adds this to your config permanently.

### Install from Source

```bash
git clone https://github.com/griches/copilot-hud.git
cd copilot-hud
npm install
npm run build
copilot plugin install ./
```

---

## Features

### Model and Project Info
Shows which model you're using, your project name, and git branch at a glance. The model name is shortened for readability — `claude-sonnet-4.6 (medium)` becomes `[Sonnet 4.6 (medium)]`. Dirty branches show a `*` indicator, and optionally ahead/behind counts.

```
[Sonnet 4.6 (medium)] │ my-project │ git:(main*)
```

### Context Window and Requests
A live progress bar showing how much of the context window you've used. Matches the percentage shown in Copilot's own Context Usage display. Changes color as you approach the limit — green when you have plenty of room, yellow when it's getting tight, red when you're running low.

```
Context ████░░░░░░ 35% │ Reqs 3 │ (in: 24.1k, cache: 15.0k) │ out: 42.1 tok/s
```

- **Reqs** — premium API requests this session
- **Token breakdown** (optional) — input and cache token counts
- **Output speed** (optional) — tokens per second throughput

### Session Info
Optionally show the session name and duration on the project line:

```
[Sonnet 4.6 (medium)] │ my-project │ git:(main*) │ Creating README │ ⏱ 5m
```

### Live Tool Activity
See what Copilot is doing in real time. When Copilot reads files, runs commands, or edits code, the tools line updates to show each tool's status. Completed tools show a checkmark, running tools show a spinner, and failed tools show an X.

```
✓ ✎ Edit: auth.ts | ✓ ⌨ Bash: git status ×3 | ◐ ◉ Read: index.ts
```

Only real tool calls are shown — internal tools like `report_intent` are filtered out. For shell commands, the actual command is displayed (the `cd /path &&` prefix Copilot adds is stripped).

### Background Agent Tracking
When Copilot spawns subagents (background or foreground), they're tracked and displayed below the tools line. Each agent shows its type, description, status, and duration.

```
✓ [explore] Search auth module (12s)
◐ [general-purpose] Analyze dependencies (8s…)
✓ [explore] Find test files (28s)
```

Running agents show elapsed time with a `…` suffix. Completed agents show their final duration. The number of agents displayed is configurable (default: 5).

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
  "pathLevels": 1,
  "gitStatus": {
    "enabled": true,
    "showDirty": true,
    "showAheadBehind": true
  },
  "display": {
    "showTools": true,
    "showAgents": true,
    "maxAgents": 5,
    "showSessionName": true,
    "showSessionDuration": true,
    "showTokenBreakdown": false,
    "showOutputSpeed": false
  }
}
```

Or run `/copilot-hud:configure` inside a Copilot session for guided setup.

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `pathLevels` | `1` | Directory depth: `my-project` (1), `apps/my-project` (2) |
| `gitStatus.enabled` | `true` | Show git branch |
| `gitStatus.showDirty` | `true` | Show `*` for uncommitted changes |
| `gitStatus.showAheadBehind` | `true` | Show `↑N ↓N` ahead/behind remote |
| `display.showTools` | `true` | Show tool activity line |
| `display.showAgents` | `true` | Show background agent tracking |
| `display.maxAgents` | `5` | Max number of agents to display |
| `display.showSessionName` | `true` | Show session name/title |
| `display.showSessionDuration` | `true` | Show `⏱ 5m` wall clock time |
| `display.showTokenBreakdown` | `false` | Show `(in: 24k, cache: 15k)` |
| `display.showOutputSpeed` | `false` | Show `out: 42.1 tok/s` |

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
