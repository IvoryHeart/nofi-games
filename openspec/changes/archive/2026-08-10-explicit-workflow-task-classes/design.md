## Context

See `proposal.md` for the motivation and `strategic-premise.md` for the selected boundary. The current `WorkflowStage` Zod object validates stage IDs, agents, skills, artifact flow, gates, mutation, and publication authority but has no task-class property. `tools/validate-workflows.ts` parses all three manifests through that object, so the shared contract is already the single repository-wide ingestion point.

The workflow manifests are version `0.1.0` with `schemaVersion: 1`. Adding a required field invalidates old documents and therefore needs an explicit schema/version boundary. The change must remain planning/control-plane metadata: Codex owns launch settings and execution, while OpenSpec and Git own task packets and checkpoints.

## Goals / Non-Goals

**Goals:**

- Make task class a required, typed property on every workflow stage and migrate all current manifests atomically.
- Make missing and invalid values fail at the shared contract boundary.
- Preserve an exact reviewed mapping for all 13 stages.
- Make frozen-input preconditions and checkpoint/escalation behavior actionable in native task preparation.
- Keep declared class and actual execution provenance inspectable without creating another execution component or copying model policy into manifests.

**Non-Goals:**

- Dynamically infer or route task classes, models, reasoning effort, harnesses, or tools.
- Launch Codex, manage threads or subagents, persist conversations, schedule work, coordinate concurrent tasks, or lease claims.
- Generalize the contract across unsupported harness lifecycle semantics.
- Change workflow dependencies, agent separation of duties, release authority, player/game-pack behavior, catalog policy, or product persistence.
- Preserve compatibility with `schemaVersion: 1` workflow manifests after the atomic migration; rollback is the compatibility path.

## Decisions

### 1. Add one shared enum and make the stage field required

Export a `TaskClass` Zod enum with exactly `bounded-implementation` and `high-judgment`, infer its TypeScript type, and add `taskClass: TaskClass` to `WorkflowStage`. Do not make it optional and do not add a fallback: missing metadata is the failure this change is intended to expose.

Use the existing `WorkflowDefinition.parse` path in `tools/validate-workflows.ts`. Zod already rejects missing and unknown enum values, so no second hand-maintained vocabulary or custom validator branch is needed. Add focused unit tests around the shared contract plus the repository validator's positive path.

Alternatives rejected: a free-form string would admit vocabulary drift; an optional field would preserve inference; a validator-only list would duplicate the TypeScript contract.

### 2. Mark the breaking workflow-contract boundary explicitly

Change `WorkflowDefinition.schemaVersion` from literal `1` to literal `2` and update all three manifests to `schemaVersion: 2` and workflow version `0.2.0`. This makes the required-field break observable instead of silently changing the meaning of schema version 1. No compatibility parser is needed because the repository owns and migrates every current manifest in the same commit.

The agent registry, evaluation suites, workflow-run records, and other schema-versioned contracts stay unchanged. No persisted workflow rows or external API payloads are migrated by this change.

Alternative rejected: retaining schema version 1 would make an old valid document become invalid without a machine-readable version boundary.

### 3. Encode the reviewed stage mapping directly in manifests

Add `taskClass` beside each stage's identity and agent metadata. Apply the mapping in `strategic-premise.md` and the delta spec exactly; do not infer class from `agent`, `mutatesSource`, or publication flags. Evaluation and analysis can be high judgment without mutating source, while a release can be bounded despite changing production state because its independent verdict, cohort, and rollback are already frozen.

`experiment-evaluation` is high judgment because it issues the experiment verdict, matching the same independent decision boundary as `independent-game-evaluation`. `challenger-build` is declared bounded only under Decision 4.

Alternative rejected: deriving class from existing booleans conflates source mutation and operational effect with decision authority.

### 4. Make bounded launch a preflight contract, with a challenger-specific gate

Update the native-harness runbook so preparation of a bounded task packet must identify the accepted and frozen decision-bearing inputs, narrow writable scope, deterministic acceptance checks, and rollback. The operator records the manifest-declared class in the packet. If a precondition is absent, the bounded task is not launched.

