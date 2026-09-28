# Next steps to submission

Written Sep 27 after rehearsal 1. Submissions close **Mon Oct 5, 23:59 PDT**; everything
below aims to submit a day early.

## Where things stand

- **Factory:** four seats, mandates updated from rehearsal 1 on branch `rehearsal-fixes`.
  `harness check` passes gates 1, 2 and the vocabulary scan with the new mandates.
- **Proven:** one seat plans and delegates, handoffs carry full specs, independent
  verification and audit, a commit at the end.
- **Not proven:** Docker builds (gate 3), the Verifier running the harness, a run with no
  human input, several stages from one dispatch, and every fix made after rehearsal 1.

## What decides the result

Worked out from the participant guide and the four pocketful specs:

1. **Only an unbroken chain of stages counts.** A broken `stage-2/` caps the entry at
   stage 1, however good `stage-3/` is.
2. **Stage 2 carries the App score (25%).** It is the first stage with a browser UI, and
   the spec asks for a "presentation-ready consumer finance product", not a test page.
3. **Stage 3 is a big step up:** a history of payment corrections with separate effective
   and recorded times, balances "as of" and "as known at" any instant, and frozen
   statement pagination. Stage 4 widens it again. Plan for **excellent stages 1 and 2,
   with 3 as a stretch.** A clean stage 2 beats a shaky stage 3.
4. **Autonomy is all or nothing per run.** In the submitted run, any message after the
   dispatch is steering. Rehearsal 1 needed four: two to get a seat started, two to clear
   stalls. The fixes target all four, but none of them is tested yet.
5. **Writing to the tests disqualifies.** The Builder must never read the shipped test
   files; the dispatch says so.

## Plan

| Day | Goal |
|---|---|
| **Sun Sep 28** | Other PC: WSL2 + Docker + harness working. Merge `rehearsal-fixes`. Full toy run, all four stages from one dispatch, hands off. |
| **Mon Sep 29 – Tue Sep 30** | Pocketful development run, stages 1–2, in a scratch room and repository. Steering is allowed here: watch where it stalls and what the UI looks like. Fix the mandates. |
| **Wed Oct 1 – Thu Oct 2** | Second development run if the first needed help. Draft FACTORY.md from `rehearsals/`. Decide models and quota for the real run. |
| **Fri Oct 2 evening or Sat Oct 3 morning** | **The submitted run.** Fresh room, fresh repository, one dispatch (`launch/dispatch-all-stages.md`), then hands off. |
| **Sun Oct 4** | Run finishes. Fresh-clone `harness check` and `harness run --all --mode isolated`. Download `room.json`, read it for secrets. README, FACTORY.md. |
| **Mon Oct 5** | Video (it must show the room working) and presentation. Submit by early evening, not 23:59. |

Why start the submitted run on Oct 2–3: rehearsal 1's trivial stage took about 35 minutes of
seat time. Pocketful stage 1 is roughly ten times the spec, so stages 1–2 could take a
long day of seat time. That is a guess to replace with the toy and development runs' real numbers.

## The other PC (Sunday)

1. `git pull`, then `git switch rehearsal-fixes` (or merge it into `main` once you've read it).
2. WSL2 with a Linux distribution, and Docker reachable from inside it. The participant
   guide says the harness must run inside WSL2 on Windows.
3. In WSL: Python 3.12+, the kickoff checkout, `pip install -r harness/requirements.txt`,
   then Playwright's Chromium. Run one isolated `harness run` on the toy by hand and **time
   it**. The first run installs a browser in Docker and is slow.
4. Band Desktop signed in, `band preflight` clean, the four seats created with
   `launch/launch-headless.ps1` (it checks that each mandate's model line matches the seat).
5. Decide how the seats will call the harness from Windows (probably `wsl -e python3 -m harness`)
   and put that exact command in the dispatch.

## Risks, most likely first

| Risk | Seen already? | Mitigation |
|---|---|---|
| A model runs out of quota mid-run | Yes, the Verifier on Fable | Check limits before the run; arrange an API-key fallback; avoid the scarcest model |
| A seat fails to start (sign-in, permission mode) | Yes, the Architect, twice | Scratch-room clean turn from every seat before the dispatch |
| A reply lost when a turn errors | Yes | Mandate fixes (untested); report it to Band |
| Nobody notices a stalled seat | Yes | Architect's open-handoff list (untested). A seat that crashes without waking anyone can still stall the run; the Architect is only woken by messages |
| Docker or WSL2 trouble on the other PC | Unknown | Sunday is for exactly this |
| Stage 2 UI looks like a test harness | Not yet run | Look hard at it in the development run; it is 25% of the score |
| Code written to the shipped tests | No | The Builder never opens them; failures reach it only as spec-cited reports |
| A credential in `room.json` | No | Nothing is redacted automatically. Read it before committing; never print env vars or keys in a seat |
| Stage-folder mistakes (`.git` inside, stage N passing N+1) | No | Fresh-clone `harness check`; the Architect's milestone isolation rule |

## Spend

Rehearsal 1 cost about **$7.64** at list prices for a trivial stage including two
stalls; the Architect was the most expensive seat, because every handoff re-sends the
whole spec. Every pocketful handoff carries a 25 KB spec, and later stages carry the
earlier ones too. Budget **tens of dollars per stage at least**, and more for the stages
with the most rework. Read `band usage agents` after the toy run and after the
development run, and scale from real numbers rather than this guess.

## Open decisions for you

1. **Models for the submitted run.** Current: Opus Architect and Builder, Sonnet Verifier
   and Spec Auditor. The only hard rule is that the Verifier never runs the Builder's
   model. Haiku 4.5 fits the Spec Auditor if quota is tight; I would not put it on the
   Builder.
2. **Whether the dispatch should fix the technology.** The spec leaves language and
   storage open. Letting the Architect choose is more "factory"; naming one (for example a
   single process with in-memory state, which makes atomic multi-wallet updates, retries
   and export/import simpler) removes a class of risk. It is allowed either way, because
   the dispatch is the one place track-specific direction belongs.
3. **Report the lost-reply bug to Band** (their Discord is the formal channel). Draft:

   > A Claude Code seat called `jam_reply_to_message`, which returned "staged disposition".
   > Seconds later its turn ended when a background task it had started stopped with an
   > error, logged as `[error]`. The staged reply was never posted, nothing was queued, and
   > the recipient was never woken, so the room stalled until a human intervened. Expected:
   > a staged disposition survives an errored turn end, or the failure is surfaced to the
   > room. Room `b30e8b6e-8a43-4a51-84e0-60ba86ff99dd`, Sep 26 22:30:57–22:31:08 UTC.
