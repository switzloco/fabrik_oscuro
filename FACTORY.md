# Factory record

## Seats and setup

The room seats are Nick Switzer (human owner), `nicholas.switzer/next-architect` (Architect), `nicholas.switzer/next-builder` (Builder), `nicholas.switzer/next-verifier` (Verifier), and `nicholas.switzer/next-spec-auditor` (Spec Auditor). The original seat mandates remain in `mandates/`; this repository also carries the exact packaging-provided mandate copies `pf3-verifier-codex.md` and `pf3-auditor-claude.md`.

The service uses Node.js 24 on Alpine Linux and Node's built-in HTTP and crypto modules. Runtime operation needs no external service or package install. Build the deliverable from `stage-1/` with Docker; the shipped `RUN.md` contains the complete build and start commands.

## Design choices

- State is held in process memory, matching the specification's allowance that state need not survive a container restart.
- Passwords use Node's `crypto.scrypt`; seed passwords are hashed when the reset fixture is loaded.
- Idempotency records retain the parsed request body and original response. Canonical comparison sorts object keys so JSON key order and whitespace do not change replay identity.
- A settlement calculates each wallet's net delta before applying any balance changes, so intermediate transfer ordering cannot make a wallet transiently negative.
- IDs use a prefix and a UUID; response timestamps use UTC RFC 3339 timestamps.

## Costs, time, and failure handling

No paid fallback, extra provider, purchase, or top-up was used. No per-seat cost accounting or reliable end-to-end elapsed-time measurement was captured, so this record makes no numeric cost or duration claim. Docker image builds completed successfully during Stage 1 implementation and packaging.

Checks run by the Builder included JavaScript syntax validation, `git diff --check`, Docker image builds, and local HTTP smoke requests for health, reset, seeded-password login, payment, idempotent replay with reordered JSON keys, export/import, and login after import. A final rebuilt-image HTTP run was not completed because the Docker-run approval was rejected. This is a recorded verification limit, not a claimed passing container runtime test.

The private task CLI and participant refresh returned `daemon unavailable` with Windows `Access is denied`. Band's room artifact catalogue returned `local_complete` with no files, and the available computer-use inventory exposed no browser or app session. Therefore the authentic full-session `room.json` could not be downloaded. No room history was synthesized or partially written; obtain the full download from Band before treating this repository as packaging-complete.
