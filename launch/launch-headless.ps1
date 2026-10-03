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

  Each seat's harness and model are read from the Harness: and Model: lines of its
  mandate, so the mandate is the only place either is written down. The harness picks
  the transport: Claude Code, OpenCode (over ACP) or Codex (native app server).

  Token budget. Every tool call re-reads the seat's whole context, so cost is calls
  times context size. On Oct 2 a Builder with no context cap grew to 590k tokens and
  spent 110M in four hours, a third of its calls on private task bookkeeping. So:
  Claude Code seats compact at -CompactWindow (via the workspace's .claude/settings.json)
  and run without the task-list tools; OpenCode seats compact there through a lowered
  model context limit in the workspace's opencode.json; Codex seats compact natively.
  Band's own --runtime-compact-at is refused by the Claude Code and OpenCode runtimes.

.PARAMETER Reconfigure
  Re-apply mandates and runtime settings to seats that already exist, restarting each.
  Never pass it while a run is live on those seats.

.PARAMETER CompactWindow
  Context size, in tokens, at which a seat compacts its conversation.

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
    [switch]$Practice,
    [switch]$Reconfigure,
    [int]$CompactWindow = 150000
)

$ErrorActionPreference = "Stop"

$RepoRoot  = Split-Path -Parent $PSScriptRoot

if (-not (Test-Path $Workspace)) { throw "Workspace not found: $Workspace" }
$Workspace = (Resolve-Path $Workspace).Path

$Seats = @(
    @{ Name = "architect";    Session = "factory-architect";    Mandate = "mandates/architect.md" }
    @{ Name = "builder";      Session = "factory-builder";      Mandate = "mandates/builder.md" }
    @{ Name = "verifier";     Session = "factory-verifier";     Mandate = "mandates/verifier.md" }
    @{ Name = "spec-auditor"; Session = "factory-spec-auditor"; Mandate = "mandates/spec-auditor.md" }
)

function Read-MandateField([string]$Path, [string]$Field) {
    $m = Select-String -Path $Path -Pattern "^$($Field):\s*(.+?)\s*$" | Select-Object -First 1
    if (-not $m) { throw "$Path has no $($Field): line" }
    $m.Matches.Groups[1].Value
}
foreach ($seat in $Seats) {
    $path = Join-Path $RepoRoot $seat.Mandate
    if (-not (Test-Path $path)) { throw "Mandate missing: $path" }
    $seat.Harness = Read-MandateField $path "Harness"
    $seat.Model   = Read-MandateField $path "Model"
}

# Practice seats run under their own names and state file, so a rehearsal never touches
# the seats a submitted run uses. They are never graded, so a model listed here may
# disagree with the mandate; an empty map runs the mandates' own models.
$PracticeModels = @{}
# The OpenCode desktop app ships its own CLI; an older npm copy cannot read its data.
$OpenCodeCli = Join-Path $env:APPDATA "ai.opencode.desktop\cli\2.0.21\opencode-cli.exe"
if ($Practice) {
    foreach ($seat in $Seats) {
        if ($PracticeModels[$seat.Name]) { $seat.Model = $PracticeModels[$seat.Name] }
        $seat.Session = "practice-$($seat.Name)"
        $seat.Name    = "practice-$($seat.Name)"
    }
    $StateFile = Join-Path $PSScriptRoot ".factory-state.practice.json"
} else {
    $StateFile = Join-Path $PSScriptRoot ".factory-state.json"
}
$Architect = $Seats[0].Name

# A new room's participant list is briefly unstable ("participant cache changed
# repeatedly"), so read it with a few retries.
function Get-Participants([string]$Chat, [string]$As) {
    for ($try = 1; $try -le 5; $try++) {
        $r = Invoke-Jam @("chat", "participants", $Chat, "--as", $As)
        if ($r.ExitCode -eq 0) { return $r }
        Start-Sleep -Seconds (2 * $try)
    }
    throw "jam chat participants failed:`n$($r.Output)"
}

function Invoke-Jam {
    param([string[]]$JamArgs)
    $output = & jam @JamArgs 2>&1
    [PSCustomObject]@{ ExitCode = $LASTEXITCODE; Output = ($output -join "`n") }
}

# --- runtime arguments per harness ---------------------------------------------

# Private task lists cost a full context read per update and nobody else can see them.
$ClaudeDisallowed = @("TaskCreate", "TaskUpdate", "TaskList", "TaskGet", "TodoWrite", "mcp__jam_tasks")

