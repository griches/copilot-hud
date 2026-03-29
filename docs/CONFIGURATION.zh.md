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

## 字段说明

### `pathLevels` — 项目路径深度

**类型：** `1 | 2 | 3`　**默认：** `1`

控制第1行显示的目录层数：

| 值 | 效果 |
|----|------|
| `1` | `my-project` |
| `2` | `apps/my-project` |
| `3` | `dev/apps/my-project` |

---

### `gitStatus` — Git 信息

**控制第1行的 `git:(branch*)` 部分。**

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `enabled` | boolean | `true` | 是否显示 git 信息 |
| `showDirty` | boolean | `true` | 有未提交改动时显示 `*`，例如 `git:(main*)` |
| `showAheadBehind` | boolean | `true` | 显示本地超前/落后远程的提交数，例如 `git:(main ↑2 ↓1)` |

**示例组合：**

```
git:(main*)           # enabled=true, showDirty=true, showAheadBehind=false
git:(main* ↑2 ↓1)    # enabled=true, showDirty=true, showAheadBehind=true
git:(main)            # enabled=true, showDirty=false, showAheadBehind=false
（不显示）             # enabled=false
```

---

### `display` — 显示控制

**控制 HUD 三行内容的可见性。**

#### 第1行（项目信息行）

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `showSessionName` | boolean | `true` | 显示会话名称，例如 `│ Creating README` |
| `showSessionDuration` | boolean | `true` | 显示会话时长，例如 `│ ⏱ 5m` |

#### 第2行（上下文行）

上下文进度条和请求数始终显示。以下为可选项：

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `showTokenBreakdown` | boolean | `false` | 显示 token 明细，例如 `│ (in: 24.1k, cache: 15.0k)` |
| `showOutputSpeed` | boolean | `false` | 显示输出速度，例如 `│ out: 42.1 tok/s` |

#### 第3行（工具活动行）

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `showTools` | boolean | `true` | 是否显示工具活动行。设为 `false` 隐藏整行 |
| `showPromptPreview` | boolean | `false` | 是否显示最近一次用户输入的预览 |

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

### `colors` — 颜色配置

控制 HUD 各部分的颜色。

| 字段 | 默认 | 作用位置 |
|------|------|----------|
| `header` | `"cyan"` | 第1行模型名称，例如 `[Sonnet 4.6]` |
| `project` | `"yellow"` | 第1行项目路径，例如 `my-project` |
| `git` | `"magenta"` | `git:(` 和 `)` 括号 |
| `gitBranch` | `"cyan"` | 分支名称，例如 `main*` |
| `tools` | `"green"` | 工具名称（运行时为 `yellow`，失败为 `red`，自动覆盖此值） |
| `success` | `"green"` | 成功状态图标 `✓` |
| `failure` | `"red"` | 失败状态图标 `✗` |
| `label` | `"dim"` | 分隔符 `│`、标签 `Context`、`Reqs` 等 |

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

### 极简模式

只保留最核心信息，减少视觉噪音：

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

输出效果：
```
[Sonnet 4.6] │ my-project │ git:(main*)
Context ████░░░░░░ 35% │ Reqs 3
```

---

### 标准模式（默认）

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

输出效果：
```
[Sonnet 4.6] │ my-project │ git:(main* ↑2) │ Creating README │ ⏱ 5m
Context ████░░░░░░ 35% │ Reqs 3
✓ ✎ Edit: auth.ts | ✓ ⌨ Bash: git status ×3
```

---

### 完整模式

显示所有可用信息：

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

输出效果：
```
[Sonnet 4.6] │ apps/my-project │ git:(main* ↑2 ↓1) │ Creating README │ ⏱ 5m
Context ████░░░░░░ 35% │ Reqs 3 │ (in: 24.1k, cache: 15.0k) │ out: 42.1 tok/s
✓ ✎ Edit: auth.ts | ✓ ⌨ Bash: git status ×3 | ◐ ◉ Read: index.ts
```

---

## jq 一行命令快速修改

不想打开编辑器？用 `jq` 直接在命令行改：

```bash
CONFIG="$HOME/.copilot/plugins/copilot-hud/config.json"

# 初始化（如果文件不存在）
mkdir -p "$(dirname "$CONFIG")" && [ -f "$CONFIG" ] || echo '{}' > "$CONFIG"

# 修改路径深度为 2
jq '.pathLevels = 2' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# 隐藏工具活动行
jq '.display.showTools = false' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# 开启 token 明细和输出速度
jq '.display.showTokenBreakdown = true | .display.showOutputSpeed = true' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# 关闭 git ahead/behind
jq '.gitStatus.showAheadBehind = false' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

# 改颜色
jq '.colors.project = "208"' "$CONFIG" > /tmp/hud.json && mv /tmp/hud.json "$CONFIG"

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

如果 HUD 输出与预期一致，配置正确。

---

## 注意事项

1. **部分配置即可生效** — 不需要写出全部字段。只写你想修改的，其余使用默认值（`deepMerge` 实现）。
2. **JSON 格式错误** — 如果 `config.json` 格式无效，HUD 会静默回退到默认配置，不会报错。
3. **立即生效** — 修改后不需要重启 Copilot，下一次状态栏刷新时自动读取新配置。
4. **颜色数字** — 256 色必须是 `0–255` 的整数（写成字符串 `"208"`，不是数字 `208`）。
