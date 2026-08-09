# Durable agent runtime

The runtime separates durable identity, bounded working memory, and retryable execution. Provider conversations help an agent stay coherent, but accepted checkpoints and content-addressed artifacts are the authority.

## Runtime identities

| Record             | Meaning                                                                       | Lifetime                                                                                | Reuse rule                                                    |
| ------------------ | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Agent definition   | Versioned role, skill, tools, and evaluation policy                           | Until a separately evaluated version is promoted                                        | Never mutated by a run; an agent cannot promote itself        |
| Workstream session | One bounded provider conversation for an agent and workflow stage             | Until compatibility, health, idle, turn, context, cost, or checkpoint policy rotates it | Only when the complete compatibility fingerprint matches      |
| Stage attempt      | One idempotent execution generation with a leased worker                      | Until accepted, failed, blocked, abandoned, or awaiting reconciliation                  | Reclaimed only under the lease and uncertainty rules          |
| Checkpoint         | Immutable accepted state plus input, output, evidence, and version references | Permanent audit evidence                                                                | Reconstructed and hash-verified; never edited                 |
| Model-call event   | Append-only start/result evidence for one provider request                    | Permanent audit evidence                                                                | Never overwritten; ambiguous outcomes are not retried blindly |

The compatibility fingerprint includes agent and prompt versions, skill bytes, workflow and stage versions, normalized inputs, accepted checkpoint, output contract, tool policy, and model/session/security policy versions. An exact match resumes. Any change rotates the active session, links its successor, and starts a new provider conversation.

## Execution flow

1. Validate and redact the execution request, then verify every checkpoint artifact by SHA-256.
2. Refuse calls that would cross a hard budget.
3. Replay an already accepted idempotency key with zero provider calls.
4. Resume an exact-compatible healthy session or rotate to a linked successor.
5. Claim a time-bounded attempt lease and renew it independently of the provider request.
6. Append the call start event before sending the request.
7. Append the result, exact provider usage, resolved model, price-manifest result, and opaque response ID.
8. Validate exact artifact IDs, evidence gates, evidence bytes, and checkpoint schema. At most the session policy's bounded repairs are allowed.
9. Persist output and evidence bytes by content hash, then atomically accept one checkpoint.

Transport outcomes that might have reached the provider enter `reconciling`; they never create an automatic replacement call. Missing conversations reconstruct from accepted artifacts. Missing or mismatched artifacts fail before a provider call.

## Model, context, cache, and cost policy

- `studio/policies/model-routing/terra-champion-v1.yaml` pins Terra with `reasoning.context: all_turns`. Sol is a controlled challenger/escalation; Luna is disabled and must preserve quality while reducing cost.
- `studio/policies/session/bounded-workstream-v1.yaml` owns soft and hard context/cost limits, idle age, turns, checkpoint distance, duration, and repair count.
- `studio/policies/pricing/openai-2026-08-09.yaml` is effective-dated source provenance. Update it through OpenSpec after checking current official model pricing; never silently treat an unknown model or missing usage as zero.
- Explicit prompt caching remains disabled until at least three cache-on and cache-off repetitions preserve protected quality and do not increase measured cost. Prefix versions are compatibility-pinned.

Inspect a hosted run with:

```bash
pnpm studio:runtime inspect <workflow-run-uuid>
pnpm studio:runtime reconcile <attempt-uuid>
```

`reconcile` is intentionally read-only. An operator or later reconciler must establish whether the original response exists before authorizing any new paid call.

## Rollback

Call `disableLiveExecution()` on active coordinators, disable the live-provider feature setting, and stop workers from claiming new attempts. New calls are blocked immediately. A response already in flight is retained as append-only evidence but moved to reconciliation and cannot accept a checkpoint after the disable generation changes.

Rollback does not delete runtime tables, calls, checkpoints, artifacts, OpenSpec evidence, or prior game packs. Re-enable only after the unchanged holdout set passes plus a regression test for the trigger.
