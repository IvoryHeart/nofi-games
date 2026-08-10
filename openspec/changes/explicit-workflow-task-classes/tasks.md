## Work packet

- Change: `explicit-workflow-task-classes` (`system-change`)
- Task identity: `workflow-task-classes/implementation` (reassigned from `workflow-task-classes/plan` for this bounded implementation claim).
- Supported harness: `codex`
- Task class: `bounded-implementation`
- Configured model: `gpt-5.6-luna`
- Reasoning effort: `xhigh`
- Harness/version: Codex CLI `0.147.0`
- Resolved model: not exposed in the retained planning evidence; record it in verification if the implementation harness exposes it.
- Branch/worktree: `agent/codex/workflow-task-classes/plan` at `/home/ny/Forge/WizardOfAgents/nofi-workflow-task-classes`; inspect active claims before any reassignment and do not create a duplicate writable claim.
- Inputs and dependencies: `AGENTS.md`; product strategy and system architecture; agent constitution; current `native-harness-workflow`, `agent-evolution`, `research-selected-catalog`, `change-governance`, and `strategic-premise-validation` specs; the rejected `durable-agent-runtime` change; the accepted planning artifacts in this change; repository-local OpenSpec CLI `1.8.0`; no dependency installation.
- Prior failed attempt: the first Sol/xhigh planning attempt completed repository/schema reconnaissance but could not write because nested workspace isolation failed with `bwrap: loopback: Failed RTM_NEWADDR`. Its raw log is retained outside the repository with SHA-256 `964ac58a46bdfdfed11f0d601f3f04f36318c267a28233f0c8c00f538cea9357`; it is provenance, not a repository artifact or a reason to add another execution layer.
- Writable scope: `studio/control-plane/src/contracts.ts`; the three YAML files under `studio/workflows/`; focused workflow-contract tests under `studio/control-plane/test/`; `docs/runbooks/native-harness-workflow.md`; and verification, retrospective, and decision artifacts under `openspec/changes/explicit-workflow-task-classes/`. Do not modify player/game-pack/catalog code, dependencies, provider/model clients, orchestration, session/runtime code, Supabase, or unrelated documentation.
- Acceptance commands: `pnpm test -- studio/control-plane/test/workflow-task-classes.test.ts`; `pnpm workflows:validate`; `node_modules/.bin/openspec validate explicit-workflow-task-classes --strict`; `pnpm check`.
- Required evidence: raw exit status and complete relevant output for every acceptance command; all 13 expected workflow/stage/class tuples; missing/invalid-value rejection; schema/workflow version assertions; challenger exact-edit gate; bounded precondition/escalation review; workflow-consumer search; manifest forbidden-field scan; final diff against rollback; changed-artifact hashes; harness/version, task class, configured and resolved model when exposed, reasoning effort, source commit, and checkpoint commits; all failures and omissions.
- Independent gate: a separate `high-judgment` reviewer must apply `evaluation-plan.md`, inspect raw evidence and the final diff, and author the acceptance verdict. The implementing agent must not promote its own work or weaken protected metrics.
- Rollback target: `98ce6ce5219685d4dd6d8715cae6e3c521faed74`; rollback restores the workflow contract and all three manifests atomically through Git and does not delete or migrate external state.

## 1. Contract and manifest migration

- [x] 1.1 Search all supported workflow-definition consumers and any persisted/external schema-version-1 assumptions; record the result, and stop for a high-judgment design update if an undeclared consumer makes the atomic version-2 migration unsafe.
- [x] 1.2 Add the exported two-value `TaskClass` Zod enum and inferred TypeScript type, require `taskClass` on `WorkflowStage`, and change only the workflow-definition schema boundary to `schemaVersion: 2`.
- [x] 1.3 Update `research-to-game.yaml`, `game-improvement.yaml`, and `agent-evolution.yaml` atomically to schema version 2 and workflow version `0.2.0`, adding the exact 13-stage classification from the delta spec without model or reasoning identifiers.
- [x] 1.4 Add the `mechanically-verifiable-edit` gate to `challenger-build` and verify no other dependency, artifact, agent, publication, or separation-of-duties behavior changed.

## 2. Deterministic tests and operator documentation

- [x] 2.1 Add focused contract tests that accept both task classes and reject a missing value, `balanced`, `bounded`, a model identifier, and schema version 1 under the new contract.
- [x] 2.2 Add a table-driven test that loads all three manifests and asserts the exact workflow/stage/task-class matrix, schema/workflow versions, total stage count, and challenger exact-edit gate.
- [x] 2.3 Preserve the existing repository validator's agent, skill, dependency, and artifact checks; run its positive path against the migrated manifests and do not create a second task-class vocabulary.
- [x] 2.4 Update the native-harness runbook so a bounded task packet cites accepted/frozen inputs, narrow writable scope, mechanical checks, rollback, and manifest-declared class; document checkpoint/high-judgment escalation and the challenger exact-edit condition without duplicating model defaults into workflows.

## 3. Verification and strategic-fit evaluation

- [x] 3.1 Run the focused task-class test and `pnpm workflows:validate`; record full results, the 13-row mapping, and every negative fixture outcome in `verification.md`.
- [x] 3.2 Run strict change validation and `pnpm check`; resolve every failure within scope or record a blocker, with no ignored or relabeled errors.
- [x] 3.3 Compare the implementation diff with `98ce6ce5219685d4dd6d8715cae6e3c521faed74`; record changed paths and hashes, prove manifests contain no model/reasoning/provider/session/router/scheduler/lease fields, and prove no forbidden subsystem, dependency, database, player, game-pack, catalog, or distribution change was added.
- [x] 3.4 Exercise every adversarial case in `evaluation-plan.md`, including ambiguous challenger edits and bounded tasks that discover design, policy, risk, scope, architecture, or promotion decisions; record checkpoint-and-escalation outcomes rather than self-reported compliance.
- [x] 3.5 Reproduce or inspect the Git-only rollback in an isolated snapshot if required by the independent reviewer, confirming that the pinned target restores contract version 1 and all three version-0.1.0 manifests without external cleanup.

## 4. Evidence closure and independent decision

- [x] 4.1 Complete `verification.md` with execution provenance, raw evidence references, requirement-by-requirement results, protected metrics, failures, unresolved work, rollback evidence, and the planning retry hash above.
- [x] 4.2 Complete `retrospective.md` with evidence-backed reusable lessons and invalidated assumptions, or explicitly state that none were found; do not convert unsupported suggestions into policy.
- [ ] 4.3 Have an independent high-judgment reviewer compare the implementation and evidence with the strategic premise, delta spec, and evaluation plan, then author `decision.md` as accept, reject, repair, or rollback without relying on the implementing agent's confidence.
- [x] 4.4 Commit a coherent implementation/evidence checkpoint only after all applicable protected metrics pass; leave the change unarchived until verification, retrospective, and independent decision satisfy the system-change schema.
