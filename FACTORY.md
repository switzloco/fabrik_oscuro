# Factory record

## Seats and setup

The refreshed room roster contains Nick Switzer (member), `nicholas.switzer/next-architect` (room owner and Architect), `nicholas.switzer/next-builder` (Builder), `nicholas.switzer/pf3-verifier-codex` (active Verifier), and `nicholas.switzer/pf3-auditor-claude` (active Spec Auditor). It also still contains `nicholas.switzer/next-verifier` and `nicholas.switzer/next-spec-auditor`; their original mandates are preserved in `mandates/` as historical records, not active approval authorities. The replacement mandates are `pf3-verifier-codex.md` (Harness: Codex; Model: gpt-6-luna) and `pf3-auditor-claude.md` (Harness: Claude Code; Model: claude-sonnet-5). They remain unchanged from the Architect-provided mandate drafts.

The services use Node.js 24 on Alpine Linux and Node's built-in HTTP and crypto modules. Runtime operation needs no external service or package install. `stage-1/` is the approved Stage 1 service; `stage-2/` carries it forward with static, locally served HTML, CSS and JavaScript plus payment authorizations and captures. The Stage 2 candidate is awaiting fresh independent review. Build either deliverable from its stage folder with Docker; each `RUN.md` contains complete build and start commands.

## Design choices

- State is held in process memory, matching the specification's allowance that state need not survive a container restart.
- Passwords use Node's `crypto.scrypt`; seed passwords are hashed when the reset fixture is loaded.
- Idempotency records retain the parsed request body and original response. Canonical comparison sorts object keys so JSON key order and whitespace do not change replay identity.
- A settlement calculates each wallet's net delta before applying any balance changes, so intermediate transfer ordering cannot make a wallet transiently negative.
- IDs use a prefix and a UUID; response timestamps use UTC RFC 3339 timestamps.
- Stage 2 derives available funds from wallet totals minus unexpired open authorization holds. Captures transfer only reserved funds, and each API write remains synchronous in the Node request handler so concurrent operations are serialized.
- The Stage 2 browser assets are packaged in the image and use system fonts; the running UI has no external asset dependency. Available funds are the primary wallet value, with total and held amounts secondary.

## Costs, time, and failure handling

No paid fallback, extra provider, purchase, or top-up was used. No per-seat cost accounting or reliable end-to-end elapsed-time measurement was captured, so this record makes no numeric cost or duration claim. Docker image builds completed successfully during Stage 1 implementation and packaging.

Stage 2 Builder checks included JavaScript syntax validation, a successful `docker build -t pocketful-stage2 .`, and local HTTP smoke requests covering seeded holds and available balances, insufficient-funds atomicity, authorization idempotency with canonical JSON bodies, partial and final captures, capture replay, privacy-filtered activity, concurrent same-key authorizations, HTML/API route negotiation, expired authorization behavior, invalid-import atomicity, and importing a Stage 1 export while retaining its bearer token. These are implementation checks, not independent approval. The shipped isolated harness run completed Stage 1 at 147/147, but reported Stage 2 as `error` and did not finalize a report; Stage 2 is not claimed to pass. A browser surface was unavailable in the Builder runtime, so direct visual inspection at 375px and desktop widths remains for the independent reviewer. No numeric per-seat cost or elapsed-time measurement was captured, so none is claimed.

The authentic full-session export is now present as root `room.json`. The supplied Band download identifies room `382cec89-d708-4e9f-a7ef-894206f94bfc`, has scope `full`, export time `2026-10-04T23:31:28.464Z`, and contains 1,200 messages. It is 2,081,241 bytes with SHA-256 `FE55F967F465A837C89FD6F5F754C8C15FC6536F05678B189B819B67FFDAEE80`, matching the supplied source file. It was copied without editing or normalization.
