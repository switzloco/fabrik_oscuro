# Factory record

## Seats and setup

The refreshed room roster contains Nick Switzer (member), `nicholas.switzer/next-architect` (room owner and Architect), `nicholas.switzer/next-builder` (Builder), `nicholas.switzer/pf3-verifier-codex` (active Verifier), and `nicholas.switzer/pf3-auditor-claude` (active Spec Auditor). It also still contains `nicholas.switzer/next-verifier` and `nicholas.switzer/next-spec-auditor`; their original mandates are preserved in `mandates/` as historical records, not active approval authorities. The replacement mandates are `pf3-verifier-codex.md` (Harness: Codex; Model: gpt-6-luna) and `pf3-auditor-claude.md` (Harness: Claude Code; Model: claude-sonnet-5). They remain unchanged from the Architect-provided mandate drafts.

The services use Node.js 24 on Alpine Linux and Node's built-in HTTP and crypto modules. Runtime operation needs no external service or package install. `stage-1/` is the approved Stage 1 service; `stage-2/` carries it forward with static, locally served HTML, CSS and JavaScript plus payment authorizations and captures. The Stage 2 service milestone is complete at exact revision `02d0b12a0cb55468540a0a2ff63ee78297a23756`, approved by both active independent reviewers: `pf3-verifier-codex` (Codex, gpt-6-luna) and `pf3-auditor-claude` (Claude Code, claude-sonnet-5). This practice run used only the configured included Codex/Claude allowance; there were no purchases, top-ups, paid fallback, OpenCode Zen, or provider substitutions. Build either deliverable from its stage folder with Docker; each `RUN.md` contains complete build and start commands.

## Design choices

- State is held in process memory, matching the specification's allowance that state need not survive a container restart.
- Passwords use Node's `crypto.scrypt`; seed passwords are hashed when the reset fixture is loaded.
- Idempotency records retain the parsed request body and original response. Canonical comparison sorts object keys so JSON key order and whitespace do not change replay identity.
- A settlement calculates each wallet's net delta before applying any balance changes, so intermediate transfer ordering cannot make a wallet transiently negative.
- IDs use a prefix and a UUID; response timestamps use UTC RFC 3339 timestamps.
- Stage 2 derives available funds from wallet totals minus unexpired open authorization holds. Captures transfer only reserved funds, and each API write remains synchronous in the Node request handler so concurrent operations are serialized.
- The Stage 2 browser assets are packaged in the image and use system fonts; the running UI has no external asset dependency. Available funds are the primary wallet value, with total and held amounts secondary.

## Measurements, verification, and failure handling

No paid fallback, extra provider, purchase, or top-up was used. No per-seat cost accounting or reliable end-to-end elapsed-time measurement was captured, so this record makes no numeric cost or duration claim. Docker image builds completed successfully during Stage 1 implementation and packaging.

### Final service evidence

- Both independent reviewers approved the exact Stage 2 service revision `02d0b12a0cb55468540a0a2ff63ee78297a23756`: the Verifier (`pf3-verifier-codex`, Codex/gpt-6-luna) and Spec Auditor (`pf3-auditor-claude`, Claude Code/claude-sonnet-5). Stage 1 and Stage 2 source folders are unchanged from that service revision in this documentation closeout.
- A fresh clean clone at that exact revision is recorded at `checks-pf3/clone-s2-02d0b12-host/`. The offline isolated harness report is `checks-pf3/s2-host-02d0b12-20261004/report.json`: completed, exit 0, claimed Stage 2; Stage 1 passed 147/147 and Stage 2 passed 35/35, with zero failed, errors, or skipped checks in either stage. The recorded run used `python -m harness run --track pocketful --repo /mnt/c/dev/darkfactory/band-work-next/checks-pf3/clone-s2-02d0b12-host --stage 2 --mode isolated --out /mnt/c/dev/darkfactory/band-work-next/checks-pf3/s2-host-02d0b12-20261004` from the harness repository's configured virtual environment.
- The owner performed the host UI review and captured desktop and 375 CSS-pixel screenshots in `checks-pf3/ui-02d0b12/`, including home, authorizations, requests, split, refused-payment, and successful-payment flows. The screenshots were independently inspected; the mobile authorization image shows all four navigation labels fully visible, readable localized expiry context beside the exact RFC 3339 timestamp, and no clipped navigation label. The desktop authorization and home screenshots show the unchanged wide layout.
- Stage 2 Builder checks also included JavaScript syntax validation, successful Docker image builds, and local HTTP checks for seeded holds, atomicity, idempotency, captures, privacy, concurrent same-key authorizations, HTML/API negotiation, expiry, import atomicity, and Stage 1 export compatibility.

### Earlier findings retained as history

Earlier provisional and candidate checks were not all passing: an initial builder run was incomplete, one host snapshot showed 24/35, and the `fde7114` candidate report finalized at 26/35. Those results are historical and are superseded by the completed exact-revision report above. Review findings were resolved in later commits, including capture lookup/key precedence, customer-facing insufficient-funds wording, expiry presentation, and the mobile navigation clipping found in the earlier `bced02c` screenshot. A Builder-runtime browser attempt failed because no local browser surface was available; an elevated Edge attempt was rejected. The owner subsequently completed the host visual check for `02d0b12` and supplied independent screenshots. No unresolved Stage 2 service findings are being claimed here.

The service milestone is complete, but this documentation commit is a new packaging revision: both reviewers must confirm the exact final packaging SHA before packaging closeout. The existing authentic `room.json` remains unchanged in this docs-only commit; the owner will provide a fresh unchanged full-session export in a later packaging step. This record does not claim hands-off submission eligibility. No numeric per-seat cost or elapsed-time measurement was captured, so none is claimed.

### Previously verified room export (historical record)

The previously verified full-session Band download identified room `382cec89-d708-4e9f-a7ef-894206f94bfc`, scope `full`, export time `2026-10-04T23:31:28.464Z`, and 1,200 messages. That download was 2,081,241 bytes with SHA-256 `FE55F967F465A837C89FD6F5F754C8C15FC6536F05678B189B819B67FFDAEE80`, matching the source that was supplied at that time. These values describe the last verified export and are retained as history; they do not assert that a later owner-managed `room.json` refresh has the same hash. A fresh unchanged full-session download and source/destination comparison are a separate packaging step owned by the Architect. This docs-only update does not modify or stage `room.json`.
