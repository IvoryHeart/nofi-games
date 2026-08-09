# Nofi Studio

Nofi Studio is an autonomous game studio and a single cross-platform player app. Agents research opportunities, specify original games, build Godot game packs, evaluate them, publish qualified packs to one catalog, learn from gameplay evidence, and improve both games and agents.

This branch is intentionally greenfield. It reuses the existing `IvoryHeart/nofi-games` repository and its GitHub, Supabase, Vercel, domain, and secret integrations without inheriting the legacy source architecture. The legacy lineage is preserved under `archive/legacy-v1` until cutover is complete.

## Product invariants

- Distribution is one player app, not one app per game.
- The catalog is chosen by research and evidence; genre lists are not product requirements.
- Games are signed, immutable, versioned packs loaded by the player app.
- Godot 4.7.1 Compatibility and typed GDScript are the initial runtime profile.
- Specifications and accepted knowledge evolve through OpenSpec and Git.
- Agents propose their own improvements but cannot promote themselves.
- Every production decision links to reproducible evidence and a rollback target.
- Monetization is out of scope until the gameplay learning loop and distribution are reliable.

## Read first

1. [`AGENTS.md`](AGENTS.md)
2. [`docs/product/strategy.md`](docs/product/strategy.md)
3. [`docs/architecture/system.md`](docs/architecture/system.md)
4. [`agents/constitution.md`](agents/constitution.md)
5. [`openspec/specs/`](openspec/specs/)

## Commands

```bash
pnpm install
pnpm bootstrap
pnpm check
pnpm game:new -- <game-id>
pnpm game:test -- <game-id>
pnpm studio:demo
pnpm infra:start:db
pnpm infra:reset
pnpm db:test
pnpm workflows:validate
```

`pnpm bootstrap` installs a repository-local Godot binary and export templates. It does not depend on a system Godot installation.

Codex and Claude Code execute studio work through their native harnesses. OpenSpec is the task and decision system; Git branches, worktrees, and commits provide local isolation and checkpoints. See [`docs/runbooks/native-harness-workflow.md`](docs/runbooks/native-harness-workflow.md).

`pnpm infra:start:db` runs the deterministic database-only Supabase profile used by CI for product schemas. Supabase is not part of local agent-task coordination.

## Repository map

```text
agents/                 Versioned agent definitions and reusable skills
docs/                   Product strategy, architecture, ADRs, and runbooks
evals/                  Agent, game, workflow, regression, and holdout evals
games/                  Fixture, candidate, and promoted game-pack projects
openspec/               Living capabilities and proposed changes
platform/               Godot SDK, player app, catalog, and game template
studio/control-plane/   Workflow contracts, compact provenance, and evaluation decisions
studio/workflows/       Versioned agent stage graphs and artifact gates
tools/                  Deterministic bootstrap, validation, and build tools
supabase/               Reproducible local/preview database, storage, and tests
.github/ + vercel.json  Continuous verification and preview deployment
```

## Change protocol

Use an OpenSpec change for any modification to behavior, contracts, architecture, workflows, agent definitions, evaluation policy, or release policy. Code and documentation are not accepted until the change contains verification evidence and a decision artifact.
