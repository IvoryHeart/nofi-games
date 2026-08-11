## 1. Preserve the product substrate

- [x] 1.1 Record `platform-v2@201cfdda07e18b41cc5cd4f72a353e3882ab3456` and the existing branch/worktree inventory in a concise v3 history note; verify no task will delete, force-update, merge, or detach those refs.
- [x] 1.2 Move the identifier, hash, game-pack manifest, catalog-entry, and catalog schemas used by `tools/validate-catalog.ts` from `studio/control-plane` into a narrowly named product-contract module, preserving validation behavior and strict TypeScript coverage.
- [x] 1.3 Run focused catalog validation and Godot fixture/SDK checks before deletion to prove the preserved substrate does not require agent registry, workflow, evaluation, or runtime code.

## 2. Remove the falsified execution architecture

- [x] 2.1 Remove `agents/registry.yaml`, autonomous studio skills, agent/evolution/workflow evaluation suites, and their validators while revising the constitution to preserve the autonomous-studio north star, human-owned policy, bounded delegated actions, fail-closed review, and affected-agent separation.
- [x] 2.2 Remove `studio/control-plane`, `studio/workflows`, demo/runtime entry points, workflow/output/promotion contracts, and coupled tests; confirm no executable autonomous research-to-release, game-improvement, or agent-evolution path remains.
- [x] 2.3 Remove project-owned OpenSpec artifact factories and heavyweight platform-v2 change packets from the v3 tree, relying on the pinned prototype branch for quarantine while preserving the generic OpenSpec action skills.
- [x] 2.4 Simplify `package.json`, the pnpm workspace, TypeScript configuration, lockfile, and validation scripts/dependencies to the product foundation; retain formatting, strict type checking, OpenSpec, catalog, Godot, bootstrap/build, preview, and database commands.
- [x] 2.5 Add a small deterministic foundation check that fails if retired registry, workflow, promotion, evidence-ledger, agent-runtime persistence entry points, or forbidden database objects return, without treating the absence of a bootstrap workflow as abandonment of future autonomous operation.

## 3. Reset product-only persistence

- [x] 3.1 Replace the mixed platform-v2 and durable-agent-runtime migrations with one clean pre-cutover baseline containing only game catalog, consented gameplay, their policies, and the private game-pack bucket; do not contact or mutate a remote database.
- [x] 3.2 Update seed data and pgTAP coverage for the product-only baseline, including positive catalog/privacy assertions and explicit absence assertions for workflow, evidence, agent, session, attempt, lease, checkpoint, and model-call objects.
- [x] 3.3 Run the disposable local database start/reset/tests when Docker is available, inspect all output, and stop the local stack without backup; treat unavailable Docker or any ignored/unhandled failure as a PR blocker rather than a pass.

## 4. Establish lightweight agreements and boundaries

- [x] 4.1 Set OpenSpec's default to package `spec-driven`, remove custom schema configuration, and ensure strict validation recognizes only concise proposal/deltas/optional-design/tasks for new changes.
- [x] 4.2 Update current architecture and contributor documentation to distinguish OpenSpec, deterministic orchestration, bounded agents, run records, native harnesses/product runtime, and human authority; clearly mark orchestration as future work while preserving the autonomous research-to-improvement north star.
- [x] 4.3 Incorporate the applicable 12-factor-agent principles—owned prompts/context, structured outputs, deterministic control, compact errors, explicit human transitions, resumable explicit state, small focused agents, and stateless reducers—without adding runtime code or a framework; ambiguity at an authority boundary must route to human review.
- [x] 4.4 Update README, product strategy, constitution, ADRs, preview/cutover runbook, commands, repository map, and CI naming/branch filters; remove claims that agent promotion, automatic release/rollback, evidence workflows, or autonomous execution currently exist while distinguishing current absence from the preserved autonomous-studio direction.
- [x] 4.5 Document the delegation invariant consistently: humans permanently approve authority, delegation, evaluation, promotion, safety, and release policy; only bounded acceptance, release, and promotion actions may be delegated under previously accepted deterministic rules; missing or ambiguous eligibility evidence fails closed to human review; and an affected agent cannot approve or promote its own change.
- [x] 4.6 Verify retained `game-pack-contract`, `single-player-app`, `research-selected-catalog`, and product-only `preview-infrastructure` behavior agrees with documentation and that no fixed genre, monetization, or separate-app scope is introduced.

## 5. Verify, sync, and prepare one PR

- [x] 5.1 Run formatting and diff checks, strict TypeScript, foundation, strict OpenSpec, catalog, and Godot checks through `pnpm check`; inspect logs and resolve every failure without exclusions or swallowed errors.
- [x] 5.2 Run `pnpm bootstrap`, build the fixture pack twice with matching content hash, run the fixture/player contract tests, and run `pnpm build:web`; verify no ignored Godot error and no generated artifact is staged.
- [x] 5.3 Review `git diff --stat`, every deletion, all remaining references to retired components, secrets/large-artifact status, and `git diff --check`; verify preserved platform/tool/fixture/CI files changed only where the reset requires.
- [x] 5.4 Mark all implementation tasks complete, archive/sync `platform-v3-bootstrap` with standard OpenSpec, remove any empty retired current-capability shells left by full requirement removal, and rerun strict OpenSpec plus `pnpm check` from the archived tree.
- [x] 5.5 Recheck that `platform-v2@201cfdd`, every pre-existing branch/worktree claim, remote ref, and PR-evidence ref is unchanged; create one coherent `platform-v3-bootstrap` commit with `platform-v2@201cfdd` as rollback.
- [x] 5.6 Push only `platform-v3-bootstrap` and open one focused PR against `platform-v2` for review without merging it; include scope, removals, preserved substrate, autonomous north star, 12-factor and delegation boundaries, fail-closed behavior, separation of duties, exact checks, database result, and rollback in the PR body.
