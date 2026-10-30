# Copilot HUD — 手动配置指南

不需要打开 Copilot 会话，直接编辑 JSON 文件即可完成所有配置。

---

## 配置文件位置

```
~/.copilot/plugins/copilot-hud/config.json
```

如果文件不存在，HUD 使用内置默认值。你只需要写出**想要覆盖的键**，其余保持默认。

---

## 快速上手

```bash
# 创建目录（如果不存在）
mkdir -p ~/.copilot/plugins/copilot-hud

# 用编辑器打开配置文件
$EDITOR ~/.copilot/plugins/copilot-hud/config.json
```

修改后立即生效——HUD 每次渲染时都会重新读取配置文件。

---

## 完整配置结构

以下是**所有可用字段**及其默认值，完整来自 `src/config.ts`：

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

## 字段说明

### `pathLevels` — 项目路径深度

**类型：** `0 | 1 | 2 | 3`　**默认：** `1`

控制第1行显示的目录层数。当 `display.showProjectName` 为 `false` 时，此项无效。

| 值 | 效果 |
|----|------|
| `0` | `/Users/you/projects/my-project`（完整绝对路径） |
| `1` | `my-project` |
| `2` | `projects/my-project` |
| `3` | `you/projects/my-project` |

---

### `gitStatus` — Git 信息

**控制第1行的 `git:(branch*)` 部分。**

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `enabled` | boolean | `true` | 是否显示 git 信息 |
| `showDirty` | boolean | `true` | 有未提交改动时显示 `*`，例如 `git:(main*)` |
| `showAheadBehind` | boolean | `true` | 显示本地超前/落后远程的提交数，例如 `git:(main ↑2 ↓1)` |
| `showFileStats` | boolean | `false` | 显示变更文件计数：`!` 已修改、`+` 新增、`✘` 删除、`?` 未跟踪。为零的计数不显示 |

**示例组合：**

```
git:(main*)           # enabled=true, showDirty=true, showAheadBehind=false
git:(main* ↑2 ↓1)    # enabled=true, showDirty=true, showAheadBehind=true
git:(main* !3 +1 ?4)  # enabled=true, showDirty=true, showFileStats=true
git:(main)            # enabled=true, showDirty=false, showAheadBehind=false
（不显示）             # enabled=false
```

---

### `display` — 显示控制

**控制 HUD 三行内容的可见性。**

#### 第1行（项目信息行）

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `showProjectName` | boolean | `true` | 显示项目名称/路径段，例如 `│ my-project`。设为 `false` 时完全省略项目路径（`pathLevels` 无效）。 |
| `showSessionName` | boolean | `true` | 显示会话名称，例如 `│ Creating README` |
| `showSessionDuration` | boolean | `true` | 显示会话时长，例如 `│ ⏱ 5m` |
| `showLinesChanged` | boolean | `true` | 显示新增/删除行数，例如 `│ +42/-3` |
| `showEffort` | boolean | `true` | 在模型标识中显示努力等级，例如 `[Opus 4.6·high]` |
| `showMultiplier` | boolean | 跟随 `showEffort` | 在模型标识中显示请求倍率，例如 `[Opus 4.6 3x]` |
| `rainbowPath` | boolean | `false` | 项目路径逐字符彩虹渐变。设为 `false` 时回退到 `colors.project` 纯色。 |

#### 第2行（上下文行）

上下文进度条和请求数始终显示。以下为可选项：

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `showTokenBreakdown` | boolean | `true` | 显示累计输入/输出/缓存 token，例如 `│ in:1.5M out:12.2k cache:1.4M` |
| `showOutputSpeed` | boolean | `true` | 显示输出速度，例如 `│ 42 tok/s` |
| `showLastCall` | boolean | `false` | 显示最近一次 API 调用 token，例如 `│ last:76.0k→200` |
| `showCacheBreakdown` | boolean | `false` | 分别显示缓存读/写，例如 `│ cache·R:1.5M W:0` |

