# Practice run — pocketful stage 2 (Oct 1)

Stage 2 only, built on the finished stage 1 from the [previous practice
run](2026-09-30-pocketful-s1-practice.md), in a fresh room. Models: Sonnet 5 Architect,
**Opus 5 Builder** (as in the submitted run), Sonnet 5 Verifier, Sonnet 5 Spec Auditor.
Dispatch: `band-work/dispatch-practice-s2.txt`.

**Result: stage 2 complete at `b911f01`, approved by both reviewers.** Checked afterwards
on a fresh clone, `harness run --all --mode isolated`: `stage-1/` claims stage 1,
`stage-2/` claims stage 2, highest contiguous stage 2. 65 s.

**One intervention:** a Builder restart after a usage-limit reset, no message.

## Timeline (UTC)

| Time | Event |
|---|---|
| 04:34 | Dispatch |
| 04:37 | Architect sends the Builder the task in four parts (stage 1 spec, stage 2 spec, final) |
| 04:55 | **Builder hits the plan's session limit**, 17 minutes in. Reset stated as 12:30am PDT |
| 07:31 | Builder restarted; resumes in 30 s, finds its own uncommitted `stage-2/` and carries on |
| ~08:00–08:27 | Verifier returns two timestamp-format findings; Builder fixes both; Verifier approves `b911f01` |
| 08:32 | Spec Auditor approves `b911f01`. Room goes quiet |

**About 80 minutes of work** across a 2 h 36 min gap waiting for the limit to reset.

## Spend

From the seats' transcripts (Band does not attribute them): **58.4 M tokens**, Sonnet
36.5 M, Opus 21.9 M. Stage 1 was 67.7 M.

## The UI

Built and run from `RUN.md`, screenshotted at 1280 px and 390 px. It reads as a product:
a branded sign-up page with a short pitch, a wallet page with a balance card (available
and total), Send / Request / Reserve forms, an activity feed with an empty state, and
pages for requests, split and holds. The layout holds at phone width. Rough edges:

- A blurred shadow artefact in the top-left corner of every page.
- On the wallet page, three stacked forms push the activity feed to the bottom on a phone.
- The request form's payer placeholder is `@ada` while signed in as Ada.
- Nothing on a new account shows how to get money in, so the first screen is all zeros.

None of this is a defect against the spec. It is what separates "works" from
"presentation-ready", which is what the App criterion scores.

## Findings

**1. The recovery script works, but only if it outlives the wait.** It read the reset
time correctly and scheduled the restart for 07:31, but it was stopped at 06:34 by the
two-hour limit on a background job in the monitoring session. In the submitted run it
must run in its own terminal for the whole run.

**2. An Opus Builder reaches the plan's limit in 17 minutes.** The reset then took 2½
hours. On the plan, a submitted run will spend more time waiting than working: two
stages could take most of a day.

**3. The Architect posted no final report.** The dispatch asked for one. After both
approvals it acknowledged the Auditor and stopped, so nothing reached the human. In the
submitted run that is the message a judge looks for at the end of each stage. Worth a
line in the Architect's mandate.

**4. Review was lighter than stage 1:** two findings, both formatting. Either the Opus
Builder's first draft was better, or Sonnet review missed things. The organizers' hidden
65% of suite 2 will be the real answer.

## Not yet proven

Stages 3 and 4, a run on the submitted Architect model (Opus), and a run with no
intervention.
