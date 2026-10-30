# Copilot HUD

在 Copilot 会话底部实时显示状态栏的 GitHub Copilot CLI 插件，包含项目路径、Git 分支、上下文用量和工具活动信息。

[English](README.md) | 中文

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

---

## 安装

### 前置条件

- [GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli) v1.0.12+，已安装并完成身份验证
- Node.js 18+

就这些。以前还需要 `jq` 来支持追踪工具与代理活动的 hook 脚本；这些 hook 现在改用纯 Node 实现，因此除 Node 之外无需再安装任何东西。

### 快速开始

1. 安装插件：
   ```bash
   copilot plugin marketplace add griches/copilot-hud
   copilot plugin install copilot-hud@copilot-hud
   ```

2. 启动 Copilot 并运行安装向导：
   ```bash
   copilot --experimental
   ```
   在会话内执行：
   ```
   /copilot-hud:setup
   ```

   安装向导会将 Copilot 的状态栏指向 HUD、安装配额进度条扩展并启用实验性功能。重启 Copilot 后 HUD 将显示在界面底部。

   安装向导可以放心重复运行，但通常无需这样做：它会安装一个小型启动器，每次状态栏运行时都会自动找到已安装的插件，因此更新、重装插件或将其迁移到另一个 marketplace 后依然可用。修改 Copilot 设置前会先备份；如果你已有其他状态栏，会先征求你的同意再替换。

3. （可选）自定义显示内容：
   ```
   /copilot-hud:configure
   ```
   可选择是否显示会话名称、时长、Token 明细、输出速度、工具活动和 Git 风格。

> **注意：** Copilot CLI v1.0.12 的 `statusLine` 功能需要 `--experimental` 标志。安装向导会将 `"experimental": true` 写入 Copilot 设置，之后无需再加该标志。

<details>
<summary><strong>安装向导改动了什么，以及如何手动安装</strong></summary>

安装向导会运行已安装插件中的 `node scripts/setup.mjs install`，并在 Copilot 主目录（`~/.copilot` 或 `$COPILOT_HOME`）下写入：

| 文件 | 说明 |
|------|------|
| `plugins/copilot-hud/statusline.mjs` | 启动器。查找已安装的 copilot-hud 并运行 |
| `copilot-hud.sh`（Windows 上为 `copilot-hud.cmd`） | Copilot 实际执行的 wrapper。固定使用运行安装向导时的 Node，找不到时回退到 `PATH` 中的 `node` |
| `extensions/copilot-hud/extension.mjs` | 配额进度条会话扩展（可用 `--no-extension` 跳过） |
| `settings.json` | 新增 `statusLine` 和 `"experimental": true`，其余键保持不变。修改前会备份为 `settings.json.bak.<时间戳>` |

在用户设置尚未迁移到 `settings.json` 的旧版 Copilot CLI 上，这些键会写入 `config.json`；安装向导会自动判断你的 CLI 读取哪个文件。

`node scripts/setup.mjs inspect` 只输出将要执行的操作，不做任何改动。

</details>

### 空闲时刷新

Copilot 只在会话中有事件发生时才重新运行状态栏，因此等待期间提示计时和代理运行时长不会走动。在 Copilot CLI v1.0.76+ 上，可以在 `~/.copilot/settings.json` 的 `statusLine` 中加入 `refreshInterval`（秒）让它们持续更新：

```json
"statusLine": { "type": "command", "command": "~/.copilot/copilot-hud.sh", "refreshInterval": 5 }
```

安装向导会保留你在这里添加的 `refreshInterval` 和 `padding`。

### 临时关闭

```bash
COPILOT_HUD_DISABLE=1 copilot
```

除 `0`、`false`、`off`、`no` 以外的任意值都会在该会话中隐藏 HUD，且不改动你的设置。

### 从源码安装

先将本地仓库注册为 marketplace，再从中安装：

```bash
git clone https://github.com/griches/copilot-hud.git
cd copilot-hud
npm install
npm run build
copilot plugin marketplace add ./
copilot plugin install copilot-hud@copilot-hud
```

marketplace 只需注册一次。之后每次重新构建，重新执行 `copilot plugin install copilot-hud@copilot-hud` 即可应用改动；`copilot plugin update` 不会生效，因为它按版本号比较，而本地版本号并未变化。

