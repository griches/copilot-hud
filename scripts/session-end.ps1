# Copilot HUD: session-end hook (PowerShell)
# Called when a Copilot CLI session ends

$ErrorActionPreference = 'Stop'

# NOTE: do not gate on [Console]::IsOutputRedirected here. Copilot forks hooks
# with piped stdio so it can capture their output, which means stdout is always
# redirected even in a fully interactive session — the test can never be false,
# and gating on it silently disables every hook. Cross-session bleed is already
# prevented in render.ts, which only draws state whose sessionId matches the
# session currently being rendered.

function Write-StateFile($obj, $path) {
  $json = $obj | ConvertTo-Json -Depth 20
  $tmp = "$path.tmp"
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($tmp, $json, $enc)
  Move-Item -LiteralPath $tmp -Destination $path -Force
}

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
  $state.sessionActive = $false
  Write-StateFile $state $stateFile
}
finally {
  Remove-Item -Recurse -Force $lockDir -ErrorAction SilentlyContinue
}
