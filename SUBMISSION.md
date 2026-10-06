# Pocketful: 4 Stages, 193 Checks Passed

This submission contains the completed Stage 1, Stage 2, Stage 3 and Stage 4 services.

- Stage 1: 147/147 official isolated harness checks passed.
- Stage 2: 35/35 official isolated harness checks passed.
- Stage 3: 6/6 shipped isolated harness checks passed, with Stages 1 and 2 re-passing cumulatively in the same runs.
- Stage 1–2 service revision: 02d0b12a0cb55468540a0a2ff63ee78297a23756; reviewed package e17618e2d0c82e5a8b7cbfa8f712ad2c5a577131.
- Stage 3 service revision: 22cab66916735c3320b227b6ecd1b1d1bdc90cb2, approved by both the Verifier (pf3-verifier-codex) and the Spec Auditor (pf3-auditor-claude) after three earlier review findings were repaired.
- Stage 4: 5/5 shipped isolated harness checks passed, with Stages 1–3 re-passing cumulatively. Service revision 203e4480bbfcf05183f248ace764db3d45130028, approved by the Verifier (pf4-verifier-claude, 04:37 UTC) and the Spec Auditor (pf3-auditor-claude, 05:16 UTC).
- Stage 1 and Stage 2 trees are byte-identical to the reviewed package. Publication commits preserve the full result history.

See `evidence/stage4-isolated-harness-report-host.json`, `evidence/stage4-isolated-harness-report-verifier.json`, `evidence/stage4-spec-audit-203e448.md`, `evidence/isolated-harness-report.json`, `evidence/stage3-isolated-harness-report-host.json`, `evidence/stage3-isolated-harness-report-verifier.json`, `evidence/stage3-spec-audit-22cab669.md`, `FACTORY.md`, `mandates/`, and the unchanged authentic `room.json`.

The presentation and video were recorded after Stage 2 and do not yet show Stage 3. The PDF presentation is `docs/Pocketful-presentation.pdf`. The combined video is `docs/Pocketful-demo.mp4`: 43 seconds of actual BAND room recording showing review approvals, followed by the silent caption-led presentation. Total duration is approximately 2 minutes 48 seconds.

## Disclosure

This was a supervised practice run with human execution approvals, host debugging and UI checks. We do not claim a fully autonomous judged run. Final reviews used existing included Codex and Claude allowances. Earlier paid OpenCode experimentation consumed money, while Go attempts encountered rolling quota limits. We did not capture reliable per-seat cost measurements.

Claude seats were substituted for the Codex Builder and Verifier after all Codex seats (Builder, Architect, Verifier) hit their ChatGPT/Codex usage limit at 01:16 UTC on October 6, before any Stage 4 code existed. Nick approved the substitution directly in the room at 03:41 UTC. `pf4-builder-claude` (Claude Code, claude-sonnet-5) authored all Stage 4 code; `pf4-verifier-claude` (Claude Code, claude-sonnet-5) verified it and `pf3-auditor-claude` audited it. Stage 4 dispatch and review handoffs were posted under Nick's account by his Claude Code coordinator session.

We finished four stages with minutes to spare. With more time we would preflight every runtime and review lane, control context with scoped sessions and durable checkpoints, record a fresh autonomous run from the start, and extend through later stages one at a time.

An experimental Antigravity-to-BAND bridge was developed separately. It is not claimed as a contributing seat in the verified run.