For `challenger-build`, add `mechanically-verifiable-edit` to its declared gates and require its task packet to cite the exact edit yielded by the frozen hypothesis. The stage remains bounded only when that evidence exists. A hypothesis that still needs interpretation returns to a high-judgment task; it is not repaired by an automatic classifier or runtime override.

During any bounded stage, discovery of a new policy, risk, scope, architecture, promotion/rejection, or game-design decision triggers a coherent Git checkpoint and an OpenSpec handoff describing the unresolved decision. Resumption uses newly accepted and frozen inputs. This is failure recovery through existing task artifacts, not a new state machine.

Alternative rejected: dynamically rewriting the manifest's class would erase the reviewed default and create a routing mechanism. The high-judgment handoff is an explicit new task packet with its own provenance.

### 5. Keep model policy canonical and provenance compact

Workflow YAML contains `taskClass` only. It must not gain model, reasoning, provider, thread, or session fields. Native task preparation resolves the default from `openspec/specs/native-harness-workflow/spec.md` and `AGENTS.md`; consequential verification records the declared and actually used class, configured model, reasoning effort, harness/version, source commit, checks, outputs, and evidence as already required by that capability.

No change to `WorkflowRun`, Supabase, or a launcher API is required for this change. The manifest declaration plus task packet and verification provide the intended provenance boundary.

Alternative rejected: duplicating `gpt-5.6-luna`, `gpt-5.6-sol`, or `xhigh` in each workflow would create multiple mutable policy sources and couple stage definitions to a current model catalog.

### 6. Test both contract correctness and strategic fit

Add deterministic tests that:

- accept both enum values;
- reject a missing value and at least one unknown value;
- parse all three version-2 manifests;
- assert the complete workflow/stage mapping rather than only counting annotated stages;
- assert the challenger-build mechanical-edit gate;
- prove repository workflow validation still enforces agent, skill, dependency, and artifact checks.

Evaluation also inspects the implementation diff for forbidden execution/runtime additions and scans workflow manifests for duplicated model/reasoning identifiers. This prevents internally correct parser work from passing if the strategic boundary has expanded.

## Risks / Trade-offs

- [A static class can conceal a mixed-judgment stage] → Require frozen inputs before bounded launch, checkpoint/escalate on new decisions, and reclassify or split a repeatedly mixed stage through a later OpenSpec change.
- [The required field breaks old workflow documents] → Use `schemaVersion: 2`, update every repository manifest atomically, and pin rollback to the pre-change commit.
- [Challenger-build may be labeled bounded when its hypothesis remains interpretive] → Require the `mechanically-verifiable-edit` gate and exact edit in the task packet; otherwise launch a high-judgment handoff.
- [Tests may assert only presence and miss an incorrect mapping] → Use a full workflow/stage/class expected matrix.
- [Model policy may drift into workflow YAML during implementation] → Add a protected strategic-fit diff review and manifest scan for model, reasoning, provider, session, scheduler, router, or lease fields.
- [Schema-version bump may imply migrations outside the repository] → Verification must confirm no supported external or persisted version-1 consumer exists; any discovered consumer blocks acceptance until explicitly migrated or the design is revised.

## Migration Plan

1. Add the shared enum, required stage property, and workflow `schemaVersion: 2` contract.
2. Update all three manifests to schema version 2 and workflow version `0.2.0`, add the exact task-class mapping, and add the challenger mechanical-edit gate.
3. Add positive, negative, mapping, and gate tests; update the native-harness runbook for frozen-input preflight and escalation.
4. Run focused tests, `pnpm workflows:validate`, `pnpm check`, strict OpenSpec validation, and the evaluation plan's strategic-fit review. Record every failure rather than waiving it.
5. Commit implementation and evidence coherently. Independent review decides acceptance; the implementing agent does not weaken evaluation or promote its own result.

Rollback reverts the implementation commit to `98ce6ce5219685d4dd6d8715cae6e3c521faed74`, restoring contract version 1 and all three version-0.1.0 manifests together. Because the change adds no persistence, dependency, deployed player artifact, or external state, rollback requires no cleanup or data conversion.
