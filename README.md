# Copilot HUD

A GitHub Copilot CLI plugin that shows what's happening — project path, git branch, tool activity, and session duration. Renders in your tmux status bar or shell prompt.

```
[Copilot] │ my-project │ git:(main*) │ ⏱ 5m
✓ ✎ Edit: auth.ts | ✓ ⌨ Bash: npm test | ◐ ◉ View: index.ts
```

## Install

### Prerequisites

- [GitHub Copilot CLI](https://githubnext.com/projects/copilot-cli/) installed and authenticated
- Node.js 18+
- [`jq`](https://jqlang.github.io/jq/download/) (used by hook scripts)

### Quick Start

```bash
# 1. Install the plugin
copilot plugin install griches/copilot-hud

# 2. Inside a Copilot CLI session, run guided setup
/copilot-hud:setup

# 3. Reload your shell or tmux
source ~/.zshrc   # or ~/.bashrc
tmux source-file ~/.tmux.conf  # if using tmux integration
```

The setup wizard will:
1. Detect your Node.js runtime
2. Let you choose between **tmux status bar** or **shell prompt** integration
3. Write the required shell/tmux config
4. Let you enable optional features (ahead/behind counts, prompt preview, etc.)

### Install from Source

```bash
git clone https://github.com/griches/copilot-hud.git
cd copilot-hud
npm install
npm run build
copilot plugin install ./
```

---

## What You See

### Default (2 lines)
```
[Copilot] │ my-project │ git:(main*) │ ⏱ 5m
✓ ✎ Edit: auth.ts | ✓ ⌨ Bash ×2 | ◐ ◉ View: index.ts
```

- **Line 1** — Project path (configurable depth), git branch, session duration
- **Line 2** — Tool activity (running and completed tools)

Tool status icons:
| Icon | Meaning |
|------|---------|
| `◐`  | Running |
| `✓`  | Success |
| `✗`  | Failed  |
| `⊘`  | Denied  |

---

## How It Works

```
Copilot CLI → hooks (session/tool events) → hud-state.json
                                                   ↓
                                         node dist/index.js
                                                   ↓
                                       tmux status bar / shell prompt
```

- **Hooks** fire on `sessionStart`, `userPromptSubmitted`, `preToolUse`, `postToolUse`, and `sessionEnd`
- Each hook writes to `~/.copilot/hud-state.json`
- The HUD script reads that file, gets git status, and renders colorized output

---

## Configuration

Customize anytime:
```
/copilot-hud:configure
```

Or edit `~/.copilot/plugins/copilot-hud/config.json` directly:

```json
{
  "pathLevels": 2,
  "gitStatus": {
    "enabled": true,
    "showDirty": true,
    "showAheadBehind": false
  },
  "display": {
    "showTools": true,
    "showSessionDuration": true,
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

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `pathLevels` | `1` | Directory depth: `my-project` (1), `apps/my-project` (2), `dev/apps/my-project` (3) |
| `gitStatus.enabled` | `true` | Show git branch |
| `gitStatus.showDirty` | `true` | Show `*` for uncommitted changes |
| `gitStatus.showAheadBehind` | `false` | Show `↑N ↓N` ahead/behind remote |
| `display.showTools` | `true` | Show tool activity line |
| `display.showSessionDuration` | `true` | Show `⏱ 5m` session timer |
| `display.showPromptPreview` | `false` | Show last submitted prompt |

---

## Development

```bash
# Watch mode for rapid iteration
npm run dev

# Test with mock data
COPILOT_HOME=/tmp/test-hud node dist/index.js
```

---

## Differences from claude-hud

| Feature | claude-hud | copilot-hud |
|---------|-----------|-------------|
| Display mechanism | Claude Code native `statusLine` API | tmux status bar or shell `PROMPT_COMMAND` |
| Context window % | ✅ Native from Claude Code stdin | ❌ Not exposed via Copilot CLI hooks |
| Token usage limits | ✅ From Claude Code rate_limits | ❌ Not exposed via hooks |
| Tool activity | ✅ Via transcript JSONL | ✅ Via `preToolUse`/`postToolUse` hooks |
| Git status | ✅ | ✅ |
| Session duration | ✅ | ✅ |
| Always visible | ✅ (native UI integration) | ✅ (tmux) / on prompt refresh (shell) |

The main limitation is that Copilot CLI's plugin/hook API doesn't expose context window or rate-limit data — only tool events and session lifecycle. If Copilot CLI adds a native `statusLine` API in future, this plugin can be updated to use it.

---

## License

MIT