> **如果你之前已从 GitHub marketplace 安装**：两种来源注册的名称相同（都是 `copilot-hud`），因此 `marketplace add ./` 会因 `already registered` 失败，随后的安装会静默使用已发布版本，而不是你的本地代码。请先切换来源——该命令同时会卸载来自 marketplace 的副本，但不会影响你的 `config.json`：
>
> ```bash
> copilot plugin marketplace remove copilot-hud --force
> ```

### 已经使用直接安装？

Copilot CLI 正在废弃直接安装（仓库、URL 和本地路径）。`copilot plugin install griches/copilot-hud` 和 `copilot plugin install ./` 目前仍然可用，但会触发废弃警告，并将在未来版本中停止支持。可用 `copilot plugin list` 检查：直接安装显示为 `copilot-hud`，marketplace 安装显示为 `copilot-hud@copilot-hud`。

迁移方式：

```bash
copilot plugin uninstall copilot-hud
copilot plugin marketplace add griches/copilot-hud
copilot plugin install copilot-hud@copilot-hud
```

如果该 marketplace 已经注册过，中间那条命令会提示 `already registered`，这属于正常情况，继续执行安装即可。

HUD 的配置保存在 `~/.copilot/plugins/copilot-hud/config.json`，迁移过程不会影响该文件。

---

## 功能

### 模型与项目信息

一目了然地显示当前模型、项目路径和 Git 分支。模型徽标从 display_name 解析 effort 级别和倍率。路径深度可通过 pathLevels 配置（0-3；`0` 为完整绝对路径）。代码增删行以绿/红色着色显示。

```
[Opus 4.6 3x·high] │ /Users/sky/Github/my-project │ git:(main* ↑2) │ ⏱ 5m │ +42/-3
```

### 上下文窗口与 Credits

实时进度条显示上下文用量。直接使用 API 提供的 used_percentage。显示精确的已用/总量 token 数。Token 明细（in/out/cache）合并在同一分段。默认全部开启。颜色随用量变化——充足时绿色，紧张时黄色，不足时红色。

```
Ctx ████░░░░░░ 70.0k/200.0k 35% │ Quota ██████░░░░ 4785/7500 64% · 19d │ Credits 1.42 │ in:1.5M out:12.2k cache:1.4M │ 42 tok/s
```

