# Verification

## Execution provenance

- Change: `explicit-workflow-task-classes` (`system-change`).
- Implementation task identity: `workflow-task-classes/implementation`.
- Task class: `bounded-implementation`.
- Configured model: `gpt-5.6-luna`; reasoning effort: `xhigh`.
- Harness: Codex CLI `0.147.0`.
- Resolved model: not exposed by this harness.
- Source commit at implementation start: `9c87c03`.
- Rollback target: `98ce6ce5219685d4dd6d8715cae6e3c521faed74`.
- Independent-review evidence correction (2026-08-10): the first failed planning transcript is `/var/tmp/nofi-workflow-task-classes-sol.jsonl`, SHA-256 `964ac58a46bdfdfed11f0d601f3f04f36318c267a28233f0c8c00f538cea9357`; the successful planning retry is `/var/tmp/nofi-workflow-task-classes-sol-retry.jsonl`, SHA-256 `59761d071f4cf88d436f2aa9e4e3c63b8bed5b819acebd9fd59cfcc76ddfb36e`. The original line mislabeled the failed transcript hash as the retry hash.
- The final coherent implementation/evidence checkpoint is the commit reported with this artifact; no independent decision is implied by the implementation checkpoint.

## Migration boundary

Task 1.1 search found one supported `WorkflowDefinition` ingestion path: `tools/validate-workflows.ts` imports the shared contract and parses every YAML file under `studio/workflows/`. The focused test also parses the same three manifests for its exact matrix assertions. No second supported workflow-definition reader, external workflow-definition API, persisted workflow-definition table, or schema-version-1 workflow-definition payload was found. Other version-1 contracts are separate game-pack, agent, evaluation, catalog, and workflow-run records and were not migrated.

The manifest diff against the rollback target contains only the schema/version boundary, required `taskClass` declarations, and the challenger gate. Agent references, skills, dependencies, artifacts, mutation, publication, and separation-of-duties fields are unchanged.

## Exact classification matrix

| Workflow           | Stage                          | Task class               |
| ------------------ | ------------------------------ | ------------------------ |
| `research-to-game` | `opportunity-research`         | `high-judgment`          |
| `research-to-game` | `concept-design`               | `high-judgment`          |
| `research-to-game` | `game-build`                   | `bounded-implementation` |
| `research-to-game` | `independent-game-evaluation`  | `high-judgment`          |
| `research-to-game` | `controlled-release`           | `bounded-implementation` |
| `game-improvement` | `gameplay-analysis`            | `high-judgment`          |
| `game-improvement` | `experiment-build`             | `bounded-implementation` |
| `game-improvement` | `experiment-evaluation`        | `high-judgment`          |
| `game-improvement` | `experiment-release`           | `bounded-implementation` |
| `agent-evolution`  | `improvement-observation`      | `high-judgment`          |
| `agent-evolution`  | `challenger-build`             | `bounded-implementation` |
| `agent-evolution`  | `independent-agent-evaluation` | `high-judgment`          |
| `agent-evolution`  | `agent-canary`                 | `bounded-implementation` |

## Command evidence

Raw command logs are retained outside Git under `/tmp/nofi-explicit-workflow-task-classes-*.log` in this execution environment. Relevant results:

