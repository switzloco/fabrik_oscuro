# Practice run: pocketful stage 1, Codex Builder (Oct 3)

This is the first pocketful run on the token-budget factory. The Architect ran Sonnet 5 on
Claude Code. The Builder ran **GPT-6 Luna on Codex** (high effort, Band compaction at
150 k). The Verifier and Spec Auditor ran Kimi K3 on OpenCode (Zen, capped at 150 k).
This was the first practice run on the routing fixes from the toy run that morning.

**Result: pocketful stage 1 complete at `c77e520`, approved by both reviewers. The
organizers' tool passed 147/147.** It took 1 h 50 min from dispatch, about 43 minutes of
which was a stall that needed two practice nudges (see finding 1).

## Spend

| | Sep 30 stage 1 (all Claude) | This run |
|---|---:|---:|
| Claude, Architect (plan) | 67.7 M, all seats | **5.1 M**, 63 calls |
| Codex, Builder (plan) | — | **5.5 M**, 77 calls |
| Kimi K3, Verifier + Spec Auditor (Zen) | — | ~3 M, **$2.10** |
| Largest context of any seat | 590 k (Oct 2 Builder) | 106 k |

That is about 13.6 M tokens in all, roughly five times less, and thirteen times less on
the Claude plan. No seat hit a usage limit. No seat got near its 150 k cap, so compaction
never ran. The saving came from fewer calls on smaller contexts.

## What review caught

- **The Verifier** returned the first handoff because the service sat at the repository
  root instead of `stage-1/`, and one response had the wrong shape. The fix took four
  minutes.
- **The Spec Auditor** rejected a revision that passed the organizers' tool 147/147. One
  endpoint returned 422 where the specification reserves 400. Another behaviour was not
  backed by a requirement or a recorded assumption. Both were fixed, re-verified, and the
  re-trace of §1–§11 then approved.

## Findings

1. **A handle mentioned in passing woke the wrong seat, and the run stalled.** The
   Architect's brief to the Verifier said items would come from the Builder, naming the
   Builder by `@handle`. That woke the Builder, which took the Verifier's brief as its
   own role. The work item arrived in the same turn, and the Builder ended the turn
   waiting for "the Builder's handoff". It then brushed off the re-sent item for the same
   reason. Nothing wakes an idle Architect, so the room sat silent for 27 minutes. Mandate
   changes:
   - a message meant for one seat names the others by role, never by handle;
   - the Builder starts any work item addressed to it in the turn it arrives;
   - the Architect checks a few minutes after each handoff that the receiver has started.
2. **A restart does not wake an idle seat.** `jam restart` brings a seat back to "ready"
   but starts no turn, so an outside watchdog cannot recover a dropped handoff without
   posting a message. It has to be prevented inside the band.
3. **`recover-after-limit.ps1` could never restart a seat that has served several rooms.**
   Such a seat refuses a bare restart and asks for `--host-session`. This is the likely
   reason the Oct 2 submitted run's Builder never came back after its limit reset. Fixed.
4. **Codex seats still use Band's task tools.** `--claude-disallowed-tool` does not apply
   to them, so only the mandate line restrains them, and GPT-6 Luna ignored it.
5. **Kimi keeps mentioning the Architect to say "no reply needed"**, despite the new rule.
6. **The Architect's "plan snapshot publish" background task failed five times.** That
   noise came from Band itself.
7. **Claude Code stopped the background limit watcher for low memory.** In the submitted
   run it gets its own terminal, as rehearsal finding 1 on Oct 1 said.

## Changing a seat's harness

`band runtime template set` keeps any flag you leave out and cannot clear one. A seat
moving from Claude Code to Codex therefore has to be removed (`jam rm --as`), dropped
from the state file, and created again. The first attempt left Band's daemon unresponsive
until Band Desktop was restarted.
