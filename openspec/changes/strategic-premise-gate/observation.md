## Agent and affected versions

- Subject: repository architecture/change-authoring behavior on branch `platform-v2`
- Champion: commit `c6b891dc`, with no strategic-premise skill or architecture discovery gate
- Affected change: `durable-agent-runtime`
- Affected implementation: commits `c023c4d` and `c6b891d`

## Reproducible observation

Given a request for durable, long-running agents in a repository being operated through Codex, the agent selected OpenAI Responses and Conversations as the execution substrate before inventorying Codex SDK/CLI or Claude Code. It then implemented provider conversations, model routing, task leases, checkpoints, usage accounting, and Supabase persistence even though the intended development harness already supplied threads, subagents, tools, authentication, and resumption.

The proposal names its interface provider-neutral, but the implementation contract requires `conversationId`, configured model, reasoning effort, prompt-cache configuration, response ID, provider usage, and provider conversation lifecycle. The only non-test provider is OpenAI. This is direct-model API neutrality, not agent-harness neutrality.

## Evidence, frequency, and impact

- `openspec/changes/durable-agent-runtime/proposal.md` begins from Responses API capabilities and never compares native harness integration.
- `openspec/changes/durable-agent-runtime/design.md` considers provider-conversation boundaries but contains no Codex, Claude Code, or build-versus-integrate analysis.
- `studio/control-plane/src/provider.ts` exposes OpenAI-shaped execution semantics despite the neutral name.
- The protected evaluation suite exhaustively verifies leases, conversation continuity, accounting, and Supabase persistence, but does not test whether the selected architecture duplicates an existing capability.
- The retrospective identifies implementation-level assumptions but does not revisit the strategic premise.
- Frequency observed: one consequential architecture change, one failure. This is sufficient to open a challenger because the failure is directly inspectable and high-impact, but insufficient by itself to promote the challenger.
- Impact: unnecessary code, dependencies, database schema, operational surface, credentials, and a misleading abstraction boundary before any real game-production workflow ran.

## Alternative explanations

- Durable state and shared leases would be appropriate for an already-required distributed scheduler, but no such requirement had been accepted.
- Direct API execution could be useful for bounded non-coding agents later, but it should be a separately justified harness rather than the default.
- The user asked to apply `durable-agent-runtime`, which could be read as authorization to implement the drafted change; it did not remove the obligation to validate the architecture premise before implementation.
- Existing harnesses do not replace durable product knowledge or independent evidence. The error was rebuilding execution, not retaining OpenSpec, Git, tests, and evaluation artifacts.
