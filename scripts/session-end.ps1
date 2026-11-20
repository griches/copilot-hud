# Copilot HUD: session-end hook (PowerShell)
# Called when a Copilot CLI session ends
#
# A thin wrapper. The implementation is in hud-hook.mjs, shared with the bash
# hooks so the two platforms can't drift apart — see that file for the payload
# shapes, the state format, and the locking rules.
#
# NOTE: do not gate on [Console]::IsOutputRedirected here. Copilot forks hooks
# with piped stdio so it can capture their output, which means stdout is always
# redirected even in a fully interactive session — the test can never be false,
# and gating on it silently disables every hook. Cross-session bleed is prevented
# by giving each session its own state file, named by the payload's
# sessionId — see hud-hook.mjs.

# node also renders the statusline, so if it's missing there is no HUD to update.
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { exit 0 }

$payload = [Console]::In.ReadToEnd()

# Windows PowerShell encodes anything piped to a native command using
# $OutputEncoding, which defaults to ASCII — that would mangle any non-ASCII
# text in the payload (a prompt, a path) before node ever sees it.
$OutputEncoding = New-Object System.Text.UTF8Encoding($false)

try {
  $payload | & node (Join-Path $PSScriptRoot 'hud-hook.mjs') 'session-end'
} catch {
  # A hook must never take the session down with it.
}

exit 0
