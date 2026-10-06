Spec Auditor report — Stage 4 exact-SHA audit

Scope: exact revision `203e4480bbfcf05183f248ace764db3d45130028` only (clone `checks-pf3/clone-s4-203e448-host`). `git rev-parse HEAD` confirmed this SHA; `git status --short` confirmed a clean worktree before anything else was trusted. Findings/verdict below are bound solely to this SHA and do not transfer to any later commit. No acceptance-test or Builder-facing test source was read for this audit; only production source (`stage-4/server.js`, `stage-4/ledger.js`) was read, plus the spec itself (`pocketful/spec/stage-4.md`, 72 lines, read in full).

## Baseline preservation (confirmed)
`git diff 22cab66916735c3320b227b6ecd1b1d1bdc90cb2 HEAD --stat -- stage-1 stage-2 stage-3` is empty: `stage-1/`, `stage-2/` and `stage-3/` remain byte-identical to the already-approved Stage 3 baseline (`audit-s3-22cab669-report.md`, APPROVE). `stage-4/server.js` and `stage-4/ledger.js` are new files in this diff; everything below concerns only genuinely new code.

`ledger.js` stage-4 diff: `paymentRevisionList` (`ledger.js:36-41`) is the only changed function versus the approved Stage 3 copy — it now accepts `replacement` as either a single object or an array (`Array.isArray(replacement) ? replacement : (replacement ? [replacement] : [])`), purely additive, used by `correctionBatches` to trial multiple revisions at once. Every other `ledger.js` function is unchanged from the approved baseline.

`server.js` stage-4 diff against the Stage 3 baseline is additive only: `recordPaymentRevision`'s default-revision object gained `correction_batch_id:null` (`server.js:29`); `payment()` gained a trailing `refund_of=null` parameter threaded into the stored object (`server.js:32,34`); two new helpers `currentAmount`/`refundedAmount` (`server.js:36-37`); `paymentCorrection`'s immutability check extended with `||p.refund_of` and a new `refund_exceeds_payment` floor check (`server.js:101,106`); two new handler functions `paymentRefund` (`server.js:118-136`) and `correctionBatches` (`server.js:137-196`); `validateFixtureStage4`/`importValidateStage4` (`server.js:250-,315-`) defaulting the two new fields to `null`; two new routes (`server.js:353-354`); `refund_of:null` added to the `/payments`, `/requests/{id}/pay`, and `/settlements` response literals. No existing Stage 1-3 behavior for payments without refunds/corrections was altered.

## Requirement trace

### `POST /payments/{payment_id}/refunds`
Spec: *"`POST /payments/{payment_id}/refunds`, body `{"amount": 200}`, requires an idempotency key. Only the original receiver may refund, else 403 `forbidden`; unknown payment is 404."*
Code: `server.js:118-136` (`paymentRefund`) — `keyInfo` call at line 121 enforces the idempotency key; payment lookup (line 123) returns 404 `not_found` before the receiver check (line 124, `p.to_user_id!==user.id` → 403 `forbidden`), matching the established Stage 1-3 404-before-403 precedent.
Check: probe `probe-stage4-203e448-auditor.cjs` — non-receiver (b) refund on p1 → 403 `forbidden`; refund on unknown id → 404 `not_found`. Both passed.

Spec: *"The target may be a direct payment, request payment or capture, but never a refund... Refunds of refunds give 422 `invalid_refund_target`."*
Code: `server.js:125` — `if(p.refund_of)return error(res,422,'invalid_refund_target')`. No check on `settlement_id`/`authorization_id`/`request_id` of the target, so direct/request/capture/settlement payments are all valid targets; only an existing refund is rejected.
Check: probe — refund-of-refund (on rp1) → 422 `invalid_refund_target`. Passed.

Spec: *"Refunds cumulatively may not exceed the payment's current corrected amount: 422 `refund_exceeds_payment`."*
Code: `server.js:36-37,127-128` — `cap=currentAmount(p.payment_id)-refundedAmount(p.payment_id)`; `currentAmount` reads the latest revision's amount (reflecting corrections), `refundedAmount` sums existing refunds of that payment.
Check: probe — p1 current=300 (after correction to 150 is a different test; in the auditor probe p1 stays at 300), already refunded=100, cap=200; requesting 250 → 422 `refund_exceeds_payment`. Passed.

