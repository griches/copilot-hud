# Copilot HUD — Configuration Reference

No Copilot session needed. Edit the JSON file directly to configure everything.

---

## Config File Location

```
~/.copilot/plugins/copilot-hud/config.json
```

If the file doesn't exist, the HUD uses built-in defaults. You only need to write the **keys you want to override** — everything else stays at its default.

---

## Quick Start

```bash
# Create the directory if it doesn't exist
mkdir -p ~/.copilot/plugins/copilot-hud

# Open the config file in your editor
$EDITOR ~/.copilot/plugins/copilot-hud/config.json
```

Changes take effect immediately — the HUD re-reads the config file on every render.

---

## Full Config Structure

All available fields with their defaults, sourced directly from `src/config.ts`. A real file only needs the keys you want to change:

```json
{
  "preset": "standard",
  "pathLevels": 1,
  "gitStatus": {
    "enabled": true,
    "showDirty": true,
    "showAheadBehind": true,
    "showFileStats": false,
    "showPrefix": true,
    "maxBranchLength": 0
  },
  "display": {
    "layout": [
      ["model", "remote", "project", "git", "session", "duration", "lines"],
      ["context", "quota", "credits", "tokens", "speed", "lastCall"]
    ],
    "showTools": true,
    "showToolIcons": true,
    "showToolTargets": true,
    "maxTools": 0,
    "showAgents": true,
    "maxAgents": 5,
    "completedAgentFadeSec": 30,
    "showProjectName": true,
    "showSessionName": true,
    "showSessionDuration": true,
    "showTokenBreakdown": true,
    "showOutputSpeed": true,
    "showPromptPreview": false,
    "showLinesChanged": true,
    "showEffort": true,
    "showCredits": true,
    "showContextCounts": true,
    "showLastCall": false,
    "showCacheBreakdown": false,
    "rainbowPath": false,
    "abbreviateHome": false,
    "showRemote": true,
    "barStyle": "block",
    "barWidth": 10,
    "separator": "│",
    "showQuota": true,
    "quotaBucket": "",
    "showQuotaCounts": true,
    "showQuotaReset": true,
    "showQuotaPace": false,
    "showQuotaProjection": false,
    "fitWidth": true,
    "maxWidth": 0
  },
  "thresholds": {
    "contextWarn": 70,
    "contextCritical": 85,
    "quotaWarn": 75,
    "quotaCritical": 90,
    "paceWarn": 90,
    "paceCritical": 100,
    "paceMinUsed": 10
  },
  "colors": {
    "project": "yellow",
    "git": "magenta",
    "gitBranch": "cyan",
    "tools": "green",
    "success": "green",
    "failure": "red",
    "running": "yellow",
    "denied": "brightMagenta",
    "label": "dim",
    "muted": "dim",
    "header": "cyan",
    "remote": "brightMagenta",
    "credits": "brightBlue",
    "added": "green",
    "removed": "red",
    "agentType": "cyan",
    "prompt": "cyan",
    "contextOk": "green",
    "contextWarn": "yellow",
    "contextCritical": "red",
    "quotaOk": "brightBlue",
    "quotaWarn": "brightMagenta",
    "quotaCritical": "red",
    "paceWarn": "yellow",
    "paceCritical": "red",
    "rainbowPathBg": "189"
  }
}
```

---

## Field Reference

### `pathLevels` — Project path depth

**Type:** `0 | 1 | 2 | 3`  **Default:** `1`

Controls how many directory levels appear on line 1. Has no effect when `display.showProjectName` is `false`.

| Value | Output |
|-------|--------|
| `0` | `/Users/you/projects/my-project` (full absolute path) |
| `1` | `my-project` |
| `2` | `projects/my-project` |
| `3` | `you/projects/my-project` |

With `0`, set `display.abbreviateHome` to write your home directory as `~`: `~/projects/my-project`.

---

### `gitStatus` — Git info

