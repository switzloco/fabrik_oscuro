<#
.SYNOPSIS
  Bring up the four-seat factory as Jam-owned headless agents, in one shared Band chat.

.DESCRIPTION
  Idempotent: re-running skips seats and the room that already exist, tracked in
  launch/.factory-state.json (gitignored). Each seat rides the local Claude Code
  subscription login (--runtime-auth subscription) -- no ANTHROPIC_API_KEY needed.

  Derived from gs-syk/dark-factory's launch-headless.ps1, with three changes:

  1. Seat names are bare roles (architect, builder, verifier, spec-auditor) so each
     one matches its mandate filename. Gate 1 requires "a mandate file named after
     that seat"; a seat called factory-architect has no architect.md and the entry
     is not ranked.
  2. The Verifier runs a different model from the Builder, and the -RuntimeModel
     values here must stay identical to the Model: line in each mandate -- gate 1
     checks the mandate names the model the seat actually runs.
  3. --cwd is the workspace root rather than one repository, so the same seats serve
     the toy rehearsal and the graded run. A headless seat's cwd is fixed at
     creation; the dispatch names the absolute target path.

.PARAMETER Workspace
  Absolute path the seats work under. Must contain both the kickoff checkout and
  band-work/.

.PARAMETER NewRoom
  Create a fresh room even if one is recorded. The submitted run requires a fresh
  room and a fresh result repository.
#>

param(
    [string]$Workspace = "C:\dev\darkfactory",
    [switch]$NewRoom,
    [switch]$Practice
)

$ErrorActionPreference = "Stop"

$RepoRoot  = Split-Path -Parent $PSScriptRoot

if (-not (Test-Path $Workspace)) { throw "Workspace not found: $Workspace" }
$Workspace = (Resolve-Path $Workspace).Path

$Seats = @(
    @{ Name = "architect";    Session = "factory-architect";    Model = "claude-opus-5";    Mandate = "mandates/architect.md" }
    @{ Name = "builder";      Session = "factory-builder";      Model = "claude-opus-5";    Mandate = "mandates/builder.md" }
    @{ Name = "verifier";     Session = "factory-verifier";     Model = "claude-sonnet-5";  Mandate = "mandates/verifier.md" }
    @{ Name = "spec-auditor"; Session = "factory-spec-auditor"; Model = "claude-sonnet-5";  Mandate = "mandates/spec-auditor.md" }
)

# Practice seats run cheaper models under their own names and state file, so a
# rehearsal never touches the seats a submitted run uses. They are never graded, so
# their Model: lines are allowed to disagree with the mandates.
# A model named "opencode/<id>" runs on OpenCode instead of Claude Code.
$PracticeModels = @{
    "architect" = "claude-sonnet-5"; "builder" = "claude-opus-5"
    "verifier" = "claude-sonnet-5"; "spec-auditor" = "claude-sonnet-5"
}
# The OpenCode desktop app ships its own CLI; an older npm copy cannot read its data.
$OpenCodeCli = Join-Path $env:APPDATA "ai.opencode.desktop\cli\2.0.21\opencode-cli.exe"
if ($Practice) {
    foreach ($seat in $Seats) {
        $seat.Model   = $PracticeModels[$seat.Name]
        $seat.Session = "practice-$($seat.Name)"
        $seat.Name    = "practice-$($seat.Name)"
    }
    $StateFile = Join-Path $PSScriptRoot ".factory-state.practice.json"
} else {
    $StateFile = Join-Path $PSScriptRoot ".factory-state.json"
}
$Architect = $Seats[0].Name

function Invoke-Jam {
    param([string[]]$JamArgs)
    $output = & jam @JamArgs 2>&1
    [PSCustomObject]@{ ExitCode = $LASTEXITCODE; Output = ($output -join "`n") }
}

# --- check each mandate's Model: line matches what we are about to create ------

foreach ($seat in $Seats) {
    $path = Join-Path $RepoRoot $seat.Mandate
    if (-not (Test-Path $path)) { throw "Mandate missing: $path" }
    $declared = (Select-String -Path $path -Pattern '^Model:\s*(\S+)' | Select-Object -First 1).Matches.Groups[1].Value
    if ($declared -ne $seat.Model -and -not $Practice) {
        throw "$($seat.Mandate) declares Model: $declared but this script creates $($seat.Model). Gate 1 requires them to agree."
    }
}
if ($Practice) { Write-Host "Practice seats: mandate Model: lines not enforced." }
else { Write-Host "Mandates agree with the models this script creates." }

# --- load or init local state -------------------------------------------------

if (Test-Path $StateFile) {
    $State = Get-Content $StateFile -Raw | ConvertFrom-Json -AsHashtable
} else {
    $State = @{ room_chat_id = $null; seats = @{} }
}

function Save-State {
    ($State | ConvertTo-Json -Depth 5) | Set-Content -Path $StateFile -NoNewline
}

# --- resolve the account handle -----------------------------------------------

$whoami = & jam whoami 2>&1
if ($LASTEXITCODE -ne 0) { throw "jam whoami failed: $whoami`nRun 'jam init' first." }
if ($whoami -notmatch '@(\S+)') { throw "Could not parse a handle out of 'jam whoami': $whoami" }
$Owner = $Matches[1]
Write-Host "Band account: $Owner"
Write-Host "Seat working directory: $Workspace"

