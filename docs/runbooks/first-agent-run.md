# First durable agent run

This guide proves the workflow before any game opportunity is selected. Keep deterministic runtime verification and product research in separate OpenSpec changes.

## 1. Validate the repository and fake path

```bash
pnpm install --frozen-lockfile
pnpm bootstrap
pnpm studio:runtime validate
pnpm studio:runtime fake-run
pnpm check
```

The fake run must return `accepted` with one call. Run it again through the coordinator tests to verify accepted replay uses zero calls.

## 2. Validate durable persistence

```bash
pnpm infra:start:db
pnpm infra:reset
pnpm db:test
```

For a restored hosted project, follow `docs/runbooks/supabase-runtime.md`, confirm the dry run is additive, then run `pnpm studio:runtime hosted-smoke` with server credentials. Never reset hosted state.

## 3. Authorize the bounded live provider smoke

Live execution is off in the champion policy and blocked again at the coordinator. For a one-call local adapter check:

```bash
NOFI_LIVE_PROVIDER_ENABLED=true pnpm studio:runtime live-smoke
```

For the full three-call create/continue/rotate assertion:

```bash
NOFI_LIVE_PROVIDER_TEST=true \
NOFI_LIVE_PROVIDER_ENABLED=true \
pnpm vitest run studio/control-plane/test/live-provider.test.ts
```

Both require `OPENAI_API_KEY`. The full smoke has a 500,000 micro-USD aggregate ceiling, zero repair retries, at most three completed calls, structured output assertions, observed usage checks, and conversation cleanup. In GitHub, manually dispatch `Manual live provider smoke`, explicitly authorize cost, and use the protected `live-provider-smoke` environment.

If credentials are absent, record the omission; do not weaken the gate or silently substitute a fake result. If any secret, duplicate call, invalid output, incomplete provenance, or budget violation appears, disable live execution and preserve the evidence.

## 4. Start product research separately

After this runtime change receives independent acceptance, create a new OpenSpec change such as:

```bash
pnpm exec openspec new change game-concept
```

That change should ask the research workflow to discover current opportunities, retain source snapshots, evaluate multiple concepts, and let evidence choose what enters the single-app catalog. Do not encode a fixed genre list, begin monetization, or publish a production game from the runtime-scaffolding change.