**Controls the `git:(branch*)` segment on line 1.**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `true` | Show or hide git info entirely |
| `showDirty` | boolean | `true` | Append `*` when there are uncommitted changes, e.g. `git:(main*)` |
| `showAheadBehind` | boolean | `true` | Show commits ahead/behind remote, e.g. `git:(main ↑2 ↓1)` |
| `showFileStats` | boolean | `false` | Show changed-file counts: `!` modified, `+` added, `✘` deleted, `?` untracked. Zero counts are omitted |
| `showPrefix` | boolean | `true` | Wrap the branch in `git:(…)`. `false` shows just `main*` |
| `maxBranchLength` | number | `0` | Cut longer branch names to this many columns with `…`. `0` never cuts |

**Output examples:**

```
git:(main*)           # enabled=true, showDirty=true,  showAheadBehind=false
git:(main* ↑2 ↓1)    # enabled=true, showDirty=true,  showAheadBehind=true
git:(main* !3 +1 ?4)  # enabled=true, showDirty=true,  showFileStats=true
git:(main)            # enabled=true, showDirty=false, showAheadBehind=false
main*                 # showPrefix=false
git:(feature…)        # maxBranchLength=8
(hidden)              # enabled=false
```

---

### `display` — Visibility controls

**Toggles individual elements across all three HUD lines.**

#### Line 1 (project info)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `showProjectName` | boolean | `true` | Show the project name/path segment, e.g. `│ my-project`. When `false`, the project path is omitted entirely (`pathLevels` has no effect). |
| `showSessionName` | boolean | `true` | Show the session title, e.g. `│ Creating README` |
| `showSessionDuration` | boolean | `true` | Show wall-clock session time, e.g. `│ ⏱ 5m` |
| `showLinesChanged` | boolean | `true` | Show lines added/removed, e.g. `│ +42/-3` |
| `showEffort` | boolean | `true` | Show reasoning effort in the model badge, e.g. `[Opus 4.6·high]` |
| `showMultiplier` | boolean | follows `showEffort` | Show the request multiplier in the model badge, e.g. `[Opus 4.6 3x]` |
| `rainbowPath` | boolean | `false` | Render the project path as a per-character rainbow gradient. When `false`, falls back to `colors.project` (solid color). |
| `showRemote` | boolean | `true` | Show `◉ remote` badge next to the model badge while a remote controller (`--remote` / `--connect`) is attached. Hidden when no remote is connected. |

#### Line 2 (context)

The context bar is shown unless you take it out of `layout`. These are optional additions:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `showContextCounts` | boolean | `true` | Show `70.0k/200.0k` next to the context percentage |
| `showCredits` | boolean | `true` | Show the usage of this session alone, e.g. `│ Credits 1.42` |
| `showTokenBreakdown` | boolean | `true` | Show cumulative in/out/cache tokens, e.g. `│ in:1.5M out:12.2k cache:1.4M` |
| `showOutputSpeed` | boolean | `true` | Show output throughput, e.g. `│ 42 tok/s` |
| `showLastCall` | boolean | `false` | Show last API call tokens, e.g. `│ last:76.0k→200` |
| `showCacheBreakdown` | boolean | `false` | Show cache read/write separately, e.g. `│ cache·R:1.5M W:0` |

The monthly quota bar also sits on this line. It needs the session extension that `/copilot-hud:setup` installs; without it these have no visible effect:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `showQuota` | boolean | `true` | Show the entitlement bar, e.g. `│ Quota ██████░░░░ 64%` |
| `showQuotaCounts` | boolean | `true` | Add the raw counts, e.g. `4785/7500` |
| `showQuotaReset` | boolean | `true` | Add days until the entitlement resets, e.g. `· 19d` |
| `showQuotaPace` | boolean | `false` | Project usage so far to the reset date and flag the bar with `▲` — amber when on track to end at 90% or more, red when on track to run out first. Buckets under `thresholds.paceMinUsed` (10%) are never flagged |
| `showQuotaProjection` | boolean | `false` | Show where usage is heading by the reset date, e.g. `40% →207%` |
| `quotaBucket` | string | `""` | Entitlement id to draw, e.g. `premium_interactions`. Empty, or an id that isn't metered on your plan, picks the most used |

