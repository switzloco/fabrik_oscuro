# Factory record

## Seats and setup

The final active approval authorities were the configured included Codex and Claude seats: Nick Switzer (member), `nicholas.switzer/next-architect` (room owner and Architect), `nicholas.switzer/next-builder` (Builder), `nicholas.switzer/pf3-verifier-codex` (Verifier), and `nicholas.switzer/pf3-auditor-claude` (Spec Auditor). The original Go reviewer assignments were replaced by these included Codex/Claude reviewers. The obsolete `next-verifier` briefly resumed and was then stopped; the old `next-verifier` and `next-spec-auditor` mandates remain preserved as history, not active approval authorities. The active mandates are `pf3-verifier-codex.md` (Harness: Codex; Model: gpt-6-luna) and `pf3-auditor-claude.md` (Harness: Claude Code; Model: claude-sonnet-5), unchanged from the Architect-provided drafts.

The services use Node.js 24 on Alpine Linux and Node's built-in HTTP and crypto modules. Runtime operation needs no external service or package install. `stage-1/` is the approved Stage 1 service; `stage-2/` carries it forward with static, locally served HTML, CSS and JavaScript plus payment authorizations and captures. The Stage 2 service milestone is complete at exact revision `02d0b12a0cb55468540a0a2ff63ee78297a23756`, approved by both active independent reviewers: `pf3-verifier-codex` (Codex, gpt-6-luna) and `pf3-auditor-claude` (Claude Code, claude-sonnet-5). These were the final active review authorities, after the historical seat transitions above. The no-spending mandate prohibited purchases, top-ups, paid fallback, and OpenCode Zen; none were authorized or used. Build either deliverable from its stage folder with Docker; each `RUN.md` contains complete build and start commands.

## Design choices

- State is held in process memory, matching the specification's allowance that state need not survive a container restart.
- Passwords use Node's `crypto.scrypt`; seed passwords are hashed when the reset fixture is loaded.
- Idempotency records retain the parsed request body and original response. Canonical comparison sorts object keys so JSON key order and whitespace do not change replay identity.
- A settlement calculates each wallet's net delta before applying any balance changes, so intermediate transfer ordering cannot make a wallet transiently negative.
- IDs use a prefix and a UUID; response timestamps use UTC RFC 3339 timestamps.
- Stage 2 derives available funds from wallet totals minus unexpired open authorization holds. Captures transfer only reserved funds, and each API write remains synchronous in the Node request handler so concurrent operations are serialized.
- The Stage 2 browser assets are packaged in the image and use system fonts; the running UI has no external asset dependency. Available funds are the primary wallet value, with total and held amounts secondary.

## Measurements, verification, and failure handling

No purchase, top-up, paid fallback, or OpenCode Zen use occurred. No per-seat cost accounting or reliable end-to-end elapsed-time measurement was captured, so this record makes no numeric cost or duration claim. Docker image builds completed successfully during Stage 1 implementation and packaging.

### Final service evidence

- Both independent reviewers approved the exact Stage 2 service revision `02d0b12a0cb55468540a0a2ff63ee78297a23756`: the Verifier (`pf3-verifier-codex`, Codex/gpt-6-luna) and Spec Auditor (`pf3-auditor-claude`, Claude Code/claude-sonnet-5). Stage 1 and Stage 2 source folders are unchanged from that service revision in this documentation closeout.
- The fresh clean-clone offline packaging check exited 0. The clone at `checks-pf3/clone-s2-02d0b12-host/` is pinned to service revision `02d0b12a0cb55468540a0a2ff63ee78297a23756` and has clean status. This packaging-check exit code is separate from the isolated runtime report below.
- The isolated runtime harness report is `checks-pf3/s2-host-02d0b12-20261004/report.json`: completed successfully with exit 0 and claimed Stage 2; Stage 1 passed 147/147 and Stage 2 passed 35/35, with zero failed, errors, or skipped checks in either stage. The recorded invocation was `python -m harness run --track pocketful --repo /mnt/c/dev/darkfactory/band-work-next/checks-pf3/clone-s2-02d0b12-host --stage 2 --mode isolated --out /mnt/c/dev/darkfactory/band-work-next/checks-pf3/s2-host-02d0b12-20261004` from the harness repository's configured virtual environment.
- The owner performed the host UI review and captured desktop and 375 CSS-pixel screenshots in `checks-pf3/ui-02d0b12/`, including home, authorizations, requests, split, refused-payment, and successful-payment flows. The screenshots were independently inspected; the mobile authorization image shows all four navigation labels fully visible, readable localized expiry context beside the exact RFC 3339 timestamp, and no clipped navigation label. The desktop authorization and home screenshots show the unchanged wide layout.
- Stage 2 Builder checks also included JavaScript syntax validation, successful Docker image builds, and local HTTP checks for seeded holds, atomicity, idempotency, captures, privacy, concurrent same-key authorizations, HTML/API negotiation, expiry, import atomicity, and Stage 1 export compatibility.

### Earlier findings retained as history

Earlier provisional and candidate checks were not all passing: an initial Builder run was incomplete, and the `fde7114` candidate report finalized at 26/35. These results are historical and are superseded by the completed exact-revision report above. Review findings were resolved in later commits, including capture lookup/key precedence, customer-facing insufficient-funds wording, expiry presentation, and mobile navigation clipping found in the earlier `bced02c` screenshot. A Builder-runtime browser attempt failed because no local browser surface was available; an elevated Edge attempt was rejected. The owner subsequently completed the host visual check for `02d0b12` and supplied independent screenshots. No unresolved Stage 2 service findings are being claimed here.

The service milestone is complete, but this documentation/export update is a new packaging revision: both reviewers must confirm the exact final packaging SHA before packaging closeout. The authentic `room.json` is included unchanged from its verified Band download. This record does not claim hands-off submission eligibility. No numeric per-seat cost or elapsed-time measurement was captured, so none is claimed.

### Verified room export and preserved earlier snapshot

The packaged `room.json` is the unchanged authentic Band full-session download for room `382cec89-d708-4e9f-a7ef-894206f94bfc`. Its export scope is `full`, `exportedAt` is `2026-10-05T02:37:42.070Z`, and it contains 7,238 messages. The file is 10,900,330 bytes with SHA-256 `A5DE2E189EA8F9D48C4367324BF37428F2373C4F8C9DEC56044EFC4CDFF7D665`; the source download at `C:\Users\Nick\Downloads\Oct-4-2026-12-15-56-AM (1).json` has the same byte length and hash. The export contains the final service-review messages `377d8844` and `12463b5a`, and Stage 2 completion `76ce481d`. It predates this packaging commit and subsequent final packaging confirmations; those later messages are not represented in this snapshot.

The earlier full-session export is preserved at `checks-pf3/room-before-final-20261004-233128.json`: 2,081,241 bytes, SHA-256 `FE55F967F465A837C89FD6F5F754C8C15FC6536F05678B189B819B67FFDAEE80`. Its metadata remains historical and is not attributed to the current `room.json`.
