## Context

The control plane currently validates versioned agent and workflow definitions, evaluates candidates, and records workflow state in memory. The initial Supabase migration stores workflow runs, append-only events, evidence, agent versions, and catalog state, but it has no execution sessions, stage attempts, checkpoints, or model-call accounting. See `proposal.md` for the motivation and the capability specs for required behavior.

The implementation must work against local Supabase in CI and the existing suspended hosted project after it is restored. Provider credentials remain external to Git. The runtime will initially use OpenAI's Responses API, but no accepted workflow artifact may depend on a provider conversation remaining available.

## Goals / Non-Goals

**Goals:**

- Make a stage attempt exactly identifiable, safely claimable, resumable, and auditable across process failure.
- Reuse provider context only when the agent, inputs, contracts, tools, and policy are compatible.
- Bound context growth and cost while retaining accepted decisions through provider-neutral checkpoints.
- Validate agent output before it can become workflow evidence or unlock a dependent stage.
- Capture enough provenance to reproduce the effective request policy and explain model-routing decisions.
- Keep local/fake execution deterministic so orchestration can be tested without paid API calls.

**Non-Goals:**

- Keeping a model process alive between calls or assuming an OpenAI conversation avoids input-token charges.
- Storing raw chain-of-thought, credentials, complete environment snapshots, or unrestricted tool output.
- Allowing an agent to change its own model policy, evaluation gates, tool permissions, or champion version during a run.
- Selecting or building the first product game inside this system change.
- Giving browser clients direct access to studio execution tables.

## Decisions

### 1. Separate versioned agent identity, workstream session, and stage attempt

An agent identity is the versioned registry entry and skill hash. An agent session is a bounded provider conversation for one coherent workstream. A stage attempt is one idempotent effort to transform a specific input set into a declared output contract.

Each session receives a compatibility fingerprint over the agent ID and version, skill hash, workflow and stage versions, normalized input hashes, output-schema hash, tool-policy hash, model-policy version, and security-policy version. The coordinator may resume only an active session with the same fingerprint. A changed dependency, accepted checkpoint, policy, or contract starts a new session and links it to its predecessor.

This permits useful continuity within interrupted work without turning an agent into one global chat whose stale context leaks across runs. Alternatives considered were a fresh conversation for every call, which repeatedly reconstructs context, and one conversation per named agent, which mixes unrelated work and grows without a safe compatibility boundary.

### 2. Treat accepted checkpoints as authoritative memory

After each accepted unit of work, the runtime writes an immutable checkpoint containing:

- input and output artifact references with SHA-256 hashes;
- accepted conclusions, assumptions, unresolved questions, and the declared next action;
- agent, skill, workflow, schema, tool, model-policy, Git, and OpenSpec versions;
- the originating attempt, provider response reference, and usage-record references.

Large artifacts live in Git or the evidence object store; the checkpoint stores typed references and a bounded summary. A new conversation is seeded from the versioned role prefix plus the last accepted checkpoint and current inputs. Provider conversation history can accelerate a continuation, but it cannot override a checkpoint or supply the only copy of an accepted decision.

The alternative, serializing complete prompts and responses as memory, would increase secret/privacy exposure, retain irrelevant material, and make provider history a hidden source of truth.

### 3. Use a provider-neutral execution boundary with a deterministic fake

The control plane defines an `AgentProvider` contract around conversation creation, structured response execution, usage reporting, cancellation status, and provider references. The OpenAI adapter uses the official JavaScript SDK and Responses/Conversations APIs. Tests and dry runs use a deterministic fake provider that exercises the same output validation and persistence paths.

Provider request construction is pure from an execution envelope: stable instructions and skill content, checkpoint, current inputs, allowed tools, output schema, model policy, and correlation metadata. Credentials and unrelated process environment are never part of the envelope. Provider-specific fields stay inside the adapter, while normalized results are persisted by the coordinator.

