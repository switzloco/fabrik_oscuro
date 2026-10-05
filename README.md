# Pocketful practice run

**Team:** Nick Switzer and the active Band seats `nicholas.switzer/next-architect`, `nicholas.switzer/next-builder`, `nicholas.switzer/pf3-verifier-codex`, and `nicholas.switzer/pf3-auditor-claude`.

The current review authorities are `pf3-verifier-codex` (Codex, gpt-6-luna) and `pf3-auditor-claude` (Claude Code, claude-sonnet-5). The earlier `next-verifier` and `next-spec-auditor` seats and their original mandates remain preserved in the room/repository as historical records; they are not active approval authorities for this practice.

**Track:** Pocketful.

This repository contains the independently approved Stage 1 payments and settlements service and the completed Stage 2 wallet and payment-authorization service. The exact service revision is `02d0b12a0cb55468540a0a2ff63ee78297a23756`; both active reviewers approved that revision. Stage 1 remains packaged independently in [`stage-1/`](stage-1/); Stage 2 carries it forward in [`stage-2/`](stage-2/) with the browser UI and authorization/capture API. This is a two-stage practice run, not a hands-off submission and not a claim of submission eligibility. The current README/FACTORY packaging revision still needs fresh confirmation from both reviewers, and the owner will supply a fresh authentic Band export in a later packaging step.

## Repository map

- [`stage-1/`](stage-1/) contains the independently buildable Stage 1 service, Dockerfile, and run instructions.
- [`stage-2/`](stage-2/) contains an independently buildable Stage 2 service, local browser assets, Dockerfile, and run instructions. It builds on Stage 1 with available/held balances, authorizations, expiry, and captures.
- [`mandates/`](mandates/) preserves the original mandates and contains the active replacement review mandates `pf3-verifier-codex.md` and `pf3-auditor-claude.md`.
- [`room.json`](room.json) is a separately managed room-log artifact. [`FACTORY.md`](FACTORY.md) records the last verified export; the owner handles any fresh unchanged Band download and byte comparison in a later packaging step, outside this docs-only closeout.
- Root `server.js`, `Dockerfile`, and `RUN.md` preserve the original Stage 1 service files. The `stage-1/` copy is the packaged stage deliverable.

## Build and run

From `stage-1/` for Stage 1:

```sh
docker build -t pocketful-stage1 .
docker run --rm -p 8080:8080 -e PORT=8080 pocketful-stage1
```

The service listens on `0.0.0.0:8080`; use `GET /health` for readiness. See [`stage-1/RUN.md`](stage-1/RUN.md) for the same commands.

For the Stage 2 service, run the corresponding commands from `stage-2/` and use the `pocketful-stage2` image tag. See [`stage-2/RUN.md`](stage-2/RUN.md).
