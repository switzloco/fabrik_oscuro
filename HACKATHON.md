# Hackathon: WeAreDevelopers x BAND — Dark Factory (hackathon edition)

Reference copy of the event page, captured 2026-09-20 from a paste of
<https://lablab.ai/ai-hackathons/wearedevelopers-hackathon>. Navigation, speaker
roster and footer links are omitted. The **Judging Criteria** section listed in
the page's own nav was not included in the capture and is still outstanding.

## At a glance

| | |
|---|---|
| Build window | **Sep 26 – Oct 5, 2026**, fully online |
| Kickoff | Sep 26, 09:00 PDT — the written SPEC is released here, not before |
| Close | Page header says 23:59 PDT Oct 5; the event schedule says 12:00 AM PDT Oct 5. **Conflicting — assume the earlier one.** |
| Team size | 1–6 people |
| Prize pool | $6,000 cash, split across two tracks |
| Platform | lablab.ai (enrol + submit), BAND Desktop (build), Discord (support) |
| Related | WeAreDevelopers World Congress NA, San Jose, Sep 23–25. Sign-ups eligible for a free ticket. |

## The challenge

Build a software factory in BAND Desktop: a band of coding agents that plans
work, implements it, hands off evidence, and independently checks its own
results. Then use it to ship a clean-room clone of a well-known product.

> **What you submit is the factory, the run that produced the result, and the result.**

## Two tracks

Pick one and stay in it. You compete only against your own track.

| Track | Product | The hard part |
|---|---|---|
| **tablekeeper** | Restaurant reservations, like OpenTable | A table must never be double-booked, under concurrency, retries and time zones |
| **pocketful** | Wallet and payments, like Venmo | Money must never be created, destroyed or spent twice, under concurrent transfers, retries and rounding |

## Four stages

Both tracks follow the same four stages, each with its own SPEC released at kickoff.

1. **JSON API** — every endpoint the spec lists, with documented response shapes and error codes.
2. **Web UI** — the screens the spec lists, over the stage 1 API, each element carrying the exact `data-testid` attribute it names.
3. **Concurrency control** — through every write path: each check-and-act atomic so two callers can't both pass it; idempotency keys stored so a replayed request returns the original response instead of doing the work twice; malformed input rejected with the documented error rather than a 500.
4. **Domain extension** — a real extension of the same domain: widen the model and API you already have, without breaking anything that already passes.

## Submission requirements

### 1. Your band
- At least **three** distinct coding-agent seats in BAND Desktop, each with a mandate file. Seats may share a runtime and a model.
- A seat can be **any runtime BAND supports** — including one built on the BAND SDK and run on your own machine, a cloud box or a CI runner.
- Models: Featherless credits or bring your own provider access.

### 2. Your mandates must be generic
A mandate is the standing instruction for a seat: what it owns, how it takes and
hands off work, when it rejects something. It **cannot** name anything specific
to the track — no endpoint paths, no field names, no error codes, no
`data-testid` values. Track detail belongs in the task pasted into the room.

> The test: could you hand your mandates to a team building something completely
> different, and would they still make sense? If not, you have written a
> transcript of this problem rather than a factory — and a factory another team
> could stand up is **what 60 of the 100 points are for**.

A mandate naming track-specific detail **disqualifies the entry**. The harness
scans for it pre-submission; judging checks again.

### 3. Your repository
- One **public** GitHub repo a judge can clone without BAND Desktop membership.
- One folder per completed stage, `stage-1/` … `stage-4/`, each a **complete, buildable service**. Submit only stages you completed. **Minimum to be eligible: a complete stage 1.**
- Plus: seat mandates, factory description, and the BAND Desktop room export (`harness export-room`).
- Each folder is graded against every suite up to its own number — `stage-3/` must pass suites 1, 2 and 3.
- **Each folder must hold that stage's solution.** One that also passes the next stage's suite is "a later answer in the wrong folder" and earns nothing for its own stage.
- Run `harness check` before pushing. It validates structure and flags credentials or unrelated private data.