This boundary is intentionally smaller than a general multi-provider abstraction. It supports replacement and testing without pretending different providers have identical reasoning or caching semantics.

### 4. Resume coherent work; checkpoint and rotate at bounded context boundaries

The coordinator applies this ordered policy:

1. Resume an exact-fingerprint session for the same unfinished stage attempt when it is healthy and within budget.
2. Continue within that session while observed usage remains under the configured soft context and cost limits.
3. At a semantic boundary, write and validate a checkpoint, then rotate to a fresh conversation seeded from that checkpoint.
4. Refuse another call before the configured hard token, cost, duration, or retry limit and mark the attempt blocked with a non-secret reason.
5. Rotate immediately when the compatibility fingerprint changes or context is known to contain revoked/incorrect information.

Default workflow behavior is to rotate between stages because their roles, tools, and output contracts differ. A stage may opt into a shared workstream only through versioned workflow configuration and evaluation evidence. Thresholds are versioned configuration, measured from API usage rather than guessed from prompt character counts, and chosen below any provider pricing/context discontinuity with safety headroom.

OpenAI persisted reasoning may be used inside a compatible session. Stable instruction/skill/schema prefixes receive a stable prompt-cache key and explicit cache boundary where supported. Dynamic inputs and checkpoints follow the stable prefix. Because chained history remains billable and cache writes are not free, caching is an optimization recorded in usage—not a reason to keep sessions indefinitely.

### 5. Route models through a versioned policy, not agent discretion

Every stage points to a versioned model policy. The initial champion policy uses GPT-5.6 Terra for balanced reasoning stages, allows Sol only through a declared escalation rule or an evaluation-proven stage override, and keeps Luna disabled except for bounded transformations whose quality gates pass. Policies pin a model snapshot when the API offers one; otherwise the response's resolved model identifier is recorded alongside the configured alias.

An escalation creates a new attempt or an explicitly linked continuation with a machine-readable reason such as protected-evaluation failure, schema failure after bounded repair, or approved complexity class. Agents cannot self-escalate by emitting prose. Model-policy challengers use the existing independent champion/challenger process before promotion.

The alternative, always using the largest model, spends budget where no quality gain is established. Pure per-call automatic routing would be difficult to reproduce and could silently change behavior.

### 6. Make stage execution idempotent with database leases and immutable attempts

The additive migration introduces four studio-only records:

- `studio_agent_sessions`: bounded workstream identity, compatibility fingerprint, provider conversation reference, status, predecessor, budget policy, and latest accepted checkpoint;
- `studio_stage_attempts`: unique idempotency key, workflow/stage/input identity, lease owner and expiry, state transitions, and terminal reason;
- `studio_agent_checkpoints`: immutable, hash-addressed checkpoint manifests linked to their session and attempt;
- `studio_model_calls`: append-only request/result provenance, provider response reference, model and policy, normalized token categories, cache usage, latency, estimated cost, and status.

The idempotency key hashes the workflow-run ID, stage version, normalized input hashes, agent/skill versions, output-schema hash, and attempt generation. Claiming or renewing a lease is transactional. Only the current lease holder may begin a model call or accept output. A worker that loses its lease may record late provider evidence but cannot promote the result. Unknown transport outcomes enter a reconciliation state rather than triggering an immediate duplicate paid call.

Database transitions and uniqueness constraints are the concurrency authority; in-process locks are only an optimization. Service-role control-plane access is required, RLS is enabled, and no anonymous/authenticated policy exposes these tables.

### 7. Validate structured output before checkpoint acceptance

Every stage producer declares a versioned Zod/JSON Schema output contract. The adapter requests structured output when supported, then the provider-neutral boundary validates it again. A bounded repair call may receive validation errors without hidden application state. Invalid output, an undeclared artifact, a missing evidence reference, or a tool-policy violation cannot create an accepted checkpoint or unlock a dependent stage.

