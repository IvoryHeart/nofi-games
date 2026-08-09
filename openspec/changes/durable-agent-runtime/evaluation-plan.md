## Requirement coverage

| Requirement                                           | Evidence method                                                                                                                                         | Acceptance threshold                                                                                                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent identity is independent from execution sessions | TypeScript contract test creates two incompatible workstreams for one pinned agent version                                                              | One stable agent identity; two distinct sessions; no provider identifier in the agent definition                                                                                                        |
| Coherent work can resume from a durable session       | Integration test interrupts after a checkpoint, expires the lease, and resumes; a second case changes every compatibility-fingerprint component in turn | Exact-compatible work resumes from the accepted checkpoint with zero repeated completed stages; every incompatible case rotates and links a new session                                                 |
| Authoritative memory survives conversation loss       | Fake provider makes the saved conversation unavailable and the coordinator reconstructs from content-addressed artifacts                                | Reconstructed output and checkpoint-input hashes match the uninterrupted fixture; missing required artifacts fail explicitly before a provider call                                                     |
| Context growth is bounded by policy                   | Property tests vary token, cost, idle-age, turn, and checkpoint-distance counters around soft/hard boundaries                                           | Every soft boundary selects the configured checkpoint/rotation action; every hard boundary issues zero subsequent calls and records `budget-exhausted`                                                  |
| Stage attempts are idempotent and leased              | Database integration test races at least 20 workers, replays the winning key, expires a lease, and delivers a late result                               | One active lease, at most one accepted checkpoint, zero extra calls on completed replay, and no late result accepted without the current lease                                                          |
| Agent output is contract validated                    | Contract tests inject malformed JSON, schema-invalid artifacts, undeclared artifacts, missing evidence, and a valid repair                              | Zero invalid outputs accepted or used by dependent stages; only the bounded valid repair can produce a checkpoint                                                                                       |
| Model selection is evidence controlled                | Policy tests attempt agent-authored escalation and unapproved Terra/Sol/Luna substitutions; champion/challenger evaluation runs repeated stage fixtures | All undeclared routing is rejected; a challenger promotes only after minimum repetitions, all protected gates, and the suite's primary-improvement rule pass                                            |
| Provider failure is reversible                        | Failure-injection tests cover missing credentials, authentication failure, timeout, conversation loss, adapter disablement, and cancellation            | No accepted OpenSpec, catalog, game-pack, or prior evidence is mutated; diagnostics contain no secret; unknown outcomes enter reconciliation without blind retry                                        |
| Version-pinned workflow records                       | Provenance integration test executes, resumes, rotates, and repairs one fixture, then reconstructs the version envelope from the ledger                 | 100% of consequential attempts contain all specified Git, OpenSpec, workflow, agent, prompt, skill, tool, input/output, policy, provider, model, session, attempt, lease, checkpoint, and parent fields |
| Model usage and estimated cost are attributable       | Unit tests normalize complete, partial, and unknown provider usage; golden tests price calls across effective-date boundaries                           | Provider values are preserved exactly, unsupported fields remain unavailable, integer cost is reproducible from the pinned schedule, and unknown models are `unpriced` rather than zero                 |
| Checkpoints are immutable and content addressed       | pgTAP tests reject update/delete and duplicate hash conflicts; integration test rotates and follows predecessor links                                   | Checkpoint bytes reproduce their SHA-256, mutation is rejected, and every resumed/rotated call identifies exactly one accepted seed checkpoint                                                          |
| Secrets are excluded from agent evidence              | Canary secrets are placed in configured environment values and injected into provider errors, tool output, and diagnostics                              | Zero canary bytes appear in execution envelopes, logs, returned diagnostics, database rows, snapshots, or retained evidence artifacts                                                                   |

## Protected metrics