- **Ctx** — 上下文进度条，精确显示 `已用/总量 百分比`
- **Quota**（可选）— 月度配额进度条：已用请求数、已消耗百分比，以及距离配额重置的天数。需要安装[会话扩展](#配额进度条)。超过 75% 变为品红色，超过 90% 变为红色；配额耗尽后会追加 `+N over`。
- **Credits** — 本次会话消耗的 AI Units（AIU），对应 Copilot 新的按量计费（1 AIU = $0.01 USD）。在老版本 CLI 上会回退为传统的 premium request 计数（`Reqs`）。
- **in/out/cache** — 累计输入、输出和缓存 token
- **tok/s** — 输出生成速度
- **last call**（可选）— 最近一次 API 调用的 token 消耗
- **Cache R/W**（可选）— 缓存读/写分开统计

### 配额进度条

配额进度条显示你本月已消耗的额度：

```
Quota ██████░░░░ 4785/7500 64% · 19d
```

它需要一个小型会话扩展，因为配额数据本身无法抵达状态栏。Copilot 传给状态栏的
JSON 载荷中不包含任何配额字段，磁盘上的事件日志同样没有——携带配额的
`assistant.usage` 事件被标记为 `ephemeral: true`，因此永远不会被持久化。唯一
的获取方式就是接入正在运行的会话。

`/copilot-hud:setup` 会自动为你安装该扩展。如需手动安装，请将本仓库中的
`extension/extension.mjs` 复制到 `~/.copilot/extensions/copilot-hud/extension.mjs`。
扩展默认即会加载，无需额外配置。

> **进度条不会立刻出现。** 执行 `/copilot-hud:setup`（或 `/copilot-hud:configure`）
> 之后，你还需要：
>
> 1. **重启 Copilot** —— 扩展只在启动时被发现并加载，因此刚安装的扩展并未在当前
>    会话中运行。
> 2. **发送一次提问并等待回复** —— 配额随 `assistant.usage` 事件到达，而该事件只在
>    一次模型调用完成时才会触发。
>
> 在这两步完成之前没有任何配额数据可供绘制，HUD 会照常渲染但不显示进度条。这是
> 预期行为，并非安装失败。如果之后进度条仍未出现，请检查
> `~/.copilot/hud-quota.json` 是否存在；若该文件缺失，说明扩展没有运行——在
> Copilot 中执行 `/extensions` 可以查看各扩展的状态。

首次回复之后，进度条会自动保持最新。数值在每次模型调用时刷新，因此额度变化
（例如组织上调了你的月度配额）会在下一次提问时生效。无限额度的配额桶（通常是
`chat` 和 `completions`）会被跳过，而不是渲染成一条永远空着的进度条。

由于数据只存在于运行中的会话里，还有一个副作用：新会话刚开始时，进度条会短暂
显示上一个会话的数值，直到本次会话的首个回复将其更新。

未安装扩展时，HUD 的渲染结果与之前完全一致，只是没有配额进度条。可通过
`/copilot-hud:configure` 或 `display.showQuota*` 配置项进行调整。

**用量节奏。** 单看百分比无法判断是否有问题——第 20 天用到 40% 很从容，第 5 天
用到 40% 就值得注意。开启 `display.showQuotaPace` 后，进度条会按当前用量推算到
重置日，并用 `▲` 标记：预计月末达到 90% 及以上时为琥珀色，预计提前耗尽时为红色。

```
Quota ████░░░░░░ 3000/7500 40% ▲ · 25d
```

用量低于 10% 时不会标记。

已安装的扩展文件是一份副本（Copilot 只从自己的扩展目录加载扩展）。每次会话启动时
会将它与插件中的版本比较，插件更新后自动替换；新副本在下次启动 Copilot 时生效。

### 代码变更

显示本次会话累计的新增和删除行数，以绿/红色着色。

```
+42/-3
```

### Effort 级别与倍率

模型徽标显示从 display_name 解析出的 effort 级别和请求倍率。`claude-opus-4.6 (3x) (high)` 显示为 `[Opus 4.6 3x·high]`。

### 会话信息

可选在项目行显示会话名称和时长：

```
[Opus 4.6 3x·high] │ /Users/sky/Github/my-project │ git:(main* ↑2) │ Creating README │ ⏱ 5m │ +42/-3
```

### 输入预览

显示当前正在处理的输入，以及自提交以来经过的时间：

```
❯ fix the auth redirect loop when the session token expires mid-request (42s)
```

在一轮对话进行中，这个时间表示 Copilot 已经工作了多久；对话结束后，则表示会话空闲了多久。通过 `display.showPromptPreview` 启用（默认 `false`）。多行输入会合并为一行；当时间戳缺失或超过一天时会省略时长——过期的状态文件不应显示出无意义的计时。

### 窄终端适配

每一行都会按终端宽度裁剪，而不是换行。终端越窄，越不重要的片段越先被丢弃——先是会话名称，然后是代码增删行数，再然后是时长——而模型徽标和上下文进度条始终保留：

```
120 列  [opus-4.6 3x·high] │ ◉ remote │ my-project │ git:(main*) │ Fixing auth │ ⏱ 5m │ +42/-3
 70 列  [opus-4.6 3x·high] │ ◉ remote │ my-project │ git:(main*) │ ⏱ 5m │ +42/-3
 40 列  [opus-4.6 3x·high] │ ◉ remote
```

仍然过宽的内容会以 `…` 截断，而不是换行。宽度直接向终端本身查询——状态行运行时输出是管道，因此 HUD 会直接询问控制终端。如果确实无法确定宽度，则不做任何截断，行为与以前一致。

通过 `display.fitWidth: false` 关闭，或用 `display.maxWidth` 指定固定宽度（在分屏窗格中，或宽度检测失败时很有用）。

### 实时工具活动

实时查看 Copilot 正在做什么。当 Copilot 读取文件、执行命令或编辑代码时，工具行会同步更新。完成的工具显示对勾，运行中显示转圈图标，失败显示叉号。

```
✓ ✎ Edit: auth.ts | ✓ ⌨ Bash: git status ×3 | ◐ ◉ Read: index.ts
```

只显示真实工具调用——`report_intent` 等内部工具会被过滤。Shell 命令显示实际执行内容（Copilot 添加的 `cd /path &&` 前缀会被去掉）。

### 后台代理追踪

当 Copilot 派发子代理时，会在工具行下方显示每个代理的类型、描述、状态和时长。

```
◐ [explore] Analyze test coverage (45s…)
✓ [explore] Search auth module (18s)
✗ [general-purpose] Parse config schema (1m 12s)
✓ [task] Check git status (3s)
```

- `◐` — 运行中（黄色），带已用时间和 `…` 后缀
- `✓` — 完成（绿色），带最终时长
- `✗` — 失败（红色），带最终时长
- `[type]` — 代理类型（explore、task、general-purpose 等）

显示的代理数量可通过 `display.maxAgents` 配置（默认 5）。已完成的代理会在 `display.completedAgentFadeSec` 秒后自动隐藏（默认 30；设为 `0` 保留旧行为，永不自动隐藏）。

---

## 工作原理

```
Copilot CLI 会话
  │
  ├─ statusLine（实验性）──→ copilot-hud.sh ──→ statusline.mjs
  │    通过 stdin 传入会话 JSON         （查找已安装的插件）
  │    （model、context_window、cost）  ▼
  │                               node dist/index.js
  │                                     │
  ├─ hooks ──→ hud-state.json           │ 读取 state + git
  │  （会话和工具事件）                  │
  │                                     ▼
  └──────────────────────────── 渲染彩色状态栏
```

- **statusLine** 通过 stdin 接收会话数据（model、context window、cost、`ai_used` —— credits 优先读顶层 `ai_used.formatted`，原始值在 `ai_used.total_nano_aiu`；老版本回退到 `cost.total_premium_requests`）
- **Hooks** 在 `sessionStart`、`userPromptSubmitted`、`preToolUse`、`postToolUse`、`sessionEnd` 时触发，写入 `~/.copilot/hud-state.json`。`.sh` 与 `.ps1` hook 都只是薄封装，实际实现是共享的 Node 脚本 `scripts/hud-hook.mjs`，因此两个平台行为完全一致
- HUD 脚本合并两个数据源，渲染带颜色的输出

---

## 配置

> **完整配置参考：** 查看 [docs/CONFIGURATION.zh.md](docs/CONFIGURATION.zh.md) 获取包含所有选项、颜色名、预设方案和 `jq` 命令的完整手动配置指南。

编辑 `~/.copilot/plugins/copilot-hud/config.json`：

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

也可以在 Copilot 会话内运行 `/copilot-hud:configure` 进行引导式配置。

### 配置项

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `preset` | 无 | 从命名外观开始：`compact`、`minimal`、`standard` 或 `full`。文件中的键仍然优先 |
| `pathLevels` | `1` | `0` = 完整绝对路径, `1` = 项目名, `2-3` = 包含父目录 |
| `gitStatus.enabled` | `true` | 是否显示 Git 分支 |
| `gitStatus.showDirty` | `true` | 有未提交改动时显示 `*` |
| `gitStatus.showAheadBehind` | `true` | 显示 `↑N ↓N` 超前/落后提交数 |
| `gitStatus.showFileStats` | `false` | 显示变更文件计数：`!3 +1 ✘2 ?4` 分别表示已修改、新增、删除、未跟踪 |
| `gitStatus.showPrefix` | `true` | 用 `git:(…)` 包裹分支名 |
| `gitStatus.maxBranchLength` | `0` | 用 `…` 截断过长的分支名。`0` 不截断 |
| `display.showTools` | `true` | 是否显示工具活动行 |
| `display.showToolIcons` | `true` | 显示工具类型图标 |
| `display.showToolTargets` | `true` | 显示工具操作的对象。屏幕共享时可关闭 |
| `display.maxTools` | `0` | 工具行最多显示的工具数。`0` 显示全部 |
| `display.showAgents` | `true` | 是否显示后台代理追踪 |
| `display.maxAgents` | `5` | 显示代理的最大数量 |
| `display.completedAgentFadeSec` | `30` | 已完成的子代理在结束多少秒后从 HUD 中隐藏（`0` = 永不自动隐藏，保留旧行为） |
| `display.showProjectName` | `true` | 是否显示项目名称/路径段 |
| `display.showSessionName` | `true` | 是否显示会话名称 |
| `display.showSessionDuration` | `true` | 是否显示 `⏱ 5m` 会话时长 |
| `display.showTokenBreakdown` | `true` | 显示 `in:1.5M out:12.2k cache:1.4M` |
| `display.showOutputSpeed` | `true` | 显示 `42 tok/s` |
| `display.showLinesChanged` | `true` | 显示 `+42/-3` 代码增删行数 |
| `display.showEffort` | `true` | 在模型徽标中显示 effort 级别 |
| `display.showMultiplier` | 跟随 `showEffort` | 在模型徽标中显示请求倍率 |
| `display.showCredits` | `true` | 显示本次会话使用的 Credits |
| `display.showContextCounts` | `true` | 在上下文百分比旁显示 `70.0k/200.0k` |
| `display.showLastCall` | `false` | 显示最后一次 API 调用的 token 消耗 |
| `display.showCacheBreakdown` | `false` | 分别显示缓存读/写计数 |
| `display.showPromptPreview` | `false` | 显示最近用户输入及其提交至今的时长 |
| `display.showQuota` | `true` | 显示月度配额进度条（需要会话扩展） |
| `display.showQuotaCounts` | `true` | 在配额百分比旁显示 `4785/7500` 计数 |
| `display.showQuotaReset` | `true` | 显示距离配额重置的剩余天数 |
| `display.showQuotaPace` | `false` | 当用量预计会在重置前耗尽时，用 `▲` 标记配额进度条（先琥珀色，后红色） |
| `display.showQuotaProjection` | `false` | 显示重置日的预计用量：`40% →207%` |
| `display.quotaBucket` | `""` | 要显示的配额 id。留空时选择用量最高的配额 |
| `display.rainbowPath` | `false` | 项目路径逐字符彩虹渐变（`false` 时回退到 `colors.project` 纯色） |
| `display.abbreviateHome` | `false` | `pathLevels: 0` 时将主目录写作 `~` |
| `display.layout` | 两行 | 决定显示哪些片段、在哪一行、以什么顺序。见[完整参考](docs/CONFIGURATION.zh.md) |
| `display.barStyle` | `"block"` | `block`、`shade`、`dots`、`line` 或 `ascii` |
| `display.barWidth` | `10` | 上下文和配额进度条的列宽 |
| `display.separator` | `"│"` | 片段之间的分隔符 |
| `display.fitWidth` | `true` | 将每一行裁剪到终端宽度，丢弃低优先级片段而不是换行 |
| `display.maxWidth` | `0` | `fitWidth` 使用的列宽预算。`0` 表示自动检测，正数表示固定宽度 |
| `colors.rainbowPathBg` | `"189"` | 彩虹路径背景色。`"none"` 禁用背景；否则为 256 色索引或命名颜色 |
| `thresholds.*` | 见参考 | 上下文、配额和预警颜色变化的位置 |

### 颜色

颜色可指定为：
- 命名颜色：`red`、`green`、`yellow`、`blue`、`magenta`、`cyan`、`dim`
- 256 色索引（字符串）：`"208"`（橙色）、`"99"`（紫色）

---

## 卸载

```bash
# 1. 卸载插件
copilot plugin uninstall copilot-hud

# 2. 删除 wrapper 脚本和配额扩展
rm ~/.copilot/copilot-hud.sh
rm -rf ~/.copilot/extensions/copilot-hud

# 3. 从 ~/.copilot/settings.json 删除 statusLine 配置
#    如不再需要，删除 "statusLine" 和 "experimental" 键。
#    （安装向导在同目录留有备份：settings.json.bak.<时间戳>）

# 4. 删除启动器和插件配置（可选）
rm -rf ~/.copilot/plugins/copilot-hud
```

---

## 开发

```bash
# 构建
npm run build

# 用模拟数据测试
echo '{"cwd":"/Users/sky/Github/my-project","model":{"display_name":"claude-opus-4.6 (3x) (high)"},"context_window":{"context_window_size":200000,"used_tokens":70000,"used_percentage":35}}' | node dist/index.js
```

---

## 致谢

界面布局和配色参考 [jarrodwatts/claude-hud](https://github.com/jarrodwatts/claude-hud)。

---

## 许可证

MIT
