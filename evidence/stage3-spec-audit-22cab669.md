Spec Auditor report — Stage 3 exact-SHA audit (independent re-audit, no carryover assumed)

Scope: exact revision `22cab66916735c3320b227b6ecd1b1d1bdc90cb2` only (clone `checks-pf3/clone-s3-22cab669-host`). `git rev-parse HEAD` confirmed this SHA and `git status --short` confirmed a clean worktree before anything else was trusted. This report does not duplicate or infer a pass from the prior `audit-s3-9fef97b-report.md`; every finding below was re-derived from scratch by reading production source in this clone. No acceptance-test source was read for this audit.

## Baseline preservation (confirmed)
`git diff e17618e2d0c82e5a8b7cbfa8f712ad2c5a577131 HEAD --stat -- stage-1 stage-2` is empty: `stage-1/` and `stage-2/` remain byte-identical to the approved Stage 2 baseline in this candidate.

## Commit history since the previously-audited `9fef97b`
```
f473753 Implement Stage 3
9fef97b Document legacy void timestamp migration assumption   (prior audit target — REJECTED, 3 findings)
56d5494 Fix known-at visibility of authorization closures      (targets Finding 2)
bc3c3ce Preserve original amounts in opening balance fallback  (targets Finding 3)
22cab66 Restore resource-first capture idempotency checks      (targets Finding 1 — HEAD)
```

## Full fresh source read
Read `stage-3/ledger.js` in full (206 lines) and `stage-3/server.js` in full (287 lines) directly in this clone — production source, not tests — independent of the earlier 9fef97b review.

## Disposition of the three prior findings against this exact SHA

### Finding 1 — capture lookup/idempotency-key precedence — RESOLVED
Prior finding: Stage 3 had reordered the capture handler so a missing/invalid `Idempotency-Key` on an unknown `authorization_id` returned `400 missing_idempotency_key` instead of the Stage-2-approved `404 not_found`, reverting a precedence fix already approved in Stage 2 review, with nothing in the Stage 3 spec text calling for the change.

Current code, `stage-3/server.js:267-270`:
```
const captureMatch=path.match(/^\/authorizations\/([^/]+)\/capture$/);
if(req.method==='POST'&&captureMatch){let b;try{b=await readBody(req);}catch{return badBody(res);}if(!b||typeof b!=='object'||Array.isArray(b))return badBody(res);
 const a=state.authorizations.find(x=>x.authorization_id===captureMatch[1]);if(!a)return error(res,404,'not_found');
 const k=keyInfo(req,res,user,req.method,path,b);if(k.stop)return k.status?error(res,k.status,k.code):undefined;
```
Resource lookup (line 269) now precedes the idempotency-key check (line 270) again, matching the approved Stage 2 order. Independently verified this introduces no conflict with Stage 1 §7 ("an already-claimed key is resolved before... current-resource checks"): `keyInfo`'s `save()` (`server.js:25`, called only at the 8 success-path call sites, confirmed by `grep -n "\.save("`) is the only way an `idempotency` record is created, and the stored record's `path` is the literal request path, which for this endpoint embeds the specific `authorization_id` (`/authorizations/{id}/capture`). An "already-claimed key" row therefore can only exist for an `authorization_id` that has already produced at least one successful capture response — i.e. a resource that necessarily exists. "Already-claimed" and "resource 404" are mutually exclusive for this endpoint shape, so reordering the 404 check ahead of the key check changes no observable outcome for any reachable request. Resolved correctly, matches approved Stage 2 baseline byte-for-byte for this handler shape.

### Finding 2 — hold closure (void / final capture) not gated by `known_at` — RESOLVED
Prior finding: `closedAt` (shared by expiry, final capture, and void) was compared only against `asOf`, silently extending the spec's expiry-specific `known_at` exemption to void and final-capture closures too.

