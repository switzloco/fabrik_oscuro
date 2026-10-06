# Pocketful: 3 Stages, 188 Checks Passed

This submission contains the completed Stage 1, Stage 2 and Stage 3 services. Stage 4 is incomplete and excluded.

- Stage 1: 147/147 official isolated harness checks passed.
- Stage 2: 35/35 official isolated harness checks passed.
- Stage 3: 6/6 shipped isolated harness checks passed, with Stages 1 and 2 re-passing cumulatively in the same runs.
- Stage 1–2 service revision: 02d0b12a0cb55468540a0a2ff63ee78297a23756; reviewed package e17618e2d0c82e5a8b7cbfa8f712ad2c5a577131.
- Stage 3 service revision: 22cab66916735c3320b227b6ecd1b1d1bdc90cb2, approved by both the Verifier (pf3-verifier-codex) and the Spec Auditor (pf3-auditor-claude) after three earlier review findings were repaired.
- Stage 1 and Stage 2 trees are byte-identical to the reviewed package. Publication commits preserve the full result history.

See `evidence/isolated-harness-report.json`, `evidence/stage3-isolated-harness-report-host.json`, `evidence/stage3-isolated-harness-report-verifier.json`, `evidence/stage3-spec-audit-22cab669.md`, `FACTORY.md`, `mandates/`, and the unchanged authentic `room.json`.

The presentation and video were recorded after Stage 2 and do not yet show Stage 3. The PDF presentation is `docs/Pocketful-presentation.pdf`. The combined video is `docs/Pocketful-demo.mp4`: 43 seconds of actual BAND room recording showing review approvals, followed by the silent caption-led presentation. Total duration is approximately 2 minutes 48 seconds.

## Disclosure

This was a supervised practice run with human execution approvals, host debugging and UI checks. We do not claim a fully autonomous judged run. Final reviews used existing included Codex and Claude allowances. Earlier paid OpenCode experimentation consumed money, while Go attempts encountered rolling quota limits. We did not capture reliable per-seat cost measurements.

Stage 4 was dispatched to the Builder at 22:51 UTC on October 5, but the Builder, Architect and Verifier Codex seats all hit their ChatGPT/Codex usage limit at 01:16 UTC on October 6 before any Stage 4 code was written. No Stage 4 work is claimed.

We ran out of time after three stages. With more time we would preflight every runtime and review lane, control context with scoped sessions and durable checkpoints, record a fresh autonomous run from the start, and extend through later stages one at a time.

An experimental Antigravity-to-BAND bridge was developed separately. It is not claimed as a contributing seat in the verified run.
