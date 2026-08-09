# Supabase runtime operations

Supabase is the authoritative ledger for workflow runs, sessions, attempts, checkpoints, call accounting, and evidence provenance. Runtime tables have RLS enabled, no browser policies, and service-role-only grants.

## Local database

For deterministic database work, start only Postgres and its migration environment:

```bash
pnpm infra:start:db
pnpm infra:reset
pnpm db:test
pnpm infra:stop --no-backup
```

The database-only profile avoids unrelated local Studio, storage, metadata, and analytics container health failures. Use `pnpm infra:start` only when those APIs are actually under test. A zero-state reset and pgTAP are the acceptance path; never infer database correctness from TypeScript mocks.

## Hosted project recovery and credentials

The existing `nofi-games` project was restored on 2026-08-09 and verified `ACTIVE_HEALTHY`. Keep credentials in ignored environment files or deployment secret stores. Required server names are:

```text
SUPABASE_ACCESS_TOKEN
SUPABASE_PROJECT_REF
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

`SUPABASE_ANON_KEY` is optional for the RLS smoke. A 401 with PostgreSQL code `42501` and `permission denied` proves the key reached the project but lacks table access; it is not an invalid-key signal. Rotate a key only after authentication itself is shown invalid.

Never print environment values, API-key responses, connection strings, or debug output. In particular, do not run `supabase db dump --dry-run` in a shared log: the CLI may print an ephemeral database login. Use migration history and explicit metadata queries instead.

## Non-destructive hosted migration

```bash
supabase link --project-ref "$SUPABASE_PROJECT_REF"
supabase migration list
supabase db push --linked --dry-run
supabase db push --linked
supabase migration list
```

Never run `supabase db reset` against the linked project. Inspect existing public-table names before pushing. The platform migrations use new `studio_*` names and conflict-safe storage buckets; if a dry run indicates drops, resets, or collisions, stop and open a new migration change.

The hosted verification on 2026-08-09 applied and matched:

```text
202608090001_platform_v2.sql
202608090002_durable_agent_runtime.sql
```

The final PostgREST/RPC smoke retained completed workflow run `d773b698-6990-4a19-9a22-055cd0fc630f`, accepted attempt `e1f9814f-ff6d-43c4-aeb0-5055ef882258`, and checkpoint `8576da79-86c2-4008-937b-100aa5ade7c9`. It proved one-call acceptance, zero-call replay, lease and checkpoint RPCs, usage/pricing reads, complete provenance, secret-canary containment, and browser denial. These IDs are non-secret append-only audit evidence.

Repeat the bounded repository smoke with:

```bash
pnpm studio:runtime hosted-smoke
```

It intentionally leaves a completed audit run because immutable model calls and checkpoints must not be deleted. It does not mutate legacy tables.

## Rollback and incident handling

Database rollback is operational, not destructive: disable live calls and claims, preserve append-only rows, and deploy a forward corrective migration. Do not drop the runtime tables or delete evidence. If hosted RLS exposes a runtime row to an anonymous/authenticated client, disable workers and live execution immediately and fix grants/policies before resuming.
