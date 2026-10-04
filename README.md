# Pocketful practice run

**Team:** Nick Switzer and the active Band seats `nicholas.switzer/next-architect`, `nicholas.switzer/next-builder`, `nicholas.switzer/pf3-verifier-codex`, and `nicholas.switzer/pf3-auditor-claude`.

The current review authorities are `pf3-verifier-codex` (Codex, gpt-6-luna) and `pf3-auditor-claude` (Claude Code, claude-sonnet-5). The earlier `next-verifier` and `next-spec-auditor` seats and their original mandates remain preserved in the room/repository as historical records; they are not active approval authorities for this practice.

**Track:** Pocketful.

This repository records the Stage 1 payments and settlements service. Stage 1 is packaged as a self-contained container service in [`stage-1/`](stage-1/). Stage 2 is intentionally absent while it remains gated on Stage 1 review.

## Repository map

- [`stage-1/`](stage-1/) contains the independently buildable Stage 1 service, Dockerfile, and run instructions.
- [`mandates/`](mandates/) preserves the original mandates and contains the active replacement review mandates `pf3-verifier-codex.md` and `pf3-auditor-claude.md`.
- [`room.json`](room.json) is the authentic, full-session Band export for this room. Its export metadata and unchanged source hash are recorded in [`FACTORY.md`](FACTORY.md).
- Root `server.js`, `Dockerfile`, and `RUN.md` preserve the original Stage 1 service files. The `stage-1/` copy is the packaged stage deliverable.

## Build and run

From `stage-1/`:

```sh
docker build -t pocketful-stage1 .
docker run --rm -p 8080:8080 -e PORT=8080 pocketful-stage1
```

The service listens on `0.0.0.0:8080`; use `GET /health` for readiness. See [`stage-1/RUN.md`](stage-1/RUN.md) for the same commands.
