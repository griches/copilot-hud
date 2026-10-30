# Copilot HUD

A GitHub Copilot CLI plugin that displays a real-time status line inside your Copilot session — project path, git branch, context usage, tool activity, and background agents.

English | [中文](README.zh.md)

```
  /Users/sky/Github/my-project [↙ main]                 Claude Opus 4.6 (3x) (high)
──────────────────────────────────────────────────────────────────────────────────────
  [Opus 4.6 3x·high] │ my-project │ git:(main* ↑2) │ Creating README │ ⏱ 5m │ +42/-3
  Ctx ████░░░░░░ 70.0k/200.0k 35% │ Quota ██████░░░░ 4785/7500 64% · 19d │ Credits 1.42 │ 42 tok/s
  ✓ ✎ Edit: auth.ts | ✓ ⌨ Bash: git status ×3 | ◐ ◉ Read: index.ts
  ◐ [explore] Analyze test coverage (45s…)
  ✓ [explore] Search auth module (18s)
  ✗ [general-purpose] Parse config schema (1m 12s)
```

## Install

### Prerequisites

- [GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli) v1.0.12+ installed and authenticated
- Node.js 18+

That's the whole list. `jq` used to be required as well, for the hook scripts
that track tool and agent activity; those hooks are now plain Node, so there is
nothing to install beyond Node itself.

### Quick Start

1. Install the plugin:

   ```bash
   copilot plugin marketplace add griches/copilot-hud
   copilot plugin install copilot-hud@copilot-hud
   ```

2. Start Copilot with the experimental flag and run the setup skill:
   ```bash
   copilot --experimental
   ```
   Then inside the session:
   ```
   /copilot-hud:setup
   ```

The setup points Copilot's status line at the HUD, installs the quota-bar extension, and enables the experimental flag. Restart Copilot after setup and the HUD will appear at the bottom of the interface.

Setup is safe to re-run and you rarely need to: it installs a small launcher that finds the installed plugin each time the status line runs, so updating, reinstalling, or moving the plugin to another marketplace keeps working. It backs up your Copilot settings before changing them, and if you already have a different status line it asks before replacing it.

3. (Optional) Customize what the HUD shows:
   ```
   /copilot-hud:configure
   ```
   Choose which elements to display — session name, duration, token breakdown, output speed, tool activity, agent tracking, and git style.

> **Note:** The `statusLine` feature in Copilot CLI requires the `--experimental` flag as of v1.0.12. The setup skill adds `"experimental": true` to your Copilot settings so you don't need the flag again.

<details>
<summary><strong>What setup changes, and doing it by hand</strong></summary>

Setup runs `node scripts/setup.mjs install` from the installed plugin. Under your Copilot home (`~/.copilot`, or `$COPILOT_HOME`) it writes:

| File | What it is |
|------|------------|
| `plugins/copilot-hud/statusline.mjs` | The launcher. Finds the installed copilot-hud and runs it |
| `copilot-hud.sh` (`copilot-hud.cmd` on Windows) | The wrapper Copilot executes. Pins the Node that ran setup, falling back to `node` on `PATH` |
| `extensions/copilot-hud/extension.mjs` | The quota-bar session extension (skip with `--no-extension`) |
| `settings.json` | Gains `statusLine` and `"experimental": true`; every other key is kept. Backed up to `settings.json.bak.<timestamp>` first |

On Copilot CLI versions from before user settings moved to `settings.json`, the same keys go in `config.json` instead; setup detects which one your CLI reads.

`node scripts/setup.mjs inspect` prints what would happen without changing anything.

</details>

### Refreshing While Idle

Copilot re-runs the status line when something happens in the session, so the prompt timer and running-agent durations stand still while you wait. On Copilot CLI v1.0.76+ you can make them tick by adding `refreshInterval` (seconds) to the `statusLine` entry in `~/.copilot/settings.json`:

```json
"statusLine": { "type": "command", "command": "~/.copilot/copilot-hud.sh", "refreshInterval": 5 }
```

Setup keeps a `refreshInterval` or `padding` you add here.

### Turning It Off for a Session

```bash
COPILOT_HUD_DISABLE=1 copilot
```