月度配额进度条也显示在这一行。它依赖 `/copilot-hud:setup` 安装的会话扩展；未安装时以下选项没有可见效果：

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `showQuota` | boolean | `true` | 显示配额进度条，例如 `│ Quota ██████░░░░ 64%` |
| `showQuotaCounts` | boolean | `true` | 附加原始计数，例如 `4785/7500` |
| `showQuotaReset` | boolean | `true` | 附加距离配额重置的天数，例如 `· 19d` |
| `showQuotaPace` | boolean | `false` | 按当前用量推算到重置日，并用 `▲` 标记进度条——预计月末达到 90% 及以上时为琥珀色，预计提前耗尽时为红色。用量低于 10% 时不标记 |

#### 第3行（工具活动行）

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `showTools` | boolean | `true` | 是否显示工具活动行。设为 `false` 隐藏整行 |

#### 输入预览行

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `showPromptPreview` | boolean | `false` | 显示当前处理的输入及其时长，如 `❯ fix the auth redirect loop (42s)`。绘制在上下文行与工具活动行之间。多行输入会合并为一行；时间戳缺失或超过一天时省略时长。 |

#### 第4行及以下（后台代理）

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `showAgents` | boolean | `true` | 是否显示后台代理追踪行（每个代理一行） |
| `maxAgents` | number | `5` | 显示代理的最大数量 |

#### 宽度适配（所有行）

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `fitWidth` | boolean | `true` | 让每一行保持在终端宽度内。先按重要性从低到高丢弃片段，然后以 `…` 截断。设为 `false` 则始终完整绘制，由终端自行换行。 |
| `maxWidth` | number | `0` | `fitWidth` 使用的列宽预算。`0` 表示自动检测终端宽度，正数表示固定宽度。 |

终端变窄时的片段丢弃顺序：

- **第1行** — 会话名称 → 时长 → 代码增删行数 → git → 项目路径。模型徽标和 `◉ remote` 指示器永不丢弃。
- **第2行** — 最后一次调用 → token 明细 → 输出速度 → credits → 配额。上下文进度条永不丢弃。
- **第3行** — 从最旧的工具开始丢弃；最近的一个工具永不丢弃。

宽度检测依次尝试：`maxWidth`、`COPILOT_HUD_COLUMNS` 环境变量、stdout/stderr 流、`COLUMNS`，最后通过 `/dev/tty` 查询控制终端。实际生效的通常是最后一项，因为 Copilot 运行状态行时输出是管道。若全部失败，则完全不做截断。

工具活动行示例：
```
✓ ✎ Edit: auth.ts | ✓ ⌨ Bash: git status ×3 | ◐ ◉ Read: index.ts
```

状态图标含义：
- `✓` 成功  
- `✗` 失败  
- `◐` 运行中  
- `⊘` 被拒绝

---

#### 新增的显示选项

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `layout` | 二维数组 | 两行 | 决定显示哪些片段、在哪一行、以什么顺序。片段 id：`model`、`remote`、`project`、`git`、`session`、`duration`、`lines`、`context`、`quota`、`credits`、`tokens`、`speed`、`lastCall`。未列出的片段会隐藏，未知 id 会被忽略 |
| `barStyle` | string | `"block"` | `block` `████░░░░░░`、`shade` `▓▓▓▓░░░░░░`、`dots` `●●●●○○○○○○`、`line` `━━━━──────`、`ascii` `####------` |
| `barWidth` | number | `10` | 上下文和配额进度条的列宽（1–40） |
| `separator` | string | `"│"` | 片段之间的分隔符，两侧各带一个空格 |
| `showContextCounts` | boolean | `true` | 在上下文百分比旁显示 `70.0k/200.0k` |
| `showCredits` | boolean | `true` | 显示本次会话的用量，例如 `Credits 1.42` |
| `showQuotaProjection` | boolean | `false` | 显示重置日的预计用量，例如 `40% →207%` |
| `quotaBucket` | string | `""` | 要显示的配额 id，例如 `premium_interactions`。留空或该 id 在你的套餐中不计量时，选择用量最高的配额 |
| `showToolIcons` | boolean | `true` | 显示工具类型图标，例如 `✎`。状态图标始终保留 |
| `showToolTargets` | boolean | `true` | 显示工具操作的对象，例如 `: auth.ts`。屏幕共享时可关闭 |
| `maxTools` | number | `0` | 工具行最多显示的工具数，最新的优先。`0` 显示全部 |
| `abbreviateHome` | boolean | `false` | `pathLevels` 为 `0` 时，将主目录写作 `~` |