Spec: *"A refund is a new payment in the opposite direction, with `refund_of` naming the target, `request_id: null`, `authorization_id: null`, and the original note/visibility. Return 201 with that payment; replay returns 200 with the original body."*
Code: `server.js:129-134` — `payment(from,to,b.amount,p.note,p.visibility,null,null,now(),null,p.payment_id)` passes `request_id=null`, `settlement_id=null`, `authorization_id=null`, `refund_of=p.payment_id`, and reuses `p.note`/`p.visibility`; `from`/`to` are swapped (the original receiver is now `from`). `k.save(out)` (line 134) registers the idempotency record for replay.
Check: probe — refund response verified for `refund_of`, `request_id:null`, `authorization_id:null`, `settlement_id:null`, `note`, `visibility`, swapped `from_user_id`/`to_user_id`, correct `amount`; replay with the same key+body → 200 `deepEqual` to the original. Passed.

Spec: *"It moves existing money from the receiver's available funds, or fails 409 `insufficient_funds`, atomically."*
Code: `server.js:130-131` — `if(availableFor(from)<b.amount)return error(res,409,'insufficient_funds')`, checked before `payment()` mutates any balance; `payment()` itself (`server.js:32-35`) debits/credits synchronously with no intervening `await`.
Check: probe — p2 (a→c 5000), c drains to d leaving low available balance, c attempts to refund p2 for 5000 (within cap but exceeds available) → 409 `insufficient_funds`. Passed.

Spec: *"Refunds never reopen a request or authorization or restore a released hold. Other payments have `refund_of: null`."*
Code: `paymentRefund` never touches `state.requests` or `state.authorizations`; `payment()`'s `refund_of` parameter defaults to `null` (`server.js:32`) for every other call site (`/payments`, `/requests/{id}/pay`, `/settlements`), and those three response literals explicitly carry `refund_of:null` in their JSON output. The `/authorizations/{id}/capture` response (unchanged code, inherited from Stage 3) builds its output via `receipt(p,user)` (`server.js:35` factory + object-spread), which automatically carries the payment object's `refund_of` field without a dedicated edit — traced and confirmed by reading `receipt()`'s `{...p,...}` spread.
Check: probe — d requests 40 from a, a pays, d refunds 40 → 201, original request not reopened (verified via conditional GET). Passed.

### Stage-3 correction extensions
Spec: *"Captures and refund payments cannot themselves be corrected: 422 `linked_payment_immutable`."*
Code: `server.js:101` — `if(p.settlement_id||p.authorization_id||p.refund_of)return error(res,422,'linked_payment_immutable')`. Note: this line also blocks correcting settlement members via the single-payment correction endpoint, which is consistent with corrections on settlement members being routed exclusively through `/correction-batches` per the batch section of the spec.
Check: probe — correction attempt on the refund payment itself (rp1) → 422 `linked_payment_immutable`. Passed.

Spec: *"A correction cannot reduce a payment below its already-refunded amount: 422 `refund_exceeds_payment`. Correction debits are checked against available funds."*
Code: `server.js:106` (floor check) and `server.js:108-109` (`if(delta>0&&availableFor(from)<delta||delta<0&&availableFor(to)<-delta)return error(res,409,'insufficient_funds')`).
Check: probe — correction on p1 (by sender b) attempting to reduce below the refunded floor (50 < refunded 100) → 422 `refund_exceeds_payment`. Passed.

### `POST /correction-batches`
Spec: *"requires a settlement operator and an idempotency key, with the same 401/403 rules as settlements."*
Code: `server.js:141-142` — `keyInfo` first, then `if(!state.operators.includes(user.id))return error(res,403,'forbidden')`.
Check: probe — non-operator (b) POST `/correction-batches` → 403 `forbidden`. Passed.

Spec: *"corrections contains 1..32 objects with distinct payment_ids, else 422 `validation_failed`."*
Code: `server.js:143-145` — length bound `1..32`, and `new Set(ids).size!==ids.length` for distinctness.
Check: probe — batch with duplicate `payment_id`s → 422 `validation_failed`; empty `corrections` array → 422 `validation_failed`. Passed.

Spec: *"Every item has the ordinary correction fields and validation. Unknown payment is 404; a stale expected revision is 409 `stale_revision`. The operator may correct ordinary, request and settlement payments, but captures and refunds remain immutable."*
Code: `server.js:147-158` (per-item loop, in input order) — field presence/type/range checks (line 151-152) mirror `paymentCorrection`'s own validation; `linked_payment_immutable` check is `p.authorization_id||p.refund_of` (line 150, deliberately omitting `p.settlement_id` so settlement members remain correctable here); 404 (line 149) before stale-revision 409 (line 155).
Check: probe — batch including the immutable refund payment (rp1) alongside a valid settlement item → 422 `linked_payment_immutable`; stale-revision retry (`expected_revision:1` after a prior bump to revision 2) → 409 `stale_revision`. Passed.