Any value other than `0`, `false`, `off`, or `no` blanks the HUD for that session without touching your settings.

### Install from Source

Register your local checkout as a marketplace, then install from it:

```bash
git clone https://github.com/griches/copilot-hud.git
cd copilot-hud
npm install
npm run build
copilot plugin marketplace add ./
copilot plugin install copilot-hud@copilot-hud
```

The marketplace only needs registering once. After each rebuild, re-run `copilot plugin install copilot-hud@copilot-hud` to pick up your changes — `copilot plugin update` won't, since it compares versions and your local version hasn't changed.

> **If you already installed from the GitHub marketplace**, both sources register under the same name (`copilot-hud`), so `marketplace add ./` fails with `already registered` and the install silently uses the published version instead of your checkout. Swap it over first — this also uninstalls the marketplace copy, but leaves your `config.json` alone:
>
> ```bash
> copilot plugin marketplace remove copilot-hud --force
> ```

### Already Installed Directly?

Copilot CLI is deprecating direct installs (repos, URLs, and local paths) — `copilot plugin install griches/copilot-hud` and `copilot plugin install ./` still work today, but emit a deprecation warning and will stop working in a future release. Run `copilot plugin list` to check: a direct install shows as `copilot-hud`, a marketplace install as `copilot-hud@copilot-hud`.

To migrate:

```bash
copilot plugin uninstall copilot-hud
copilot plugin marketplace add griches/copilot-hud
copilot plugin install copilot-hud@copilot-hud
```

If the marketplace is already registered, the middle command reports `already registered` — that's harmless, carry on to the install.

Your HUD configuration lives in `~/.copilot/plugins/copilot-hud/config.json` and is untouched by this.

---

## Features

### Model and Project Info
Shows which model you're using, your project path, git branch, session info, and code changes at a glance. The model name is shortened for readability — `claude-opus-4.6 (3x) (high)` becomes `[Opus 4.6 3x·high]`. The model badge parses reasoning effort (low/medium/high/xhigh), whether it is supplied explicitly, embedded in `display_name`, or recorded in the active session's `events.jsonl`, plus the request multiplier. When no session event is available, it falls back to Copilot's `settings.json` (`effortLevel`). Path depth is configurable (`pathLevels` 0–3; `0` shows the full absolute path). Lines added/removed are shown with green/red coloring.

```
[Opus 4.6 3x·high] │ my-project │ git:(main* ↑2) │ ⏱ 5m │ +42/-3
```

### Context Window and Requests
A live progress bar showing how much of the **current** context window you're using. Prefers Copilot's live `current_context_used_percentage` / `current_context_tokens` / `displayed_context_limit` fields (populated from the very first render) and falls back to the legacy cumulative fields when unavailable, so the bar is accurate and populated immediately on session start instead of showing `0%` until the first response. Changes color as you approach the limit — green when you have plenty of room, yellow when it's getting tight, red when you're running low. Token breakdown (in/out/cache) is shown in a single segment.

```
Ctx ████░░░░░░ 70.0k/200.0k 35% │ Quota ██████░░░░ 4785/7500 64% · 19d │ Credits 1.42 │ in:1.5M out:12.2k cache:1.4M │ 42 tok/s
```

