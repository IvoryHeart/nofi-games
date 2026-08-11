# Preview deployment and cutover

## Branch model

- `archive/legacy-v1` preserves the legacy production lineage.
- `platform-v2@201cfdd` preserves the falsified prototype and rollback.
- `platform-v3-bootstrap` contains the studio-foundation reset.
- The focused v3 review targets `platform-v2` only to show the reset diff and must not be merged automatically.
- Existing `main` remains production until a separately accepted cutover change defines integration and rollback.

## Local environment

```bash
pnpm install
pnpm bootstrap
pnpm check
pnpm build:web
pnpm infra:start:db
pnpm infra:reset
pnpm db:test
pnpm infra:stop -- --no-backup
```

The database-only local profile recreates product catalog and consented gameplay state. It contains no studio workflow, registry, evaluation, session, attempt, lease, checkpoint, model-call, or evidence objects.

## Supabase verification

GitHub Actions starts disposable local Supabase for the database job, applies `supabase/migrations/` and `supabase/seed.sql`, runs pgTAP, and then stops it. No remote Supabase preview automation is configured, and this bootstrap does not authorize applying its clean baseline to a remote or production database.

## Vercel previews

Keep the existing Git integration. `vercel.json` installs pinned tools, bootstraps Godot, and exports the one player app into `dist/player`.

## Bootstrap review gates

1. Strict OpenSpec and `pnpm check` pass from the reduced tree.
2. Local database reset and all pgTAP product/absence checks pass.
3. The SDK and fixture contract pass, and the generated catalog pins the exact fixture artifact hash. The bounded canonical-UID experiment did not establish byte equality, so this bootstrap makes no reproducible-build claim or equality gate.
4. The player shell loads the integrity-checked fixture pack.
5. The web player export succeeds.
6. No generated artifact, secret, large trace, or user data is staged.
7. `platform-v2@201cfdd` and existing worktree/ref claims remain unchanged.

Autonomous research, game improvement, promotion, release delegation, and production cutover are future changes, not bootstrap gates.
