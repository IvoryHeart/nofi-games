## Desired outcome

Enable agents to execute, resume, verify, and improve governed game-studio work without rebuilding capabilities already supplied by their coding-agent harnesses.

## Required capabilities

- Versioned outcome, constraints, task decomposition, and acceptance gates.
- Isolated writable workspaces for concurrent agents.
- Durable, inspectable checkpoints and accepted knowledge.
- Native subagents, tools, permissions, authentication, and context management.
- Harness-independent verification, provenance, review, and rollback.

## Existing capabilities and evidence

- OpenAI documents that the [Codex SDK](https://developers.openai.com/codex/sdk/) can start, continue, and resume local Codex threads and that [Codex subagents](https://developers.openai.com/codex/multi-agent/) delegate independent work.
- Anthropic documents [Claude Code sessions](https://code.claude.com/docs/en/sessions), [subagents](https://code.claude.com/docs/en/sub-agents), and [parallel worktree isolation](https://code.claude.com/docs/en/worktrees).
- Git provides branches, worktrees, commits, diffs, merging, and rollback.
- OpenSpec already provides proposals, tasks, verification, retrospectives, decisions, and evolving capability knowledge.
- The repository's direct-provider interface exposes conversation, response, model, reasoning, and cache semantics, proving that it abstracts a model API rather than a harness.

## Alternatives and rejection reasons

- Keep the direct-provider runtime: rejects native harness value and adds credentials, database state, failure modes, and maintenance.
- Retain Supabase leases around native harnesses: no accepted local coordination requirement justifies a second ownership system.
- Build a generic harness API: only two harnesses are requested and forcing parity would hide useful native capabilities.
- Use one harness only: unnecessary because portable task/evidence artifacts support both without normalizing execution.
- Do nothing: leaves the rejected runtime as misleading active architecture.

## Selected repository-owned boundary

The repository owns task packets, OpenSpec knowledge, Git/worktree isolation, checkpoint commits, verification evidence, and decisions. Codex and Claude Code own execution. Supabase is reserved for product data that actually requires shared runtime persistence.

## Assumptions and disconfirming signals

The workflow assumes trusted local execution with shared Git visibility. Reconsider it if measured work requires automatic untrusted multi-machine scheduling, branch visibility cannot prevent duplicate claims, or local loss/recovery is inadequate despite checkpoint commits.

## Decision, validation, and rollback

Adopt the native-harness workflow and remove direct model execution. The capability sources above were checked on 2026-08-09 alongside installed Codex CLI `0.147.0` and Claude Code `2.1.220`. Validate static contracts, worktree isolation/resume, identical acceptance artifacts, and clean CI. A later independent fixture must exercise both harnesses before claiming cross-harness quality equivalence. Rollback restores `c6b891d` from Git; no destructive database rollback is needed.