Spec: *"Correcting any settlement member requires including every member of that settlement, else 422 `incomplete_settlement`. Members of one settlement must have identical effective instants (offset spellings may differ), else 422 `validation_failed`."*
Code: `server.js:159-170` — groups items by `settlement_id`, checks every live member of that settlement is present in the submitted `ids` (line 167), then checks all submitted members of that settlement share one effective instant via `ledger.compareInstant` (line 168-169, which is offset-spelling-tolerant per `ledger.js:22-32`).
Check: probe — batch-correcting only m1 of a two-member settlement → 422 `incomplete_settlement`; batch-correcting both m1+m2 with mismatched `effective_at` → 422 `validation_failed`. Passed.

Spec: *"Error precedence is: item errors in input order, settlement completeness, resulting current available funds, then historical total and available funds at every effective/event boundary... Affordability is determined by the combined effect of all proposed revisions. A rejected batch leaves history, balances and idempotency records unchanged."*
Code: `server.js:147-184` is a single straight-line sequence in exactly this order — item-errors loop (147-158) → settlement completeness/instant-match (159-170) → combined-delta current-available-funds check (171-181) → `ledger.historicalSafe(state,recorded_at,trial)` (184) where `trial` (line 183) is the full array of all proposed revisions, passed to `ledger.js:36-41`'s array-aware `paymentRevisionList` so every historical boundary is evaluated against the *combined* effect of the whole batch, not one item at a time. No state mutation occurs before line 184; every `return error(...)` before that point leaves `state.payments`, `state.payment_revisions`, and `state.idempotency` untouched (the `keyInfo` idempotency record is only written via `k.save(out)` at line 195, after success, so a rejected batch never writes one either).
Check: new probe `probe-stage4-203e448-overdraft.cjs` — constructed a case where reducing an early payment overdraws a user only at an intermediate historical boundary (not at "now", which stays non-negative because a later payment restores the balance), isolating the `historicalSafe` check from the "resulting current available funds" check: batch → 409 `historical_overdraft`. Confirmed via `/_test/export` that the target payment's amount and revision count were unchanged after the rejection (atomicity). Confirmed the same idempotency key, retried with a valid correction, succeeded with 201 (proving the 409 did not poison or consume the idempotency key). All assertions passed; console: `"Stage 4 historical_overdraft probe passed..."`.

Spec: *"Return 201 with `correction_batch_id`, `recorded_at` and `revisions` in input order. All new revisions share recorded_at, strictly later than the previous recorded_at of every member; each revision also exposes correction_batch_id."*
Code: `server.js:182` — `recorded_at=rfcNowAfter(state.last_recorded_at||...)`, computed once and reused for every revision in the loop at 186-192 (shared `recorded_at`); `rfcNowAfter` (`server.js:~76-82`, unchanged from Stage 3) guarantees strict monotonicity against the global `state.last_recorded_at`, which `recordPaymentRevision` (line 31) and this handler (line 193) both keep updated on every write path, so it is strictly later than every member's *own* previous `recorded_at` as well as every other payment's. `items` (built at line 146-158, pushed in the `for(const c of b.corrections)` input order) drives `revisionsOut` in the same order (line 186-192). Each `revision` carries `correction_batch_id` (line 189, 191).
Check: probe — happy-path batch correcting m1 and m2 together → 201; `revisions` length 2, in input order (m1 then m2), shared `recorded_at` across both, matching `correction_batch_id` on both entries, correct new amounts. Passed.

Spec: *"Effective times cannot be later than now. Original payments and receipts never change... Replays return the original batch response with 200. This adds one idempotent write path."*
Code: `server.js:152` — `ledger.compareInstant(c.effective_at,requestStartedAt)>0` rejects future-dated `effective_at` with `validation_failed`. `state.payments` array entries are never mutated by `correctionBatches` (only `state.payment_revisions[...]` gains an appended entry, line 190); the original payment object and its first receipt are untouched. `keyInfo`/`k.save` (lines 141, 195) provide the replay-200 idempotent write path — the 10th counted in the spec's write-path tally (5 from Stage 1-2 + settlements/correction from Stage 3 + refund + correction-batch here; arithmetic: Stage 1-3 baseline already accounted for 8 idempotent write paths per the Stage 3 audit, `+1` for `/payments/{id}/refunds` and `+1` for `/correction-batches` = 10).
Check: probe — replay of the same successful batch (same idempotency key) → 200, `deepEqual` to the original batch response. Passed.

