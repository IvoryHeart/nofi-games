## Desired outcome

Make the judgment level of every governed workflow stage explicit, reviewable, and reproducible so a native Codex task can be launched with the intended class and a bounded task cannot silently assume authority for a new strategic, architectural, scope, risk, promotion, or game-design decision.

The outcome does not require the repository to execute agents, route models, manage sessions, schedule work, or lease tasks. It requires trustworthy task intent and provenance at the existing workflow boundary.

## Required capabilities

- Represent exactly two task classes, `bounded-implementation` and `high-judgment`, as required workflow-stage metadata.
- Classify every stage in all three workflow manifests from the authority and judgment the stage needs after its accepted inputs are frozen.
- Reject a workflow manifest when any stage omits the class or supplies a value outside the two-value vocabulary.
- Preserve the special challenger-build precondition: it is bounded only when a frozen hypothesis specifies an exact mechanically verifiable edit.
- Require bounded work to checkpoint useful work and escalate when it encounters an undeclared policy, risk, scope, architecture, promotion, or game-design decision.
- Keep the task-class-to-model mapping canonical in the native-harness policy while recording enough declarative provenance for a native Codex launch.

These capabilities concern the studio control plane and execution-harness handoff. They do not add product-runtime, game-pack, distribution, shared-persistence, or model-provider capabilities.

## Existing capabilities and evidence

