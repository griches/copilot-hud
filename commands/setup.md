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
PLUGIN_DIR="$COPILOT_HOME/installed-plugins/_direct"
echo "Plugin: $(ls "$PLUGIN_DIR/dist/index.js" 2>/dev/null && echo 'OK' || echo 'NOT FOUND')"
echo "Node: $(command -v node 2>/dev/null || echo 'NOT FOUND')"
```

If the plugin is not found, tell the user to run `copilot plugin install griches/copilot-hud` first.
If Node.js is not found, tell the user to install it from https://nodejs.org/.

## Step 2: Create Wrapper Script

Create the wrapper script that Copilot's statusLine will execute. This script pipes stdin (session JSON) to the HUD renderer:

```bash
COPILOT_HOME="${COPILOT_HOME:-$HOME/.copilot}"
cat > "$COPILOT_HOME/copilot-hud.sh" << 'SCRIPT'
#!/bin/bash
cat | node ~/.copilot/installed-plugins/_direct/dist/index.js
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
echo '{"cwd":"'$(pwd)'","model":{"display_name":"test"}}' | ~/.copilot/copilot-hud.sh 2>&1
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
