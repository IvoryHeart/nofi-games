## Why

Review of the platform-v3 bootstrap found that several current specifications still describe unimplemented platform or workflow behavior, while a hypothetical evidence-ledger capability duplicates the new execution boundary. The same review falsified the claimed cross-worktree reproducibility of the fixture pack and identified duplicate CI runs and machine-local paths in durable history.

## What Changes

- **BREAKING**: narrow current player, game-pack, catalog-selection, preview, and governance requirements so runtime/product claims have observable implementation and focused tests, repository constraints have deterministic checks, and human policy supports only approval, authority, and selection decisions; leave product aspirations in non-normative strategy or future changes.
- **BREAKING**: retire the current `evidence-ledger` capability. Keep only the future-facing constraint that run records contain facts rather than authority under the studio execution boundary.
- The sole bounded canonical-SDK-UID hypothesis did not establish reproducibility: one local clean-cache comparison produced different PCK hashes. Stop causal investigation in this change, make no cross-worktree equality claim or gate, and retain content-addressed artifact hashing with the limitation recorded.
- Run CI once per pull-request update and once after a push to `main`, cancelling stale runs without weakening either the application or database jobs.
- Remove ephemeral machine-local worktree paths from durable platform-v2 history while preserving the pinned rollback branch and commit.
- Keep the market brief and competing-concept record as concise sections of the governing OpenSpec change; do not introduce another custom research-artifact schema or factory.
- Keep the autonomous-studio north star and authority/delegation boundary unchanged. Do not implement identity, telemetry transport, network policy, updates, canaries, rollback automation, catalog research automation, or an autonomous workflow.

Rollback is `platform-v3-bootstrap@39a9df1139c4d2170b8e2502b61c74bb83836232`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `change-governance`: define the distinct enforcement required for current runtime/product behavior, repository constraints, and human-owned approval, authority, or selection decisions—not future product aspiration.
- `evidence-ledger`: retire the hypothetical current capability and defer any concretely named run-record capability until implementation needs it.
- `game-pack-contract`: align manifest, SDK, deterministic-reset, loader-integrity, namespace, and identity requirements with the checks that exist now.
- `preview-infrastructure`: describe the actual pull-request, Vercel, local Supabase, main-push, and rollback behavior without implying unconfigured remote preview automation.
- `research-selected-catalog`: express research and concept comparison as current human/OpenSpec catalog-acceptance policy rather than a nonexistent research-agent workflow.
- `single-player-app`: retain one-app distribution and current local catalog/pack loading while removing unimplemented shell capabilities and automatic rollout/rollback behavior.

## Impact

The change affects current OpenSpec capabilities, the Godot SDK/fixture build inputs and checks, CI triggers, the preview/cutover runbook, the platform-v2 history note, and the existing PR description. It adds no product database objects, autonomous execution code, model integration, or player-facing feature.