Current code, `stage-3/ledger.js:94` (`heldAt`) and `:120` (`heldBefore`):
```
if (closedAt && compareInstant(closedAt, asOf) <= 0 && compareInstant(closedAt, knownAt) <= 0) continue;
...
if (expiresAt && compareInstant(expiresAt, asOf) <= 0) continue;
```
```
if (auth.closed_at && compareInstant(auth.closed_at, at) < 0 && compareInstant(auth.closed_at, knownAt) <= 0) continue;
...
if (auth.expires_at && compareInstant(auth.expires_at, at) < 0) continue;
```
The fix adds the `knownAt` gate only to the shared `closedAt` early-exit, leaving the separate, pre-existing `expiresAt`-only early-exit on the next line untouched and ungated. Verified against three constructed scenarios (void, pure expiry, final capture) with `T0 < K < T1 < T2` (creation < known_at < event < asOf): void and final-capture closures at T1 are now correctly still reported as held when `asOf=T2` but `knownAt=K<T1`; a pure-expiry authorization with `expires_at=T1` is correctly still released at `asOf=T2` regardless of `knownAt`, since the independent, ungated `expiresAt` check still fires. The legacy-void-without-timestamp cutover comment (`ledger.js:88-90`) is unchanged by this fix and remains a pre-existing, already-documented assumption, not a new gap. Resolved correctly, with no regression to the expiry exemption.

### Finding 3 — `deriveOpeningBalances` using latest revision instead of original — RESOLVED
Prior finding: `deriveOpeningBalances` derived opening balances using the *latest* payment revision (`rs[rs.length-1]`) rather than the original (`revision 1`), contradicting "Opening balances equal seeded ending balances minus the net effect of **original** seeded payments. Corrections must not change those opening balances."

