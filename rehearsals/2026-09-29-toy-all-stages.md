# Rehearsal 2 — toy, all four stages from one dispatch (Sep 29–30)

The first test of the mandates changed after [rehearsal 1](2026-09-26-toy-stage-1.md), and
the first run shaped like a submitted one: a fresh result repository holding only the
mandates, a fresh room holding only the Architect and the human, and one dispatch
([`launch/dispatch-all-stages.md`](../launch/dispatch-all-stages.md), adapted for a machine
without Docker) covering all four stages.

**Result: all four stages built, verified, audited and committed by the band.** Checked
afterwards, outside the band, against the organizers' suites on a fresh clone:

| Folder | Its suites | Result |
|---|---|---|
| `stage-1/` | 1 | 8 / 8 |
| `stage-2/` | 1–2 | 12 / 12 |
| `stage-3/` | 1–3 | 14 / 14 (one check failed once on a heavily loaded laptop, passed on rerun) |
| `stage-4/` | 1–4 | 24 / 24 |

Next-suite overshoot checks behaved as the harness expects for stages 1 and 3.

**One human message was needed**, and it was not a mandate failure: the Architect hit the
Claude plan's usage limit mid-run. See the first finding.

Gate 3 is still untested; this laptop has no Docker. The Verifier started each service
directly with Python and ran the organizers' suites with pytest against it.

## Timeline

| UTC | Event |
|---|---|
| Sep 29 18:16 | Dispatch |
| 18:23 | Architect has read all four specs, added the three seats, sent WI-1 in two parts, posted its open-handoff list |
| 18:29 | Builder commits stage 1 under its own name and reports the revision |
| 18:35 | **Spec Auditor: REJECT** — two behaviours no requirement accounts for |
| 18:38 | Architect records both as assumptions; Auditor approves on re-review; Verifier approves |
| 18:41 | **Stage 1 complete** (25 min) |
| 19:00 | **Stage 2 complete** (19 min), including browser checks |
| 19:17 | Stage 3 approved by both reviewers. **The Architect's next turn fails: plan usage limit reached** |
| — | Room idle ~20 h. The limit reset at 23:10 UTC, but nothing wakes a seat after a reset |
| Sep 30 15:57 | Human: "Your turn … failed on a usage-limit error, which has since reset. Continue the run." |
| 15:59 | Architect reconciles on its own: declares stage 3 complete, sends stage 4 |
| 16:21 | **Stage 4 complete**, final report posted |

**Active time: about 85 minutes** for four stages, roughly 20 minutes a stage.

## Spend

`band usage rooms`, list-price estimates:

| Seat | Estimate |
|---|---:|
| Architect | $16.93 |
| Builder | $12.64 |
| Verifier | $4.85 |
| Spec Auditor | $2.49 |
| **Room total** | **$36.91** (48.2 M tokens) |

About $9 a stage on a problem whose specs fit on one screen each.

## Findings

**1. The plan's usage limit is the real ceiling, and nobody recovers from it.** All four
seats draw on one Claude subscription, and so did this monitoring session. About 27 M
tokens in the first hour hit the session limit. The Architect was the seat that failed, so
the open-handoff rule could not help: the one seat that watches for stalls was the one
stalled, and a limit reset wakes nobody. In a submitted run this ends autonomy.
→ Not fixable in a mandate. The submitted run needs seats on API-key billing, or a plan
whose limits a full run cannot reach, with the whole run measured first. Pocketful's specs
are many times larger than the toy's.

**2. Acknowledgements cost turns.** The Architect replied to reports with thanks,
confirmations and "heads-ups", and every one woke the seat it reached for an empty turn.
→ The Architect's mandate now says a mention or reply is only for a seat that must act,
and reports needing no answer are closed without replying.

**3. The rehearsal-1 fixes held:**
- The Architect added the seats itself, read every stage first and kept an open-handoff list.
- The Builder committed each stage under its own name (`nicholas.switzer/builder`) and
  reported full revisions; the Architect checked each commit's contents before handing on.
- The Spec Auditor rejected unaccounted behaviour instead of noting it. The Architect
  recorded it as assumptions rather than stripping it. That is allowed, but a dead
  exception handler that returns 500, where the spec forbids 5xx, arguably should have gone.
- The Verifier used fresh clones and one foreground command per check, and stopped a stray
  server left over from rehearsal 1.
- After the stall the Architect reattached, read the room and resumed exactly where it
  stopped, as its mandate says.
- No handoff was lost.

**4. Review changed the record once and the code never.** One rejection in four stages, and
it changed what was recorded, not the code. On the toy that is fine; the rubric says correct
work accepted first time loses nothing. Pocketful will show whether review catches real bugs.

**5. A loaded laptop makes concurrency checks flaky.** Four seats plus a browser left 4 GB of
32 GB free, and Claude Code itself stopped a background job for memory. One stage-3
concurrency check failed once and passed on rerun. Run the submitted stages, and the
harness, on a machine with room to spare.

## Not yet proven

Gate 3 (Docker), the harness itself in isolated mode, a run with **no** human message,
and anything at pocketful's size.
