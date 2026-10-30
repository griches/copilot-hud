---
description: Set up Copilot HUD as a native status line inside Copilot CLI
allowed-tools: Bash, Read
---

Set up copilot-hud as the Copilot CLI status line. A helper script does all the file changes; don't edit Copilot's settings by hand. Placeholders in `{BRACES}` are values you fill in from earlier steps.

## Step 1: Find the runtime and the helper

Node.js is the only requirement — it renders the status line and runs the hooks.

| Shell | Commands |
|---|---|
| bash / zsh (macOS, Linux, WSL, Git Bash) | `command -v node` and `find "${COPILOT_HOME:-$HOME/.copilot}/installed-plugins" -name setup.mjs -path "*copilot-hud*" 2>/dev/null \| head -1` |
| PowerShell | `(Get-Command node -ErrorAction SilentlyContinue).Source` and `(Get-ChildItem -Recurse -Filter setup.mjs (Join-Path $(if ($env:COPILOT_HOME) { $env:COPILOT_HOME } else { "$HOME\.copilot" }) 'installed-plugins') \| Where-Object FullName -like '*copilot-hud*' \| Select-Object -First 1).FullName` |

The results are `{NODE}` and `{SETUP}`.

- No Node: stop. Point the user to Node.js LTS from https://nodejs.org (`winget install OpenJS.NodeJS.LTS` on Windows), then ask them to restart their shell and run `/copilot-hud:setup` again.
- No helper: the plugin isn't installed. Tell the user to run `copilot plugin marketplace add griches/copilot-hud` and then `copilot plugin install copilot-hud@copilot-hud`. Do not suggest `copilot plugin install griches/copilot-hud` — direct installs are deprecated by Copilot CLI and emit a warning.

## Step 2: Inspect the current settings

```bash
"{NODE}" "{SETUP}" inspect
```

In PowerShell, prefix the command with `&`. This changes nothing. It prints JSON with:

- `settingsPath`: the file `statusLine` goes in
- `command`: the statusLine command it will install
- `existing`: `none`, `copilot-hud`, or `other`, for the current statusLine
- `existingPreview`: a redacted preview of the current command
- `plugin`: the installed copilot-hud the status line will run, or `null`
- `hudConfigExists`: whether the user already has a HUD config

If it fails (for example, the settings file is not valid JSON), show the error and stop.

If `existing` is `other`, ask the user:

- question: "You already have a status line: `{existingPreview}`. Replace it with copilot-hud? Your settings are backed up first."
- options: "Replace it" / "Keep my current status line"

On "Keep", stop without changing anything. Only ever show `existingPreview`, never the raw command, because it may contain secrets.

## Step 3: Install

```bash
"{NODE}" "{SETUP}" install
```

This does the following:

- Copies a launcher to `<copilot home>/plugins/copilot-hud/statusline.mjs`. The launcher finds the installed copilot-hud each time it runs, so reinstalling the plugin or moving it to another marketplace never needs setup again.
- Writes the wrapper Copilot executes: `copilot-hud.sh` in the Copilot home (`copilot-hud.cmd` on Windows).
- Installs the quota-bar session extension to `<copilot home>/extensions/copilot-hud/extension.mjs`. Add `--no-extension` to skip it; the HUD then renders without a quota bar.
- Backs up the settings file to the reported `backupPath`, and saves a replaced command to `previousCommandPath`.
- Writes `statusLine` and `"experimental": true`, and keeps every other setting. A `refreshInterval` or `padding` the user added to the statusLine is kept.

Running it again is safe: when nothing needs changing it reports `settingsChanged: false` and writes no backup.

Test the result with sample input:

```bash
echo '{"cwd":"'"$(pwd)"'","model":{"display_name":"claude-sonnet-4.6 (1x) (medium)"},"context_window":{"context_window_size":200000,"remaining_tokens":130000,"used_percentage":35,"total_input_tokens":24100,"total_output_tokens":8420},"cost":{"total_duration_ms":300000,"total_api_duration_ms":45000,"total_lines_added":42,"total_lines_removed":5},"ai_used":{"total_nano_aiu":1420000000,"formatted":"1.42"}}' | {COMMAND}
```

`{COMMAND}` is the `command` from the report. In PowerShell: `'<json>' | & "{wrapperPath}"`.

It should print at least two HUD lines within a few seconds. If it errors or prints nothing:

1. Show the output.
2. If `backupPath` was reported, restore it by copying it over `settingsPath`.
3. Stop.

## Step 4: Choose a look

```bash
"{NODE}" "{SETUP}" preview
```

This changes nothing. It prints each look, drawn by the real renderer from sample data. Show the output to the user in a fenced code block, exactly as printed, so they can compare them. Then ask:

- question: "Which look do you want? You can change it any time with `/copilot-hud:configure`."
- options: "Standard (recommended)" / "Compact" / "Minimal" / "Full". If `hudConfigExists` is `true`, put "Keep my current config" first instead.

On "Keep my current config", skip to Step 5. Otherwise run this with the lowercase name:

```bash
"{NODE}" "{SETUP}" preset {NAME}
```

It writes `preset` to the HUD config and keeps everything else in that file. If the report's `overrides` isn't empty, list those keys and tell the user they still apply on top of the look. If the command fails, show the error and carry on: the HUD still works with its defaults.

## Step 5: Finish

Tell the user:

> Setup complete! Restart Copilot CLI to see the HUD:
> ```
> copilot --experimental
> ```
> To customize what the HUD shows, run `/copilot-hud:configure`.

Then add whichever of these apply:

- `"experimental": true` is now in their settings, so the flag is only needed for this first restart. (`statusLine` is an experimental Copilot CLI feature as of v1.0.12.)
- If `extensionChanged` is `true`: **the quota bar will not appear straight away.** Extensions are launched at startup, so it needs the restart, and then one prompt with a completed response — quota arrives on the `assistant.usage` event, which only fires once a model call finishes. This is expected and not a sign of a failed install.
- Countdowns and durations (the prompt timer, running agents) only move when Copilot re-runs the status line. On Copilot CLI v1.0.76+ they can tick while idle: add `"refreshInterval": 5` (seconds) to `statusLine` in `settingsPath`. Offer this; don't do it unasked.

## If the HUD doesn't appear

Check these in order:

1. Run the Step 3 test again and show its output.
2. If there's no output, run `inspect` again. `"plugin": null` means the launcher can't find copilot-hud under `<copilot home>/installed-plugins` — reinstall it with `copilot plugin install copilot-hud@copilot-hud`.
3. Check that `COPILOT_HUD_DISABLE` isn't set in the shell that starts Copilot.
4. Check that Copilot was started with `--experimental`, or that `"experimental": true` is in `settingsPath`.
5. If Node moved (nvm, mise, and asdf upgrades change the path) the wrapper falls back to `node` on `PATH`; run setup again to pin the new one.
6. To go back to the previous status line, copy `backupPath` over `settingsPath`.