# --- create or reconcile each seat ---------------------------------------------

foreach ($seat in $Seats) {
    $handle = "$Owner/$($seat.Name)"

    if ($State.seats.ContainsKey($seat.Name) -and $State.seats[$seat.Name]) {
        Write-Host "Seat known: $handle (agent_id $($State.seats[$seat.Name])) - skipping create"
        continue
    }

    Write-Host "Creating seat: $handle ($($seat.Model)) ..."
    if ($seat.Model -like "opencode/*") {
        if (-not (Test-Path $OpenCodeCli)) { throw "OpenCode CLI not found: $OpenCodeCli" }
        $runtime = @("--transport", "opencode", "--runtime-auth", "inherit", "--spawn-command", $OpenCodeCli, "--spawn-arg", "acp")
    } else {
        $runtime = @("--transport", "claude-code-cli", "--runtime-auth", "subscription")
    }
    $result = Invoke-Jam (@(
        "agent", "create",
        "--session", $seat.Session,
        "--name", $seat.Name,
        "--runtime-model", $seat.Model,
        "--cwd", $Workspace,
        "--instructions-file", (Join-Path $RepoRoot $seat.Mandate),
        "--json"
    ) + $runtime)

    if ($result.ExitCode -eq 0) {
        $agentId = ($result.Output | ConvertFrom-Json).created.peer.agent_id
        $State.seats[$seat.Name] = $agentId
        Save-State
        Write-Host "  created, agent_id $agentId"
    } elseif ($result.Output -match "already exists") {
        Write-Warning "$handle already exists in Jam but is absent from $StateFile. Find its agent_id in Jam Desktop's Runtime tab and add it to the state file's ""seats"" map, or 'jam rm --as $handle' and re-run to recreate it cleanly."
        throw "Unreconciled existing seat: $handle"
    } else {
        throw "jam agent create failed for $handle`:`n$($result.Output)"
    }
}

# --- create or reuse the shared chat -------------------------------------------

$ArchitectHandle = "$Owner/$Architect"

if ($State.room_chat_id -and -not $NewRoom) {
    $ChatId = $State.room_chat_id
    Write-Host "Room known: $ChatId - skipping create (pass -NewRoom to start a fresh one)"
} else {
    Write-Host "Creating shared room as $ArchitectHandle ..."
    $result = Invoke-Jam @("chat", "new", "--as", $ArchitectHandle)
    if ($result.ExitCode -ne 0) { throw "jam chat new failed:`n$($result.Output)" }
    $ChatId = $result.Output.Trim()
    $State.room_chat_id = $ChatId
    Save-State
    Write-Host "  created room $ChatId"
}

# --- ensure everyone is a participant -------------------------------------------

$result = Invoke-Jam @("chat", "participants", $ChatId, "--as", $ArchitectHandle)
if ($result.ExitCode -ne 0) { throw "jam chat participants failed:`n$($result.Output)" }
$currentParticipants = $result.Output

# Compare whole handles, not substrings. The bare owner handle is a prefix of every
# seat handle, so a substring test always reports the human as already present, the
# human never gets added, and `jam room send` then 404s on the room.
$present = $currentParticipants -split "`r?`n" |
    ForEach-Object { ($_.Trim() -split '\s+')[0] } |
    Where-Object { $_ }

$wanted = @($Owner) + ($Seats | ForEach-Object { "$Owner/$($_.Name)" })
$toAdd = $wanted | Where-Object { $present -notcontains $_ }

if ($toAdd.Count -gt 0) {
    Write-Host "Adding participants: $($toAdd -join ', ')"
    $result = Invoke-Jam (@("chat", "add", $ChatId) + $toAdd + @("--as", $ArchitectHandle))
    # Band 0.4.12 can add every participant and still fail to decode its own reply.
    # The re-read below is the real check, so a failed add is only a warning here.
    if ($result.ExitCode -ne 0) { Write-Warning "jam chat add reported:`n$($result.Output)" }
} else {
    Write-Host "All participants already present."
}

# Re-read and confirm, rather than trusting the add. A missing human is the failure
# that shows up much later as an unexplained HTTP 404 from `jam room send`.
$result = Invoke-Jam @("chat", "participants", $ChatId, "--as", $ArchitectHandle)
if ($result.ExitCode -ne 0) { throw "jam chat participants failed:`n$($result.Output)" }
$present = $result.Output -split "`r?`n" |
    ForEach-Object { ($_.Trim() -split '\s+')[0] } |
    Where-Object { $_ }

$missing = $wanted | Where-Object { $present -notcontains $_ }
if ($missing) { throw "Not in the room after add: $($missing -join ', ')" }
Write-Host "Confirmed in the room: $($wanted -join ', ')"

# --- done ------------------------------------------------------------------------

Write-Host ""
Write-Host "Factory room ready: $ChatId"
Write-Host ""
Write-Host "Seat handles, for the roster in the dispatch:"
foreach ($seat in $Seats) { Write-Host "  $Owner/$($seat.Name)" }
Write-Host ""
Write-Host "Dispatch with:"
Write-Host "  jam room send $ChatId `"@$Architect <your brief>`" --mention $($State.seats[$Architect])"
Write-Host "Watch with:"
Write-Host "  jam room messages $ChatId"