function Get-RuntimeArgs($seat) {
    switch ($seat.Harness) {
        "Claude Code" {
            $a = @("--transport", "claude-code-cli", "--runtime-auth", "subscription",
                   "--claude-context-mode", "local_config")
            foreach ($t in $ClaudeDisallowed) { $a += @("--claude-disallowed-tool", $t) }
            return $a
        }
        "OpenCode" {
            if (-not (Test-Path $OpenCodeCli)) { throw "OpenCode CLI not found: $OpenCodeCli" }
            return @("--transport", "opencode", "--runtime-auth", "inherit",
                     "--spawn-command", $OpenCodeCli, "--spawn-arg", "acp")
        }
        "Codex" {
            if (-not (Get-Command codex -ErrorAction SilentlyContinue)) { throw "Codex CLI not on PATH. npm install -g @openai/codex, then codex login." }
            return @("--transport", "codex-app-server", "--codex-channel", "stdio",
                     "--runtime-auth", "inherit", "--runtime-compact-at", "$CompactWindow")
        }
        default { throw "$($seat.Mandate): unknown Harness: $($seat.Harness)" }
    }
}

if ($Practice) { Write-Host "Practice seats." }
foreach ($seat in $Seats) { Write-Host "  $($seat.Name): $($seat.Harness), $($seat.Model)" }

# Claude Code reads its compaction window from the settings of the directory it runs in.
$ClaudeDir = Join-Path $Workspace ".claude"
New-Item -ItemType Directory -Force $ClaudeDir | Out-Null
$SettingsFile = Join-Path $ClaudeDir "settings.json"
$settings = if (Test-Path $SettingsFile) { Get-Content $SettingsFile -Raw | ConvertFrom-Json -AsHashtable } else { @{} }
if (-not $settings.env) { $settings.env = @{} }
$settings.env["CLAUDE_CODE_AUTO_COMPACT_WINDOW"] = "$CompactWindow"
($settings | ConvertTo-Json -Depth 5) | Set-Content -Path $SettingsFile -Encoding utf8NoBOM
Write-Host "Claude Code seats compact at $CompactWindow tokens ($SettingsFile)."

# OpenCode compacts near its model's context limit, so lowering the limit in the
# workspace's opencode.json caps it. Band's own compaction budget is Codex-only.
$OpenCodeFile = Join-Path $Workspace "opencode.json"
$oc = if (Test-Path $OpenCodeFile) { Get-Content $OpenCodeFile -Raw | ConvertFrom-Json -AsHashtable } else { @{ '$schema' = "https://opencode.ai/config.json" } }
if (-not $oc.provider) { $oc.provider = @{} }
foreach ($seat in $Seats | Where-Object { $_.Harness -eq "OpenCode" }) {
    $provider, $modelId = $seat.Model -split '/', 2
    if (-not $oc.provider[$provider]) { $oc.provider[$provider] = @{} }
    if (-not $oc.provider[$provider].models) { $oc.provider[$provider].models = @{} }
    $oc.provider[$provider].models[$modelId] = @{ limit = @{ context = $CompactWindow; output = 32000 } }
}
($oc | ConvertTo-Json -Depth 8) | Set-Content -Path $OpenCodeFile -Encoding utf8NoBOM
Write-Host "OpenCode seats compact at $CompactWindow tokens ($OpenCodeFile)."

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

    $runtime = Get-RuntimeArgs $seat
    if ($State.seats.ContainsKey($seat.Name) -and $State.seats[$seat.Name]) {
        if (-not $Reconfigure) {
            Write-Host "Seat known: $handle (agent_id $($State.seats[$seat.Name])) - skipping (pass -Reconfigure to re-apply)"
            continue
        }
        Write-Host "Reconfiguring seat: $handle ($($seat.Harness), $($seat.Model)) ..."
        $r = Invoke-Jam @("agent", "instructions", "set", "--as", $handle, "--instructions-file", (Join-Path $RepoRoot $seat.Mandate))
        if ($r.ExitCode -ne 0) { throw "instructions set failed for $handle`:`n$($r.Output)" }
        $r = Invoke-Jam (@("runtime", "template", "set", "--as", $handle, "--runtime-model", $seat.Model, "--apply-and-restart") + $runtime)
        if ($r.ExitCode -ne 0) { throw "runtime template set failed for $handle`:`n$($r.Output)" }
        Write-Host "  re-applied and restarted"
        continue
    }

    Write-Host "Creating seat: $handle ($($seat.Harness), $($seat.Model)) ..."
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

$result = Get-Participants $ChatId $ArchitectHandle
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
$result = Get-Participants $ChatId $ArchitectHandle
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