### 4. Your video
- Must include a **recording of the BAND Desktop room** that generated your solution, plus a walkthrough.
- A video without the room recording **disqualifies** the team.

### 5. Your service
- Must build and serve from a **clean container with no outbound network**. A service that doesn't start scores zero.
- CPU/memory caps, harness concurrency and per-request timeouts are published with the spec at kickoff.

### Submission form fields (lablab.ai)
Project title · short description · long description · tech & category tags ·
cover image · video presentation · slide presentation · public GitHub repo ·
demo platform · application URL.

## Disqualifiers

- A mandate that names track-specific detail
- A video without the BAND Desktop room recording
- A service that does not start from a clean container (scores zero)

## Prizes

Per track: **1st $1,500 · 2nd $1,000 · 3rd $500.**

A place is awarded only if the track has enough eligible entries: at least one
for first, four for second, six for third. Unawarded prizes are not
redistributed. Winning entries may be published as case studies. Featherless
adds $300 in credits for the first winning team.

## Partner resources

- **Docker Sandboxes** — isolated reproducible containers. <https://docs.docker.com/ai/sandboxes/>
- **Featherless AI** — serverless inference, 30,000+ open models, OpenAI-compatible API. $25 per-request credits per participant, up to 1,000 participants, first come first served; promo code emailed shortly before kickoff. Signup takes a card — cancel before the next cycle if you don't keep it.

## Key links

- Event page — <https://lablab.ai/ai-hackathons/wearedevelopers-hackathon>
- BAND hacker guide — <https://www.band.ai/hacker-guide>
- BAND Desktop / Jam docs — <https://docs.band.ai/jam>
- BAND SDK setup — <https://docs.band.ai/integrations/sdks/tutorials/setup>
- Connect an agent — <https://docs.band.ai/getting-started/connect-remote-agent>
- Create account — <https://app.band.ai/>
- BAND Discord — <https://discord.com/invite/5YkNXmYfjk>
- lablab Discord — <https://discord.gg/lablabai>

---

# What this changes for us

*Commentary, not event content. Added 2026-09-20.*

## 1. `launch/PLAN.md` states the entry wrong

PLAN.md's opening decision reads:

> "The factory is the hackathon entry, not a tool for building a separate entry."

The event page says the opposite: the submission is *the factory, the run, and
the result*, and **a complete stage 1 service is the eligibility floor**. A
submission with no `stage-1/` is not scored at all, however good the mandates
are.

The "separate from shipped project" line appears to mean the BAND tooling isn't
graded as part of the shipped service — not that no service is shipped.

**Action:** we pick a track and build tablekeeper or pocketful. The factory is
how we build it, and it is 60 of the 100 points — but it is not the deliverable
on its own.

## 2. The SDK migration is optional, not required

PLAN.md concludes "the seats should ship as SDK agents." The requirements say a
seat may be **any runtime BAND supports**, and mandates that seats may even
share a runtime and a model. Four terminal-attached Claude Code windows in a Jam
room is a conforming submission.

**Action:** treat `launch/PLAN.md`'s SDK path as a stretch goal. It is a week
of plumbing that buys zero points, and the week is needed for stages 1–4.

## 3. What we already have that scores

- **Generic mandates** — the 60-point criterion, and a disqualifier if we got it
  wrong. `mandates/` names nothing track-specific. This is banked.
- **Milestone isolation** (`mandates/architect.md`) already states the exact rule
  the stage-folder grading enforces: a deliverable contains only what that
  milestone requires. A stage folder that passes the *next* stage's suite scores
  nothing for its own stage.
- **FACTORY.md** is the required factory description.
- **Four seats** exceeds the three-seat minimum.

## 4. Still outstanding

- The **Judging Criteria** section of the event page (not in this capture).
- `harness` — what installs it, and whether `export-room` requires BAND Desktop.
- Track decision: tablekeeper or pocketful.
- Team registration on lablab.ai, and enrolment before kickoff.
- The four stage SPECs do not exist until Sep 26 09:00 PDT.
