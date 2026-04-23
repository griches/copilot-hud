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

All available fields with their defaults, sourced directly from `src/config.ts`:

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
    "project": "yellow",
    "git": "magenta",
    "gitBranch": "cyan",
    "tools": "green",
    "success": "green",
    "failure": "red",
    "label": "dim",
    "header": "cyan",
    "rainbowPathBg": "189"
  }
}
```

---

## Field Reference

### `pathLevels` — Project path depth

**Type:** `0 | 1 | 2 | 3`  **Default:** `0`

Controls how many directory levels appear on line 1:

| Value | Output |
|-------|--------|
| `0` | `/Users/you/projects/my-project` (full absolute path) |
| `1` | `my-project` |
| `2` | `projects/my-project` |
| `3` | `you/projects/my-project` |

---

### `gitStatus` — Git info

**Controls the `git:(branch*)` segment on line 1.**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `true` | Show or hide git info entirely |
| `showDirty` | boolean | `true` | Append `*` when there are uncommitted changes, e.g. `git:(main*)` |
| `showAheadBehind` | boolean | `true` | Show commits ahead/behind remote, e.g. `git:(main ↑2 ↓1)` |

**Output examples:**

```
git:(main*)           # enabled=true, showDirty=true,  showAheadBehind=false
git:(main* ↑2 ↓1)    # enabled=true, showDirty=true,  showAheadBehind=true
git:(main)            # enabled=true, showDirty=false, showAheadBehind=false
(hidden)              # enabled=false
```

---

### `display` — Visibility controls

**Toggles individual elements across all three HUD lines.**

#### Line 1 (project info)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `showSessionName` | boolean | `true` | Show the session title, e.g. `│ Creating README` |
| `showSessionDuration` | boolean | `true` | Show wall-clock session time, e.g. `│ ⏱ 5m` |
| `showLinesChanged` | boolean | `true` | Show lines added/removed, e.g. `│ +42/-3` |
| `showEffort` | boolean | `true` | Show effort level and multiplier in model badge, e.g. `[Opus 4.6 3x·high]` |
| `rainbowPath` | boolean | `true` | Render the project path as a per-character rainbow gradient. When `false`, falls back to `colors.project` (solid color). |

#### Line 2 (context)

The context bar and request count are always shown. These are optional additions:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `showTokenBreakdown` | boolean | `true` | Show cumulative in/out/cache tokens, e.g. `│ in:1.5M out:12.2k cache:1.4M` |
| `showOutputSpeed` | boolean | `true` | Show output throughput, e.g. `│ 42 tok/s` |
| `showLastCall` | boolean | `false` | Show last API call tokens, e.g. `│ last:76.0k→200` |
| `showCacheBreakdown` | boolean | `false` | Show cache read/write separately, e.g. `│ cache·R:1.5M W:0` |
| `showCost` | boolean | `true` | Show the estimated raw API cost segment, e.g. `│ $0.42` |
| `costColorMode` | string | `"dynamic"` | Coloring strategy for the cost segment. See below. |

**`costColorMode` values:**

| Value | Behavior |
|-------|----------|
| `"dynamic"` | 7 tiers keyed to baseline `n = max(Reqs, 1) × $0.04`: green < 10n, blue < 50n, pink < 200n, purple < 500n, yellow < 700n, orange < 1000n, red otherwise. Adapts as premium request count grows. |
| `"simple"` | 3 fixed tiers: green < $1, yellow < $5, red ≥ $5. |
| `"none"` | Dim text, no semantic coloring. |

#### Line 3 (tool activity)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `showTools` | boolean | `true` | Show or hide the entire tool activity line |
| `showPromptPreview` | boolean | `false` | Show a preview of the last user prompt |

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

### `colors` — Color configuration

Controls the color of each HUD element.

| Field | Default | Where it appears |
|-------|---------|-----------------|
| `header` | `"cyan"` | Model name on line 1, e.g. `[Sonnet 4.6]` |
| `project` | `"yellow"` | Project path on line 1 — **only used when `display.rainbowPath: false`** |
| `git` | `"magenta"` | The `git:(` and `)` brackets |
| `gitBranch` | `"cyan"` | Branch name inside the brackets, e.g. `main*` |
| `tools` | `"green"` | Tool names (auto-overridden: `yellow` while running, `red` on failure) |
| `success` | `"green"` | Success icon `✓` |
| `failure` | `"red"` | Failure icon `✗` |
| `label` | `"dim"` | Separators `│`, labels `Context`, `Reqs`, etc. |
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

### Minimal

Only the most essential information:

```json
{
  "pathLevels": 1,
  "gitStatus": {
    "enabled": true,
    "showDirty": true,
    "showAheadBehind": false
  },
  "display": {
    "showTools": false,
    "showSessionName": false,
    "showSessionDuration": false,
    "showTokenBreakdown": false,
    "showOutputSpeed": false,
    "showLinesChanged": false,
    "showEffort": false,
    "showCost": false,
    "rainbowPath": false
  }
}
```

Output:
```
[Sonnet 4.6] │ my-project │ git:(main*)
Ctx ████░░░░░░ 70.0k/200.0k 35% │ Reqs 3
```

---

### Standard (default)

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
    "showSessionName": true,
    "showSessionDuration": true,
    "showTokenBreakdown": true,
    "showOutputSpeed": true,
    "showLinesChanged": true,
    "showEffort": true,
    "showCost": true,
    "costColorMode": "dynamic"
  }
}
```

