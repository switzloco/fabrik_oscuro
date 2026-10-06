# Pocketful: 4 Stages, 193 Checks Passed

**Team:** Nick Switzer and the active Band seats `nicholas.switzer/next-architect`, `nicholas.switzer/next-builder`, `nicholas.switzer/pf3-verifier-codex`, and `nicholas.switzer/pf3-auditor-claude`.

The current review authorities are `pf3-verifier-codex` (Codex, gpt-6-luna) and `pf3-auditor-claude` (Claude Code, claude-sonnet-5). The earlier `next-verifier` and `next-spec-auditor` seats and their original mandates remain preserved in the room/repository as historical records; they are not active approval authorities for this practice.

**Track:** Pocketful.

This repository contains four independently approved, independently buildable Pocketful stages:

- Stage 1 payments and settlements ([`stage-1/`](stage-1/)) and Stage 2 wallet UI and payment authorizations ([`stage-2/`](stage-2/)), approved at service revision `02d0b12a0cb55468540a0a2ff63ee78297a23756` and final package `e17618e2`.
- Stage 3 statements, historical balances and payment corrections ([`stage-3/`](stage-3/)), approved by both active reviewers at exact revision `22cab66916735c3320b227b6ecd1b1d1bdc90cb2`. Two fresh-clone isolated harness runs at that revision (host and Verifier) each passed Stage 1 147/147, Stage 2 35/35 and Stage 3 6/6 with zero failures, errors or skips. Stage 1 and Stage 2 are byte-identical to the approved package.

- Stage 4 refunds and batch corrections ([`stage-4/`](stage-4/)), approved by both reviewers at exact revision `203e4480bbfcf05183f248ace764db3d45130028`. A fresh-clone isolated harness run at that revision passed 147/147, 35/35, 6/6 and 5/5 with zero failures. Stages 1–3 are byte-identical to the approved Stage 3 revision.

Claude seats were substituted for the Codex Builder and Verifier after all Codex seats (Builder, Architect, Verifier) hit their ChatGPT/Codex usage limit at 01:16 UTC on October 6, before any Stage 4 code existed. Nick approved the substitution directly in the room at 03:41 UTC. `pf4-builder-claude` (Claude Code, claude-sonnet-5) authored all Stage 4 code; `pf4-verifier-claude` (Claude Code, claude-sonnet-5) verified it and `pf3-auditor-claude` audited it. Stage 4 dispatch and review handoffs were posted under Nick's account by his Claude Code coordinator session.

This is a supervised practice run, not a hands-off submission and not a claim of submission eligibility. Publication preserves the reviewed service files.

See [the submission overview](SUBMISSION.md), [presentation PDF](docs/Pocketful-presentation.pdf), and [recorded demo](https://switzloco.github.io/fabrik_oscuro/). The demo page contains a recorded presentation, not a hosted backend.

## Repository map

- [`stage-1/`](stage-1/) contains the independently buildable Stage 1 service, Dockerfile, and run instructions.
- [`stage-2/`](stage-2/) contains an independently buildable Stage 2 service, local browser assets, Dockerfile, and run instructions. It builds on Stage 1 with available/held balances, authorizations, expiry, and captures.
- [`stage-3/`](stage-3/) contains an independently buildable Stage 3 service that adds RFC 3339 historical views (`as_of`, `known_at`), statements with frozen pagination snapshots, sender-only idempotent payment corrections with historical overdraft checks, and Stage 1/2 export import.
- [`evidence/`](evidence/) holds the Stage 2 harness report, both Stage 3 isolated harness reports, and the Stage 3 Spec Auditor report.
- [`mandates/`](mandates/) preserves the original mandates and contains the active replacement review mandates `pf3-verifier-codex.md` and `pf3-auditor-claude.md`.
- [`room.json`](room.json) is the unchanged authentic full-session Band export verified for this package. [`FACTORY.md`](FACTORY.md) records its metadata and hash, plus the preserved earlier export. The snapshot predates the packaging commit and later packaging confirmations.
- Root `server.js`, `Dockerfile`, and `RUN.md` preserve the original Stage 1 service files. The `stage-1/` copy is the packaged stage deliverable.

## Build and run

From `stage-1/` for Stage 1:

```sh
docker build -t pocketful-stage1 .
docker run --rm -p 8080:8080 -e PORT=8080 pocketful-stage1
```

The service listens on `0.0.0.0:8080`; use `GET /health` for readiness. See [`stage-1/RUN.md`](stage-1/RUN.md) for the same commands.

For Stages 2 and 3, run the corresponding commands from `stage-2/` or `stage-3/` with the `pocketful-stage2` or `pocketful-stage3` image tag. See [`stage-2/RUN.md`](stage-2/RUN.md) and [`stage-3/RUN.md`](stage-3/RUN.md).
