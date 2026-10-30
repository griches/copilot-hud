---
description: Configure which elements appear in the Copilot HUD
allowed-tools: Bash, Read, Edit
---

# Configure Copilot HUD

## Read the current config

The config file is `plugins/copilot-hud/config.json` inside the Copilot home (`$COPILOT_HOME` when set, otherwise `~/.copilot`). This command writes only that file.

```bash
cat "${COPILOT_HOME:-$HOME/.copilot}/plugins/copilot-hud/config.json" 2>/dev/null || echo "(no config — using defaults)"
```

Missing keys use the defaults in `docs/CONFIGURATION.md`. The effective config is the defaults, then the file's `preset`, then the rest of the file; use the effective values when describing the current state.

## Show the looks

Find the helper, as `{NODE}` and `{SETUP}`:

| Shell | Commands |
|---|---|
| bash / zsh (macOS, Linux, WSL, Git Bash) | `command -v node` and `find "${COPILOT_HOME:-$HOME/.copilot}/installed-plugins" -name setup.mjs -path "*copilot-hud*" 2>/dev/null \| head -1` |
| PowerShell | `(Get-Command node -ErrorAction SilentlyContinue).Source` and `(Get-ChildItem -Recurse -Filter setup.mjs (Join-Path $(if ($env:COPILOT_HOME) { $env:COPILOT_HOME } else { "$HOME\.copilot" }) 'installed-plugins') \| Where-Object FullName -like '*copilot-hud*' \| Select-Object -First 1).FullName` |

Then draw every look and the user's current config, each from the same sample data:

```bash
"{NODE}" "{SETUP}" preview
"{NODE}" "{SETUP}" preview --current
```

In PowerShell, prefix each command with `&`. Show both outputs to the user in fenced code blocks, exactly as printed, before asking anything. If the helper can't be found, carry on without them.

## Ask

Ask the Look question from Batch 1 on its own first, then work out the effective config under the chosen look and use it for every current value and default in the remaining questions. Otherwise a default carried over from the old config would write a key that overrides the look. Then ask the rest, in three batches. Put the current value in each question. In multi-select questions, every listed item becomes `true` if selected and `false` if not. Every single-select question also offers "Keep current", which changes none of its keys.

Send each batch as one form: a single ask with one property per question. The form schema is strict about the two question shapes, so use exactly these:

```json
{
  "type": "object",
  "properties": {
    "git": {
      "type": "string",
      "title": "Git",
      "description": "Currently: Branch + dirty + ahead/behind",
      "enum": ["Keep current", "Branch + dirty + ahead/behind", "Branch + dirty", "Branch only", "Disabled"],
      "default": "Keep current"
    },
    "activity": {
      "type": "array",
      "title": "Activity lines",
      "description": "Select every line to show. Unselected lines are hidden.",
      "items": { "type": "string", "enum": ["Tools", "Agents", "Prompt"] },
      "default": ["Tools", "Agents"]
    }
  }
}
```

- Single select: `"type": "string"` with `enum`.
- Multi-select: `"type": "array"` whose `items` has **both** `"type": "string"` and `enum`. Leaving `type` out of `items` is rejected as invalid input.
- Set a multi-select's `default` to the items that are currently on, so submitting it untouched changes nothing. Don't set `minItems`: selecting nothing is a valid answer and turns every item off.
- Keep the option labels short, as above. The example output for each option belongs in the `description`.

### Batch 1

**Look** (single select) — the starting point shown above. The model and context bar are always shown. Setting one writes `preset` and removes these keys from the file, so that the preset takes effect: `pathLevels`, `gitStatus.showAheadBehind`, `gitStatus.showFileStats`, and under `display`: `layout`, `abbreviateHome`, `barWidth`, `maxAgents`, `showTools`, `showSessionName`, `showSessionDuration`, `showTokenBreakdown`, `showOutputSpeed`, `showLinesChanged`, `showCredits`, `showContextCounts`, `showLastCall`, `showCacheBreakdown`, `showPromptPreview`, `showQuotaCounts`, `showQuotaPace`, `showQuotaProjection`.

| Option | What differs from the defaults |
|---|---|
| Standard (default) | Nothing |
| Compact — one line | `layout: [["model", "remote", "project", "git", "context", "quota"]]`, `showContextCounts: false`, `barWidth: 5`, and everything Minimal turns off |
| Minimal — two lines | `false`: `showSessionName`, `showSessionDuration`, `showTokenBreakdown`, `showOutputSpeed`, `showLinesChanged`, `showCredits`, `showTools`, `showQuotaCounts`, `gitStatus.showAheadBehind` |
| Full — everything | `true`: `showLastCall`, `showCacheBreakdown`, `showPromptPreview`, `showQuotaPace`, `showQuotaProjection`, `abbreviateHome`, `gitStatus.showFileStats`. Also `pathLevels: 0`, `maxAgents: 8` |

**Details** (multi-select) — fine-tune the info lines on top of the look. Cache read/write only shows alongside token counts.

- "Session name — `Creating README`": `display.showSessionName`
- "Duration — `⏱ 5m`": `display.showSessionDuration`
- "Lines changed — `+42/-3`": `display.showLinesChanged`
- "Context counts — `70.0k/200.0k`": `display.showContextCounts`
- "Token counts — `in:1.5M out:12.2k cache:1.4M`": `display.showTokenBreakdown`
- "Output speed — `42 tok/s`": `display.showOutputSpeed`
- "Last call — `last:76.0k→200`": `display.showLastCall`
- "Cache read/write — `cache·R:1.4M W:0`": `display.showCacheBreakdown`