`gitStatus` 还支持 `showPrefix`（默认 `true`，`false` 时只显示 `main*`）和 `maxBranchLength`（默认 `0`，超出时用 `…` 截断）。

把所有内容放在一行：

```json
{
  "display": {
    "layout": [["model", "project", "git", "context", "quota"]]
  }
}
```

---

### `thresholds` — 进度条变色的阈值

| 字段 | 默认 | 说明 |
|------|------|------|
| `contextWarn` | `70` | 上下文进度条变为 `colors.contextWarn` 的百分比 |
| `contextCritical` | `85` | 上下文进度条变为 `colors.contextCritical` 的百分比 |
| `quotaWarn` | `75` | 配额进度条变为 `colors.quotaWarn` 的百分比 |
| `quotaCritical` | `90` | 配额进度条变为 `colors.quotaCritical` 的百分比 |
| `paceWarn` | `90` | 重置日预计用量达到此值时显示琥珀色 `▲` |
| `paceCritical` | `100` | 重置日预计用量达到此值时显示红色 `▲` |
| `paceMinUsed` | `10` | 用量低于此值时不做预测 |

---

### `colors` — 颜色配置

控制 HUD 各部分的颜色。

| 字段 | 默认 | 作用位置 |
|------|------|----------|
| `header` | `"cyan"` | 第1行模型名称，例如 `[Sonnet 4.6]` |
| `project` | `"yellow"` | 第1行项目路径 — **仅在 `display.rainbowPath: false` 时生效** |
| `git` | `"magenta"` | `git:(` 和 `)` 括号 |
| `gitBranch` | `"cyan"` | 分支名称，例如 `main*` |
| `tools` | `"green"` | 工具名称（运行时为 `yellow`，失败为 `red`，自动覆盖此值） |
| `success` | `"green"` | 成功状态图标 `✓` |
| `failure` | `"red"` | 失败状态图标 `✗` |
| `label` | `"dim"` | 分隔符 `│`、标签 `Context`、`Credits` 等 |
| `running` | `"yellow"` | 运行中图标 `◐` 及运行中的工具名称 |
| `denied` | `"brightMagenta"` | 被拒绝图标 `⊘` 及被拒绝的工具名称 |
| `muted` | `"dim"` | 次要内容：会话名称、时长、token 计数、工具对象、耗时 |
| `remote` | `"brightMagenta"` | `◉ remote` 标记 |
| `credits` | `"brightBlue"` | Credits 数值 |
| `added` / `removed` | `"green"` / `"red"` | `+42` 和 `-3` |
| `agentType` | `"cyan"` | 代理行上的 `[explore]` |
| `prompt` | `"cyan"` | 输入预览行的 `❯` |
| `contextOk` / `contextWarn` / `contextCritical` | `"green"` / `"yellow"` / `"red"` | 上下文进度条各级别的颜色 |
| `quotaOk` / `quotaWarn` / `quotaCritical` | `"brightBlue"` / `"brightMagenta"` / `"red"` | 配额进度条各级别的颜色 |
| `paceWarn` / `paceCritical` | `"yellow"` / `"red"` | 显示 `▲` 时配额进度条的颜色 |
| `rainbowPathBg` | `"189"` | 彩虹路径的背景色。`"none"` 禁用背景；否则为 256 色索引（如 `"189"`）或命名颜色（如 `"magenta"`）。 |