Artifact bytes are hashed before persistence. The ledger records the full version envelope and the relationship among attempt, call, checkpoint, and workflow event. Prompts and responses may be retained only in a redacted evidence artifact under an explicit retention policy; normalized provenance and accepted outputs are always retained.

### 8. Account from observed usage and effective-dated price data

Each model call stores provider-reported input, output, reasoning, cached-input, and cache-write tokens when available. Estimated cost is computed in integer micro-US dollars from an immutable, effective-dated price schedule whose source URL and retrieval date are versioned. Unknown token categories or an unknown resolved model make cost `unpriced` rather than silently zero.

Budgets can be enforced per call, attempt, workflow run, and UTC accounting period. The preflight check uses conservative estimates; the post-call record uses observed usage. Evaluation compares quality, total cost, uncached-input cost, cache effectiveness, and latency across repeated fixtures so a cheaper policy cannot promote through quality regression.

### 9. Restore and migrate Supabase only after local proof

The hosted project is treated as an empty deployment target, not as the development loop. Migrations and pgTAP tests run against local Docker Supabase first. After the project is restored, the implementation verifies the project URL and existing server-side credentials through a non-secret health check, links the CLI without committing credentials, inspects remote migration state, and applies additive migrations through the standard migration path.

If old keys no longer authenticate after restore, credential rotation is an operational repair and does not change the runtime design. The runtime has a local persistence mode and a deterministic provider, so hosted suspension cannot block implementation or tests.

## Risks / Trade-offs

- [Provider conversations are durable but prior context remains billable] → Enforce measured soft/hard budgets, checkpoint at semantic boundaries, and rotate instead of assuming reuse is free.
- [Checkpoint summaries can omit a fact needed later] → Retain hash-addressed source artifacts, validate required checkpoint fields, and permit retrieval by declared reference rather than expanding every summary.
- [A timed-out request may have completed remotely] → Persist correlation metadata, enter reconciliation state, and forbid blind retry until the provider result is resolved or the policy explicitly abandons it.
- [Leases can expire during a long response] → Renew independently, record late evidence, and require an active lease plus unchanged input fingerprint before acceptance.
- [Pricing or rolling model aliases can change] → Use effective-dated price manifests, pin snapshots where offered, record resolved model IDs, and rerun policy evals before promotion.
- [Caching can increase cost when prefixes churn] → Hash cacheable prefixes, measure cache writes and reads, and disable explicit caching for policies that fail the cost evaluation.
- [A hosted clean-slate assumption could be wrong] → Inspect migration history and schema before applying; use only additive migrations and never reset the remote project as part of automation.
- [Detailed evidence can expose sensitive prompt material] → Store normalized provenance by default, redact optional raw artifacts, apply explicit retention, and test secret canaries.

## Migration Plan

1. Add provider-neutral contracts, model/session policy schemas, output contracts, and a deterministic fake; keep live execution disabled.
2. Add the four runtime tables, constraints, triggers, RLS, and pgTAP coverage; verify a complete local Supabase reset.
3. Implement the coordinator, lease/idempotency logic, checkpoint store, redaction, and usage/cost accounting against the fake provider.
4. Add the OpenAI adapter and an opt-in bounded live smoke test. Record, but never print, external conversation/response identifiers or secret values.
5. Run resume, rotation, duplicate-worker, malformed-output, context-budget, pricing, and provider-failure evaluations. Promote the initial model/session policy only if all protected gates pass.
6. Restore and inspect the existing Supabase project, verify credentials, apply additive migrations, and run a remote read/write smoke test with disposable studio records.
7. Enable the adapter for an explicitly requested workflow run. Launch opportunity research only after the runtime change is verified and accepted; the resulting game choice begins a separate `game-concept` change.

Rollback disables the live provider feature flag and stops workers from claiming new attempts. In-flight calls are allowed to reconcile, but their outputs cannot be accepted after disablement. The additive tables and append-only evidence remain for audit; no destructive database rollback is required. Workflow definitions, the player app, and the catalog remain unchanged.
