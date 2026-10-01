<#
.SYNOPSIS
  Restart any seat that stopped on a usage limit, once the limit has reset.

.DESCRIPTION
  A seat whose turn fails on the plan's usage limit is never woken again: nothing in
  the room mentions it, and the reset itself wakes nobody. Rehearsal 2 lost about 20
  hours this way. On Sep 30, `jam restart --as <seat>` after the reset brought a stalled
  Verifier back to its interrupted work within 25 seconds, with no message posted to the
  room. This script does exactly that and nothing else: it never posts to the room, so
  the run's only human input stays the dispatch.

  It polls the room's newest messages, finds `[error]` lines from a seat reporting a
  usage limit with its reset time, waits until a minute after that reset, and restarts
  the seat. Each error is handled once. Run it beside a run and stop it with Ctrl+C.

.PARAMETER ChatId
  The room to watch. Defaults to the room recorded in the state file.

.PARAMETER Practice
  Read the practice state file instead of the submitted run's.
#>

param(
    [string]$ChatId,
    [switch]$Practice,
    [int]$IntervalSeconds = 60
)

$ErrorActionPreference = "Stop"

$jam = Join-Path $env:LOCALAPPDATA "Programs\jam\bin\jam.exe"
if (-not (Test-Path $jam)) { $jam = "jam" }

$stateName = if ($Practice) { ".factory-state.practice.json" } else { ".factory-state.json" }
$stateFile = Join-Path $PSScriptRoot $stateName
if (-not $ChatId) {
    if (-not (Test-Path $stateFile)) { throw "No -ChatId given and no state file at $stateFile" }
    $ChatId = (Get-Content $stateFile -Raw | ConvertFrom-Json).room_chat_id
}

$whoami = & $jam whoami 2>&1
if ($whoami -notmatch '@(\S+)') { throw "Could not parse a handle out of 'jam whoami': $whoami" }
$owner = $Matches[1]

# "[error] practice-verifier (Agent): You've hit your session limit · resets 7:30pm (America/Los_Angeles)"
$limitLine = '^(?<at>\S+Z) \[error\] (?<seat>\S+) \(Agent\): .*limit.*resets (?<time>\d{1,2}(:\d{2})?\s*[ap]m)\s*\((?<tz>[^)]+)\)'

function Get-ResetUtc([datetime]$errorUtc, [string]$clock, [string]$ianaZone) {
    $zone = [TimeZoneInfo]::FindSystemTimeZoneById($ianaZone)
    $localError = [TimeZoneInfo]::ConvertTimeFromUtc($errorUtc, $zone)
    if ($clock -notmatch '^(?<h>\d{1,2})(:(?<m>\d{2}))?\s*(?<ampm>[ap]m)$') { throw "Unreadable reset time: $clock" }
    $hour = [int]$Matches.h % 12
    if ($Matches.ampm -eq 'pm') { $hour += 12 }
    $minute = if ($Matches.m) { [int]$Matches.m } else { 0 }
    $reset = $localError.Date.AddHours($hour).AddMinutes($minute)
    if ($reset -le $localError) { $reset = $reset.AddDays(1) }
    [TimeZoneInfo]::ConvertTimeToUtc([datetime]::SpecifyKind($reset, 'Unspecified'), $zone)
}

$handled = @{}
$pending = @{}   # seat -> @{ RestartAt; ErrorAt } (UTC)
Write-Host "Watching room $ChatId for usage-limit stalls (owner $owner). Ctrl+C to stop."

while ($true) {
    $lines = & $jam room messages $ChatId 2>$null
    foreach ($line in $lines) {
        if ($line -notmatch $limitLine) { continue }
        $key = "$($Matches.at) $($Matches.seat)"
        if ($handled.ContainsKey($key)) { continue }
        $handled[$key] = $true
        $errorUtc = [datetime]::Parse($Matches.at).ToUniversalTime()
        try {
            $resetUtc = Get-ResetUtc $errorUtc $Matches.time $Matches.tz
        } catch {
            $resetUtc = $errorUtc.AddHours(5)
            Write-Warning "Could not read the reset time in: $line. Assuming five hours."
        }
        $restartAt = $resetUtc.AddMinutes(1)
        $pending[$Matches.seat] = @{ RestartAt = $restartAt; ErrorAt = $Matches.at }
        Write-Host "$(Get-Date -AsUTC -Format s)Z  $($Matches.seat) hit a usage limit; restart scheduled for $($restartAt.ToString('s'))Z"
    }

    $now = (Get-Date).ToUniversalTime()
    foreach ($seat in @($pending.Keys)) {
        if ($now -lt $pending[$seat].RestartAt) { continue }
        # A restart interrupts any live turn, so skip a seat that has already moved on.
        $latest = $lines | Where-Object { $_ -match "^(\S+Z) \[\w+\] $([regex]::Escape($seat)) \(Agent\)" } |
            ForEach-Object { ($_ -split ' ')[0] } | Sort-Object | Select-Object -Last 1
        if ($latest -gt $pending[$seat].ErrorAt) {
            Write-Host "$(Get-Date -AsUTC -Format s)Z  $seat is active again; no restart"
            $pending.Remove($seat); continue
        }
        Write-Host "$(Get-Date -AsUTC -Format s)Z  restarting $owner/$seat"
        & $jam restart --as "$owner/$seat" 2>&1 | Select-Object -First 1 | Write-Host
        $pending.Remove($seat)
    }

    Start-Sleep -Seconds $IntervalSeconds
}
