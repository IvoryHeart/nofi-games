## Desired outcome

Resume interrupted agent work without repeating accepted stages while preserving attributable evidence, cost, and rollback.

## Required capabilities

The change identified sessions, checkpoints, idempotent attempts, structured outputs, accounting, and failure recovery as required capabilities.

## Existing capabilities and evidence

This analysis was missing before implementation. It evaluated OpenAI Responses and Conversations but did not evaluate Codex SDK/CLI, Codex native subagents, Claude Code, Git worktrees, or OpenSpec task artifacts as an integrated execution substrate.

## Alternatives and rejection reasons

The design compared fresh provider conversations with bounded or global provider conversations. It did not compare native harness execution, so its alternative set was incomplete.

## Selected repository-owned boundary

The change selected a direct-model runtime, provider conversation lifecycle, Supabase leases, checkpoints, and model-call accounting. Independent user review rejected that boundary as broader than the repository needs.

## Assumptions and disconfirming signals

The implementation assumed the repository must invoke models to execute agents. Codex and Claude Code already owning execution disconfirms that assumption for the current local workflow.

## Decision, validation, and rollback

REJECT. Preserve the change and additive database migration as historical evidence, remove active execution paths, and supersede it with `native-harness-workflow`. Source rollback is the native-harness correction; hosted tables remain inert rather than deleting audit evidence.
