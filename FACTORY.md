# Factory record

## Seats and setup

The refreshed room roster contains Nick Switzer (member), `nicholas.switzer/next-architect` (room owner and Architect), `nicholas.switzer/next-builder` (Builder), `nicholas.switzer/pf3-verifier-codex` (active Verifier), and `nicholas.switzer/pf3-auditor-claude` (active Spec Auditor). It also still contains `nicholas.switzer/next-verifier` and `nicholas.switzer/next-spec-auditor`; their original mandates are preserved in `mandates/` as historical records, not active approval authorities. The replacement mandates are `pf3-verifier-codex.md` (Harness: Codex; Model: gpt-6-luna) and `pf3-auditor-claude.md` (Harness: Claude Code; Model: claude-sonnet-5). They remain unchanged from the Architect-provided mandate drafts.

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

The authentic full-session export is now present as root `room.json`. The supplied Band download identifies room `382cec89-d708-4e9f-a7ef-894206f94bfc`, has scope `full`, export time `2026-10-04T23:31:28.464Z`, and contains 1,200 messages. It is 2,081,241 bytes with SHA-256 `FE55F967F465A837C89FD6F5F754C8C15FC6536F05678B189B819B67FFDAEE80`, matching the supplied source file. It was copied without editing or normalization.