#### Line 3 (tool activity)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `showTools` | boolean | `true` | Show or hide the entire tool activity line |
| `showToolIcons` | boolean | `true` | Show each tool's type icon, e.g. `✎`. Status icons always stay |
| `showToolTargets` | boolean | `true` | Show what each tool acted on, e.g. `: auth.ts`. Turn off when screen sharing |
| `maxTools` | number | `0` | Most tools on the line, newest first. `0` shows every recent one |

#### Prompt preview line

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `showPromptPreview` | boolean | `false` | Show the prompt being worked on and its age, e.g. `❯ fix the auth redirect loop (42s)`. Drawn between the context line and the tool activity line. Multi-line prompts are collapsed; the age is omitted when the timestamp is missing or more than a day old. |

#### Lines 4+ (background agents)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `showAgents` | boolean | `true` | Show background agent tracking lines (one line per tracked agent) |
| `maxAgents` | number | `5` | Maximum number of agents to display |

#### Layout and style (all lines)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `layout` | array of arrays | two lines, see below | Which segments appear, on which line, in which order |
| `barStyle` | string | `"block"` | `block` `████░░░░░░`, `shade` `▓▓▓▓░░░░░░`, `dots` `●●●●○○○○○○`, `line` `━━━━──────`, `ascii` `####------` |
| `barWidth` | number | `10` | Columns for the context and quota bars, from 1 to 40 |
| `separator` | string | `"│"` | Divider between segments, drawn with a space either side |

`layout` has one array per line. Segment ids are `model`, `remote`, `project`, `git`, `session`, `duration`, `lines`, `context`, `quota`, `credits`, `tokens`, `speed`, and `lastCall`. A segment left out is hidden, and an id it doesn't know is ignored. Everything on one line:

```json
{
  "display": {
    "layout": [["model", "project", "git", "context", "quota"]]
  }
}
```

The `show*` keys still apply, so a segment needs to be both in `layout` and turned on. The prompt, tool, and agent lines always follow underneath.

#### Width fitting (all lines)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `fitWidth` | boolean | `true` | Keep every line inside the terminal width. Segments are dropped least-important-first, then the line is truncated with `…`. Set `false` to always draw everything and let the terminal wrap. |
| `maxWidth` | number | `0` | Column budget for `fitWidth`. `0` auto-detects the terminal width; a positive number pins it. |

Segments are dropped in this order as the terminal narrows:

- **Line 1** — session name → duration → lines changed → git → project path. The model badge and the `◉ remote` indicator are never dropped.
- **Line 2** — last call → token breakdown → output speed → credits → quota. The context bar is never dropped.
- **Line 3** — oldest tools first; the most recent tool is never dropped.

Width detection tries, in order: `maxWidth`, the `COPILOT_HUD_COLUMNS` environment
variable, the stdout/stderr streams, `COLUMNS`, and finally the controlling
terminal via `/dev/tty`. The last one is what normally answers, because Copilot
runs the statusline with its output piped. If every source fails, no truncation
happens at all.

Tool activity line example:
```
✓ ✎ Edit: auth.ts | ✓ ⌨ Bash: git status ×3 | ◐ ◉ Read: index.ts
```

Status icon meanings:
- `✓` — success  
- `✗` — failure  
- `◐` — running  
- `⊘` — denied

---

### `thresholds` — When bars change color

| Field | Default | Description |
|-------|---------|-------------|
| `contextWarn` | `70` | Context percentage that turns the bar `colors.contextWarn` |
| `contextCritical` | `85` | Context percentage that turns the bar `colors.contextCritical` |
| `quotaWarn` | `75` | Quota percentage that turns the bar `colors.quotaWarn` |
| `quotaCritical` | `90` | Quota percentage that turns the bar `colors.quotaCritical` |
| `paceWarn` | `90` | Projected usage at the reset date that raises an amber `▲` |
| `paceCritical` | `100` | Projected usage at the reset date that raises a red `▲` |
| `paceMinUsed` | `10` | No projection below this much usage, where it is mostly noise |

---

### `colors` — Color configuration

Controls the color of each HUD element.

