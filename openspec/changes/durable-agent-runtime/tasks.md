## 1. Pin Runtime Contracts and Policies

- [x] 1.1 Add the official OpenAI JavaScript SDK and any required Supabase server client dependency to the control-plane package with lockfile updates.
- [x] 1.2 Add strict Zod contracts and exported TypeScript types for model policies, session budgets, agent sessions, stage attempts, checkpoints, model calls, provider usage, and priced/unpriced cost results.
- [x] 1.3 Extend agent and workflow contracts with versioned model-policy, session-policy, output-contract, security-policy, and workstream-boundary references while retaining validation for existing definitions.
- [x] 1.4 Add versioned policy manifests for the initial Terra champion, controlled Sol escalation, disabled-by-default Luna routing, session limits, redaction, and effective-dated pricing source metadata.
- [x] 1.5 Add canonical serialization, SHA-256 artifact hashing, idempotency-key generation, and complete compatibility-fingerprint utilities with golden tests.
- [x] 1.6 Add secret-value collection and recursive redaction utilities with encoded, multiline, nested-error, and substring canary tests.

## 2. Add Durable Persistence

- [x] 2.1 Add an additive Supabase migration for `studio_agent_sessions`, `studio_stage_attempts`, `studio_agent_checkpoints`, and `studio_model_calls` with foreign keys, status checks, timestamps, and provenance columns.
- [x] 2.2 Add database uniqueness, lease-claim/renewal functions, acceptance guards, immutable-checkpoint/model-call triggers, and indexes for runnable-attempt and reconciliation queries.
- [x] 2.3 Enable RLS on every runtime table, omit browser-role policies, and grant only the control-plane service path the operations it requires.
- [x] 2.4 Extend pgTAP coverage for a zero-state migration, repeat migration safety, RLS isolation, append-only records, lease races, stale-lease rejection, and one accepted checkpoint per idempotency key.
- [x] 2.5 Define a provider-neutral runtime repository interface and implement deterministic in-memory storage for unit tests.
- [x] 2.6 Implement the Supabase runtime repository with transactional claim, renew, reconcile, checkpoint-acceptance, and provenance-read operations.
- [x] 2.7 Add local-Supabase integration tests that race at least 20 claimants, replay completed attempts, expire leases, and reject late acceptance.

## 3. Implement Provider and Accounting Boundaries

- [x] 3.1 Define the provider-neutral execution envelope, conversation lifecycle, structured-result, normalized usage, cancellation, and uncertain-outcome contracts.
- [x] 3.2 Implement a programmable deterministic fake provider for success, malformed output, conversation loss, timeout-after-acceptance, authentication failure, cancellation, and partial-usage fixtures.
- [x] 3.3 Implement the OpenAI Responses/Conversations adapter with structured output, configured reasoning context, stable cache prefix/key, correlation metadata, and opaque provider identifiers.
- [x] 3.4 Implement provider-error normalization so missing credentials block locally, ambiguous transport outcomes require reconciliation, and diagnostics are redacted before return or persistence.
- [x] 3.5 Normalize provider-reported input, cached-input, cache-write, output, and reasoning usage without inventing unavailable categories.
- [x] 3.6 Implement effective-dated integer micro-USD pricing with resolved-model lookup, pricing-source provenance, rounding golden tests, and explicit `unpriced` results.
- [x] 3.7 Add adapter contract tests proving the fake and OpenAI adapter return the same normalized boundary types without exposing credentials or raw environment state.

## 4. Build the Session and Workflow Coordinator

