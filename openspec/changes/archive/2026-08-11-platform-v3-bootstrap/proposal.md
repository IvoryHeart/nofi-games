## Why

The first autonomous game run falsified the `platform-v2` execution architecture, not the autonomous-studio north star. Repository-owned registries, workflow graphs, promotion machinery, evidence artifacts, custom OpenSpec factories, and runtime persistence made the run slower to understand and harder to trust than the work it coordinated, duplicating responsibilities already supplied by Git, OpenSpec, native coding harnesses, and deterministic programs. Reset to the smallest studio foundation that preserves the proven player and game-pack substrate while making future automation earn its place through explicit, testable changes.

Evidence for the reset is the preserved `platform-v2` source at commit `201cfdda07e18b41cc5cd4f72a353e3882ab3456`, including the oversized active game-run packet, the completed-but-unadopted runtime change, and the overlapping workflow, registry, evidence, and database implementations. The reset succeeds if a fresh contributor can identify the five studio boundaries from current docs and specs, the preserved player/fixture checks remain green, and no executable autonomous workflow or agent-runtime state store remains. The rollback target is branch `platform-v2` at that commit.

## What Changes

- Preserve the Godot player app, SDK, game-pack contract, fixture game, catalog and Godot build tools, CI, single-app product direction, and still-useful product and architecture decisions.
- **BREAKING**: remove current studio execution behavior based on the agent registry, self-promotion/evolution system, declarative autonomous workflow graphs, evidence/decision control plane, and Supabase agent-runtime persistence.
- Quarantine `platform-v2` planning and run material as non-normative history without deleting historical branches, worktrees, or PR evidence.
- Reconfigure OpenSpec to its lightweight `spec-driven` workflow: current behavioral specs, concise proposed deltas, optional design notes, and executable task lists. OpenSpec will not be a runtime database, evidence ledger, agent registry, or artifact factory.
- Preserve the north star of an agent-operated studio that continuously researches, creates, evaluates, releases, observes, and improves one catalog, while implementing no autonomous workflow in this reset.
- Establish a future-facing boundary: OpenSpec records accepted intent; deterministic orchestration will own control flow and durable transitions; bounded agents will perform small judgment tasks through structured inputs and outputs; run records will contain operational facts and artifact references; and humans will own authority policy.
- Allow humans to delegate bounded acceptance, release, and promotion actions under previously accepted deterministic rules. Delegated execution will fail closed to human review when eligibility evidence is missing or ambiguous. Delegation will never cover changes to authority, delegation, evaluation, promotion, safety, or release policy itself, and an affected agent will never approve or promote its own change.
- Apply the relevant 12-factor-agent principles at that boundary: repository-owned prompts and context assembly, structured tool requests/results, deterministic control flow, compact errors, small focused agents, explicit human-contact transitions, resumable state outside model context, and agent calls shaped as stateless reducers. This change implements none of those future agent workflows.

Non-goals for this change are building an orchestrator, model client, conversation/session manager, task lease service, subagent coordinator, agent registry replacement, promotion system, run database, catalog research workflow, game, monetization feature, or separate distribution app. These implementation non-goals do not narrow the autonomous-studio product direction.

## Capabilities

### New Capabilities

- `studio-execution-boundary`: Defines the ownership and authority boundary among OpenSpec, deterministic orchestration, bounded agents, run records, native harnesses, product runtime, and humans.

### Modified Capabilities

- `change-governance`: Replaces evidence-heavy, schema-specific governance with a lightweight agreement and durable-knowledge protocol.
- `evidence-ledger`: Retires the workflow ledger and narrows future run records to operational observations and artifact references, not coordination or decision authority.
- `native-harness-workflow`: Retires repository-owned workflow stages, task routing policy, and provider-shaped task packets while retaining native harness ownership of model execution.
- `agent-evolution`: Removes the prototype self-improvement and promotion machinery while preserving future human-authorized, deterministic promotion of eligible changes with affected-agent separation.
- `strategic-premise-validation`: Retires the dedicated premise artifact factory and evaluation suite; consequential design alternatives and rollback remain concise design responsibilities.
- `preview-infrastructure`: Moves preview and disposable database behavior from the preserved `platform-v2` prototype to the product-only `platform-v3-bootstrap` foundation.

## Impact

- Removes or quarantines `agents/registry.yaml`, autonomous-agent skills and evals, `studio/control-plane`, `studio/workflows`, runtime/evidence database objects, legacy OpenSpec schemas and change packets, and their validators, scripts, dependencies, and documentation references.
- Updates `README.md`, `AGENTS.md`, `agents/constitution.md`, product/architecture documentation, package scripts, OpenSpec configuration/current specs, and CI-facing checks to describe and verify the smaller foundation.
- Leaves `platform/`, the fixture under `games/fixtures/`, relevant Godot/catalog tooling, deployment configuration, and their behavioral contracts intact; changes to player-facing or game-pack behavior are out of scope.
