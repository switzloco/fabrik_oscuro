# Dispatch: every stage from one message

The dispatch for a dark-factory run: one message to the Architect that carries the whole
sequence, then nothing until the Architect's final report. It follows the example prompt
in the participant guide, plus what the rehearsals taught (see [`../rehearsals/`](../rehearsals/)).

Use it on the toy track first, end to end, on the machine that will run the submitted
entry. Then use it, unchanged except for the track, for the submitted run.

## Before you send it

Everything here happens *before* the dispatch, because nothing may happen after it.

1. `band preflight` reports ready, and `docker version` answers.
2. The harness runs on this machine. On Windows it has to run inside WSL2. Decide the exact
   command and put it in `<HARNESS>` below, for example `python -m harness` or
   `wsl -e python3 -m harness`, and run `<HARNESS> check` once by hand to prove it.
3. Every seat takes one clean turn. Wake each seat once in a **scratch** room and read the
   reply: a seat that is not signed in, or whose permission mode is refused, fails here
   instead of in the run. Rehearsal 1 lost its first two turns to exactly this.
4. Every seat's account has quota for a whole run on its model, with a fallback arranged.
   Rehearsal 1 lost its Verifier to an empty account.
5. Create a **fresh** result repository and a **fresh** room. Add the four seats and
   yourself.
6. Replace every `<PLACEHOLDER>` below. In Band Desktop, pick each handle from the
   suggestion list so it becomes a real mention; a typed `@name` reaches nobody.

## The dispatch

```text
You are the Architect. Build all four stages of the <TRACK> track, in order, each in its
own complete folder, and take each one through the band before starting the next.

Your band — use these literal handles:
  Builder       @<OWNER>/builder
  Verifier      @<OWNER>/verifier
  Spec Auditor  @<OWNER>/spec-auditor

Workspace:          <WORKSPACE>
Result repository:  <WORKSPACE>/band-work/result
Specifications:     <WORKSPACE>/dark-factory-wearedevs/<TRACK>/spec/stage-1.md … stage-4.md
Stage N goes in:    <WORKSPACE>/band-work/result/stage-N/

Stages
- Read all four specifications before planning stage 1. Choose a design that the later
  stages can extend rather than replace, but build and expose only the current stage's
  behaviour in its folder.
- Stage 1 is built from its specification.
- Stage N+1 starts as a copy of the finished stage-N folder, then is extended to the
  stage N+1 specification. Earlier stages' requirements keep applying unless a later
  specification changes them.
- Each folder is a complete service on its own: source, a Dockerfile, and a RUN.md whose
  command builds and starts it with no manual steps. No .git directory, submodule or
  symlink inside a stage folder.
- A folder holds the answer to its own stage and no later one.

Every handoff gives the receiver the complete requirements it works to. The specification
files above are on disk in the shared workspace, so a handoff names the files and the
exact sections that apply (for stage N, its own specification and the earlier stages'
requirements that still apply) instead of pasting them. A seat cannot read this message
or any other, so everything else it needs (the task, acceptance criteria, recorded
assumptions) travels in the handoff itself.

Checking
- Docker is available. The Verifier builds each stage from a fresh clone and runs it
  from its RUN.md.
- The project ships an acceptance tool. The Verifier runs it from
  <WORKSPACE>/dark-factory-wearedevs:
    <HARNESS> run --track <TRACK> --repo <WORKSPACE>/band-work/result --stage N --mode isolated --out <WORKSPACE>/band-work/checks/sN-<unique>
  Each run needs a new --out directory. "claimed stage: N" is what a finished stage N
  shows. Its last suite is the next stage's and is expected to fail.
- The tool ships only part of each stage's checks. A pass on it is not evidence that a
  stage is done. Build to the specification, never to the tool's checks, and verify the
  requirements the tool does not exercise.
- The Builder never opens the tool's test files under
  <WORKSPACE>/dark-factory-wearedevs/<TRACK>/test. It learns about a failure only from the
  Verifier's report, which cites the specification passage the failure violates.

When a stage is done, post its committed revision in the room, then start the next.
After stage 4, or when the band cannot go further, post the final report: which stages
are complete, their revisions, and any blocker with its evidence.

This dispatch is your only input. Nobody will answer a question, approve a step or
confirm a choice. Resolve every question inside the band.
```

## After the final report

1. Download the room: in Band Desktop open the room's `⋮` menu → **Open in Band**, then
   in the console `⋮` → **Download → Download full session**. Save it unedited as
   `room.json` at the repository root. Read it for credentials before committing.
2. On a **fresh clone**: `<HARNESS> check`, then `<HARNESS> run --all --mode isolated`.
3. Record the clock and the spend (`band usage agents`) in a new file under `rehearsals/`.