- `studio/control-plane/src/contracts.ts` already defines `WorkflowStage` as the strict TypeScript/Zod contract consumed by repository tooling, but it has no task-class field.
- `tools/validate-workflows.ts` already parses every YAML file under `studio/workflows/` through `WorkflowDefinition`, so extending the shared stage schema provides one deterministic validation boundary for missing and invalid values.
- `studio/workflows/research-to-game.yaml`, `game-improvement.yaml`, and `agent-evolution.yaml` already declare the complete stage graphs, agents, gates, mutation authority, and publication authority. They are the narrowest place to declare stage intent.
- `openspec/specs/native-harness-workflow/spec.md`, `AGENTS.md`, and `docs/runbooks/native-harness-workflow.md` already define both task classes, the canonical Codex defaults, task-packet provenance, and checkpoint-and-escalate behavior. This change can reuse that policy instead of copying model identifiers into workflow manifests.
- The official OpenAI documentation confirms that Codex itself accepts model and reasoning-effort configuration and handles agent/thread orchestration: [Codex configuration](https://learn.chatgpt.com/docs/config-file/config-basic) and [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents). The repository therefore needs to describe launch intent, not construct another launcher, router, or session runtime.
- Git commits and OpenSpec task packets already provide durable claims, checkpoints, verification, and rollback. Supabase is not needed for this metadata.

## Alternatives and rejection reasons

### Reuse prose policy without manifest metadata

Doing nothing yet would leave the class implicit at the exact stage boundary used by the workflow validator. Operators could infer classifications inconsistently, and workflow provenance could not show whether the intended class was declared. The requirement and all stage mappings are established, so delay does not reduce meaningful uncertainty.

### Put task class only in per-run task packets

Task packets must record the selected class, but making each run invent it would duplicate a stable stage property and allow drift from the reviewed workflow definition. Per-run packets should consume and record the manifest declaration, with an explicit high-judgment escalation when the bounded preconditions do not hold.

### Duplicate model and reasoning identifiers into every workflow

This would bind workflow definitions to a mutable Codex model policy, multiply updates, and create conflicting sources of truth. The existing native-harness capability already owns the mapping and evidence-backed override rule.

### Build a router, scheduler, provider adapter, model client, session runtime, or database lease service

These components do not contribute to the requested outcome and would duplicate lifecycle capabilities already owned by Codex and Git/OpenSpec. They would increase operational burden, recovery paths, and portability cost while weakening the accepted native-harness boundary.

### Adapt the existing workflow contract and validator

Adding one required enum to the existing `WorkflowStage` contract, annotating the three manifests, and extending deterministic contract tests directly satisfies the outcome with no new subsystem. This is the selected alternative.

## Selected repository-owned boundary

The repository owns a declarative `taskClass` field on every workflow stage, its two-value vocabulary, the reviewed stage classifications, validation, and documentation of escalation semantics. A native task packet consumes that declaration and records the actual class used.

Codex owns model selection at launch, reasoning effort, tools, permissions, threads, subagents, compaction, and model calls. The canonical native-harness policy owns the default model mapping. Git/OpenSpec own task state and checkpoints. Supabase remains reserved for product runtime data. The player app and game-pack runtime are unaffected.

The initial classification is:

| Workflow           | Stage                          | Task class               | Boundary condition                                                                                                                        |
| ------------------ | ------------------------------ | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `research-to-game` | `opportunity-research`         | `high-judgment`          | Interprets external evidence and proposes opportunity.                                                                                    |
| `research-to-game` | `concept-design`               | `high-judgment`          | Makes game-design and selection decisions.                                                                                                |
| `research-to-game` | `game-build`                   | `bounded-implementation` | Launches only from an accepted selected specification and frozen evaluation plan.                                                         |
| `research-to-game` | `independent-game-evaluation`  | `high-judgment`          | Produces an independent release verdict.                                                                                                  |
| `research-to-game` | `controlled-release`           | `bounded-implementation` | Applies an accepted verdict to a controlled, reversible release.                                                                          |
| `game-improvement` | `gameplay-analysis`            | `high-judgment`          | Interprets evidence and defines the experiment hypothesis.                                                                                |
| `game-improvement` | `experiment-build`             | `bounded-implementation` | Implements the accepted frozen hypothesis.                                                                                                |
| `game-improvement` | `experiment-evaluation`        | `high-judgment`          | Independently judges protected results and issues the experiment verdict.                                                                 |
| `game-improvement` | `experiment-release`           | `bounded-implementation` | Applies an accepted verdict to a bounded cohort with rollback.                                                                            |
| `agent-evolution`  | `improvement-observation`      | `high-judgment`          | Interprets failures and freezes a challenger hypothesis and evaluation plan.                                                              |
| `agent-evolution`  | `challenger-build`             | `bounded-implementation` | Launches as bounded only when the frozen hypothesis yields an exact mechanically verifiable edit; otherwise it checkpoints and escalates. |
| `agent-evolution`  | `independent-agent-evaluation` | `high-judgment`          | Independently issues a promotion or rejection verdict.                                                                                    |
| `agent-evolution`  | `agent-canary`                 | `bounded-implementation` | Applies an accepted promotion verdict to a bounded reversible canary.                                                                     |

## Assumptions and disconfirming signals

- Assumption: a stage has one safe default task class once its accepted inputs and authority are stated. A stage that repeatedly mixes bounded editing with new design or policy decisions would disconfirm this and should be split or reclassified through a later OpenSpec change.
- Assumption: the existing manifest parser is the authoritative ingestion path. Discovery of another supported workflow loader that bypasses `WorkflowDefinition` would require the same validation there before acceptance.
- Assumption: `challenger-build` inputs can prove an exact mechanically verifiable edit before launch. If that condition cannot be made reviewable in the task packet, the stage must be classified `high-judgment` rather than weakening the bounded definition.
- Assumption: controlled releases and canaries execute already accepted decisions. If they gain authority to select cohorts, waive gates, promote, reject, or alter rollback policy, they must become high judgment.
- Assumption: class-to-model defaults remain native-harness policy. A need for automated cross-harness scheduling or runtime model arbitration would be a separate premise-gated change, not an extension of this field.
- Disconfirming signals include missing/invalid metadata passing validation, a bounded task making one of the prohibited decisions, duplicated model identifiers appearing in manifests, a new execution or persistence subsystem, or an inability to reconstruct the declared and actually used class from workflow and verification artifacts.

## Decision, validation, and rollback

Proceed with the narrow contract adaptation. Validate strategic fit by proving that every current stage has the reviewed declaration, missing and unknown values fail deterministically, the challenger-build precondition and bounded-task escalation are explicit, verification records declared-versus-used class, and no router, scheduler, provider adapter, model client, session runtime, database lease, product-runtime change, or per-workflow model mapping is introduced.

Implementation acceptance must include strict OpenSpec validation, workflow contract tests with negative fixtures, repository workflow validation, formatting/type/test checks, and a review of the final diff against the boundary above. Passing self-authored parser tests is insufficient if the diff grows an execution layer or permits bounded decision-making.

The Git-addressable rollback target is `98ce6ce5219685d4dd6d8715cae6e3c521faed74`. Reverting the implementation commit restores the prior schema and manifests atomically; no database, player, catalog, or external runtime state requires migration or cleanup.
