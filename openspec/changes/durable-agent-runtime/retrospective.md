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

- A provider-neutral direct-model API was the right abstraction for an agent-driven development platform. The required portability boundary is the task/evidence protocol; Codex and Claude Code should retain native execution.
- Supabase leases and checkpoint rows were required for the current local workflow. Git branches/worktrees and coherent commits provide visible ownership and recovery without a second source of truth.
- Exhaustive implementation tests were sufficient architecture evidence. They proved internal correctness while entirely missing build-versus-integrate and strategic fit.
- A provider conversation could safely stand in for durable long-running agent state. It cannot; it may disappear independently of accepted work.
- Blocking new claims was enough for rollback. It was not enough for already running asynchronous calls.
- Model-supplied evidence hashes could be treated as authoritative. Only hashes computed over retained bytes are authoritative.
- A fake provider's locally monotonic response sequence was globally unique. It was unique only within one adapter instance.
- A full local Supabase stack was necessary for database acceptance. Postgres-only local tests plus hosted repository smoke are more deterministic and cover the intended boundaries.
- A read-only CLI dry run was automatically safe to log. Some dry-run commands expose temporary connection material.
- A SQL assertion that merely expects a permission error could not destabilize the database. The pgTAP/PostgreSQL interaction disproved that assumption.

## Improvement suggestions

- Supersede this runtime with `native-harness-workflow`; do not execute the live OpenAI suite unless a future accepted change specifically justifies a direct-model harness.
- Add the `validate-strategic-premise` skill and require its artifact before consequential architecture proposals.
- Reuse content-addressed artifacts, redaction lessons, and failure evidence only when a future accepted capability needs them; do not continue implementation tasks for the rejected runtime by default.