- **Ctx** — context bar with exact token usage `used/total percentage`
- **Quota** (optional) — monthly entitlement bar: requests used, percentage consumed, and days until reset. Requires the [session extension](#quota-bar). Turns magenta past 75% and red past 90%, and appends `+N over` once the entitlement is exhausted.
- **Credits** (optional) — AI units (AIU) consumed this session under Copilot's usage-based billing (1 AIU = $0.01 USD). Falls back to legacy premium request count (`Reqs`) on older CLI versions.
- **in/out/cache** — cumulative input, output, and cache tokens
- **tok/s** — output generation speed
- **last call** (optional) — tokens used in the most recent API call
- **Cache R/W** (optional) — separate cache read vs write counts

### Quota Bar

The quota bar shows how much of your monthly entitlement you've consumed:

```
Quota ██████░░░░ 4785/7500 64% · 19d
```

It needs a small session extension, because quota data never reaches the
statusline on its own. Copilot pipes a fixed JSON payload to the statusline
that carries no entitlement fields, and the on-disk event log doesn't have them
either — the `assistant.usage` event that carries quota is marked
`ephemeral: true`, so it is never persisted. The only way to observe it is to
attach to the live session.

`/copilot-hud:setup` installs the extension for you. To do it by hand, copy
`extension/extension.mjs` from this repo to
`~/.copilot/extensions/copilot-hud/extension.mjs`. Extensions load by default,
so no further configuration is needed.

Copilot only loads extensions from its own extensions directory, so the
installed file is a copy. It is kept current for you: each session start
compares it with the plugin's and replaces it if the plugin has moved on. The
refreshed copy takes effect the next time Copilot starts.

> **The bar won't appear immediately.** After running `/copilot-hud:setup` (or
> `/copilot-hud:configure`) you need to:
>
> 1. **Restart Copilot** — extensions are discovered and launched at startup, so
>    a newly installed one isn't running in your current session.
> 2. **Send a prompt and wait for the response** — quota arrives on the
>    `assistant.usage` event, which only fires when a model call completes.
>
> Until both have happened there is no quota data to draw, and the HUD renders
> without the bar. This is expected, not a broken install. If the bar still
> doesn't appear afterwards, check that `~/.copilot/hud-quota.json` exists;
> if it's missing, the extension isn't running — `/extensions` inside Copilot
> lists the status of each one.

After that first response the bar stays current on its own. The numbers refresh
on every model call, so an entitlement change — an org raising your monthly
allowance, for example — lands on your next prompt. Unlimited buckets (typically
`chat` and `completions`) are skipped rather than drawn as a permanently empty
bar.

One consequence of the data only existing live: at the very start of a new
session the bar briefly shows the previous session's figures, until the first
response of the new one updates it.

Without the extension the HUD renders exactly as before, minus the quota bar.
Configure it with `/copilot-hud:configure` or the `display.showQuota*` keys.

**Pace.** The percentage alone doesn't say whether you're in trouble — 40% is
calm on day 20 and a problem on day 5. With `display.showQuotaPace` the bar
projects your usage so far to the reset date and flags it with `▲`: amber when
you're on track to end the month at 90% or more, red when you'd run out first.

```
Quota ████░░░░░░ 3000/7500 40% ▲ · 25d
```

Buckets under 10% used are never flagged. Add `display.showQuotaProjection` to see the forecast itself, as `40% ▲ →207%`.

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

### Prompt Preview

Shows the prompt currently being worked on, with the time since you submitted it:

```
❯ fix the auth redirect loop when the session token expires mid-request (42s)
```

During a turn the age reads as how long Copilot has been working; once the turn
finishes it reads as how long the session has been idle. Enable with
`display.showPromptPreview` (default `false`). Multi-line prompts are collapsed
to a single line, and the age is dropped if the timestamp is missing or older
than a day — a stale state file shouldn't produce a nonsense clock.

### Narrow Terminals

Every HUD line is fitted to the terminal width instead of wrapping. As the
terminal narrows, the least important segments drop out first — session name,
then lines changed, then duration — while the model badge and the context bar
are always kept:

```
120 cols  [opus-4.6 3x·high] │ ◉ remote │ my-project │ git:(main*) │ Fixing auth │ ⏱ 5m │ +42/-3
 70 cols  [opus-4.6 3x·high] │ ◉ remote │ my-project │ git:(main*) │ ⏱ 5m │ +42/-3
 40 cols  [opus-4.6 3x·high] │ ◉ remote
```

Anything still too wide is truncated with `…` rather than wrapped. Width is
detected from the terminal itself — the statusline runs with its output piped,
so the HUD asks the controlling terminal directly. If the width genuinely can't
be determined, nothing is truncated and you get the old behavior.

Turn it off with `display.fitWidth: false`, or pin a fixed budget with
`display.maxWidth` (useful in a split pane, or if detection fails).

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

The number of agents displayed is configurable via `display.maxAgents` (default: 5). Completed agents fade out after `display.completedAgentFadeSec` seconds (default: 30; set to `0` to keep them around like before).

