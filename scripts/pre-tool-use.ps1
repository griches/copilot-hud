# Copilot HUD: pre-tool-use hook (PowerShell)
# Called before Copilot uses any tool — marks tools as "running" and records
# sub-agent spawns.
#
# The preToolUse payload differs from postToolUse and is easy to get wrong:
#
#   preToolUse   {sessionId, cwd, toolCalls: [{id, name, args}]}
#   postToolUse  {sessionId, cwd, timestamp, toolName, toolArgs, toolResult}
#
# Three differences that matter: `toolCalls` is an array (one invocation can
# carry several calls — spawning three agents arrives as a single hook firing),
# each `args` is a JSON *string* rather than an object, and there is no
# `timestamp` field, so we stamp the time ourselves.

$ErrorActionPreference = 'Stop'

# Only run in an interactive terminal — skip headless/background runs (e.g. copilot -p)
if ([Console]::IsOutputRedirected) { exit 0 }

function Write-StateFile($obj, $path) {
  $json = $obj | ConvertTo-Json -Depth 20
  $tmp = "$path.tmp"
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($tmp, $json, $enc)
  Move-Item -LiteralPath $tmp -Destination $path -Force
}

$raw = [Console]::In.ReadToEnd()
try { $data = $raw | ConvertFrom-Json } catch { exit 0 }

$calls = @()
if ($data -and $data.toolCalls) { $calls = @($data.toolCalls) }
if ($calls.Count -eq 0) { exit 0 }

# postToolUse supplies epoch-ms timestamps; match that so durations line up.
$ts = [long][Math]::Floor((Get-Date -UFormat %s)) * 1000

$copilotHome = if ($env:COPILOT_HOME) { $env:COPILOT_HOME } else { Join-Path $HOME '.copilot' }
$stateFile = Join-Path $copilotHome 'hud-state.json'
$lockDir = "$stateFile.lock"

if (-not (Test-Path -LiteralPath $stateFile)) { exit 0 }

$internal = @('report_intent', 'task_complete', 'thinking', 'read_agent', 'list_agents', 'write_agent')

# Acquire lock (creating a directory is atomic)
$retries = 0
while ($true) {
  try { New-Item -ItemType Directory -Path $lockDir -ErrorAction Stop | Out-Null; break }
  catch {
    Start-Sleep -Milliseconds 50
    $retries++
    if ($retries -ge 40) { Remove-Item -Recurse -Force $lockDir -ErrorAction SilentlyContinue; break }
  }
}

try {
  $state = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json

  $agents = @()
  if ($state.agents) { $agents = @($state.agents) }
  $recent = @()
  if ($state.recentTools) { $recent = @($state.recentTools) }

  # Fold every call in the batch into one state update, so a multi-agent spawn
  # doesn't need N read-modify-write cycles.
  foreach ($call in $calls) {
    $toolName = if ($call.name) { [string]$call.name } else { '' }
    if ($toolName -eq '') { continue }
    if ($internal -contains $toolName) { continue }

    # args arrives as a JSON string; tolerate anything unparseable.
    $toolArgs = $null
    if ($call.args) {
      try { $toolArgs = [string]$call.args | ConvertFrom-Json } catch { $toolArgs = $null }
    }

    if ($toolName -eq 'task') {
      # A sub-agent spawn. postToolUse deliberately ignores `task`, so this is
      # the only place a running agent is recorded.
      $desc    = if ($toolArgs -and $toolArgs.description) { [string]$toolArgs.description } else { '' }
      $subType = if ($toolArgs -and $toolArgs.agent_type) { [string]$toolArgs.agent_type } else { '' }

      if ($desc -ne '') {
        $agents += [pscustomobject]@{
          description  = $desc
          subagentType = if ($subType -ne '') { $subType } else { $null }
          status       = 'running'
          startTime    = $ts
        }
      }
      continue
    }

    # Extract a human-readable "target" from common tool args
    $target = ''
    if ($toolName -in @('edit', 'view', 'create')) {
      if ($toolArgs) {
        if ($toolArgs.path) { $target = [string]$toolArgs.path }
        elseif ($toolArgs.file_path) { $target = [string]$toolArgs.file_path }
      }
    }
    elseif ($toolName -eq 'bash') {
      if ($toolArgs -and $toolArgs.command) {
        # First line, strip "cd /path && " prefix, truncate to 60 chars
        $cmd = ([string]$toolArgs.command -split "`n")[0]
        $cmd = $cmd -replace '^cd \S+ && ', ''
        if ($cmd.Length -gt 60) { $cmd = $cmd.Substring(0, 60) }
        $target = $cmd
      }
    }

    # Prepend to recentTools, keep last 8
    $recent = @([pscustomobject]@{
      name      = $toolName
      target    = if ($target -ne '') { $target } else { $null }
      status    = 'running'
      timestamp = $ts
    }) + $recent
    if ($recent.Count -gt 8) { $recent = $recent[0..7] }
  }

  $state.agents = $agents
  $state.recentTools = $recent

  Write-StateFile $state $stateFile
}
finally {
  Remove-Item -Recurse -Force $lockDir -ErrorAction SilentlyContinue
}
