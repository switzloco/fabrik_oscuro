# Practice run — toy stage 1, non-Claude reviewers (Oct 2)

The first run with the Verifier and Spec Auditor off the Claude plan. Sonnet 5 Architect
and Builder on Claude Code; **Kimi K3 Verifier and Spec Auditor on OpenCode**, through
Band's `opencode` transport, billed per token from a $10 OpenCode Zen balance.

**Result: toy stage 1 complete at `0b75b23` in 29 minutes, approved by both reviewers.**
Checked afterwards on a fresh clone in isolated mode: 100% of its own suite.

## What it took to get OpenCode seats running

| Problem | Cause | Fix |
|---|---|---|
| ACP handshake timed out after 30 s | A custom `--spawn-command` drops Band's default arguments, so OpenCode opened its interactive screen | `--spawn-arg acp` |
| OpenCode Go models "not offered by this session" | OpenCode 2.0.21's ACP mode lists only the `opencode/` (Zen) provider, never `opencode-go/`, even with a Go model set as default in `opencode.json` | Use the same models through Zen, pay per token |
| Qwen 3.8 Max seat started its turn and never answered | Unknown | Spec Auditor on Kimi K3 too |

The launch script handles the first two: a practice model named `opencode/<id>` creates
an OpenCode seat with the right arguments.

## How the Kimi Verifier did

It did the whole job, unprompted: a fresh clone, `docker build --no-cache` and a second
build with `--network=none`, the acceptance tool run exactly as dispatched (8/8), and
spec-derived probes beyond it: malformed reset bodies, boundary values, unknown routes,
50 concurrent increments, behaviour after a restart, resource limits. Its verdict cited
the specification. It raised one non-blocking observation (a ~2 MB request body hangs
the connection). The Spec Auditor read the artifacts, diffed the commit, ran the service
and traced each requirement.

## Spend

| | Tokens | Cost |
|---|---:|---:|
| Claude (Architect + Builder, Sonnet 5) | 3.2 M | plan |
| OpenCode Zen (Verifier + Spec Auditor, Kimi K3) | 1.25 M | **$1.18** |

Rehearsal 2 used about 12 M Claude tokens a toy stage with all four seats on Claude.
Moving the two reviewers off Claude cut Claude usage by roughly three quarters.

## Findings

1. **A non-Claude Verifier works through Band.** This is also the strongest form of the
   factory's rule that the Verifier never runs the Builder's model: different vendor,
   different family.
2. **The Architect sent the stage to the Verifier and the Spec Auditor at the same time**
   (20 s apart), instead of auditing after the Verifier's approval. Harmless here; worth
   watching on a stage where the Verifier rejects.
3. **The Architect posted a final report this time**, addressed to the human.
4. **My dispatch carried the wrong track's spec paths** (a bad substitution), corrected
   with a second message. The submitted dispatch must be proofread before it is sent.

## Cost projection for pocketful

Pocketful stages ran 58–68 M tokens with all-Claude reviewers, the reviewers' share
roughly 25–40%. At Kimi's observed rate (~$0.95 per million tokens, mostly cached reads),
the two reviewers would cost very roughly **$10–25 per pocketful stage** on Zen. The $10
balance covers testing, not a submitted run. OpenCode Go, if its ACP mode ever exposes Go
models, or Codex, would avoid per-token billing.