- [x] 4.1 Build a pure execution-envelope assembler from pinned agent, skill, workflow, schema, tool, checkpoint, input, policy, Git, and OpenSpec artifacts.
- [x] 4.2 Implement deterministic resume-or-rotate selection from compatibility fingerprint, provider health, idle age, turns, checkpoint distance, context, and cost budgets.
- [x] 4.3 Implement preflight budget refusal, post-call usage accumulation, soft-boundary checkpointing, hard-boundary stopping, and version-pinned budget events.
- [x] 4.4 Implement leased stage execution with idempotent replay, independent lease renewal, provider-call recording, uncertain-outcome reconciliation, and late-result rejection.
- [x] 4.5 Implement structured-output validation, declared-evidence gate checks, bounded repair, content-addressed artifact persistence, and atomic checkpoint acceptance.
- [x] 4.6 Implement reconstruction from the latest accepted checkpoint when a provider conversation is unavailable and explicit failure when a required referenced artifact is missing.
- [x] 4.7 Integrate the coordinator with workflow state transitions so completed stages are never replayed and dependent stages unlock only from accepted outputs.
- [x] 4.8 Add a CLI for validation, fake-provider execution, run inspection, resume, reconciliation, and opt-in budget-capped live smoke execution.

## 5. Prove Safety, Quality, and Cost Behavior

- [x] 5.1 Add the complete compatibility-fingerprint mutation matrix and verify every incompatible change rotates while exact-compatible interruptions resume.
- [x] 5.2 Add malformed-output, forged-evidence, undeclared-artifact, prompt-injection, missing-artifact, provider-loss, and hard-budget adversarial tests from the evaluation plan.
- [x] 5.3 Add end-to-end secret-canary tests across envelopes, logs, diagnostics, snapshots, database records, and retained evidence artifacts.
- [x] 5.4 Add provenance completeness tests that reconstruct every required version, session, attempt, lease, checkpoint, provider, usage, price, and resume relationship from one run.
- [x] 5.5 Add repeated model-policy champion/challenger fixtures with independent evaluation, protected quality metrics, and Terra/Sol/Luna promotion rules.
- [x] 5.6 Add cache-on versus cache-off repeated fixtures and require measured cost non-regression before enabling explicit prompt caching in the champion policy.
- [x] 5.7 Add an opt-in live OpenAI create/continue/rotate smoke test with a strict call and cost cap, structured output, observed usage assertions, and automatic test-artifact cleanup.
- [x] 5.8 Add CI jobs for deterministic runtime tests and local Supabase pgTAP/integration tests while keeping live provider tests manual and credential-gated.

## 6. Restore and Connect Hosted Supabase

- [x] 6.1 Discover existing non-secret Supabase project configuration and verify whether the suspended project requires dashboard restoration before API or CLI access.
- [x] 6.2 After restoration, verify the existing server-side credentials through a redacted health check and rotate them only if authentication proves they are invalid.
- [x] 6.3 Link the Supabase CLI without committing credentials, inspect remote schema and migration history, and confirm that applying the runtime migration is additive and non-destructive.
- [x] 6.4 Apply the validated migrations and run disposable remote lease, checkpoint, usage, and RLS smoke tests without resetting hosted state.
- [x] 6.5 Record the hosted project verification evidence and the exact migration/version envelope without persisting project secrets.

## 7. Document Operations and Rollback

- [x] 7.1 Document agent identity versus workstream session versus stage attempt, including when conversations resume, checkpoint, rotate, reconcile, and stop.
- [x] 7.2 Document model-routing, price-manifest updates, budget controls, cache evaluation, live-call authorization, and cost inspection commands.
- [x] 7.3 Document local and hosted Supabase setup, suspended-project recovery, credential handling, migration inspection, and non-destructive rollback procedures.
- [x] 7.4 Add a first-run operator guide that validates the fake workflow, performs the bounded live smoke, and then opens a separate `game-concept` change for opportunity research.
- [x] 7.5 Exercise the live-provider disable switch and worker-claim stop, verify in-flight reconciliation cannot accept output, and preserve all prior evidence.

## 8. Verify and Hand Off

- [x] 8.1 Run formatting, linting, type checking, unit tests, integration tests, OpenSpec strict validation, and a clean local Supabase reset from the repository commands.
- [x] 8.2 Execute every requirement row and adversarial case in `evaluation-plan.md`, recording command, result, artifact hash, and any explicit live-test omission.
- [x] 8.3 Confirm all protected metrics pass and every rollback trigger remains false; leave live execution disabled if any gate is unmet.
- [x] 8.4 Produce the implementation verification artifact and request independent acceptance before archiving this change or starting live game-opportunity research.
