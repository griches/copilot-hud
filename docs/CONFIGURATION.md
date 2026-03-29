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
    "showTokenBreakdown": false,
    "showOutputSpeed": false,
    "showPromptPreview": false
  },
  "colors": {
    "project": "yellow",
    "git": "magenta",
    "gitBranch": "cyan",
    "tools": "green",
    "success": "green",
    "failure": "red",
    "label": "dim",
    "header": "cyan"
  }
}
```

---

## Field Reference

### `pathLevels` — Project path depth

**Type:** `1 | 2 | 3`  **Default:** `1`

Controls how many directory levels appear on line 1:

| Value | Output |
|-------|--------|
| `1` | `my-project` |
| `2` | `apps/my-project` |
| `3` | `dev/apps/my-project` |

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

#### Line 2 (context)

The context bar and request count are always shown. These are optional additions:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `showTokenBreakdown` | boolean | `false` | Show token detail, e.g. `│ (in: 24.1k, cache: 15.0k)` |
| `showOutputSpeed` | boolean | `false` | Show output throughput, e.g. `│ out: 42.1 tok/s` |

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
| `project` | `"yellow"` | Project path on line 1, e.g. `my-project` |
| `git` | `"magenta"` | The `git:(` and `)` brackets |
| `gitBranch` | `"cyan"` | Branch name inside the brackets, e.g. `main*` |
| `tools` | `"green"` | Tool names (auto-overridden: `yellow` while running, `red` on failure) |
| `success` | `"green"` | Success icon `✓` |
| `failure` | `"red"` | Failure icon `✗` |
| `label` | `"dim"` | Separators `│`, labels `Context`, `Reqs`, etc. |

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
    "showOutputSpeed": false
  }
}
```

Output:
```
[Sonnet 4.6] │ my-project │ git:(main*)
Context ████░░░░░░ 35% │ Reqs 3
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
    "showTokenBreakdown": false,
    "showOutputSpeed": false
  }
}
```

Output:
```
[Sonnet 4.6] │ my-project │ git:(main* ↑2) │ Creating README │ ⏱ 5m
Context ████░░░░░░ 35% │ Reqs 3
✓ ✎ Edit: auth.ts | ✓ ⌨ Bash: git status ×3
```

---

### Full

Everything enabled:

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
    "showSessionName": true,
    "showSessionDuration": true,
    "showTokenBreakdown": true,
    "showOutputSpeed": true
  }
}
```

Output:
```
[Sonnet 4.6] │ apps/my-project │ git:(main* ↑2 ↓1) │ Creating README │ ⏱ 5m
Context ████░░░░░░ 35% │ Reqs 3 │ (in: 24.1k, cache: 15.0k) │ out: 42.1 tok/s
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

# Hide the tool activity line
jq '.display.showTools = false' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# Enable token breakdown and output speed
jq '.display.showTokenBreakdown = true | .display.showOutputSpeed = true' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# Disable ahead/behind counts
jq '.gitStatus.showAheadBehind = false' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# Change a color
jq '.colors.project = "208"' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# Reset to defaults (delete the config file)
rm "$CONFIG"
```

---

## Testing Your Config

Render the HUD with mock session data — no Copilot session required:

```bash
echo '{
  "cwd": "/Users/you/projects/my-app",
  "model": {"display_name": "claude-sonnet-4.6"},
  "context_window": {
    "context_window_size": 200000,
    "remaining_tokens": 130000,
    "total_output_tokens": 8420,
    "current_usage": {
      "input_tokens": 24100,
      "cache_read_input_tokens": 15000
    }
  },
  "cost": {
    "total_duration_ms": 300000,
    "total_api_duration_ms": 45000,
    "total_premium_requests": 3
  },
  "session_name": "Creating README"
}' | node ~/.copilot/installed-plugins/_direct/dist/index.js
```

---

## Notes

- **Partial configs work** — you only need to specify the keys you want to change. The rest use defaults (via `deepMerge` in `src/config.ts`).
- **Invalid JSON is silently ignored** — if `config.json` is malformed, the HUD falls back to defaults without errors.
- **Changes are instant** — no restart needed. The config is re-read on every status line render.
- **256-color values** must be integers `0–255` written as strings (e.g. `"208"`, not `208`).
