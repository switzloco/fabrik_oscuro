# Factory Description

## What this is

A reusable four-seat software factory built in BAND Desktop (Jam). A human puts a written specification into a BAND room. Four coding-agent seats then plan, implement, verify, and audit the work until each milestone passes.

The seat mandates in [`mandates/`](mandates/) are generic. They describe how a seat works: what it owns, how it takes and hands off work, and when it rejects something. They say nothing about what is being built. The task itself lives in the brief that the human pastes into the room, so the same four mandates can be handed to a team building something completely different.

## The crew

| Seat | Runtime | Model (initial) | The one job it owns |
|---|---|---|---|
| **Architect** | Claude Code | Opus 5 | Plan, sequence, integrate, and decide when a milestone is complete |
| **Builder** | Claude Code | Opus 5 | Implement one scoped work item at a time |
| **Verifier** | Claude Code | Sonnet 5 | Independently check the work against the specification |
| **Spec Auditor** | Claude Code | Sonnet 5 | Prove that every requirement is implemented, checked, and not exceeded |

Model choice is runtime configuration, not part of a mandate, and it can be changed per seat without touching the mandate files. The seats deliberately use different model tiers. The seat that verifies the work is not the same model as the seat that produced it, so the two are less likely to share blind spots.

That last sentence is a constraint on the table above, not a description of it: **the Verifier's model may never equal the Builder's.** Two instances of one model fail in correlated ways, and a checker that fails the way the author fails is not a checker. The Architect and the Spec Auditor may share a tier with anyone, since neither produces the code it judges. Any swap that puts the Builder and the Verifier on the same model deletes the independence this factory is built to provide, and every verdict it produces afterwards is worth less than it looks.

## Who talks to whom

Routing runs through `@mentions`. A seat sees only the messages in which it is mentioned, and the human sees the whole room.

- **Human ↔ Architect.** The Architect is the single escalation point, so there is exactly one place a person has to look.
- **Architect → Builder.** One scoped work item at a time, with acceptance criteria.
- **Builder → Verifier.** A handoff note when an item is implemented.
- **Verifier → Builder.** A reproducible failure report when an item is returned.
- **Verifier → Architect.** A verdict backed by evidence.
- **Architect → Spec Auditor → Architect.** A traceability review at each milestone boundary.

Deliberately left out of mentions:
- The **Builder never mentions the Auditor or the human.** It cannot ask for its own sign-off or route around the Verifier.
- The **Auditor is not mentioned on every work item.** It works at milestone boundaries, which keeps the room readable and its sign-off meaningful.
- The **Verifier and Auditor do not message the human.** Escalation goes through the Architect only.

## One typical run

```text
Human posts brief + specification
  -> @Architect plans, splits into work items, records assumptions
  -> @Builder implements item 1, builds and runs it, hands off
  -> @Verifier derives checks from the spec, runs them
       fail -> returns a reproducible report to @Builder -> Builder fixes -> Verifier re-runs
       pass -> reports an approved verdict to @Architect
  -> (repeat for each item in the milestone)
  -> @Architect requests a milestone review from @Spec Auditor
  -> @Spec Auditor updates the traceability record, lists gaps and extras
  -> @Verifier builds and runs from a clean checkout and runs every check so far
  -> @Architect declares the milestone complete only when both sign off,
     then tells the human what was done and what decision, if any, is needed
```

## What breaks without the room

Take the room away and the Verifier's independence and the Auditor's sign-off collapse into one agent grading its own work: the "no self-approval" gate no longer exists. Each handoff carries a finding that changes what the next seat does, such as a failure report that sends an item back, an audit gap that reopens a milestone, or an approved verdict that unlocks the next one. Without the room, those become one agent's private notes.

## Design principles

- **Generic mandates.** Nothing in a mandate refers to the thing being built. The specification and brief are supplied at run time.
- **No self-approval.** The seat that produced work never marks it verified or complete.
- **Evidence over assertion.** Verdicts cite runs, checks, and specification passages.
- **Milestone isolation.** A milestone's deliverable contains only what that milestone requires.
- **One human gate.** The Architect owns all escalation, with a recommended default rather than a menu.
- **Restart-safe.** Each mandate says what a seat does after a reattach: announce it, read the room history and plan, and resume the last unfinished item.

## Running it

See the [README](README.md) and [`launch/`](launch/).