| Field | Default | Where it appears |
|-------|---------|-----------------|
| `header` | `"cyan"` | Model name on line 1, e.g. `[Sonnet 4.6]` |
| `project` | `"yellow"` | Project path on line 1 — **only used when `display.rainbowPath: false`** |
| `git` | `"magenta"` | The `git:(` and `)` brackets |
| `gitBranch` | `"cyan"` | Branch name inside the brackets, e.g. `main*` |
| `tools` | `"green"` | Names of finished tools. Running and failed tools use `running` and `failure` instead |
| `success` | `"green"` | Success icon `✓` |
| `failure` | `"red"` | Failure icon `✗`, and the name of a failed tool |
| `running` | `"yellow"` | Running icon `◐`, and the name of a running tool |
| `denied` | `"brightMagenta"` | Denied icon `⊘`, and the name of a denied tool |
| `label` | `"dim"` | Separators `│`, labels `Ctx`, `Quota`, `Credits` |
| `muted` | `"dim"` | Secondary values: session name, duration, token counts, tool targets, ages |
| `remote` | `"brightMagenta"` | The `◉ remote` badge |
| `credits` | `"brightBlue"` | The credits value |
| `added` / `removed` | `"green"` / `"red"` | `+42` and `-3` |
| `agentType` | `"cyan"` | `[explore]` on agent lines |
| `prompt` | `"cyan"` | The `❯` on the prompt line |
| `contextOk` / `contextWarn` / `contextCritical` | `"green"` / `"yellow"` / `"red"` | Context bar at each level |
| `quotaOk` / `quotaWarn` / `quotaCritical` | `"brightBlue"` / `"brightMagenta"` / `"red"` | Quota bar at each level |
| `paceWarn` / `paceCritical` | `"yellow"` / `"red"` | Quota bar when the `▲` is raised |
| `rainbowPathBg` | `"189"` | Background color behind the rainbow project path. `"none"` disables background; otherwise a 256-color index (e.g. `"189"`) or named color (e.g. `"magenta"`). |

#### Available color names

**Standard:**
```
red  green  yellow  blue  magenta  cyan  white  dim
```

**Bright variants:**
```
brightRed  brightGreen  brightYellow  brightBlue  brightMagenta  brightCyan
```

**256-color (integer 0–255, written as a string):**
```json
"project": "208"   // orange
"gitBranch": "99"  // purple
"header": "214"    // gold
```

---

## Presets

Set `preset` to start from a named look, then add any keys you want to change. Keys in your file always win over the preset:

```json
{
  "preset": "minimal",
  "display": {
    "showCredits": true
  }
}
```

```
Standard
[sonnet-4.6 1x·medium] │ my-project │ git:(main* ↑2) │ Creating README │ ⏱ 5m │ +42/-3
Ctx ████░░░░░░ 70.0k/200.0k 35% │ Quota ████░░░░░░ 3000/7500 40% · 25d │ Credits 1.42 │ in:1.5M out:12.2k cache:1.4M │ 42 tok/s
◐ ◉ View: src/index.ts | ✓ ✎ Edit: auth.ts | ✓ ⌨ Bash: git status
◐ [explore] Analyze test coverage (45s…)

Compact
[sonnet-4.6 1x·medium] │ my-project │ git:(main*) │ Ctx ██░░░ 35% │ Quota ██░░░ 40% · 25d
◐ [explore] Analyze test coverage (45s…)

Minimal
[sonnet-4.6 1x·medium] │ my-project │ git:(main*)
Ctx ████░░░░░░ 70.0k/200.0k 35% │ Quota ████░░░░░░ 40% · 25d
◐ [explore] Analyze test coverage (45s…)

Full
[sonnet-4.6 1x·medium] │ ~/projects/my-project │ git:(main* ↑2 !3 +1 ?4) │ Creating README │ ⏱ 5m │ +42/-3
Ctx ████░░░░░░ 70.0k/200.0k 35% │ Quota ████░░░░░░ 3000/7500 40% ▲ →207% · 25d │ Credits 1.42 │ in:1.5M out:12.2k cache·R:1.4M W:0 │ 42 tok/s │ last:76.0k→200
❯ fix the auth redirect loop (42s)
◐ ◉ View: src/index.ts | ✓ ✎ Edit: auth.ts | ✓ ⌨ Bash: git status
◐ [explore] Analyze test coverage (45s…)
```

