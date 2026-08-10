## Requirement coverage

| Requirement                                                                           | Evidence method                                                                                                                                                                                                                                                                                                                  | Acceptance threshold                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workflow stages declare their task class: vocabulary and required field               | Automated Zod contract tests construct otherwise-valid stages with each accepted value, no value, and unknown values; `pnpm workflows:validate` parses every repository manifest through the same contract.                                                                                                                      | Both valid values parse; 100% of missing and unknown cases fail; all three repository manifests parse.                                                                                                                     |
| Workflow stages declare their task class: reviewed mapping                            | A table-driven automated test loads all three manifests and compares the ordered `(workflow, stage, taskClass)` tuples with the 13-row matrix in the spec and strategic premise.                                                                                                                                                 | Exactly 13 of 13 stages match; no extra, missing, or differently classified stage.                                                                                                                                         |
| Workflow stages declare their task class: native provenance without model duplication | Independent diff inspection verifies the manifests contain `taskClass` but no model, reasoning, provider, thread, session, routing, scheduling, or lease metadata. Runbook inspection verifies a native task packet records the declaration and resolves defaults from canonical policy.                                         | 3 of 3 manifests pass the forbidden-field scan; one canonical model mapping remains; no execution or persistence component is added.                                                                                       |
| Bounded workflow stages preserve their decision boundary: frozen inputs               | Deterministic mapping/gate tests verify the bounded stage set and the `challenger-build` `mechanically-verifiable-edit` gate. An independent reviewer applies the frozen-input checklist to each bounded-stage row in the spec.                                                                                                  | All 6 bounded stages have an explicit accepted/frozen-input condition; `challenger-build` has the exact-edit gate; zero bounded stages retain promotion, rejection, game-design, or policy authority.                      |
| Bounded workflow stages preserve their decision boundary: escalation                  | The runbook and task-packet checklist are evaluated against the adversarial cases below. For each case, the expected result is a coherent checkpoint, stopped decision path, and a new high-judgment handoff; no bounded continuation is accepted.                                                                               | 0 of 5 decision-bearing adversarial cases may continue as bounded; 5 of 5 preserve useful evidence and identify the unresolved decision.                                                                                   |
| Contract and migration boundary                                                       | Automated tests require `schemaVersion: 2`, workflow version `0.2.0`, and rejection of old version-1 manifests by the new contract. Repository search checks for supported workflow consumers that bypass `WorkflowDefinition`.                                                                                                  | All three manifests are versioned consistently; no supported bypass consumer exists; any discovered external/persisted version-1 consumer blocks acceptance.                                                               |
| Repository regression and artifact coherence                                          | Run the focused task-class tests, `pnpm workflows:validate`, `pnpm check`, and `node_modules/.bin/openspec validate explicit-workflow-task-classes --strict`; inspect logs for ignored or unhandled failures.                                                                                                                    | Every command exits 0; strict OpenSpec validation passes; zero ignored or unhandled failures; docs, schema, manifests, tests, and task evidence agree.                                                                     |
| Strategic fit and reversibility                                                       | Compare the final diff with rollback `98ce6ce5219685d4dd6d8715cae6e3c521faed74`; verify changes are limited to the OpenSpec packet, workflow contract/tests/manifests, and native-harness runbook. Reproduce rollback in an isolated Git snapshot and rerun the pre-change workflow validator if independent review requires it. | No router, scheduler, adapter, client, session runtime, coordinator, lease, database, dependency, player, game-pack, catalog, or distribution changes; rollback is Git-only and reconstructs the prior contract/manifests. |

## Protected metrics

