<#
.SYNOPSIS
  Bring up the four-seat factory as Jam-owned headless agents, in one shared Band chat.

.DESCRIPTION
  Idempotent: re-running skips seats and the room that already exist, tracked in
  launch/.factory-state.json (gitignored). Each seat rides the local Claude Code
  subscription login (--runtime-auth subscription) -- no ANTHROPIC_API_KEY needed.

  See launch/PLAN.md "Headless spike results" for how this recipe was derived.
#>

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$StateFile = Join-Path $PSScriptRoot ".factory-state.json"

$Seats = @(
    @{ Name = "factory-architect";    Session = "factory-architect-spike";    Model = "claude-opus-5";    Mandate = "mandates/architect.md" }
    @{ Name = "factory-builder";      Session = "factory-builder-spike";      Model = "claude-opus-5";    Mandate = "mandates/builder.md" }
    @{ Name = "factory-verifier";     Session = "factory-verifier-spike";     Model = "claude-opus-5";    Mandate = "mandates/verifier.md" }
    @{ Name = "factory-spec-auditor"; Session = "factory-spec-auditor-spike"; Model = "claude-sonnet-5";  Mandate = "mandates/spec-auditor.md" }
)

function Invoke-Jam {
    param([string[]]$JamArgs)
    $output = & jam @JamArgs 2>&1
    [PSCustomObject]@{ ExitCode = $LASTEXITCODE; Output = ($output -join "`n") }
}

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

# --- create or reconcile each seat ---------------------------------------------

foreach ($seat in $Seats) {
    $handle = "$Owner/$($seat.Name)"

    if ($State.seats.ContainsKey($seat.Name) -and $State.seats[$seat.Name]) {
        Write-Host "Seat known: $handle (agent_id $($State.seats[$seat.Name])) - skipping create"
        continue
    }

    Write-Host "Creating seat: $handle ($($seat.Model)) ..."
    $mandatePath = Join-Path $RepoRoot $seat.Mandate
    $result = Invoke-Jam @(
        "agent", "create",
        "--session", $seat.Session,
        "--transport", "claude-code-cli",
        "--name", $seat.Name,
        "--runtime-auth", "subscription",
        "--runtime-model", $seat.Model,
        "--cwd", $RepoRoot,
        "--instructions-file", $mandatePath,
        "--json"
    )

    if ($result.ExitCode -eq 0) {
        $agentId = ($result.Output | ConvertFrom-Json).created.peer.agent_id
        $State.seats[$seat.Name] = $agentId
        Save-State
        Write-Host "  created, agent_id $agentId"
    } elseif ($result.Output -match "already exists") {
        Write-Warning "$handle already exists locally but isn't in $StateFile. Find its agent_id (jam status --as $handle won't show it; check Jam Desktop's Runtime tab) and add it to the state file's ""seats"" map, or 'jam rm --as $handle' it and re-run this script to recreate it cleanly."
        throw "Unreconciled existing seat: $handle"
    } else {
        throw "jam agent create failed for $handle`:`n$($result.Output)"
    }
}

# --- create or reuse the shared chat -------------------------------------------

$ArchitectHandle = "$Owner/factory-architect"

if ($State.room_chat_id) {
    $ChatId = $State.room_chat_id
    Write-Host "Room known: $ChatId - skipping create"
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

$wanted = @($Owner) + ($Seats | ForEach-Object { "$Owner/$($_.Name)" })
$toAdd = $wanted | Where-Object { $currentParticipants -notmatch [regex]::Escape($_) }

if ($toAdd.Count -gt 0) {
    Write-Host "Adding participants: $($toAdd -join ', ')"
    $result = Invoke-Jam (@("chat", "add", $ChatId) + $toAdd + @("--as", $ArchitectHandle))
    if ($result.ExitCode -ne 0) { throw "jam chat add failed:`n$($result.Output)" }
} else {
    Write-Host "All participants already present."
}

# --- done ------------------------------------------------------------------------

Write-Host ""
Write-Host "Factory room ready: $ChatId"
Write-Host "Post the brief with:"
Write-Host "  jam room send $ChatId `"@Architect <your brief>`" --mention $($State.seats['factory-architect'])"
Write-Host "Watch it with:"
Write-Host "  jam room messages $ChatId"