Current code, `stage-3/server.js:177-181`:
```
function deriveOpeningBalances(z){
 const opening=Object.fromEntries(z.users.map(u=>[u.id,u.balance]));
 for(const p of z.payments){opening[p.from_user_id]+=p.amount;opening[p.to_user_id]-=p.amount;}
 return opening;
}
```
Now uses `p.amount` (the base payment record's amount field) directly. Independently confirmed via `paymentCorrection()` (`server.js:92-114`) that `p.amount` is structurally immutable — corrections only ever push a new entry onto `state.payment_revisions[p.payment_id]` (line 111: `revisions.push(revision)`); nothing in the codebase ever writes back to `p.amount` on the base payment object. `p.amount` is therefore always equal to the revision-1/original amount, for every payment unconditionally — not just the previously-documented single-revision case. This closes the import-validator edge case described in the original finding (multi-revision `payment_revisions` supplied with `opening_balances` omitted) as well as the documented round-trip case. Resolved correctly and unconditionally.

## Remaining Stage 3 requirements re-traced fresh in this clone (pass)
All of the following were re-read directly in `clone-s3-22cab669-host` (not inferred from the prior audit):
- `GET /me` (`server.js:236-245`): `as_of`/`known_at` validated independently (422 `validation_failed` on invalid instant), each defaults independently to `requestStartedAt` when omitted ("Omission means everything known when the read begins"), echoed back only when explicitly supplied, `total`/`available`/`held` computed via `ledger.balanceAt`/`heldAt`, safe-integer guarded.
- `GET /statement` (`statementPage`, `server.js:68-83`): half-open `[from,to)` window via `ledger.statement`; `from` defaults to `null` (full opening balance, no lower exclusion); `to`/`known_at` default to `requestStartedAt`; `snapshot` query rejects any of `from`/`to`/`known_at` (422 `validation_failed`); unknown or another user's token is 404 `not_found` (snapshot lookup filters on `user_id===who.id`); every fresh (non-`snapshot`) call freezes a new deep-cloned snapshot (`clone(result)`) and returns a fresh token, so existing snapshots are provably unaffected by later payments/corrections; paging via `entries.slice(offset,offset+limit)` changes neither balances nor entries and `has_more` is computed correctly off the frozen `entries.length` for the snapshot path and the live `result.entries.length` for the fresh-query path.
- `POST /payments/{id}/corrections` (`paymentCorrection`, `server.js:92-114`): idempotency-key required first; sender-only 403; unknown-payment 404; `linked_payment_immutable` 422 for settlement/capture-linked payments; required-field and range validation (422); `stale_revision` 409 on `expected_revision` mismatch; `insufficient_funds` 409 checked via `availableFor`/`historicalSafe` before committing; `historical_overdraft` 409 via `ledger.historicalSafe` on a trial state, checked before mutating real balances; `recorded_at` generated via `rfcNowAfter(state.last_recorded_at||current.recorded_at)` — using the global `state.last_recorded_at` watermark (updated on every payment and every correction, `server.js:30,111`) is strictly stronger than, and therefore compliant with, the spec's per-payment "recorded times for one payment strictly increase" requirement, since a globally monotonic sequence is also monotonic per payment.
- `GET /payments/{id}/revisions` (`server.js:248`): 404 `not_found` for both unknown payment and non-party caller (sender/receiver only); returns the full revision list including synthetic revision 1 (`reason:""`).
- `known_at` revision selection: `ledger.selectedRevision`/`selectedPayments` pick the highest-`revision` row with `recorded_at<=knownAt`, consistently used by `balanceAt`, `balanceBefore`, `heldAt`/`heldBefore` (via shared `knownAt`), and `statement`.
- Settlement history (`server.js:283`): each transfer becomes a payment with `created_at=committed_at` (shared across all transfers in the settlement) and `recordPaymentRevision` seeds `effective_at=recorded_at=p.created_at` for the synthetic revision 1 — consistent with corrections being the only mechanism that ever adds revision >1.
- `linked_payment_immutable` (`server.js:99`): single guard `if(p.settlement_id||p.authorization_id)` covers both settlement members and captures.
- Import/export (`importValidateStage3`, `server.js:182-225`): accepts Stage 1/2 exports (via `importValidateStage2` first); synthesizes revision 1 for payments missing `payment_revisions`; validates revision chain order/shape, strictly increasing `recorded_at` within a payment's own revision list (line 195); re-derives `opening_balances` via the now-fixed `deriveOpeningBalances` when absent; re-derives legacy `closed_at` for expired/captured authorizations consistent with the live `validateFixtureStage3`/`refreshExpirations` logic, explicitly leaving void `closed_at` unset when absent (comment at line 211, matching the `ledger.js:88-90` legacy-void assumption); final `historicalSafe` gate on the resulting state before accepting the import.
- `/_test/reset` (`validateFixtureStage3`, `server.js:134-166`): rejects future `created_at` on seeded payments/authorizations relative to reset time; seeds `opening_balances`, `payment_revisions` (revision 1, `reason:""`), `statement_snapshots:[]`, `last_recorded_at:resetAt`; runs `historicalSafe` before accepting the fixture.

## Search for additional gaps introduced by the three fix commits
Re-examined all three diffs for second-order effects, not just the direct fix:
- Finding 1's reordering was checked against every other handler with the same `keyInfo`-then-resource-lookup shape (`/payments`, `/requests`, `/requests/{id}/pay|decline|cancel`, `/authorizations`, `/splits`, `/settlements`) — none of those were touched by this commit, and none share the capture endpoint's "already-claimed implies resource exists" property in a way that would be affected.
- Finding 2's `knownAt` gate was checked against both call sites (`heldAt` and `heldBefore`) — both were fixed identically, and the fix is scoped to the `closedAt` branch only, leaving the `expiresAt` branch in both functions untouched, so no new regression to expiry handling in either the "at" or "before" variant.
- Finding 3's fix was checked against every caller of `deriveOpeningBalances` (only `importValidateStage3`, one call site) and confirmed `p.amount` is never mutated anywhere else in `server.js`.
No new gaps were found. The rest of `server.js` and `ledger.js` is byte-identical to the already-reviewed `9fef97b` revision (only these three functions differ across the full diff range), so no other code path could have regressed.

## Not independently exercised
`stage-3/app.js`, `index.html`, `styles.css`, `Dockerfile`, `RUN.md` were not read this round (client-side/static assets, unchanged by any of the three fix commits, lower risk relative to ledger/server logic). Coordinator-reported harness run (147/147+35/35+6/6 passing, session 34647, now closed) was not used as a substitute for this source-level audit; this verdict rests solely on direct reading of production source against the verbatim spec text.

VERDICT: APPROVE — all three previously-identified deviations from `spec/stage-3.md` are confirmed fixed at exact SHA `22cab66916735c3320b227b6ecd1b1d1bdc90cb2`, each verified by direct code reading and concrete scenario tracing rather than by trusting the commit messages: (1) capture handler restores the Stage-2-approved resource-lookup-then-key order, proven equivalent-in-outcome to key-first for this endpoint; (2) `heldAt`/`heldBefore` now gate void/final-capture closure on `known_at` while correctly leaving the expiry exemption ungated; (3) `deriveOpeningBalances` now uses the structurally-immutable original payment amount unconditionally. A full fresh re-trace of the remaining Stage 3 requirements against the verbatim specification text found no additional gaps and no unrequested behavior change introduced by the three fix commits. This verdict is bound solely to SHA `22cab66916735c3320b227b6ecd1b1d1bdc90cb2` and does not transfer to any other revision.
