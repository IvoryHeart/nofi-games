# Nofi Studio

Nofi is one cross-platform player app for a research-selected catalog of original Godot games. The north star is an agent-operated studio that continuously researches, creates, evaluates, releases, observes, and improves that catalog.

`platform-v3-bootstrap` is intentionally smaller than that destination. It preserves the proven player and game-pack substrate while removing the execution architecture falsified by the first autonomous game run. No autonomous studio workflow, agent registry, promotion engine, or agent-runtime persistence exists on this branch.

## Product invariants

- Distribution is one player app, not one app per game.
- Research and evidence choose the catalog; genre lists are not product requirements.
- Games are immutable, versioned packs loaded through the player app.
- Godot 4.7.1 Compatibility and typed GDScript are the initial runtime profile.
- OpenSpec is a lightweight agreement and durable-knowledge layer.
- Humans permanently approve authority, delegation, evaluation, promotion, safety, and release policy.
- Changes to those policies are never delegable.
- Humans may later delegate bounded acceptance, release, and promotion actions under previously accepted deterministic rules.
- Delegated execution fails closed to human review when eligibility evidence is missing, conflicting, stale, invalid, or ambiguous.
- An affected agent cannot approve or promote its own change.
- Monetization remains out of scope.

## Read first

1. [AGENTS.md](AGENTS.md)
2. [Product strategy](docs/product/strategy.md)
3. [System architecture](docs/architecture/system.md)
4. [Agent constitution](agents/constitution.md)
5. [Current capabilities](openspec/specs/)

## Commands

```bash
pnpm install
pnpm bootstrap
pnpm worktree:new -- <sibling-path> <branch>
pnpm check
pnpm format:check
pnpm format:write
pnpm typecheck
pnpm foundation:validate
pnpm openspec:validate
pnpm catalog:validate
pnpm godot:sync-sdk
pnpm godot:build-fixture-pack
pnpm godot:check
pnpm game:new -- <game-id>
pnpm game:test -- <game-id>
pnpm build:web
pnpm infra:start
pnpm infra:start:db
pnpm infra:stop
pnpm infra:reset
pnpm db:test
```

`pnpm bootstrap` installs the pinned repository-local Godot runtime and export templates, then synchronizes the canonical SDK. `pnpm check` validates formatting, strict TypeScript, the foundation boundary, OpenSpec, the catalog, the SDK, the fixture, and single-app pack loading.

The local Supabase profile contains only product catalog and consented gameplay state. It is not a studio task, lease, session, checkpoint, model-call, or evidence store.

## Foundation boundary

- **OpenSpec:** current behavioral specs, concise proposed deltas, optional design, and tasks.
- **Deterministic orchestration (future):** control flow, durable transitions, retries, idempotency, delegation eligibility, and side effects.
- **Bounded agents (future):** small judgment transformations with owned prompts/context and structured outputs.
- **Run records (future):** operational facts and artifact references, never authority or accepted knowledge.
- **Humans:** policy ownership and initial action approval, with bounded action delegation permitted under accepted fail-closed rules.
- **Product runtime:** the player, catalog, game packs, product identity, storage, telemetry, updates, and rollback.

Codex is the primary coding harness; Claude Code remains adoptable. Native harnesses own conversations, context, permissions, tools, authentication, models, and subagents. The repository does not implement those lifecycle concerns.

## Repository map

```text
agents/                 Authority constitution only
docs/                   Product strategy, architecture, ADRs, history, and runbooks
games/fixtures/         Non-discoverable contract fixture
openspec/specs/         Accepted behavioral capabilities
openspec/changes/       Concise proposed deltas and implementation tasks
platform/               Godot SDK, player app, catalog, and game template
tools/                  Deterministic bootstrap, validation, and build tools
supabase/               Product-only local/preview schema, seed, and tests
.github/ + vercel.json  Continuous verification and player-app previews
```

## Change protocol

Use a `spec-driven` OpenSpec change before modifying behavior, architecture, contracts, agent boundaries, evaluation policy, or release policy. A change contains a concise proposal, delta specs, design only when useful, and executable tasks. Operational output belongs in command logs or future run records, not mandatory evidence/decision artifact factories.

See [the platform-v2 history note](docs/history/platform-v2.md) for the preserved prototype and rollback commit.
