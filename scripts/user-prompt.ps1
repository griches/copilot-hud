# Copilot HUD: user-prompt hook (PowerShell)
# Called when the user submits a prompt

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

$prompt = if ($data -and $data.prompt) { [string]$data.prompt } else { '' }
$ts     = if ($data -and $null -ne $data.timestamp) { $data.timestamp } else { 0 }

$copilotHome = if ($env:COPILOT_HOME) { $env:COPILOT_HOME } else { Join-Path $HOME '.copilot' }
$stateFile = Join-Path $copilotHome 'hud-state.json'
$lockDir = "$stateFile.lock"

if (-not (Test-Path -LiteralPath $stateFile)) { exit 0 }

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
  $state.lastPrompt = $prompt
  $state.lastPromptTime = $ts
  Write-StateFile $state $stateFile
}
finally {
  Remove-Item -Recurse -Force $lockDir -ErrorAction SilentlyContinue
}
