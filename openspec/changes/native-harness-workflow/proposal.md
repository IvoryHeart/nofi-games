## Why

The rejected `durable-agent-runtime` premise duplicated agent execution already provided by Codex and Claude Code, while calling an OpenAI-shaped conversation API “provider neutral.” Before the first live studio run, execution should move to native harnesses and Git-native coordination so the repository owns durable knowledge without rebuilding harness internals.

The falsifiable outcome is that the same versioned workflow task can be completed in either Codex or Claude Code from an isolated worktree, resumed from Git and OpenSpec artifacts after harness context is lost, and independently verified without a task, lease, session, or checkpoint row in Supabase.

## What Changes

- **BREAKING**: Reject direct model-provider execution as the studio default and remove the custom Responses API stage coordinator, model/session policies, live-provider workflow, and runtime commands.
- Define Codex and Claude Code as the only supported execution harnesses for now. Harness-native threads, subagents, skills, tools, permissions, compaction, and authentication stay inside each harness.
- Use OpenSpec artifacts as the canonical task and decision record, Git branches/worktrees as writable task isolation and ownership, commits as checkpoints, and CI as deterministic verification.
- Keep accepted task contracts outcome-oriented. Harness thread IDs and model details are optional provenance, not workflow identity or authoritative memory.
- Remove Supabase from local agent-task coordination. Existing additive runtime tables remain inert historical migration evidence and are not read or written by the new workflow.
- Retain Supabase for product-facing concerns that actually require shared runtime data, such as catalog metadata and consented gameplay telemetry, when those capabilities are implemented.
- Add a strategic-premise gate requiring authoritative capability discovery and a build/integrate decision before architectural implementation.
- Non-goals: dynamically selecting models, supporting additional harnesses, operating a distributed multi-machine scheduler, retaining raw harness transcripts, or changing the player app and game-pack runtime.
- Rollback boundary: restore the rejected direct-provider code from Git history. No player, game-pack, catalog, or production Supabase data changes are required.

## Capabilities

### New Capabilities

- `native-harness-workflow`: Execute governed work through Codex or Claude Code using OpenSpec, Git branches/worktrees, commits, and CI as the durable local workflow substrate.
- `strategic-premise-validation`: Require evidence that a proposed architecture solves the right problem and reuses suitable existing capabilities before implementation begins.

### Modified Capabilities

- `change-governance`: Gate architectural implementation on an explicit, reviewable strategic-premise artifact.
- `evidence-ledger`: Record Git/OpenSpec/harness provenance without requiring database-backed agent session, lease, attempt, or checkpoint state.

## Impact

- `AGENTS.md`, `CLAUDE.md`, architecture documentation, and runbooks define one canonical protocol consumable by both harnesses.
- `agents/skills/validate-strategic-premise` supplies the missing pre-implementation capability check.
- `studio/control-plane` returns to workflow contracts and evidence decisions rather than executing models.
- `studio/workflows` become outcome-oriented again and stop pinning an OpenAI model/session policy.
- The OpenAI SDK dependency and opt-in provider smoke workflow are removed.
- Supabase migration history is preserved, but the durable-agent-runtime tables are deprecated and unused.