---

## How It Works

```
Copilot CLI session
  │
  ├─ statusLine (experimental) ──→ copilot-hud.sh ──→ statusline.mjs
  │    pipes session JSON on stdin     (finds the installed plugin)
  │    (model, context_window, cost)   ▼
  │                              node dist/index.js
  │                                    │
  ├─ hooks ──→ hud-state.json          │ reads state + git
  │  (sessionStart, toolUse events)    │
  │                                    ▼
  └─────────────────────────────── rendered status line
```

- **statusLine** receives session JSON on stdin including: model (id, display_name with effort/multiplier), context_window (live `current_context_*` and `displayed_context_limit`, plus cumulative sizes/percentages/token counts, cache stats, last call, reasoning tokens), cost (duration, API time, lines added/removed), `ai_used` (credits under Copilot's usage-based billing — prefer `formatted`, raw value in `total_nano_aiu`; falls back to legacy `cost.total_premium_requests`), session metadata (name, id, cwd, transcript_path), Copilot CLI version, and `remote.connected` for remote-control sessions
- **Hooks** fire on `sessionStart`, `userPromptSubmitted`, `preToolUse`, `postToolUse`, and `sessionEnd`, writing to `~/.copilot/hud-state.json`. The `.sh` and `.ps1` hooks are thin wrappers around one shared Node implementation in `scripts/hud-hook.mjs`, so both platforms behave identically
- The HUD script merges both data sources and renders colorized output
- Text the HUD didn't author — prompts, tool targets, agent descriptions, branch and directory names — is stripped of escape sequences, control characters, and bidirectional overrides before it reaches your terminal
- Git status is one read-only `git status --porcelain=v2 --branch` call per render, run with `--no-optional-locks` so an interrupted render can't leave `.git/index.lock` behind

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
    "showAheadBehind": true,
    "showFileStats": false
  },
  "display": {
    "showTools": true,
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
    "showLastCall": false,
    "showCacheBreakdown": false,
    "rainbowPath": false,
    "showRemote": true,
    "showQuota": true,
    "showQuotaCounts": true,
    "showQuotaReset": true,
    "showQuotaPace": false,
    "fitWidth": true,
    "maxWidth": 0
  },
  "colors": {
    "rainbowPathBg": "189"
  }
}
```

Or run `/copilot-hud:configure` inside a Copilot session for guided setup, with examples of each look.

For a ready-made look, set `"preset"` to `compact`, `minimal`, `standard`, or `full`, and add only the keys you want to change. [The reference](docs/CONFIGURATION.md#presets) shows all four.

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `preset` | none | Start from a named look: `compact`, `minimal`, `standard`, or `full`. Keys in your file still win |
| `pathLevels` | `1` | `0` = full absolute path, `1` = project name, `2-3` = parent dirs |
| `gitStatus.enabled` | `true` | Show git branch |
| `gitStatus.showDirty` | `true` | Show `*` for uncommitted changes |
| `gitStatus.showAheadBehind` | `true` | Show `↑N ↓N` ahead/behind remote |
| `gitStatus.showFileStats` | `false` | Show changed-file counts: `!3 +1 ✘2 ?4` for modified, added, deleted, untracked |
| `gitStatus.showPrefix` | `true` | Wrap the branch in `git:(…)` |
| `gitStatus.maxBranchLength` | `0` | Cut longer branch names with `…`. `0` never cuts |
| `display.showTools` | `true` | Show tool activity line |
| `display.showToolIcons` | `true` | Show each tool's type icon |
| `display.showToolTargets` | `true` | Show what each tool acted on. Turn off when screen sharing |
| `display.maxTools` | `0` | Most tools on the line. `0` shows every recent one |
| `display.showAgents` | `true` | Show background agent tracking |
| `display.maxAgents` | `5` | Max number of agents to display |
| `display.completedAgentFadeSec` | `30` | Hide completed sub-agents this many seconds after they finish (`0` = never auto-hide, legacy behavior) |
| `display.showProjectName` | `true` | Show the project name/path segment |
| `display.showSessionName` | `true` | Show session name/title |
| `display.showSessionDuration` | `true` | Show `⏱ 5m` wall clock time |
| `display.showTokenBreakdown` | `true` | Show `in:1.5M out:12.2k cache:1.4M` |
| `display.showOutputSpeed` | `true` | Show `42 tok/s` |
| `display.showLinesChanged` | `true` | Show `+42/-3` lines added/removed |
| `display.showEffort` | `true` | Show effort level in model badge |
| `display.showMultiplier` | follows `showEffort` | Show the request multiplier in model badge |
| `display.showCredits` | `true` | Show the credits used this session |
| `display.showContextCounts` | `true` | Show `70.0k/200.0k` next to the context percentage |
| `display.showLastCall` | `false` | Show last API call token counts |
| `display.showCacheBreakdown` | `false` | Show separate cache read/write counts |
| `display.showPromptPreview` | `false` | Show the last user prompt and how long ago it was submitted |
| `display.rainbowPath` | `false` | Render project path as per-character rainbow gradient (`false` = use `colors.project`) |
| `display.abbreviateHome` | `false` | With `pathLevels: 0`, write the home directory as `~` |
| `display.layout` | two lines | Which segments appear, on which line, in which order. See [the reference](docs/CONFIGURATION.md) |
| `display.barStyle` | `"block"` | `block`, `shade`, `dots`, `line`, or `ascii` |
| `display.barWidth` | `10` | Columns for the context and quota bars |
| `display.separator` | `"│"` | Divider between segments |
| `display.showRemote` | `true` | Show the `◉ remote` badge when a remote controller is attached to the session |
| `display.showQuota` | `true` | Show the monthly entitlement bar (requires the session extension) |
| `display.showQuotaCounts` | `true` | Include `4785/7500` counts alongside the quota percentage |
| `display.showQuotaReset` | `true` | Include days remaining until the entitlement resets |
| `display.showQuotaPace` | `false` | Flag the quota bar with `▲` (amber, then red) when usage is on track to run out before the reset |
| `display.showQuotaProjection` | `false` | Show where usage is heading by the reset date: `40% →207%` |
| `display.quotaBucket` | `""` | Entitlement id to draw. Empty picks the most used |
| `display.fitWidth` | `true` | Fit every line to the terminal width, dropping low-priority segments instead of wrapping |
| `display.maxWidth` | `0` | Column budget for `fitWidth`. `0` auto-detects; a positive number pins it |
| `colors.rainbowPathBg` | `"189"` | Background color for rainbow path. `"none"` disables background; otherwise a 256-color index or named color |
| `thresholds.*` | see reference | Where the context, quota, and pace colors change |

### Colors

Colors can be specified as:
- Named colors: `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `dim`
- 256-color indices: `208` (orange), `99` (purple)