**Activity lines** (multi-select)

- "Tools — `✓ Edit: auth.ts | ✓ Bash: git status ×3`": `display.showTools`
- "Agents — `✓ [explore] Search codebase (12s)`": `display.showAgents`
- "Prompt — `❯ fix the auth redirect loop (42s)`": `display.showPromptPreview`

**Git** (single select)

| Option | `gitStatus` keys |
|---|---|
| Branch + dirty + ahead/behind (default) — `git:(main* ↑2 ↓1)` | `enabled: true`, `showDirty: true`, `showAheadBehind: true` |
| Branch + dirty — `git:(main*)` | `enabled: true`, `showDirty: true`, `showAheadBehind: false` |
| Branch only — `git:(main)` | `enabled: true`, `showDirty: false`, `showAheadBehind: false` |
| Disabled | `enabled: false` |

**Quota bar** (single select) — monthly entitlement usage. It needs the session extension that `/copilot-hud:setup` installs; without it this setting has no visible effect.

| Option | Keys (all under `display`) |
|---|---|
| Full (default) — `Quota ██████░░░░ 4785/7500 64% · 19d` | `showQuota: true`, `showQuotaCounts: true`, `showQuotaReset: true` |
| Bar + counts — `Quota ██████░░░░ 4785/7500 64%` | `showQuota: true`, `showQuotaCounts: true`, `showQuotaReset: false` |
| Compact — `Quota ██████░░░░ 64%` | `showQuota: true`, `showQuotaCounts: false`, `showQuotaReset: false` |
| Hidden | `showQuota: false` |

### Batch 2

**Project path** (single select)

| Option | Keys |
|---|---|
| 1 level (default) — `my-project` | `pathLevels: 1`, `display.showProjectName: true` |
| 2 levels — `projects/my-project` | `pathLevels: 2`, `display.showProjectName: true` |
| 3 levels — `you/projects/my-project` | `pathLevels: 3`, `display.showProjectName: true` |
| Full path — `/Users/you/projects/my-project` | `pathLevels: 0`, `display.showProjectName: true` |
| Hidden | `display.showProjectName: false` |

**Path style** (single select)

| Option | Keys |
|---|---|
| Solid color (default) | `display.rainbowPath: false` |
| Rainbow + lavender background | `display.rainbowPath: true`, `colors.rainbowPathBg: "189"` |
| Rainbow, no background | `display.rainbowPath: true`, `colors.rainbowPathBg: "none"` |

**Extras** (multi-select)

- "Git file counts — `git:(main* !3 +1 ✘2 ?4)`": `gitStatus.showFileStats`
- "Quota pace — flag the quota bar with `▲` when you're on track to run out before it resets": `display.showQuotaPace`
- "Quota forecast — `40% →207%`, where usage is heading by the reset date": `display.showQuotaProjection`
- "Credits — `Credits 1.42`, the usage of this session": `display.showCredits`
- "Effort — `[opus-4.6·high]`": `display.showEffort`
- "Multiplier — `[opus-4.6 3x]`": `display.showMultiplier`
- "Remote indicator — `◉ remote` when someone is attached to the session": `display.showRemote`

**Narrow terminals** (single select)

| Option | Keys (all under `display`) |
|---|---|
| Fit automatically (default) — drop the least important segments, then truncate | `fitWidth: true`, `maxWidth: 0` |
| Fit to a fixed width — ask for the column count | `fitWidth: true`, `maxWidth: <columns>` |
| Never truncate — draw everything and let the terminal wrap | `fitWidth: false` |

### Batch 3

**Bar style** (single select)

| Option | Keys |
|---|---|
| Block (default) — `████░░░░░░` | `display.barStyle: "block"` |
| Shade — `▓▓▓▓░░░░░░` | `display.barStyle: "shade"` |
| Dots — `●●●●○○○○○○` | `display.barStyle: "dots"` |
| Line — `━━━━──────` | `display.barStyle: "line"` |
| ASCII — `####------` | `display.barStyle: "ascii"` |

**Separator** (single select)

| Option | Keys |
|---|---|
| Line (default) — `a │ b` | `display.separator: "│"` |
| Pipe — `a \| b` | `display.separator: "\|"` |
| Dot — `a · b` | `display.separator: "·"` |
| Spaces — `a  b` | `display.separator: ""` |

**Tool line** (multi-select)

- "Tool icons — `✓ ✎ Edit`": `display.showToolIcons`
- "Tool targets — `Edit: auth.ts`. Turn off when screen sharing": `display.showToolTargets`

If the user cancels any question, say "Configuration cancelled." and stop.

## Preview and confirm

Compute the changed keys by comparing against the effective config.

- If nothing changed, say "No changes needed - config unchanged." and stop.
- Otherwise show each changed key as `key: old → new`, and a mock-up of the HUD with the new settings, using the printed looks as a guide to the format.

Then ask "Save these changes?"

## Write

Write the config file, creating directories as needed. Start from the existing file, apply the Look (writing `preset` and removing its keys), then write only the keys whose chosen value differs from the effective config under that Look. Keep every other key exactly as it was, including settings this command doesn't ask about, such as `colors`, `thresholds`, and `display.completedAgentFadeSec`. Write valid JSON with 2-space indentation.

Then run `"{NODE}" "{SETUP}" preview --current` and show the result in a fenced code block, so the user sees the real thing. Say: "Configuration saved! The HUD picks it up on its next refresh." Mention that `docs/CONFIGURATION.md` documents every other option, and that they can also just ask — for example "hide the tool activity line" or "show two path levels".
