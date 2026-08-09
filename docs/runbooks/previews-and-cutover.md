# Preview deployment and cutover

## Branch model

- `archive/legacy-v1` pins the legacy production lineage.
- `platform-v2` is the clean orphan implementation branch.
- Pull requests into `platform-v2` receive isolated previews.
- Existing `main` remains production until all cutover gates pass.
- After acceptance, archive the legacy commit remotely and make the v2 history the new production `main`.

## Local environment

```bash
pnpm install
pnpm bootstrap
pnpm infra:start
pnpm infra:reset
pnpm db:test
pnpm check
pnpm build:web
```

The Supabase CLI runs Postgres, Auth, Storage, Realtime, and Studio in Docker. Local default credentials and data must never be exposed publicly.

## Supabase previews

Use the existing Supabase project's GitHub integration with repository working directory `.`. Enable automatic branching and require its GitHub check. Preview branches apply `supabase/migrations/` and seed only `supabase/seed.sql`; they do not receive production data.

Do not enable deploy-to-production until the platform-v2 database reset, tests, and rollback rehearsal pass.

## Vercel previews

Keep the existing Git integration. Configure `platform-v2` as a preview branch while `main` remains production. `vercel.json` installs pinned tools, bootstraps Godot, and exports the single player app into `dist/player`.

## Cutover gates

1. OpenSpec and all repository checks pass from a clean clone.
2. Supabase migration reset and database tests pass locally and in preview.
3. The Godot player shell exports and loads an integrity-checked fixture pack.
4. One research-to-game workflow completes with an independently evaluated candidate.
5. One game improvement and one agent champion/challenger cycle demonstrate rollback.
6. Preview telemetry links every decision to pinned evidence.
7. The legacy production commit is addressable by archive branch and deployment.
8. The v2 preview is promoted, monitored, and reversible before legacy services are removed.