#### 可用颜色名

**标准色：**
```
red  green  yellow  blue  magenta  cyan  white  dim
```

**亮色：**
```
brightRed  brightGreen  brightYellow  brightBlue  brightMagenta  brightCyan
```

**256 色（数字 0–255）：**
```json
"project": "208"   // 橙色
"gitBranch": "99"  // 紫色
"header": "214"    // 金色
```

---

## 常用配置预设

设置 `preset` 即可从命名外观开始，再添加想修改的键。文件中的键始终优先于预设：

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

Standard 即默认值。Compact 和 Minimal 隐藏会话名称、时长、代码变更、Credits、token 计数、速度、配额计数、超前/落后和工具行；Compact 还会把所有内容放在一行并缩短进度条。Full 增加文件计数、输入预览、最后一次调用、缓存读写、配额预警和预测，并从 `~` 开始显示路径。

在终端中运行以下命令可查看彩色效果：

```bash
node "$(find ~/.copilot/installed-plugins -name setup.mjs -path '*copilot-hud*' | head -1)" preview
```

加上 `--current` 可用同样的示例数据绘制你自己的配置，加上 `--width 100` 可查看该宽度下会隐藏哪些内容。

---

## jq 一行命令快速修改

不想打开编辑器？用 `jq` 直接在命令行改。这些命令只是为已经安装了 `jq` 的人提供的便利——HUD 本身已不再需要 `jq`，如果你没有安装，可以手动编辑 JSON，或使用 `/copilot-hud:configure`。

```bash
CONFIG="$HOME/.copilot/plugins/copilot-hud/config.json"

# 初始化（如果文件不存在）
mkdir -p "$(dirname "$CONFIG")" && [ -f "$CONFIG" ] || echo '{}' > "$CONFIG"

# 修改路径深度为 2
jq '.pathLevels = 2' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# 启用完整绝对路径
jq '.pathLevels = 0' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# 隐藏工具活动行
jq '.display.showTools = false' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# 开启 token 明细和输出速度
jq '.display.showTokenBreakdown = true | .display.showOutputSpeed = true' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# 显示/隐藏代码行数变化
jq '.display.showLinesChanged = true' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# 开启缓存读/写分别显示
jq '.display.showCacheBreakdown = true' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# 开启最近一次调用 token
jq '.display.showLastCall = true' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# 关闭 git ahead/behind
jq '.gitStatus.showAheadBehind = false' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# 改颜色
jq '.colors.project = "208"' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# 启用彩虹路径（默认关闭）
jq '.display.rainbowPath = true' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# 保留彩虹但去掉薰衣草背景
jq '.colors.rainbowPathBg = "none"' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# 隐藏代理追踪
jq '.display.showAgents = false' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# 显示更多代理
jq '.display.maxAgents = 10' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# 重置为默认（删除配置文件）
rm "$CONFIG"
```

---

## 验证配置

用开发模式测试渲染效果，无需启动 Copilot 会话：

```bash
# 基础测试（读取你的配置文件）
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

`~/.copilot/copilot-hud.sh` 是 `/copilot-hud:setup` 安装的 wrapper，也就是 Copilot 实际执行的命令。

如果 HUD 输出与预期一致，配置正确。

---

## 注意事项

1. **部分配置即可生效** — 不需要写出全部字段。只写你想修改的，其余使用默认值（`deepMerge` 实现）。
2. **JSON 格式错误** — 如果 `config.json` 格式无效，HUD 会静默回退到默认配置，不会报错。
3. **立即生效** — 修改后不需要重启 Copilot，下一次状态栏刷新时自动读取新配置。
4. **颜色数字** — 256 色必须是 `0–255` 的整数（写成字符串 `"208"`，不是数字 `208`）。
5. **`COPILOT_HUD_DISABLE=1`** — 在启动 Copilot 的环境中设置该变量，可在该会话中隐藏 HUD，不受配置影响。
