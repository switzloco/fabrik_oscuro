# Factory Description

## What this is

A reusable four-seat software factory built in BAND Desktop (Jam). A human puts a written specification into a BAND room. Four coding-agent seats then plan, implement, verify, and audit the work until each milestone passes.

The seat mandates in [`mandates/`](mandates/) are generic. They describe how a seat works: what it owns, how it takes and hands off work, and when it rejects something. They say nothing about what is being built. The task itself lives in the brief that the human pastes into the room, so the same four mandates can be handed to a team building something completely different.

## The crew

| Seat | Runtime | Model (initial) | The one job it owns |
|---|---|---|---|
| **Architect** | Claude Code | Claude Sonnet 5 | Plan, sequence, integrate, and decide when a milestone is complete |
| **Builder** | Claude Code | Claude Sonnet 5 | Implement one scoped work item at a time |
| **Verifier** | OpenCode | Kimi K3 | Independently check the work against the specification |
| **Spec Auditor** | OpenCode | Kimi K3 | Prove that every requirement is implemented, checked, and not exceeded |

Model choice is runtime configuration, not part of a mandate, and it can be changed per seat without touching the mandate files. The seats that judge the work run a different vendor's model, in a different harness, from the seats that plan and produce it. The seat that verifies the work is not the same model as the seat that produced it, so the two are less likely to share blind spots.

That last sentence is a constraint on the table above, not a description of it: **the Verifier's model may never equal the Builder's.** Two instances of one model fail in correlated ways, and a checker that fails the way the author fails is not a checker. The Architect and the Spec Auditor may share a model with anyone, since neither produces the code it judges. A different model family is stronger than a different size of the same family: rehearsals ran the reviewers on Claude first, then moved them to Kimi K3 without changing a word of any mandate, only each seat's runtime. Any swap that puts the Builder and the Verifier on the same model deletes the independence this factory is built to provide, and every verdict it produces afterwards is worth less than it looks.

## Who talks to whom

Routing runs through `@mentions`. A seat sees only the messages in which it is mentioned, and the human sees the whole room.

- **Human → Architect.** One dispatch per run, and nothing after it. The Architect is the only seat that reports back, so there is exactly one place a person has to look, and what it posts is an outcome, never a question.
- **Architect → Builder.** One scoped work item at a time, with acceptance criteria.
- **Builder → Architect.** The committed revision and a handoff note when an item is implemented.
- **Architect → Verifier.** A verification request carrying the complete requirements, the revision and the Builder's note. A seat cannot read the room, so the requirements travel with the request.
- **Verifier → Builder.** A reproducible failure report when an item is returned.
- **Builder → Verifier.** The fixed revision, answering each point of the failure report.
- **Verifier → Architect.** A verdict backed by evidence, ending in one `VERDICT:` line.
- **Architect → Spec Auditor → Architect.** A traceability review at each milestone boundary.

Deliberately left out of mentions:
- The **Builder never mentions the Auditor or the human.** It cannot ask for its own sign-off or route around the Verifier.
- The **Auditor is not mentioned on every work item.** It works at milestone boundaries, which keeps the room readable and its sign-off meaningful.
- The **Verifier and Auditor do not message the human.** Their findings go to the Architect, which resolves them inside the band.

## One typical run

```text
Human posts brief + specification
  -> @Architect plans, splits into work items, records assumptions
  -> @Builder implements item 1 in committed increments, hands the revision to @Architect
  -> @Architect records or returns any behaviour the Builder chose, then sends
     @Verifier the complete requirements with the revision
  -> @Verifier derives checks from the spec, runs them
       fail -> returns a reproducible report to @Builder -> Builder fixes -> Verifier re-runs
       pass -> VERDICT: APPROVE to @Architect
  -> (repeat for each item in the milestone)
  -> @Architect requests a milestone review from @Spec Auditor
  -> @Spec Auditor updates the traceability record, lists gaps and extras
  -> @Verifier builds and runs from a clean checkout and runs every check so far
  -> @Architect declares the milestone complete only when both sign off,
     then posts the committed revision and what was done — a report, never a question
```

## What breaks without the room

Take the room away and the Verifier's independence and the Auditor's sign-off collapse into one agent grading its own work: the "no self-approval" gate no longer exists. Each handoff carries a finding that changes what the next seat does, such as a failure report that sends an item back, an audit gap that reopens a milestone, or an approved verdict that unlocks the next one. Without the room, those become one agent's private notes.

## Design principles

- **Generic mandates.** Nothing in a mandate refers to the thing being built. The specification and brief are supplied at run time.
- **No self-approval.** The seat that produced work never marks it verified or complete.
- **Evidence over assertion.** Verdicts cite runs, checks, and specification passages.
- **Milestone isolation.** A milestone's deliverable contains only what that milestone requires.
- **No human gate.** The dispatch is the only input. The Architect is the only seat that reports to the human, and it reports outcomes, never questions: an unsettled requirement becomes a recorded assumption, and a genuine blocker becomes the recorded outcome of the run.
- **Restart-safe.** Each mandate says what a seat does after a reattach: announce it, read the room history and plan, and resume the last unfinished item.
- **Stall-aware.** No human watches a submitted run, so the Architect keeps a list of open handoffs and re-sends any that a seat has not answered. Seats stop their own processes before handing off, because a turn that ends in an error can lose the reply it just wrote.
- **Machine-readable verdicts.** The Verifier and the Spec Auditor each end with one `VERDICT:` line, and the Architect declares a milestone only on two approvals of the same revision.
- **Commits tell the story.** The Builder commits each working increment under its own seat name, and nobody rewrites history, so the git log and the room log can be read side by side.

## Running it

See the [README](README.md) and [`launch/`](launch/).
