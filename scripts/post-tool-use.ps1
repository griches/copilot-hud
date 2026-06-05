# Copilot HUD: post-tool-use hook (PowerShell)
# Called after a tool completes — updates its status

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

$toolName   = if ($data -and $data.toolName) { [string]$data.toolName } else { '' }
$resultType = if ($data -and $data.toolResult -and $data.toolResult.resultType) { [string]$data.toolResult.resultType } else { 'success' }
$ts         = if ($data -and $null -ne $data.timestamp) { $data.timestamp } else { 0 }

$copilotHome = if ($env:COPILOT_HOME) { $env:COPILOT_HOME } else { Join-Path $HOME '.copilot' }
$stateFile = Join-Path $copilotHome 'hud-state.json'
$lockDir = "$stateFile.lock"

if (-not (Test-Path -LiteralPath $stateFile)) { exit 0 }

# Skip internal tools
$internal = @('report_intent', 'task_complete', 'thinking', 'list_agents', 'write_agent')
if ($internal -contains $toolName) { exit 0 }

# task postToolUse means the agent was SPAWNED, not completed — skip
if ($toolName -eq 'task') { exit 0 }

# Map result type to our status values
switch ($resultType) {
  'success' { $status = 'success' }
  'failure' { $status = 'failure' }
  'denied'  { $status = 'denied' }
  default   { $status = 'success' }
}

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

  # read_agent postToolUse means an agent has completed — mark oldest running agent as done
  if ($toolName -eq 'read_agent') {
    $agents = @()
    if ($state.agents) { $agents = @($state.agents) }
    for ($i = 0; $i -lt $agents.Count; $i++) {
      if ($agents[$i].status -eq 'running') {
        $agents[$i].status = $status
        $agents[$i] | Add-Member -NotePropertyName endTime -NotePropertyValue $ts -Force
        break
      }
    }
    $state.agents = $agents
    Write-StateFile $state $stateFile
    exit 0
  }

  # Update the most recent "running" entry matching this tool name
  $recent = @()
  if ($state.recentTools) { $recent = @($state.recentTools) }

  $found = $false
  foreach ($e in $recent) {
    if (-not $found -and $e.status -eq 'running' -and $e.name -eq $toolName) {
      $e.status = $status
      $e | Add-Member -NotePropertyName timestamp -NotePropertyValue $ts -Force
      $found = $true
    }
  }

  if ($found) {
    $state.recentTools = $recent
  }
  else {
    # No running entry — add completed entry
    $newEntry = [pscustomobject]@{
      name      = $toolName
      status    = $status
      timestamp = $ts
    }
    $recent = @($newEntry) + $recent
    if ($recent.Count -gt 8) { $recent = $recent[0..7] }
    $state.recentTools = $recent
  }

  Write-StateFile $state $stateFile
}
finally {
  Remove-Item -Recurse -Force $lockDir -ErrorAction SilentlyContinue
}
