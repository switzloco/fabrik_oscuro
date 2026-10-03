# Practice run: toy stage 1, direct routing and context caps (Oct 3)

This is the first run on the token-budget changes from the Oct 2 evening update in
[`next-steps.md`](next-steps.md): Builder → Verifier routing, a verification brief
once per milestone, task tools removed from the Claude Code seats, 150 k context caps,
and handoffs that name specification files instead of pasting them. The Architect and
Builder ran Sonnet 5 on Claude Code. The Verifier and Spec Auditor ran Kimi K3 on
OpenCode (Zen).

**Result: toy stage 1 complete at `049ac69` in 21 minutes, approved by both reviewers.**
The previous toy stage 1 took 29 minutes.

## Spend

| | Oct 2 toy stage 1 | This run |
|---|---:|---:|
| Claude (Architect + Builder) | 3.2 M | **6.3 M** (3.5 M + 2.8 M) |
| Kimi K3 on Zen | 1.25 M, $1.18 | ~2.0 M, ~$1.67 |
| Largest Claude context | — | 103 k |

The cap never triggered, because a toy stage is too small to test it. The extra Claude
spend came from chatter: the Architect took 47 calls, and 15 of them were `jam_no_reply`.

## What worked

- The Builder handed off straight to the Verifier, three minutes after it got the item.
- The Architect sent the Verifier one brief for the milestone.
- The task tools were refused in the Claude Code seats ("TaskCreate is disabled for this
  session"). The Architect tried seven of them once, in a single response, then stopped.
- An OpenCode seat honours a context limit set in the workspace's `opencode.json`.

## What broke, and the mandate change for each

1. **Acknowledgements.** The Verifier, the Builder and the Spec Auditor each mentioned the
   Architect to say "received". Only the Architect's mandate forbade that. Every mandate
   now does.
2. **Approvals sent to the Builder.** The Verifier sent "item verified" to the Builder.
   Its mandate now says an approval names the revision and never goes to the Builder.
3. **A stale revision.** The Builder pushed `049ac69` after the ambiguities were resolved,
   while the Architect was already approving `cc5c45d`. The seats sorted it out themselves
   in about five messages. The Architect now names only a revision from the latest
   verdict, and the Builder sends a superseding revision to the Verifier.
4. **The Auditor was briefed at the start**, not at the boundary. It is now briefed once the
   Verifier approves the milestone revision.
5. **A relay loop.** The release-check results went only to the Architect, so the Auditor
   kept asking for evidence it could not see. The Verifier now sends the release check to
   both.
6. **OpenCode seats still use Band's task tools.** The Claude-only flag does not reach
   them. Their mandates now forbid a private task list.

## Next

A pocketful stage is the real test of the caps, because the Oct 2 Builder passed 150 k
within its first hour.
