# Practice run — pocketful stage 1, cheaper models (Sep 30 – Oct 1)

The first run on the real track, and the first on the personal PC with Docker and the
harness in WSL2. Practice seats (`practice-*`, created with `launch-headless.ps1
-Practice`) ran cheaper models than the submitted run will: Sonnet 5 Architect, Builder
and Spec Auditor, Opus 5 Verifier. One dispatch, stage 1 only
(`band-work/dispatch-practice-s1.txt`).

**Result: stage 1 complete at `5291e2d`, approved by both reviewers.** Checked afterwards,
outside the band, on a fresh clone in isolated mode: stage 1 passes the shipped suite,
stage 2's suite fails as it should, `claimed stage: 1`. The harness run took 26 s.

**One intervention:** a seat restart after a usage limit, with no message to the room.

## Timeline (UTC)

| Time | Event |
|---|---|
| 01:15 | Dispatch |
| 01:19 | Architect sends the Builder the work item in two parts |
| ~01:40–02:22 | Builder commits; Verifier rejects five times on spec-cited findings, Builder fixes each |
| 02:22 | **Verifier hits the plan's session limit** |
| 02:31 | After the reset, `jam restart --as nicholas.switzer/practice-verifier`. It resumes 25 s later, unprompted, and builds from a fresh clone with `docker build --no-cache` |
| 02:44 | Finding 6 (reset budget) routed to the Builder |
| 02:53 | Verifier approves `2bda3dc`; Architect requests the traceability review |
| 02:57 | **Spec Auditor rejects:** idempotency record keys could collide (money could move twice) |
| 03:17 | Both approve `5291e2d`. Architect posts the final report |

**About 2 hours** for stage 1, including the ~9-minute limit stall.

## Spend

`band usage` attributed none of it to the seats on this machine (sessions show as
`(unattributed)`, 2.8 M tokens). Counted from the seats' Claude Code transcripts instead:

| Model | Seats | Tokens | of which cache reads |
|---|---|---:|---:|
| Sonnet 5 | Architect, Builder, Spec Auditor | 44.1 M | 43.4 M |
| Opus 5 | Verifier | 23.3 M | 22.8 M |
| **Total** | | **67.7 M** | 97% |

One pocketful stage cost more tokens than all four toy stages in rehearsal 2 (48 M).
Almost all of it is cached context re-read on each turn, so the number of turns, not
message size, drives it.

## Findings

**1. Review changed the code, seven times.** Every finding cited the stage-1 spec. Two
were serious: an unscoped idempotency key that let a replay on another path move money
twice (found by the Verifier, then a delimiter collision in the fix found by the Spec
Auditor), and `/_test/reset` breaking its 10 s budget on a large fixture. Rehearsal 2's
review changed the code zero times. This is the run that shows the room earning its keep.

**2. A restart recovers from a usage limit without a message.** See the timeline.
The open questions are whether organizers would call that steering, and whether a
restarted Architect resumes as cleanly.

**3. Haiku 4.5 cannot be a seat here.** Both Haiku seats failed their readiness turn:
Claude Code ran them in permission mode "default" where Band pins "auto". Sonnet and Opus
seats created identically were fine. Seats switched with `runtime template set` did not
recover; deleting and recreating them did.

**4. Band 0.4.12 quirks.** `jam chat add` adds participants and then fails to decode its
own reply; the launch script now warns and relies on its re-read. `band usage` does not
attribute owned-runtime sessions.

**5. The Architect still thanks seats.** It replied "Good catch" and "thank you for the
thorough re-pass" to reviewers, waking them for nothing, despite the rehearsal-2 mandate
change. Small cost, but the rule is not holding.

**6. The Verifier committed its own check suite into the result repository**
(`checks/stage-1/`, beside `stage-1/`). Harmless to the stage folder, and arguably good
evidence of spec-derived checks, but decide whether the submitted repository should
carry it.

**7. Six Verifier rejections on one stage.** All converged; none repeated. A retry cap
was not needed here, but stage 1 took about 2 hours, so four stages will not fit in one
plan window.

## Not yet proven

Stage 2 and its UI, the submitted model mix (Opus Builder), an Architect restart, and a
run with no intervention at all.
