# Copilot HUD

A GitHub Copilot CLI plugin that displays a real-time status line inside your Copilot session — project path, git branch, context usage, and tool activity.

English | [中文](README.zh.md)

```
  /Users/sky/Github/my-project [↙ main]                 Claude Opus 4.6 (3x) (high)
──────────────────────────────────────────────────────────────────────────────────────
  [Opus 4.6 3x·high] │ /Users/sky/Github/my-project │ git:(main* ↑2) │ Creating README │ ⏱ 5m │ +42/-3
  Ctx ████░░░░░░ 70.0k/200.0k 35% │ Reqs 3 │ in:1.5M out:12.2k cache:1.4M │ 42 tok/s
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
Shows which model you're using, your project path, git branch, session info, and code changes at a glance. The model name is shortened for readability — `claude-opus-4.6 (3x) (high)` becomes `[Opus 4.6 3x·high]`. The model badge parses effort level (high/medium/low) and multiplier (3x) from `display_name`. Path defaults to the full absolute path (configurable with `pathLevels` 0–3). Lines added/removed are shown with green/red coloring.

```
[Opus 4.6 3x·high] │ /Users/sky/Github/my-project │ git:(main* ↑2) │ ⏱ 5m │ +42/-3
```

### Context Window and Requests
A live progress bar showing how much of the context window you've used. Uses the API-provided `used_percentage` directly, with precise used/total token counts. Changes color as you approach the limit — green when you have plenty of room, yellow when it's getting tight, red when you're running low. Token breakdown (in/out/cache) is shown in a single segment. All metrics are enabled by default.

```
Ctx ████░░░░░░ 70.0k/200.0k 35% │ Reqs 3 │ in:1.5M out:12.2k cache:1.4M │ 42 tok/s
```

- **Ctx** — context bar with exact token usage `used/total percentage`
- **Reqs** — premium API requests this session
- **in/out/cache** — cumulative input, output, and cache tokens
- **tok/s** — output generation speed
- **≈$** — estimated raw API cost (what this session would cost at provider pricing)
- **last call** (optional) — tokens used in the most recent API call
- **Cache R/W** (optional) — separate cache read vs write counts

### Session Info
Optionally show the session name and duration on the project line:

```
[Opus 4.6 3x·high] │ /Users/sky/Github/my-project │ git:(main* ↑2) │ Creating README │ ⏱ 5m │ +42/-3
```

### Code Changes
Shows total lines added and removed during the session with green/red coloring:

```
+42/-3
```

### Effort & Multiplier
The model badge shows effort level and request multiplier parsed from the model's display name. `claude-opus-4.6 (3x) (high)` becomes `[Opus 4.6 3x·high]`.

### Live Tool Activity
See what Copilot is doing in real time. When Copilot reads files, runs commands, or edits code, the tools line updates to show each tool's status. Completed tools show a checkmark, running tools show a spinner, and failed tools show an X.

```
✓ ✎ Edit: auth.ts | ✓ ⌨ Bash: git status ×3 | ◐ ◉ Read: index.ts
```

Only real tool calls are shown — internal tools like `report_intent` are filtered out. For shell commands, the actual command is displayed (the `cd /path &&` prefix Copilot adds is stripped).

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

- **statusLine** receives session JSON on stdin including: model (id, display_name with effort/multiplier), context_window (sizes, percentages, token counts, cache stats, last call), cost (duration, API time, premium requests, lines added/removed), and session metadata (name, id, cwd, transcript_path)
- **Hooks** fire on `sessionStart`, `userPromptSubmitted`, `preToolUse`, `postToolUse`, and `sessionEnd`, writing to `~/.copilot/hud-state.json`
- The HUD script merges both data sources and renders colorized output

---

## Configuration

> **Full reference:** See [docs/CONFIGURATION.md](docs/CONFIGURATION.md) for a complete manual configuration guide with all options, color names, presets, and `jq` one-liners.

Edit `~/.copilot/plugins/copilot-hud/config.json`:

```json
{
  "pathLevels": 0,
  "gitStatus": {
    "enabled": true,
    "showDirty": true,
    "showAheadBehind": true
  },
  "display": {
    "showTools": true,
    "showSessionName": true,
    "showSessionDuration": true,
    "showTokenBreakdown": true,
    "showOutputSpeed": true,
    "showPromptPreview": false,
    "showLinesChanged": true,
    "showEffort": true,
    "showLastCall": false,
    "showCacheBreakdown": false,
    "showCost": true,
    "rainbowPath": true,
    "costColorMode": "dynamic"
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
| `pathLevels` | `0` | `0` = full absolute path, `1` = project name, `2-3` = parent dirs |
| `gitStatus.enabled` | `true` | Show git branch |
| `gitStatus.showDirty` | `true` | Show `*` for uncommitted changes |
| `gitStatus.showAheadBehind` | `true` | Show `↑N ↓N` ahead/behind remote |
| `display.showTools` | `true` | Show tool activity line |
| `display.showSessionName` | `true` | Show session name/title |
| `display.showSessionDuration` | `true` | Show `⏱ 5m` wall clock time |
| `display.showTokenBreakdown` | `true` | Show `in:1.5M out:12.2k cache:1.4M` |
| `display.showOutputSpeed` | `true` | Show `42 tok/s` |
| `display.showLinesChanged` | `true` | Show `+42/-3` lines added/removed |
| `display.showEffort` | `true` | Show effort level and multiplier in model badge |
| `display.showLastCall` | `false` | Show last API call token counts |
| `display.showCacheBreakdown` | `false` | Show separate cache read/write counts |
| `display.showCost` | `true` | Show estimated raw API cost (`≈$0.42`) |
| `display.showPromptPreview` | `false` | Show last user prompt preview |
| `display.rainbowPath` | `true` | Render project path as per-character rainbow gradient (`false` = use `colors.project`) |
| `display.costColorMode` | `"dynamic"` | Cost segment coloring: `"dynamic"` (7 tiers vs Reqs baseline), `"simple"` (<$1 green / <$5 yellow / ≥$5 red), or `"none"` (dim) |
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
echo '{"cwd":"/tmp/myapp","model":{"display_name":"claude-opus-4.6 (3x) (high)"},"context_window":{"context_window_size":200000,"remaining_tokens":130000,"used_percentage":35,"total_input_tokens":1500000,"total_output_tokens":12200,"total_cache_read_tokens":1400000},"cost":{"total_duration_ms":300000,"total_api_duration_ms":45000,"total_premium_requests":3,"total_lines_added":42,"total_lines_removed":3},"session_name":"Creating README"}' | node dist/index.js
```

---

## Inspired By

Layout and colors based on [jarrodwatts/claude-hud](https://github.com/jarrodwatts/claude-hud).

---

## License

MIT
