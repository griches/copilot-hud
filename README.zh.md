# Copilot HUD

在 Copilot 会话底部实时显示状态栏的 GitHub Copilot CLI 插件，包含项目路径、Git 分支、上下文用量和工具活动信息。

[English](README.md) | 中文

```
  /Users/sky/Github/my-project [↙ main]                 Claude Opus 4.6 (3x) (high)
──────────────────────────────────────────────────────────────────────────────────────
  [Opus 4.6 3x·high] │ /Users/sky/Github/my-project │ git:(main* ↑2) │ Creating README │ ⏱ 5m │ +42/-3
  Ctx ████░░░░░░ 70.0k/200.0k 35% │ Reqs 3 │ in:1.5M out:12.2k cache:1.4M │ 42 tok/s
  ✓ ✎ Edit: auth.ts | ✓ ⌨ Bash: git status ×3 | ◐ ◉ Read: index.ts
```

---

## 安装

### 前置条件

- [GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli) v1.0.12+，已安装并完成身份验证
- Node.js 18+

### 快速开始

1. 安装插件：
   ```bash
   copilot plugin install griches/copilot-hud
   ```

2. 启动 Copilot 并运行安装向导：
   ```bash
   copilot --experimental
   ```
   在会话内执行：
   ```
   /copilot-hud:setup
   ```

   安装向导会自动创建 wrapper 脚本、配置状态栏并启用实验性功能。重启 Copilot 后 HUD 将显示在界面底部。

3. （可选）自定义显示内容：
   ```
   /copilot-hud:configure
   ```
   可选择是否显示会话名称、时长、Token 明细、输出速度、工具活动和 Git 风格。

> **注意：** Copilot CLI v1.0.12 的 `statusLine` 功能需要 `--experimental` 标志。安装向导会自动将该标志写入配置文件。

### 从源码安装

```bash
git clone https://github.com/griches/copilot-hud.git
cd copilot-hud
npm install
npm run build
copilot plugin install ./
```

---

## 功能

### 模型与项目信息

一目了然地显示当前模型、项目路径和 Git 分支。模型徽标现在从 display_name 解析 effort 级别和倍率。路径默认显示完整绝对路径（可通过 pathLevels 0-3 配置）。代码增删行以绿/红色着色显示。

```
[Opus 4.6 3x·high] │ /Users/sky/Github/my-project │ git:(main* ↑2) │ ⏱ 5m │ +42/-3
```

### 上下文窗口与请求数

实时进度条显示上下文用量。直接使用 API 提供的 used_percentage。显示精确的已用/总量 token 数。Token 明细（in/out/cache）合并在同一分段。默认全部开启。颜色随用量变化——充足时绿色，紧张时黄色，不足时红色。

```
Ctx ████░░░░░░ 70.0k/200.0k 35% │ Reqs 3 │ in:1.5M out:12.2k cache:1.4M │ 42 tok/s
```

- **Ctx** — 上下文进度条，精确显示 `已用/总量 百分比`
- **Reqs** — 本次会话消耗的高级 API 请求数
- **in/out/cache** — 累计输入、输出和缓存 token
- **tok/s** — 输出生成速度
- **last call**（可选）— 最近一次 API 调用的 token 消耗
- **Cache R/W**（可选）— 缓存读/写分开统计

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

### 实时工具活动

实时查看 Copilot 正在做什么。当 Copilot 读取文件、执行命令或编辑代码时，工具行会同步更新。完成的工具显示对勾，运行中显示转圈图标，失败显示叉号。

```
✓ ✎ Edit: auth.ts | ✓ ⌨ Bash: git status ×3 | ◐ ◉ Read: index.ts
```

只显示真实工具调用——`report_intent` 等内部工具会被过滤。Shell 命令显示实际执行内容（Copilot 添加的 `cd /path &&` 前缀会被去掉）。

---

## 工作原理

```
Copilot CLI 会话
  │
  ├─ statusLine（实验性）──→ copilot-hud.sh
  │    通过 stdin 传入会话 JSON         │
  │    （model、context_window、cost）  ▼
  │                               node dist/index.js
  │                                     │
  ├─ hooks ──→ hud-state.json           │ 读取 state + git
  │  （会话和工具事件）                  │
  │                                     ▼
  └──────────────────────────── 渲染彩色状态栏
```

- **statusLine** 通过 stdin 接收会话数据（model、context window、cost）
- **Hooks** 在 `sessionStart`、`userPromptSubmitted`、`preToolUse`、`postToolUse`、`sessionEnd` 时触发，写入 `~/.copilot/hud-state.json`
- HUD 脚本合并两个数据源，渲染带颜色的输出

---

## 配置

> **完整配置参考：** 查看 [docs/CONFIGURATION.zh.md](docs/CONFIGURATION.zh.md) 获取包含所有选项、颜色名、预设方案和 `jq` 命令的完整手动配置指南。

编辑 `~/.copilot/plugins/copilot-hud/config.json`：

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
    "showCacheBreakdown": false
  }
}
```

也可以在 Copilot 会话内运行 `/copilot-hud:configure` 进行引导式配置。

### 配置项

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `pathLevels` | `0` | `0` = 完整绝对路径, `1` = 项目名, `2-3` = 包含父目录 |
| `gitStatus.enabled` | `true` | 是否显示 Git 分支 |
| `gitStatus.showDirty` | `true` | 有未提交改动时显示 `*` |
| `gitStatus.showAheadBehind` | `true` | 显示 `↑N ↓N` 超前/落后提交数 |
| `display.showTools` | `true` | 是否显示工具活动行 |
| `display.showSessionName` | `true` | 是否显示会话名称 |
| `display.showSessionDuration` | `true` | 是否显示 `⏱ 5m` 会话时长 |
| `display.showTokenBreakdown` | `true` | 显示 `in:1.5M out:12.2k cache:1.4M` |
| `display.showOutputSpeed` | `true` | 显示 `42 tok/s` |
| `display.showLinesChanged` | `true` | 显示 `+42/-3` 代码增删行数 |
| `display.showEffort` | `true` | 在模型徽标中显示 effort 级别和倍率 |
| `display.showLastCall` | `false` | 显示最后一次 API 调用的 token 消耗 |
| `display.showCacheBreakdown` | `false` | 分别显示缓存读/写计数 |
| `display.showPromptPreview` | `false` | 显示最近用户输入预览 |

### 颜色

颜色可指定为：
- 命名颜色：`red`、`green`、`yellow`、`blue`、`magenta`、`cyan`、`dim`
- 256 色索引（字符串）：`"208"`（橙色）、`"99"`（紫色）

---

## 卸载

```bash
# 1. 卸载插件
copilot plugin uninstall copilot-hud

# 2. 删除 wrapper 脚本
rm ~/.copilot/copilot-hud.sh

# 3. 从 ~/.copilot/config.json 删除 statusLine 配置
#    如不再需要，删除 "statusLine" 和 "experimental" 键

# 4. 删除插件配置（可选）
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
