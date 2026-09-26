# fabrik oscuro

A wallet and payments service, built by a four-seat agent software factory.

Entry for [WeAreDevelopers x BAND — Dark Factory](https://lablab.ai/ai-hackathons/wearedevelopers-hackathon), **pocketful track**. What is submitted here is the factory, the run that produced the result, and the result.

The hard part of this track: **money must never be created, destroyed or spent twice**, under concurrent transfers, retries and rounding.

## Repository layout

```
README.md          this file
FACTORY.md         the factory description: crew, routing, flow, design principles
HACKATHON.md       the event rules, submission requirements and disqualifiers
mandates/          one standing-instruction file per seat — generic, no track detail
launch/            the launch script and the brief template
stage-N/           the solution for each completed stage
room-export/       the BAND Desktop room export (`harness export-room`)
```

## The factory

Four Claude Code seats in one BAND room. A human posts a written specification;
the seats plan it, implement it, verify it and audit it until each milestone
passes. See [FACTORY.md](FACTORY.md) for the crew, the routing and why the room
is load-bearing.

The mandates in [`mandates/`](mandates/) are generic — they describe how a seat
works, never what is being built. Nothing in them names an endpoint, a field, an
error code or a `data-testid`. The pocketful specification is supplied at run
time in the brief, not baked into a seat.

## Running it

Prerequisites: a [BAND account](https://app.band.ai/), Jam Desktop signed in
(`jam whoami` must succeed), and Claude Code signed in to a Claude subscription.
The seats ride that login — no `ANTHROPIC_API_KEY` is used.

```powershell
launch/launch-headless.ps1
```

Creates the four seats and one shared room, adds you and the seats to it, and
prints the room's `chat_id`. Safe to re-run. Then post the brief using
[`launch/brief-template.md`](launch/brief-template.md) for the shape:

```
jam room send <chat_id> "@Architect <your brief>" --mention <architect_agent_id>
jam room messages <chat_id>
```

Step in only when the Architect surfaces a decision.

## Submission checklist

Every item below is a rule from [HACKATHON.md](HACKATHON.md). The first three
are disqualifiers or eligibility gates, not preferences.

- [ ] **`stage-1/` complete and buildable** — the eligibility floor. No stage 1, no score.
- [ ] **Mandates carry no track-specific detail** — verify with `harness check`. Naming a pocketful endpoint, field or error code disqualifies the entry.
- [ ] **The service builds and serves from a clean container with no outbound network.** A service that does not start scores zero.
- [ ] **Video includes a recording of the BAND room** that generated the solution, plus a walkthrough. Missing the room recording disqualifies.
- [ ] Each `stage-N/` holds *that* stage's solution — one that also passes the next stage's suite earns nothing for its own stage.
- [ ] `room-export/` committed from `harness export-room`.
- [ ] `harness check` passes before the final push; no credentials in the repo.

## Status

The four stage specifications are released at kickoff and are not known before
then. Nothing under `stage-N/` exists yet.

## Known issues

- **Seats share one working directory.** The launch script puts all four seats
  in the repository root. While that holds, the Builder can reach the Verifier's
  checks and the Verifier's clean-checkout release check proves nothing — two
  mandate rules that cannot be enforced. A separate `git worktree` per seat,
  with the Builder pushing to a branch the Verifier checks out fresh, is the
  intended fix.

## Credit

The seat mandates, [FACTORY.md](FACTORY.md) and the headless launch script come
from George Stoien's [dark-factory](https://github.com/gs-syk/dark-factory),
shared across two entries in different tracks. That the same mandates stand up
an unrelated product is the property they are meant to have.

One deliberate change from upstream: the Verifier runs a different model from
the Builder. See the note in [FACTORY.md](FACTORY.md#the-crew).
