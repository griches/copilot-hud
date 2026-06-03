# Copilot HUD: pre-tool-use hook (PowerShell)
# Called before Copilot uses any tool — marks tool as "running"

$ErrorActionPreference = 'Stop'

function Write-StateFile($obj, $path) {
  $json = $obj | ConvertTo-Json -Depth 20
  $tmp = "$path.tmp"
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($tmp, $json, $enc)
  Move-Item -LiteralPath $tmp -Destination $path -Force
}

$raw = [Console]::In.ReadToEnd()
try { $data = $raw | ConvertFrom-Json } catch { exit 0 }

$toolName = if ($data -and $data.toolName) { [string]$data.toolName } else { '' }
$toolArgs = if ($data) { $data.toolArgs } else { $null }
$ts       = if ($data -and $null -ne $data.timestamp) { $data.timestamp } else { 0 }

$copilotHome = if ($env:COPILOT_HOME) { $env:COPILOT_HOME } else { Join-Path $HOME '.copilot' }
$stateFile = Join-Path $copilotHome 'hud-state.json'
$lockDir = "$stateFile.lock"

if (-not (Test-Path -LiteralPath $stateFile)) { exit 0 }

# Skip internal tools
$internal = @('report_intent', 'task_complete', 'thinking', 'read_agent', 'list_agents', 'write_agent')
if ($internal -contains $toolName) { exit 0 }

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

  # Handle subagent spawns separately
  if ($toolName -eq 'task') {
    $desc    = if ($toolArgs -and $toolArgs.description) { [string]$toolArgs.description } else { '' }
    $subType = if ($toolArgs -and $toolArgs.agent_type) { [string]$toolArgs.agent_type } else { '' }

    if ($desc -ne '') {
      $entry = [pscustomobject]@{
        description  = $desc
        subagentType = if ($subType -ne '') { $subType } else { $null }
        status       = 'running'
        startTime    = $ts
      }
      $agents = @()
      if ($state.agents) { $agents = @($state.agents) }
      $agents += $entry
      $state.agents = $agents
      Write-StateFile $state $stateFile
    }
    exit 0
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

  $newEntry = [pscustomobject]@{
    name      = $toolName
    target    = if ($target -ne '') { $target } else { $null }
    status    = 'running'
    timestamp = $ts
  }

  # Prepend to recentTools, keep last 8
  $recent = @($newEntry)
  if ($state.recentTools) { $recent += @($state.recentTools) }
  if ($recent.Count -gt 8) { $recent = $recent[0..7] }
  $state.recentTools = $recent

  Write-StateFile $state $stateFile
}
finally {
  Remove-Item -Recurse -Force $lockDir -ErrorAction SilentlyContinue
}
