# fabrik oscuro

A wallet and payments service, built by a four-seat agent software factory.

Entry for [WeAreDevelopers x BAND — Dark Factory](https://lablab.ai/ai-hackathons/wearedevelopers-hackathon), **pocketful track**.

Everything under `stage-N/` was written by the band working in a BAND Desktop room, not
by hand. `room.json` is that room, downloaded unedited. The factory that produced it is
described in [FACTORY.md](FACTORY.md) and defined by the files in [`mandates/`](mandates/),
none of which mention wallets, payments or this track at all — that is the point of them.

## How to read this repository

| Path | What it is |
|---|---|
| [`FACTORY.md`](FACTORY.md) | The factory: the four seats, the routing between them, the design choices and what they cost |
| [`mandates/`](mandates/) | One standing-instruction file per seat, named after the seat. Generic by construction |
| `room.json` | The full BAND room download — every message and tool call the band produced |
| `stage-1/` … | One complete, buildable service per completed stage. Each has a `Dockerfile` and a `RUN.md` |
| [`HACKATHON.md`](HACKATHON.md) | Our working digest of the event rules |
| [`launch/`](launch/) | How the seats are brought up, and the brief template used to dispatch a stage |
| [`rehearsals/`](rehearsals/) | What each practice run cost, what broke, and what we changed because of it |

Each stage folder holds the solution to *that* stage: `stage-2/` is `stage-1/` carried
forward and widened to the stage 2 specification, and so on. A later answer filed in an
earlier folder claims nothing, which is why they are not all copies of the final one.

## The crew

| Seat | Harness | Model | The one job it owns |
|---|---|---|---|
| Architect | Claude Code | `claude-sonnet-5` | Plan, sequence, integrate, decide when a stage is complete |
| Builder | Codex | `gpt-6-luna` | Implement one scoped work item at a time |
| Verifier | OpenCode | `opencode/kimi-k3` | Independently check the work against the specification |
| Spec Auditor | OpenCode | `opencode/kimi-k3` | Prove every requirement is implemented, checked, and not exceeded |

The Verifier never runs the Builder's model; here it does not even run the same vendor's. Two instances of one model fail in
correlated ways, and a checker that fails the way the author fails is not a checker.
[FACTORY.md](FACTORY.md) states that as a constraint on the table rather than a
description of it.

## How the work moves

A stage is dispatched once, as a single task carrying the complete specification. From
that dispatch to the Architect's final report, nothing further arrives from outside the
band — no approvals, no hints, no reruns. Seats resolve every question among themselves
and record the assumption in the room.

```
dispatch -> Architect plans, splits into work items
         -> Builder implements one item, builds it, runs it, hands it to the Verifier
         -> Verifier derives checks from the spec, runs them
              fail -> reproducible report back to Builder -> fix -> re-run
              pass -> verdict with evidence to Architect
         -> Spec Auditor audits the stage against the spec: gaps and extras both
         -> Architect declares the stage complete only with both sign-offs
```

The Builder cannot reach the Spec Auditor or the person who dispatched the work. It
cannot ask for its own sign-off or route around the Verifier — not by policy, but
because there is no path. Take the room away and that guarantee does not weaken, it
stops existing.

## Running the factory

Prerequisites: a [BAND account](https://app.band.ai/), Band Desktop signed in, Claude
Code signed in, Python 3.12+, and a running Docker daemon.

```powershell
launch/launch-headless.ps1
```

Brings up the four seats and one shared room, adds every seat to it, and prints the
room's `chat_id`. Safe to re-run. Dispatch a stage with the shape in
[`launch/brief-template.md`](launch/brief-template.md), then leave it alone.

## Checking a stage

The harness lives in the kickoff checkout, not here. From that checkout:

```sh
python -m harness run --track pocketful --repo <path to this repo> --stage 1 \
  --out ../band-work/checks/s1-01
```

Read the last line: `claimed stage: 1` is what a correct `stage-1/` prints. The extra
`stage 2: fail` line above it is expected — a `stage-1/` that passed suite 2 would be a
stage 2 answer in the wrong folder.

Final checks run in isolated mode, because that is how they are graded — no outbound
network, 2 vCPU, 2 GiB:

```sh
python -m harness run --track pocketful --repo <path to this repo> --all --mode isolated
python -m harness check <path to this repo> --track pocketful
```

The shipped checks are partial — 79% of suite 1, 35% of suite 2, 9% of suite 3, 16% of
suite 4. A green run is not evidence of a stage. The specification is.

## Credit

The seat mandates, the factory description and the headless launch script come from
George Stoien's [dark-factory](https://github.com/gs-syk/dark-factory), shared across
two entries in different tracks. That the same mandates stand up an unrelated product is
the property they are meant to have, and the one the rubric weighs most heavily.
