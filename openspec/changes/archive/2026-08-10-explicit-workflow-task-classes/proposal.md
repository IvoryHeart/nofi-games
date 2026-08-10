## Why

The native-harness policy defines two consequential task classes, but the workflow manifests do not declare which class each stage requires. As a result, a native launch must infer judgment level from prose and cannot deterministically reject incomplete or invalid stage provenance.

The falsifiable outcome is that all 13 stages across the three workflow manifests carry a reviewed `taskClass`, missing or unknown values fail validation, and bounded stages checkpoint and escalate instead of making newly discovered high-judgment decisions.

## What Changes

- **BREAKING**: Add required `taskClass` metadata to the workflow-stage contract with exactly two valid values: `bounded-implementation` and `high-judgment`.
- Annotate every stage in `research-to-game`, `game-improvement`, and `agent-evolution` with the reviewed classification from the strategic premise.
- Treat opportunity research, concept design, gameplay analysis, independent game/experiment evaluation, agent improvement observation, and independent agent evaluation as high judgment.
- Treat game build, experiment build, controlled release, experiment release, and agent canary as bounded only after their accepted inputs and decisions are frozen.
- Treat challenger build as bounded only when its frozen hypothesis yields an exact mechanically verifiable edit; otherwise checkpoint and escalate it to high judgment.
- Reject manifests whose stages omit `taskClass` or use any other value, and add deterministic positive and negative contract evidence.
- Require any bounded stage that discovers a new policy, risk, scope, architecture, promotion, or game-design decision to checkpoint useful work and return that decision to a high-judgment task.
- Keep model and reasoning defaults in the canonical native-harness task-class policy. Workflow manifests declare intent; Codex remains responsible for native launch and execution.
- Non-goals: a router, scheduler, provider adapter, model client, conversation/session runtime, task coordinator, database lease, automatic model selection service, per-workflow model identifiers, or any player, game-pack, catalog, monetization, or distribution behavior.
- Rollback boundary: revert the implementation to Git commit `98ce6ce5219685d4dd6d8715cae6e3c521faed74`, restoring the prior workflow schema and three manifests together. No external or runtime data migration is involved.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `native-harness-workflow`: Require every workflow stage to declare its task class, define the reviewed classification and escalation behavior, validate the vocabulary, and preserve the existing native Codex model-policy boundary.

## Impact

- `studio/control-plane/src/contracts.ts`: shared workflow-stage enum and required field.
- `studio/workflows/*.yaml`: declarations for all 13 existing stages; no new stage graph or runtime behavior.
- Workflow contract and validator tests: positive coverage for all manifests and negative coverage for missing and invalid values.
- `tools/validate-workflows.ts`: continues to be the repository-wide manifest validation entry point through the shared contract.
- Native-harness documentation and task packets: explain frozen-input preconditions, checkpoint/escalation, and declared-versus-used class provenance without duplicating model identifiers.
- Dependencies and infrastructure: none added. Supabase, Vercel, GitHub coordination, the player app, game packs, catalogs, agents' promotion separation, and distribution remain unchanged.
