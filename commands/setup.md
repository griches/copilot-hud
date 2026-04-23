---
description: Set up Copilot HUD as a native status line inside Copilot CLI
allowed-tools: Bash, Read, Edit
---

# Copilot HUD Setup

This command automatically configures copilot-hud to display a native status line inside Copilot CLI. No manual steps required.

## Step 1: Detect Plugin and Runtime

Find the installed plugin and Node.js:

```bash
COPILOT_HOME="${COPILOT_HOME:-$HOME/.copilot}"
PLUGIN_DIR=$(find "$COPILOT_HOME/installed-plugins" -name "index.js" -path "*/copilot-hud/dist/*" 2>/dev/null | head -1)
if [ -n "$PLUGIN_DIR" ]; then echo "Plugin: OK ($PLUGIN_DIR)"; else echo "Plugin: NOT FOUND"; fi
echo "Node: $(command -v node 2>/dev/null || echo 'NOT FOUND')"
echo "jq: $(command -v jq 2>/dev/null || echo 'NOT FOUND')"
```

If the plugin is not found, tell the user to run `copilot plugin install griches/copilot-hud` first.
If Node.js is not found, tell the user to install it from https://nodejs.org/.
If jq is not found, tell the user to install it from https://jqlang.github.io/jq/download/. Without jq, the HUD will render but tool and agent activity will not be tracked.

## Step 2: Create Wrapper Script

Create the wrapper script that Copilot's statusLine will execute. This script pipes stdin (session JSON) to the HUD renderer:

```bash
COPILOT_HOME="${COPILOT_HOME:-$HOME/.copilot}"
PLUGIN_JS=$(find "$COPILOT_HOME/installed-plugins" -name "index.js" -path "*/copilot-hud/dist/*" 2>/dev/null | head -1)
cat > "$COPILOT_HOME/copilot-hud.sh" << SCRIPT
#!/bin/bash
cat | node "$PLUGIN_JS"
SCRIPT
chmod +x "$COPILOT_HOME/copilot-hud.sh"
echo "Wrapper script created at $COPILOT_HOME/copilot-hud.sh"
```

## Step 3: Configure statusLine

Read the existing Copilot config and merge in the statusLine and experimental settings:

```bash
COPILOT_HOME="${COPILOT_HOME:-$HOME/.copilot}"
cat "$COPILOT_HOME/config.json" 2>/dev/null || echo "{}"
```

Using the Edit tool, add or update these keys in `$COPILOT_HOME/config.json`:
- `"experimental": true`
- `"statusLine": { "type": "command", "command": "~/.copilot/copilot-hud.sh" }`

Do NOT overwrite other existing keys (like `installed_plugins`, `trusted_folders`, `banner`, etc). Merge carefully.

## Step 4: Verify

Test the wrapper script produces output:

```bash
echo '{"cwd":"'$(pwd)'","model":{"display_name":"claude-sonnet-4.6 (1x) (medium)"},"context_window":{"context_window_size":200000,"remaining_tokens":130000,"used_percentage":35,"total_input_tokens":24100,"total_output_tokens":8420},"cost":{"total_duration_ms":300000,"total_api_duration_ms":45000,"total_premium_requests":3,"total_lines_added":42,"total_lines_removed":5}}' | ~/.copilot/copilot-hud.sh 2>&1
```

If output appears, setup is complete.

## Step 5: Done

Tell the user:

> Setup complete! Restart Copilot CLI to see the HUD:
> ```
> copilot --experimental
> ```
> To customize what the HUD shows, run `/copilot-hud:configure`.
>
> **Note:** The `statusLine` feature requires the `--experimental` flag as of Copilot CLI v1.0.12.
> You can also add `"experimental": true` to `~/.copilot/config.json` to enable it permanently.
