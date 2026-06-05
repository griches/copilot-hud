# Copilot HUD: session-start hook (PowerShell)
# Called when a new Copilot CLI session begins

$ErrorActionPreference = 'Stop'

function Write-StateFile($obj, $path) {
  $json = $obj | ConvertTo-Json -Depth 20
  $tmp = "$path.tmp"
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($tmp, $json, $enc)
  Move-Item -LiteralPath $tmp -Destination $path -Force
}

$raw = [Console]::In.ReadToEnd()
try { $data = $raw | ConvertFrom-Json } catch { $data = $null }

$cwd = if ($data -and $data.cwd) { [string]$data.cwd } else { '' }
$ts  = if ($data -and $null -ne $data.timestamp) { $data.timestamp } else { 0 }
$sid = if ($data -and $data.sessionId) { [string]$data.sessionId } else { '' }

$copilotHome = if ($env:COPILOT_HOME) { $env:COPILOT_HOME } else { Join-Path $HOME '.copilot' }
$stateFile = Join-Path $copilotHome 'hud-state.json'

# Preserve agents if resuming the same session
$prevAgents = @()
if (Test-Path -LiteralPath $stateFile) {
  try {
    $prev = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
    if ($prev.sessionId -and $sid -and ($prev.sessionId -eq $sid) -and $prev.agents) {
      $prevAgents = @($prev.agents)
    }
  } catch {}
}

$state = [ordered]@{
  sessionId      = $sid
  sessionStart   = $ts
  cwd            = $cwd
  lastPrompt     = $null
  lastPromptTime = $null
  recentTools    = @()
  agents         = $prevAgents
  sessionActive  = $true
}

$dir = Split-Path -Parent $stateFile
if (-not (Test-Path -LiteralPath $dir)) {
  New-Item -ItemType Directory -Path $dir -Force | Out-Null
}

Write-StateFile $state $stateFile