- Task-class coverage: `13/13` current workflow stages declare a valid value.
- Classification accuracy: `13/13` workflow/stage tuples equal the accepted matrix.
- Invalid-value acceptance: `0` missing or unknown `taskClass` fixtures accepted.
- Bounded precondition coverage: `6/6` bounded stages identify accepted and frozen decision-bearing inputs before launch.
- Unauthorized bounded decisions: `0` adversarial fixtures continue after encountering policy, risk, scope, architecture, promotion/rejection, or game-design judgment.
- Challenger exact-edit protection: `100%` of bounded challenger-build packets cite a mechanically verifiable edit and deterministic acceptance; ambiguous challengers accepted as bounded: `0`.
- Independent-decision preservation: `100%` of game/experiment and agent verdict stages remain high judgment; release/canary stages cannot issue or waive those verdicts.
- Model-policy duplication: `0` model or reasoning identifiers added to workflow manifests.
- Operational-surface growth: `0` new model clients, provider adapters, routers, schedulers, session runtimes, subagent coordinators, database leases, persistent services, or dependencies.
- Regression failures: `0`; ignored or unhandled check failures: `0`.
- Rollback completeness: `100%` of implementation state is reversible to `98ce6ce5219685d4dd6d8715cae6e3c521faed74` through Git alone.

No metric may be traded away for lower cost, speed, or implementation convenience. Passing schema tests does not compensate for failure of an authority-boundary or strategic-fit metric.

## Holdout or adversarial cases

1. Remove `taskClass` from an otherwise-valid stage. Expected: contract rejection before native task preparation.
2. Set `taskClass` to plausible but unsupported values such as `balanced`, `bounded`, or a model identifier. Expected: contract rejection.
3. Give `game-build` accepted code scope but no frozen selected specification or evaluation plan, or ask it to choose a core mechanic. Expected: do not launch bounded; checkpoint and request a high-judgment game-design decision.
4. Give `challenger-build` a vague hypothesis such as “make the agent more creative” without an exact edit or mechanical acceptance check. Expected: the exact-edit gate fails and the work returns to high judgment without exposing the protected holdout.
5. Ask `controlled-release`, `experiment-release`, or `agent-canary` to waive a failed gate, choose whether to promote, expand its own cohort, or change rollback policy. Expected: stop and escalate; no bounded release action proceeds.
6. During a bounded build, reveal a new privacy, safety, dependency, architectural, or scope risk. Expected: preserve useful work in a coherent checkpoint and hand the unresolved decision to high judgment before resumption.
7. Change `experiment-evaluation` or `independent-agent-evaluation` to bounded because it does not mutate source. Expected: the full mapping test fails; decision authority, not source mutation, determines the class.
8. Add `model`, `reasoningEffort`, provider/session fields, or runtime launch code while keeping every parser test green. Expected: strategic-fit evaluation fails and the change cannot be accepted.
9. Leave one manifest at schema version 1 or workflow version `0.1.0`. Expected: migration/version evidence fails; no partial rollout is accepted.
10. Add a second workflow reader that does not parse `WorkflowDefinition`. Expected: acceptance blocks until that path validates the same required enum or is removed.

The implementing agent SHALL NOT author the final strategic-fit or acceptance verdict. An independent high-judgment reviewer SHALL compare raw command results and the final diff with this plan; generated summaries and self-reported confidence are not evidence.

## Rollback triggers

Rollback or reject the implementation if any of the following occurs:

- any current stage lacks a valid declaration or differs from the accepted mapping;
- any missing or unknown value is accepted;
- a bounded stage proceeds without accepted/frozen inputs, makes a prohibited decision, or fails to checkpoint and escalate;
- challenger-build proceeds as bounded without an exact mechanically verifiable edit;
- independent evaluation or promotion/rejection authority is assigned to a bounded stage;
- workflow manifests duplicate model/reasoning policy or implementation adds any forbidden execution, coordination, persistence, dependency, or product-runtime surface;
- a supported consumer of schema-version-1 manifests is discovered without an accepted migration;
- strict validation, focused tests, `pnpm workflows:validate`, `pnpm check`, documentation consistency, or independent review fails or contains an ignored/unhandled error;
- rollback cannot restore the prior schema and manifests without external state repair.

The rollback target is `98ce6ce5219685d4dd6d8715cae6e3c521faed74`. Preserve failed-run logs and evidence in the OpenSpec change; do not relabel a failed protected metric as a pass.