Spec: *"A settlement payment may be refunded under the existing refund rules, but refunds never change settlement membership."*
Code: `paymentRefund` (`server.js:118-136`) never reads or writes `settlement_id` on the target payment, and the new refund payment it creates always has `settlement_id:null` (line 133) — it is never added to `state.settlements` or to any existing settlement's membership.
Check: probe's settlement correction tests confirm `/settlements`-created payments retain exactly their original two members after an unrelated refund elsewhere; not separately re-tested with a direct settlement-member refund in this round, since the code path is identical to any other refund target (no `settlement_id` branch exists to diverge). Traced, not independently re-exercised as a distinct HTTP call — noted for completeness, non-blocking.

Spec: *"Concurrent corrections sharing any expected payment revision cannot both succeed."*
Code: in `paymentCorrection`, `paymentRefund`, and `correctionBatches`, the only `await` is the initial `readBody(req)` call; every check-then-commit step afterward (stale-revision compare, affordability checks, `historicalSafe`, and the actual mutation) is synchronous with no intervening `await`. Node's single-threaded event loop therefore cannot interleave two requests' synchronous sections — whichever request's synchronous block runs first will observe and bump the live `current.revision`/`state.payment_revisions[...]` before the second request's `c.expected_revision!==current.revision` check (line 155, or `paymentCorrection`'s equivalent) runs, which then sees the now-stale revision and gets 409 `stale_revision`.
Check: not independently exercised with a true concurrent-request race in this round (would require deliberately racing two `fetch()` calls and asserting exactly one succeeds); relying on the synchronous-execution argument plus direct code reading, consistent with the same argument accepted for the Stage 3 audit's analogous settlement-concurrency requirement. Flagged here as a traced-but-not-executed check, non-blocking given the structural guarantee is unambiguous from the code shape itself.

Spec: *"A stage-4 service must accept exports produced by the same team's stages 1–3, retaining settlement membership, corrections and snapshots."*
Code: `validateFixtureStage4`/`importValidateStage4` (`server.js:250-,315-`) wrap the Stage 3 validators and default `refund_of`/`correction_batch_id` to `null` when absent (lines 252-253, 318-319, 323-324), validating referential integrity (`refund_of` must name an existing payment) only when present.
Check: new probe `probe-stage4-203e448-import.cjs` — created an ordinary payment with a correction (2 revisions), a 2-member settlement, and a statement snapshot on the approved Stage 3 clone; exported via `GET /_test/export`; imported into the Stage 4 candidate via `POST /_test/import` → 204; re-exported from Stage 4 and verified: original payment amount preserved, correction history preserved (2 revisions, correct amount), both revisions' `correction_batch_id` defaulted to `null`, both settlement member payments still carry the original `settlement_id` (membership intact), the statement snapshot token still resolves via `GET /statement?snapshot=...` → 200. All assertions passed; console: `"Stage 4 import-preservation probe passed..."`.

## Ambiguity flagged for the Architect (non-blocking)
The spec's refund-target sentence — *"The target may be a direct payment, request payment or capture, but never a refund"* (stage-4.md, refunds section) — does not explicitly list "settlement payment" as an allowed refund target, yet the spec's closing paragraph states *"A settlement payment may be refunded under the existing refund rules."* The code (`server.js:125`) implements the more specific, later clarifying sentence — it blocks only `p.refund_of` (an existing refund), never `p.settlement_id` — which is the reading consistent with the explicit final clarification and contradicts no stated prohibition. I am not resolving this unilaterally; flagging the phrasing gap itself for the Architect to tighten in the spec text. It does not block sign-off: the implemented behavior matches the spec's own explicit, unambiguous final statement on the matter.

## Not independently exercised this round
- Static assets (`app.js`, `index.html`, `styles.css`, `Dockerfile`) were not read this round, consistent with the lower-priority treatment established in prior stage audits (no spec requirement in `stage-4.md` references client-side behavior).
- True concurrent-request race and settlement-member-refund-membership checks were traced via code reading and the single-threaded execution argument but not re-exercised as dedicated new HTTP probes this round (see notes above).

## Checks run this round (all passed)
- `probe-stage4-203e448-auditor.cjs` — refund creation/validation/cap/replay, correction-batch validation/settlement-completeness/happy-path/replay/stale-revision-after-success.
- `probe-stage4-203e448-overdraft.cjs` (new) — `historical_overdraft` 409 on a purely-historical dip, atomicity of the rejection, idempotency-key reusability after rejection.
- `probe-stage4-203e448-import.cjs` (new) — Stage 1-3 export accepted by Stage 4, settlement membership/corrections/snapshots retained, new fields defaulted to `null`.

VERDICT: APPROVE — 203e4480bbfcf05183f248ace764db3d45130028
