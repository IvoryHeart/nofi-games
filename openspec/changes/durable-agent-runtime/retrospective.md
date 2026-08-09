## Outcome

The change produced a durable provider-neutral agent runtime, additive local and hosted Supabase persistence, OpenAI and deterministic fake adapters, bounded session/model/cost policies, structured evidence and checkpoint acceptance, adversarial evaluation, CI, and operator runbooks. All deterministic and hosted protected metrics pass. The hosted project is migrated without changing its three legacy tables. Live execution remains disabled pending independent acceptance and an explicitly authorized OpenAI smoke.

## Evidence-backed lessons

- Provider conversations are useful continuity caches, not authoritative memory. Conversation-loss tests reconstructed correctly only because accepted checkpoint state and all input/output/evidence bytes were independently content addressed.
- Cryptographic work belongs at a deterministic boundary. Asking an agent to produce a SHA-256 is both unreliable and unnecessary; the accepted design lets the agent provide evidence bytes and makes the runtime compute and verify the digest.
- Compatibility schemas must parse every consequential field. Adding `promptHash` to an object was insufficient while Zod stripped it from `CompatibilityInput`; the mutation matrix exposed that the schema itself must include the field.
- Rollback is a generation boundary, not only a preflight flag. An in-flight call could otherwise pass the initial enable check and accept later. The coordinator now records the late result and reconciles without promotion.
- Failure handling must be as durable as success handling. A provider result persisted after a fake-ID collision left a calling attempt until the lease expired; hosted-smoke failure handling now reconciles the attempt and marks the run failed.
- Determinism and global uniqueness are different properties. Reproducible fake IDs are useful in unit tests but require a durable namespace when inserted into a shared ledger.
- Partial unique indexes are not a safe generic PostgREST upsert target. Insert-and-recover-on-`23505` is explicit and worked against hosted Supabase.
- Database-only local infrastructure is the correct default for ledger tests. Auxiliary Supabase service health added noise while hosted PostgREST/RPC supplied the actual transport proof.
- Test extensions can fail below SQL semantics. pgTAP's unauthorized set-returning `throws_ok` path segfaulted PostgreSQL 17.6.1.104; checking the privilege catalog proved the same invariant and survived two clean resets.
- CLI diagnostics are part of the secret boundary. `supabase db dump --dry-run` can print an ephemeral database login, so the runbook forbids it in shared logs even though it sounds read-only.

## Invalidated assumptions

- A provider conversation could safely stand in for durable long-running agent state. It cannot; it may disappear independently of accepted work.
- Blocking new claims was enough for rollback. It was not enough for already running asynchronous calls.
- Model-supplied evidence hashes could be treated as authoritative. Only hashes computed over retained bytes are authoritative.
- A fake provider's locally monotonic response sequence was globally unique. It was unique only within one adapter instance.
- A full local Supabase stack was necessary for database acceptance. Postgres-only local tests plus hosted repository smoke are more deterministic and cover the intended boundaries.
- A read-only CLI dry run was automatically safe to log. Some dry-run commands expose temporary connection material.
- A SQL assertion that merely expects a permission error could not destabilize the database. The pgTAP/PostgreSQL interaction disproved that assumption.

## Improvement suggestions

- Execute the existing three-call live OpenAI suite in the protected manual workflow, retain its usage/cost evidence, and only then consider changing the live policy. This is the only unexecuted evaluation path.
- Add a dedicated reconciliation worker in a new OpenSpec change. It should query provider response state by opaque IDs, prove outcome, and never infer that a timeout means no charge or no accepted request.
- Replace the file/in-memory artifact store with a service-role object-storage adapter that preserves the same content-addressed interface, verifies downloads, and issues bounded signed URLs.
- Add a CI regression that runs the hosted-smoke failure path against a disposable local PostgREST stack once auxiliary local services are stable; the current hosted success and deterministic repository failure tests cover the logic separately.
- Make Git cleanliness/pinning an explicit production-run preflight: consequential runs should refuse a dirty source tree or record a separately signed source-bundle hash in addition to the commit.
- When model/cache challengers accumulate real run data, persist the repeated evaluation records to `studio_agent_evaluations`; keep the current independent evaluator and no-self-promotion rules unchanged.