Standard is the defaults. Compact and Minimal hide the session name, duration, lines changed, credits, token counts, speed, quota counts, ahead/behind, and the tool line; Compact also puts everything on one line with shorter bars. Full adds file counts, the prompt line, last call, cache read/write, the pace flag, and the projection, and shows the path from `~`.

Print this from your own install, in color when run in a terminal:

```bash
node "$(find ~/.copilot/installed-plugins -name setup.mjs -path '*copilot-hud*' | head -1)" preview
```

Add `--current` to draw your own config with the same sample data, or `--width 100` to see what drops out at that width.

---

## One-liner `jq` Commands

Edit specific values without opening a text editor. These are a convenience for
people who already have `jq` — the HUD itself no longer needs it, so if you
don't have it installed, edit the JSON by hand or use `/copilot-hud:configure`
instead.

```bash
CONFIG="$HOME/.copilot/plugins/copilot-hud/config.json"

# Bootstrap the file if it doesn't exist
mkdir -p "$(dirname "$CONFIG")" && [ -f "$CONFIG" ] || echo '{}' > "$CONFIG"

# Set path depth to 2
jq '.pathLevels = 2' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# Enable full path
jq '.pathLevels = 0' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# Hide the tool activity line
jq '.display.showTools = false' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# Enable token breakdown and output speed
jq '.display.showTokenBreakdown = true | .display.showOutputSpeed = true' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# Show/hide lines changed
jq '.display.showLinesChanged = true' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# Enable cache read/write breakdown
jq '.display.showCacheBreakdown = true' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# Enable last call tokens
jq '.display.showLastCall = true' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# Disable ahead/behind counts
jq '.gitStatus.showAheadBehind = false' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# Change a color
jq '.colors.project = "208"' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# Enable rainbow path (off by default)
jq '.display.rainbowPath = true' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# Keep rainbow but drop the lavender background
jq '.colors.rainbowPathBg = "none"' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# Hide agent tracking
jq '.display.showAgents = false' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# Show more agents in the list
jq '.display.maxAgents = 10' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# Reset to defaults (delete the config file)
rm "$CONFIG"
```

---

## Testing Your Config

Render the HUD with mock session data — no Copilot session required:

```bash
echo '{
  "cwd": "/Users/you/projects/my-app",
  "model": {"display_name": "claude-opus-4.6 (3x) (high)"},
  "context_window": {
    "context_window_size": 200000,
    "remaining_tokens": 130000,
    "used_percentage": 35,
    "total_input_tokens": 1500000,
    "total_output_tokens": 12200,
    "total_cache_read_tokens": 1400000,
    "total_cache_write_tokens": 0,
    "last_call_input_tokens": 76000,
    "last_call_output_tokens": 200
  },
  "cost": {
    "total_duration_ms": 300000,
    "total_api_duration_ms": 45000,
    "total_lines_added": 42,
    "total_lines_removed": 3
  },
  "ai_used": {
    "total_nano_aiu": 1420000000,
    "formatted": "1.42"
  },
  "session_name": "Creating README"
}' | ~/.copilot/copilot-hud.sh
```

`~/.copilot/copilot-hud.sh` is the wrapper `/copilot-hud:setup` installs — the same command Copilot runs.

---

## Notes

- **Partial configs work** — you only need to specify the keys you want to change. The rest use defaults (via `deepMerge` in `src/config.ts`).
- **Invalid JSON is silently ignored** — if `config.json` is malformed, the HUD falls back to defaults without errors.
- **Changes are instant** — no restart needed. The config is re-read on every status line render.
- **256-color values** must be integers `0–255` written as strings (e.g. `"208"`, not `208`).
- **`COPILOT_HUD_DISABLE=1`** in the environment that starts Copilot blanks the HUD for that session, whatever the config says.