| Command                                                                                | Result              | Relevant output                                                                                                                                                                               |
| -------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test -- studio/control-plane/test/workflow-task-classes.test.ts`                 | Pass on retry       | `Test Files 3 passed (3)`; `Tests 14 passed (14)`; pnpm v11.21.0. The script runs the repository suite; the direct focused binary run below isolates the new file.                            |
| `node_modules/.bin/vitest run studio/control-plane/test/workflow-task-classes.test.ts` | Pass                | `Test Files 1 passed (1)`; `Tests 7 passed (7)`.                                                                                                                                              |
| `pnpm workflows:validate`                                                              | Pass                | `Agent registry and workflows valid: 8 agents, 3 workflows`.                                                                                                                                  |
| `node_modules/.bin/openspec validate explicit-workflow-task-classes --strict`          | Pass                | `Change 'explicit-workflow-task-classes' is valid`.                                                                                                                                           |
| `pnpm check`                                                                           | Pass on final retry | Formatting, typecheck, 14 tests, skills, premises, strict OpenSpec, evaluations, workflows, catalog, Godot app, fixture, pack export, and single-app pack loading all completed successfully. |
| `node_modules/.bin/prettier --check` on changed artifacts                              | Pass on retry       | `All matched files use Prettier code style!`.                                                                                                                                                 |
| `node_modules/.bin/tsc -b`                                                             | Pass                | No diagnostic output; exit 0.                                                                                                                                                                 |
| Adversarial harness                                                                    | Pass                | `ADVERSARIAL_CASES_OK: 10/10`.                                                                                                                                                                |

Focused negative fixtures all rejected at the shared contract boundary:

- Missing `taskClass`: rejected.
- `balanced`: rejected.
- `bounded`: rejected.
- `gpt-5.6-luna`: rejected.
- `schemaVersion: 1` under `WorkflowDefinition`: rejected; version 2 parses.

The positive validator path still checks the existing agent registry, skill references, dependency order, and produced/consumed artifact availability. No second task-class vocabulary was added: both the schema and inferred type use the exported `TaskClass` enum.

## Adversarial runbook evidence

The reproducible harness at `/tmp/nofi-explicit-workflow-task-classes-adversarial.log` exercised all cases from `evaluation-plan.md`:

1. Missing `taskClass` was rejected by `WorkflowStage`.
2. `balanced`, `bounded`, and a model identifier were rejected.
3. `game-build` was blocked without frozen `selected-spec` and `evaluation-plan` inputs by the bounded-stage preflight.
4. An ambiguous `challenger-build` was blocked by the exact `mechanically-verifiable-edit` gate and protected-holdout rule.
5. Controlled release, experiment release, and agent canary were constrained to accepted verdicts, declared cohorts, and rollback; waiver, verdict, cohort-expansion, and rollback-policy requests escalate.
6. Newly discovered privacy, safety, dependency, risk, scope, or architecture decisions require a coherent checkpoint and high-judgment handoff.
7. Independent game, experiment, and agent evaluation stages remained high judgment in the exact matrix.
8. Manifest scans found no model, reasoning, provider, session, router, scheduler, or lease fields.
9. All manifests were `schemaVersion: 2`, workflow version `0.2.0`; a version-1 definition was rejected.
10. The repository validator remained the supported workflow reader and parsed all three manifests through `WorkflowDefinition`.

Cases 3–6 intentionally validate the existing task-packet/runbook boundary; there is no repository launcher or runtime that could silently continue a blocked bounded task.

## Protected metrics

| Metric                            | Implementation evidence                                                                                         | Status for independent review                              |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Task-class coverage               | 13 of 13 stages declare one of the two enum values.                                                             | Evidence pass; reviewer decision pending.                  |
| Classification accuracy           | The table-driven test matched all 13 expected tuples.                                                           | Evidence pass; reviewer decision pending.                  |
| Invalid-value acceptance          | 0 missing/unknown fixtures accepted.                                                                            | Evidence pass; reviewer decision pending.                  |
| Bounded precondition coverage     | Six bounded rows have frozen-input/runbook conditions; `challenger-build` additionally has the exact-edit gate. | Evidence pass; reviewer must inspect authority boundaries. |
| Unauthorized bounded decisions    | 10 of 10 adversarial cases stopped or escalated as specified.                                                   | Evidence pass; reviewer decision pending.                  |
| Challenger exact-edit protection  | `mechanically-verifiable-edit` is present and vague hypotheses are blocked in the runbook.                      | Evidence pass; reviewer decision pending.                  |
| Independent-decision preservation | Evaluation and verdict stages remain high judgment; releases apply accepted decisions only.                     | Evidence pass; reviewer decision pending.                  |
| Model-policy duplication          | 0 forbidden model/reasoning/provider/session fields in all manifests.                                           | Evidence pass; reviewer decision pending.                  |
| Operational-surface growth        | No parser, runtime, provider, coordination, persistence, dependency, or product-surface additions.              | Evidence pass; reviewer decision pending.                  |
| Regression failures               | Focused tests, strict validation, and final `pnpm check` passed.                                                | Evidence pass; reviewer decision pending.                  |
| Rollback completeness             | Isolated Git snapshot restored contract version 1 and all three `0.1.0` manifests.                              | Evidence pass; reviewer decision pending.                  |

## Strategic-fit and rollback scans

Working-tree changed paths are limited to:

- `studio/control-plane/src/contracts.ts`;
- `studio/control-plane/test/workflow-task-classes.test.ts`;
- `studio/workflows/research-to-game.yaml`;
- `studio/workflows/game-improvement.yaml`;
- `studio/workflows/agent-evolution.yaml`;
- `docs/runbooks/native-harness-workflow.md`; and
- this OpenSpec change's task/evidence artifacts.

No package manifest, lockfile, database migration/test, Supabase code, provider/model client, router, scheduler, session runtime, lease/coordinator, player app, game-pack, catalog, or distribution path changed. The forbidden-field scan over `studio/workflows/` returned `none`. The only supported workflow-definition consumer scan returned `tools/validate-workflows.ts`; the test reader is an acceptance fixture, not a production path.

The isolated rollback command created a detached worktree at the pinned target, observed `schemaVersion: z.literal(1)` in the workflow contract, observed `schemaVersion: 1` and `version: 0.1.0` in all three manifests, found no task-class migration fields, and removed the temporary worktree. No external cleanup or data migration was required.

## Changed-artifact hashes

These hashes cover the final non-self-referential implementation and evidence artifacts before the checkpoint commit:

```text
e3832e88e0359efe00228bf0eb972c7e04f6f8adb15844e4a63c45d34856a4cf  studio/control-plane/src/contracts.ts
1f9650e30dd4de774dc0459146833454aafe03b30091db8a45d9265f00ae0723  studio/control-plane/test/workflow-task-classes.test.ts
f8deb317a5e8a5a6e3a63a75d0fe15e5f40c373d7662c071659c83efded22752  studio/workflows/research-to-game.yaml
c5a0d492e228ea8bb35ef89a284205e6d040c1803f045d7fe436b61b0ffbe747  studio/workflows/game-improvement.yaml
8c73c4910944b174f2f0a0a35f9d003598cac6782db451d1032149d5fc14b25a  studio/workflows/agent-evolution.yaml
bfee0b40cebd030782744c4fadd34a6c7b286dc84c695549b1a0bfa2eee00f8e  docs/runbooks/native-harness-workflow.md
088e4e3e407430dbaa34722c652b489ebd448aa9edfb82d2a7c3d98f4ff3a662  openspec/changes/explicit-workflow-task-classes/tasks.md
f3ff68b1bfb7f88bf8b0c14288cf728997f38169e73fabc58867a5796221843f  openspec/changes/explicit-workflow-task-classes/retrospective.md
```

## Failures, retries, and unresolved work

- Independent-review evidence correction (2026-08-10): the retained builder transcript also records a failed initial lookup of `agents/skills/openspec-apply-change/SKILL.md` before the correct `.agents/skills/openspec-apply-change/SKILL.md` path was loaded, and a later repository-wide Prettier failure on `verification.md` before that file was formatted and the check passed. These recovered failures were omitted from the original list below; neither altered the implementation or remained unresolved.
- The first exact `pnpm test` attempt exited 1 before test execution because pnpm rejected the setup-only cross-worktree `node_modules` symlink (`ERR_PNPM_UNSAFE_MODULES_DIR`). A temporary in-worktree dependency-link setup allowed the exact retry to pass; the original symlink was restored and no dependency files changed.
- The first focused Prettier check found only the new test file unformatted. `prettier --write` corrected it; the formatting retry, focused test retry, and typecheck passed.
- The first `pnpm check` reached the final Godot step and exited 1 because this worktree lacked `.tools/godot/4.7.1/godot`. A temporary symlink to the existing repository-local Godot binary enabled the final exact retry; the symlink was removed, and the full check passed.
- One repository search command was retried after a shell-quoting error, and one combined patch was retried after a stale runbook context mismatch; neither changed repository state.
- Independent high-judgment task 4.3 remains unresolved. This implementing agent did not author `decision.md`, promote the change, or close the independent review gate.