- **Exactly-once acceptance:** one or zero accepted checkpoints for each idempotency key; target `100%` across concurrency and retry fixtures.
- **No duplicate paid invocation:** a replayed completed attempt and an unresolved transport outcome issue `0` automatic replacement calls; target `100%`.
- **Contract integrity:** accepted-output validation rate `100%`; invalid-output acceptance rate `0%`.
- **Resume fidelity:** completed stages repeated after interruption `0`; checkpoint/artifact hash mismatches `0`.
- **Compatibility isolation:** incompatible sessions reused `0`; target `100%` rotation for the fingerprint mutation matrix.
- **Budget enforcement:** calls begun after a known hard limit `0`; every stop has a resumable checkpoint or an explicit missing-state failure.
- **Provenance completeness:** required populated-or-explicitly-unavailable ledger fields `100%`.
- **Secret containment:** persisted or transmitted secret canary matches `0`.
- **Model quality:** no protected quality metric may regress beyond its evaluation-suite allowance. Sol is enabled for a stage only when it clears that rule and the suite's primary-improvement threshold; Luna must additionally cost less than the Terra champion on the same repeated fixtures.
- **Cache value:** explicit prompt caching is enabled for a policy only when measured repeated-fixture cost is no greater than its no-explicit-cache control and output-quality gates remain unchanged. Cache-hit rate alone is not a success metric.
- **Accounting accuracy:** all provider-reported token categories match captured API usage exactly; deterministic price fixtures differ by at most one micro-US dollar due to integer rounding.

The deterministic fake, unit tests, and local Supabase integration suite run in normal CI. A live OpenAI smoke suite is opt-in, budget-capped, and records one create/continue/rotate sequence; it validates actual SDK fields and usage normalization but is not the sole evidence for any protected behavior. Model-policy comparison uses at least the repetitions declared by the existing evaluation suite and an independent evaluator.

## Holdout or adversarial cases

- Two workers use different process clocks near lease expiry; a late provider response arrives after another worker acquires the lease.
- The provider accepts a request but the client loses the response, leaving an unknown transport outcome.
- The provider conversation is deleted/unavailable while all checkpoint artifacts remain, and separately while one required artifact is missing.
- Agent, skill, workflow, tool policy, output schema, model policy, input hash, and accepted checkpoint are each changed independently to detect incomplete fingerprints.
- A valid JSON response contains extra undeclared artifacts, a forged evidence hash, an invalid URI, or instructions to bypass a gate.
- Secrets appear as substrings, URL-encoded values, multiline values, and nested error causes rather than only exact standalone tokens.
- Provider usage omits cache or reasoning categories, introduces an unknown model alias, or falls exactly on a pricing effective-date boundary.
- A cacheable prefix changes every turn, causing cache-write charges without useful reads.
- A checkpoint summary omits a needed detail that remains available through its declared content-addressed artifact reference.
- Local Supabase is reset from zero and migrated twice; a non-empty remote schema is inspected without destructive reset before hosted migration.
- Protected model-routing fixtures remain hidden from the agent being evaluated and include prompt-injection text in research evidence.

## Rollback triggers

- Any secret canary reaches a provider envelope, log, database record, diagnostic, or retained artifact.
- Any invalid or tool-policy-violating output is accepted, or two checkpoints are accepted for one idempotency key.
- Any automatic retry creates a second paid call while the first call has an unresolved outcome.
- A known-incompatible session is resumed, a completed stage is replayed, or checkpoint hashes fail to reproduce.
- A call starts after a known hard budget limit, or usage/cost is silently recorded as zero when unavailable.
- Required provenance completeness drops below `100%` for a consequential attempt.
- A model-policy challenger violates a protected quality gate or explicit caching costs more than its control.
- Hosted migration requires dropping/resetting existing state, or its post-migration RLS exposes studio execution tables to browser roles.

Any trigger disables live provider execution and new worker claims, preserves append-only evidence for diagnosis, and returns execution to deterministic/manual mode. Re-enablement requires a new passing verification run against the unchanged holdout set plus a regression case for the trigger.