Output:
```
[Sonnet 4.6 1x·medium] │ my-project │ git:(main* ↑2) │ Creating README │ ⏱ 5m │ +42/-3
Ctx ████░░░░░░ 70.0k/200.0k 35% │ Reqs 3 │ in:1.5M out:12.2k cache:1.4M │ $0.42 │ 42 tok/s
✓ ✎ Edit: auth.ts | ✓ ⌨ Bash: git status ×3
```

---

### Full

Everything enabled:

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
    "showLinesChanged": true,
    "showEffort": true,
    "showLastCall": true,
    "showCacheBreakdown": true,
    "showCost": true,
    "rainbowPath": true,
    "costColorMode": "dynamic"
  }
}
```

Output:
```
[Opus 4.6 3x·high] │ /Users/you/projects/my-project │ git:(main* ↑2 ↓1) │ Creating README │ ⏱ 5m │ +42/-3
Ctx ████░░░░░░ 70.0k/200.0k 35% │ Reqs 3 │ in:1.5M out:12.2k cache·R:1.4M W:0 │ $0.42 │ 42 tok/s │ last:76.0k→200
✓ ✎ Edit: auth.ts | ✓ ⌨ Bash: git status ×3 | ◐ ◉ Read: index.ts
```

---

## One-liner `jq` Commands

Edit specific values without opening a text editor:

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

# Disable rainbow path and fall back to solid color
jq '.display.rainbowPath = false' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# Keep rainbow but drop the lavender background
jq '.colors.rainbowPathBg = "none"' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# Use simple 3-tier cost coloring (<$1 green / <$5 yellow / ≥$5 red)
jq '.display.costColorMode = "simple"' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# Hide cost segment entirely
jq '.display.showCost = false' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

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
    "total_premium_requests": 3,
    "total_lines_added": 42,
    "total_lines_removed": 3
  },
  "session_name": "Creating README"
}' | node ~/.copilot/installed-plugins/_direct/blueskyxn--copilot-hud/dist/index.js
```

---

## Notes

- **Partial configs work** — you only need to specify the keys you want to change. The rest use defaults (via `deepMerge` in `src/config.ts`).
- **Invalid JSON is silently ignored** — if `config.json` is malformed, the HUD falls back to defaults without errors.
- **Changes are instant** — no restart needed. The config is re-read on every status line render.
- **256-color values** must be integers `0–255` written as strings (e.g. `"208"`, not `208`).
