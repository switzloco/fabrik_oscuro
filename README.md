# Pocketful practice run

**Team:** Nick Switzer, with the `next-architect`, `next-builder`, `next-verifier`, and `next-spec-auditor` seats in the Band room.

**Track:** Pocketful.

This repository records the Stage 1 payments and settlements service. Stage 1 is packaged as a self-contained container service in [`stage-1/`](stage-1/). Stage 2 is intentionally absent while it remains gated on Stage 1 review.

## Repository map

- [`stage-1/`](stage-1/) contains the independently buildable Stage 1 service, Dockerfile, and run instructions.
- [`mandates/`](mandates/) preserves the original seat mandates and includes the Codex Verifier and Claude Spec Auditor mandate copies for this practice run.
- `room.json` is required to be the authentic full-session room download. It is not included because the Band room download was not available to this runtime; see [`FACTORY.md`](FACTORY.md).
- Root `server.js`, `Dockerfile`, and `RUN.md` preserve the original Stage 1 service files. The `stage-1/` copy is the packaged stage deliverable.

## Build and run

From `stage-1/`:

```sh
docker build -t pocketful-stage1 .
docker run --rm -p 8080:8080 -e PORT=8080 pocketful-stage1
```

The service listens on `0.0.0.0:8080`; use `GET /health` for readiness. See [`stage-1/RUN.md`](stage-1/RUN.md) for the same commands.
