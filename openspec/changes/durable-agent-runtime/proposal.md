## Why

The studio currently versions agent roles and workflows but cannot execute or resume them, so every invocation would reconstruct context without durable session state or measured cost. OpenAI's current Responses API supports durable Conversations and GPT-5.6 persisted reasoning, while prior chained input remains billable; the platform therefore needs an explicit persistence, compaction, and accounting policy before autonomous runs begin.

The falsifiable outcome is that an interrupted research workflow can resume from its last accepted checkpoint without replaying completed stages, while every model call records exact model, session, token, cache, cost, and artifact provenance.

## What Changes

- Add a durable agent runtime that executes registered workflow stages through a provider-neutral interface with an initial OpenAI Responses API adapter.
- Preserve stable agent identity separately from execution sessions: reuse one durable conversation within a coherent workstream, compact it at declared boundaries, and start a fresh conversation when relevance or budget gates require it.
- Store authoritative memory as versioned artifacts, OpenSpec knowledge, and evidence checkpoints; conversation history is an optimization rather than the sole source of truth.
- Route work through an evaluation-controlled model policy. Default to GPT-5.6 Terra for balanced stages, elevate to Sol only for measured quality needs, and permit Luna only for bounded transformations that pass the same gates.
- Record input, output, reasoning, cached-input, and cache-write tokens plus estimated cost on every call. Use stable explicit cache prefixes and avoid repeatedly writing changing context.
- Make stage execution idempotent and resumable through leases, immutable attempt records, structured outputs, and checkpoint hashes.
- Extend the Supabase schema for sessions, checkpoints, attempts, and usage without relying on legacy production data.
- Non-goals: keeping a model process alive while idle, treating chat history as durable knowledge, selecting a product game in this change, or changing gameplay/runtime behavior.
- Rollback boundary: disable the OpenAI adapter and return workflow execution to planned/manual state while preserving all committed definitions and append-only evidence. No player-app or published catalog state changes.

## Capabilities

### New Capabilities

- `durable-agent-runtime`: Execute, resume, compact, account for, and safely abandon versioned agent sessions across workflow stages.

### Modified Capabilities

- `evidence-ledger`: Require model-call, session, checkpoint, cache, token, cost, and resume provenance for agent-executed workflow events.

## Impact

- `studio/control-plane`: provider adapter, session policy, workflow executor, structured artifact validation, and usage accounting.
- `studio/workflows` and `agents/registry.yaml`: stage model policies, session boundaries, and output contracts.
- `supabase/migrations` and tests: durable session, checkpoint, attempt, lease, and usage records with RLS.
- CI and local commands: dry-run execution, credential detection, replay/resume tests, and optional live smoke tests.
- New dependency on the official OpenAI JavaScript SDK; `OPENAI_API_KEY` remains external to Git and is never written to evidence.
