# Copilot HUD

A GitHub Copilot CLI plugin that displays a real-time status line inside your Copilot session — project path, git branch, context usage, tool activity, and background agents.

English | [中文](README.zh.md)

```
  /Users/sky/Github/my-project [↙ main]                 Claude Opus 4.6 (3x) (high)
──────────────────────────────────────────────────────────────────────────────────────
  [Opus 4.6 3x·high] │ my-project │ git:(main* ↑2) │ Creating README │ ⏱ 5m │ +42/-3
  Ctx ████░░░░░░ 70.0k/200.0k 35% │ Credits 1.42 │ in:1.5M out:12.2k cache:1.4M │ 42 tok/s
  ✓ ✎ Edit: auth.ts | ✓ ⌨ Bash: git status ×3 | ◐ ◉ Read: index.ts
  ◐ [explore] Analyze test coverage (45s…)
  ✓ [explore] Search auth module (18s)
  ✗ [general-purpose] Parse config schema (1m 12s)
```

## Install

### Prerequisites

- [GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli) v1.0.12+ installed and authenticated
- Node.js 18+
- [`jq`](https://jqlang.github.io/jq/download/) — required for hook scripts that track tool and agent activity

### Quick Start

1. Install the plugin. Prefer the marketplace path — direct repo installs are deprecated by Copilot CLI:

   ```bash
   # Marketplace install (preferred)
   copilot plugin marketplace add griches/copilot-hud
   copilot plugin install copilot-hud@copilot-hud

   # Or, direct install (still works, but emits a deprecation warning)
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
   Choose which elements to display — session name, duration, token breakdown, output speed, tool activity, agent tracking, and git style.

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
Shows which model you're using, your project path, git branch, session info, and code changes at a glance. The model name is shortened for readability — `claude-opus-4.6 (3x) (high)` becomes `[Opus 4.6 3x·high]`. The model badge parses effort level (high/medium/low) and multiplier (3x) from `display_name`. Path depth is configurable (`pathLevels` 0–3; `0` shows the full absolute path). Lines added/removed are shown with green/red coloring.

```
[Opus 4.6 3x·high] │ my-project │ git:(main* ↑2) │ ⏱ 5m │ +42/-3
```

### Context Window and Requests
A live progress bar showing how much of the **current** context window you're using. Prefers Copilot's live `current_context_used_percentage` / `current_context_tokens` / `displayed_context_limit` fields (populated from the very first render) and falls back to the legacy cumulative fields when unavailable, so the bar is accurate and populated immediately on session start instead of showing `0%` until the first response. Changes color as you approach the limit — green when you have plenty of room, yellow when it's getting tight, red when you're running low. Token breakdown (in/out/cache) is shown in a single segment.

```
Ctx ████░░░░░░ 70.0k/200.0k 35% │ Credits 1.42 │ in:1.5M out:12.2k cache:1.4M │ 42 tok/s
```

- **Ctx** — context bar with exact token usage `used/total percentage`
- **Credits** — AI units (AIU) consumed this session under Copilot's usage-based billing (1 AIU = $0.01 USD). Falls back to legacy premium request count (`Reqs`) on older CLI versions.
- **in/out/cache** — cumulative input, output, and cache tokens
- **tok/s** — output generation speed
- **last call** (optional) — tokens used in the most recent API call
- **Cache R/W** (optional) — separate cache read vs write counts

### Session Info
Optionally show the session name and duration on the project line:

```
[Opus 4.6 3x·high] │ my-project │ git:(main* ↑2) │ Creating README │ ⏱ 5m │ +42/-3
```

### Code Changes
Shows total lines added and removed during the session with green/red coloring:

```
+42/-3
```

### Effort & Multiplier
The model badge shows effort level and request multiplier parsed from the model's display name. `claude-opus-4.6 (3x) (high)` becomes `[Opus 4.6 3x·high]`.

### Remote Session Indicator
When a remote controller is attached to your Copilot session (via `--remote` / `--connect`), a magenta `◉ remote` badge appears right after the model badge so you can see at a glance that another device or teammate is driving the same session.

```
[Opus 4.6 3x·high] │ ◉ remote │ my-project │ git:(main*)
```

Toggle with `display.showRemote` (default `true`). The badge only renders while a remote is actually connected.

### Live Tool Activity
See what Copilot is doing in real time. When Copilot reads files, runs commands, or edits code, the tools line updates to show each tool's status. Completed tools show a checkmark, running tools show a spinner, and failed tools show an X.

```
✓ ✎ Edit: auth.ts | ✓ ⌨ Bash: git status ×3 | ◐ ◉ Read: index.ts
```

Only real tool calls are shown — internal tools like `report_intent` are filtered out. For shell commands, the actual command is displayed (the `cd /path &&` prefix Copilot adds is stripped).

### Background Agent Tracking
When Copilot spawns subagents, they're tracked and displayed below the tools line. Each agent shows its type, description, status, and duration.

```
◐ [explore] Analyze test coverage (45s…)
✓ [explore] Search auth module (18s)
✗ [general-purpose] Parse config schema (1m 12s)
✓ [task] Check git status (3s)
```

- `◐` — running (yellow), with elapsed time and `…` suffix
- `✓` — completed (green), with final duration
- `✗` — failed (red), with final duration
- `[type]` — agent type (explore, task, general-purpose, etc.)

The number of agents displayed is configurable via `display.maxAgents` (default: 5).

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

- **statusLine** receives session JSON on stdin including: model (id, display_name with effort/multiplier), context_window (live `current_context_*` and `displayed_context_limit`, plus cumulative sizes/percentages/token counts, cache stats, last call, reasoning tokens), cost (duration, API time, lines added/removed), `ai_used` (credits under Copilot's usage-based billing — prefer `formatted`, raw value in `total_nano_aiu`; falls back to legacy `cost.total_premium_requests`), session metadata (name, id, cwd, transcript_path), Copilot CLI version, and `remote.connected` for remote-control sessions
- **Hooks** fire on `sessionStart`, `userPromptSubmitted`, `preToolUse`, `postToolUse`, and `sessionEnd`, writing to `~/.copilot/hud-state.json`
- The HUD script merges both data sources and renders colorized output

---

## Configuration

> **Full reference:** See [docs/CONFIGURATION.md](docs/CONFIGURATION.md) for a complete manual configuration guide with all options, color names, presets, and `jq` one-liners.

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
    "showTokenBreakdown": true,
    "showOutputSpeed": true,
    "showPromptPreview": false,
    "showLinesChanged": true,
    "showEffort": true,
    "showLastCall": false,
    "showCacheBreakdown": false,
    "rainbowPath": false,
    "showRemote": true
  },
  "colors": {
    "rainbowPathBg": "189"
  }
}
```

Or run `/copilot-hud:configure` inside a Copilot session for guided setup.

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `pathLevels` | `1` | `0` = full absolute path, `1` = project name, `2-3` = parent dirs |
| `gitStatus.enabled` | `true` | Show git branch |
| `gitStatus.showDirty` | `true` | Show `*` for uncommitted changes |
| `gitStatus.showAheadBehind` | `true` | Show `↑N ↓N` ahead/behind remote |
| `display.showTools` | `true` | Show tool activity line |
| `display.showAgents` | `true` | Show background agent tracking |
| `display.maxAgents` | `5` | Max number of agents to display |
| `display.showSessionName` | `true` | Show session name/title |
| `display.showSessionDuration` | `true` | Show `⏱ 5m` wall clock time |
| `display.showTokenBreakdown` | `true` | Show `in:1.5M out:12.2k cache:1.4M` |
| `display.showOutputSpeed` | `true` | Show `42 tok/s` |
| `display.showLinesChanged` | `true` | Show `+42/-3` lines added/removed |
| `display.showEffort` | `true` | Show effort level and multiplier in model badge |
| `display.showLastCall` | `false` | Show last API call token counts |
| `display.showCacheBreakdown` | `false` | Show separate cache read/write counts |
| `display.showPromptPreview` | `false` | Show last user prompt preview |
| `display.rainbowPath` | `false` | Render project path as per-character rainbow gradient (`false` = use `colors.project`) |
| `display.showRemote` | `true` | Show the `◉ remote` badge when a remote controller is attached to the session |
| `colors.rainbowPathBg` | `"189"` | Background color for rainbow path. `"none"` disables background; otherwise a 256-color index or named color |

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
echo '{"cwd":"/tmp/myapp","model":{"display_name":"claude-opus-4.6 (3x) (high)"},"context_window":{"context_window_size":200000,"remaining_tokens":130000,"used_percentage":35,"total_input_tokens":1500000,"total_output_tokens":12200,"total_cache_read_tokens":1400000},"cost":{"total_duration_ms":300000,"total_api_duration_ms":45000,"total_lines_added":42,"total_lines_removed":3},"ai_used":{"total_nano_aiu":1420000000,"formatted":"1.42"},"session_name":"Creating README"}' | node dist/index.js
```

---

## Inspired By

Layout and colors based on [jarrodwatts/claude-hud](https://github.com/jarrodwatts/claude-hud).

---

## License

MIT