---

## Uninstall

```bash
# 1. Remove the plugin
copilot plugin uninstall copilot-hud

# 2. Remove the wrapper script and the quota extension
rm ~/.copilot/copilot-hud.sh
rm -rf ~/.copilot/extensions/copilot-hud

# 3. Remove the statusLine config from ~/.copilot/settings.json
#    Delete the "statusLine" and "experimental" keys if no longer needed.
#    (Setup left a backup beside it: settings.json.bak.<timestamp>)

# 4. Remove the launcher and plugin config (optional)
rm -rf ~/.copilot/plugins/copilot-hud
```

---

## Development

```bash
# Build
npm run build

# Build and run the tests
npm test

# Test with mock session data
echo '{"cwd":"/tmp/myapp","model":{"display_name":"claude-opus-4.6 (3x) (high)"},"context_window":{"context_window_size":200000,"remaining_tokens":130000,"used_percentage":35,"total_input_tokens":1500000,"total_output_tokens":12200,"total_cache_read_tokens":1400000},"cost":{"total_duration_ms":300000,"total_api_duration_ms":45000,"total_lines_added":42,"total_lines_removed":3},"ai_used":{"total_nano_aiu":1420000000,"formatted":"1.42"},"session_name":"Creating README"}' | node dist/index.js
```

---

## Inspired By

Layout and colors based on [jarrodwatts/claude-hud](https://github.com/jarrodwatts/claude-hud).

---

## License

MIT
