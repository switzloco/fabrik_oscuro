# OpenCode Status & Next Steps for Claude Code (Opus 5.5)

**Date:** 2026-10-02  
**Status:** All systems green. OpenCode is configured, authenticated, and verified.

---

## 1. OpenCode Environment Verification

* **Global Executable & Shims:**
  * Installed & verified at `opencode v2.0.21`.
  * Shims configured in `%APPDATA%\npm\` (`opencode`, `opencode.cmd`, `opencode.ps1`) and `%USERPROFILE%\.local\bin\opencode.exe`.
  * Desktop CLI at `%APPDATA%\ai.opencode.desktop\cli\2.0.21\opencode-cli.exe`.
* **Authentication:**
  * Stored credentials active (`OpenCode Console Personal`).
* **Available OpenCode Go Models:**
  * `opencode-go/kimi-k3` (Top choice for Verifier: strong coding & tool compliance)
  * `opencode-go/qwen3.8-max` (Excellent analytical and reasoning capability)
  * `opencode-go/glm-5.3` / `opencode-go/glm-5.3-flash`
  * `opencode-go/deepseek-v4-pro` / `opencode-go/deepseek-v4.1-flash`
* **Transport:**
  * Band ACP verified: `--transport opencode --spawn-arg acp`.

---

## 2. Token Runaway Findings & Solutions

* **Context Compaction:**
  * `compact_at_tokens` is **not** supported by the Claude Code driver in Band.
  * Claude Code lets sessions grow without capping. Thus, token optimization must be architectural.
* **Key Interventions:**
  1. **Disable Task Bookkeeping:** Disallow `TaskCreate`/`TaskUpdate` in `mandates/builder.md`. Saves ~105 calls (~42M tokens).
  2. **Direct Handoff Pipeline:** Builder hands off directly to Verifier; Verifier reports failures to Builder and sends `VERDICT: APPROVE` to Architect. Eliminates ~40 Architect relay wakes (~32M tokens).
  3. **Output Tailing:** Tail build/test commands (`| tail -n 25`) to prevent 767k characters of raw logs from staying in context.
  4. **Offload Verifier:** Running Verifier on `opencode-go/kimi-k3` takes 30-40% of run tokens off the Claude subscription plan entirely.

---

## 3. Recommended Factory Roster for Submitted Run

| Seat | Runtime | Model | Quota Pool |
|---|---|---|---|
| **Architect** | Claude Code | `claude-sonnet-5` | Claude Plan (~8M tokens) |
| **Builder** | Claude Code | `claude-sonnet-5` | Claude Plan (~25M tokens) |
| **Verifier** | OpenCode ACP | `opencode-go/kimi-k3` | OpenCode Go |
| **Spec Auditor** | OpenCode ACP | `opencode/nemotron-3-ultra-free` | Free Zen |

We are good to take next steps!
