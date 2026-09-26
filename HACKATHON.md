# Event rules — working digest

**Authoritative source:** `docs/participant-guide.md` in
[band-ai/dark-factory-wearedevs](https://github.com/band-ai/dark-factory-wearedevs).
Where this file and that one disagree, that one is right. This is a digest of the parts
that change what we do, kept here so we do not re-read 880 lines to check one rule.

An earlier version of this file was written from the lablab event page before the
kickoff package existed. Two things it got wrong: the rubric is not "60 of 100 points"
for the factory, and there is no `harness export-room` command.

| | |
|---|---|
| Track | **pocketful** — wallet and payments |
| Close | Mon Oct 5, 23:59 PDT |
| Specs | All four released at kickoff. Nothing is gated. |
| Result repo | This one. The band commits `stage-N/` into it. |

## Four gates — fail one and the entry is not ranked

1. **Three or more distinct Band Desktop seat identities**, each with a mandate file
   named after the seat as the room shows it, each starting with its `Harness:` and
   `Model:` lines. *(We have four. Headers are in place.)*
2. **Two of our own seats exchanged `@handle` messages, with a reply in each direction**,
   visible in `room.json`.
3. **`stage-1/` builds and serves from a clean container** by following its `RUN.md`.
4. **Mandates are generic**, and the code is written to the spec rather than to the tests.

`python -m harness check <repo> --track pocketful` runs gates 1, 2 and the mandate half
of gate 4 offline. Gate 3 is `harness run --repo`.

## Rubric

| Criterion | Weight |
|---|---|
| **Factory** — generic, effective, reusable from `FACTORY.md` + `mandates/` alone | 50% |
| **App** — coherent, presentation-ready UI over maintainable code | 25% |
| **Agent Teamwork** — collaboration and autonomy, read from `room.json` and git history | 25% |

Not scored: chat volume, seat count, prompt length, manufactured conflict. A rejection
counts when it changed the work. Correct work accepted first time loses nothing.

## The three rules that decide most entries

- **Hand-built code does not count.** A stage counts only if the code came out of the
  room. Never commit anything under `stage-N/` ourselves.
- **Writing to the tests disqualifies.** Only part of each suite ships — pocketful gets
  **79%** of suite 1, **35%** of suite 2, **9%** of suite 3, **16%** of suite 4. Enforced
  after close. When a stage looks done, re-read the spec and ask what the shipped checks
  never asked for.
- **Mandates must be generic.** `harness/vocabulary.py` holds the exact 146 banned
  pocketful terms, and it is the same list the organizers audit against. Ours scan clean.

## Autonomy — what the submitted run must look like

Iterate on the factory as much as we like, steering freely, while developing. **The run
we submit is different:** a fresh room and a fresh result repository. For each stage the
dispatched task is the *only* human input. No clarifications, no approvals, no debugging
hints, no reruns. A "looks good, continue" is steering. Dispatching the same stage twice
is a rerun. Either costs the Autonomy half of 25%.

If the band cannot proceed, the Architect records the blocker and the evidence as the
outcome and stops. It does not ask.

## Stage folder rules

- Each folder is a complete, buildable service with a `Dockerfile` and a `RUN.md`.
- `stage-2/` is `stage-1/` carried forward and widened. Not a fresh start, not a copy of
  the final answer.
- Graded against **every suite up to its own number**, and it must pass **at least half
  of each**.
- A folder that also passes the **next** stage's whole suite claims nothing.
- **The chain is what scores.** A passing `stage-4/` above a failing `stage-2/` counts
  for nothing above stage 1. Fix the earlier folder first.
- Submit only completed folders. An empty `stage-3/` helps nothing and hurts nothing.
- **If a copied folder contains `.git`, delete it** — it commits as a link and arrives
  empty for a judge.
- No submodules, no symlinks. All services inside the single image.

## room.json

No harness command fetches it. In Band Desktop open the room → `⋮` → **Open in Band** →
in the console, `⋮` → **Download → Download full session** (not *filtered*). Save
unedited at the repo root as `room.json`. Download it at the end, after the work is done.

**Nothing redacts it.** It holds every tool call and its output. This repo is public —
read it before committing. If a credential is in there, rotate it and replace the value
with `[REDACTED]`.

## Environment

Python 3.12+, Git, running Docker daemon, Playwright chromium. **On Windows, run the
harness inside WSL2.** The service itself may be any language — judges build the
`Dockerfile` and talk to the container over HTTP only.

Isolated mode is how grading runs: no outbound network, 2 vCPU, 2 GiB. Host mode is the
default and does *not* block outbound network, so a service that quietly reaches the
internet passes locally and fails when judged. Run the final check isolated.

## Before submitting

Work against a **fresh clone**, not the working directory.

1. `harness check` on the fresh clone — catches uncommitted files and `.git`-in-folder.
2. `harness run --repo <clone> --all --mode isolated`.
3. Follow each `RUN.md` by hand in a clean environment, then use the UI.
4. Read `room.json`: confirm the reciprocal `@handle` exchange, and that no history was
   rebased, amended or squashed.
5. `README.md` and `FACTORY.md` written, not placeholders.
6. Re-read every mandate: could another team building something else use it?
7. Skim for anything private. Rotate, do not just delete — it is already pushed.
8. Submit repo URL + presentation + video. **The video must show the room working** — a
   handoff between seats and the result. A slideshow about the factory is not the factory.

## Practice

`toy/` is an unscored four-stage track with the same shape and its **whole** suite
shipped. It is the cheap place to find out whether the seats actually produce a
reciprocal `@handle` exchange, whether the reviewer runs the checks rather than the
implementer, and whether `harness check` passes. Rehearse gates 1 and 2 there before the
real repository matters.
