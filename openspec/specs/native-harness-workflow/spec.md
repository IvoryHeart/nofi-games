# native-harness-workflow Specification

## Purpose

Define a durable, inspectable local agent workflow that uses Codex by default, remains adoptable by Claude Code, and lets Git and OpenSpec retain authoritative tasks, checkpoints, evidence, and decisions.

## Requirements

### Requirement: Supported harnesses own agent execution

The studio SHALL use Codex as its default active execution harness and SHALL keep Claude Code adoptable through the same canonical task and evidence protocol. The selected native harness SHALL own thread lifecycle, subagents, tools, context management, permissions, authentication, and model invocation. Active Claude Code execution SHALL NOT be required for a Codex task or its acceptance unless a task packet explicitly requires cross-harness evidence.

#### Scenario: Codex executes a governed task

- **WHEN** a governed task does not explicitly require another supported harness
- **THEN** it SHALL be assigned to Codex without a direct model-provider adapter

#### Scenario: Claude Code adopts a task

- **WHEN** a task is deliberately assigned to Claude Code
- **THEN** Claude Code SHALL consume and produce the same canonical OpenSpec, Git, test, evidence, and decision artifacts without requiring Codex conversation state

#### Scenario: Unsupported harness is requested

- **WHEN** a task requests a harness other than Codex or Claude Code
- **THEN** execution SHALL remain unassigned until an accepted OpenSpec change adds support

### Requirement: Codex task class determines the default model

Every consequential Codex task packet SHALL classify the task as `bounded-implementation` or `high-judgment`. `bounded-implementation` SHALL default to `gpt-5.6-luna` with `xhigh` reasoning. `high-judgment` SHALL default to `gpt-5.6-sol` with `xhigh` reasoning. Acceptance checks SHALL remain task-specific and SHALL NOT be weakened for the lower-cost class.

#### Scenario: Bounded implementation task

- **WHEN** a task has a narrow writable scope, settled design, deterministic acceptance checks, and no authority to alter strategy or promotion policy
- **THEN** the task packet SHALL classify it as `bounded-implementation` and select `gpt-5.6-luna` with `xhigh` reasoning by default

#### Scenario: High-judgment task

- **WHEN** a task includes strategy, architecture, ambiguous design, premise validation, adversarial review, or a promotion or rejection decision
- **THEN** the task packet SHALL classify it as `high-judgment` and select `gpt-5.6-sol` with `xhigh` reasoning by default

#### Scenario: Bounded task discovers strategic ambiguity

- **WHEN** a bounded implementation task discovers that completion requires an undeclared architecture, strategy, scope, or promotion decision
- **THEN** it SHALL checkpoint completed evidence, stop that decision path, and return the unresolved decision for a high-judgment Codex task

#### Scenario: Explicit evaluated override

- **WHEN** an accepted task packet or model-policy evaluation supplies a different model assignment with reproducible evidence
- **THEN** the recorded override MAY replace the default without introducing a repository model router

### Requirement: Governed work has a canonical task packet

Every consequential task SHALL identify its OpenSpec change, task ID, objective, inputs, writable scope, constraints, acceptance checks, required evidence, and rollback target in versioned repository artifacts.

#### Scenario: Harness context is unavailable

- **WHEN** a new harness thread resumes an unfinished task
- **THEN** the task packet and committed artifacts SHALL provide enough accepted context to continue without the prior transcript

### Requirement: Writable tasks are isolated by Git worktree

Every concurrently writable task SHALL use a dedicated Git branch and worktree whose names identify the harness, change, and task. A worktree or remote branch is the visible claim; no database lease is required.

#### Scenario: Two agents modify source concurrently

- **WHEN** two independent writable tasks run at the same time
- **THEN** they SHALL operate in separate worktrees and integrate through reviewed commits rather than sharing uncommitted files

#### Scenario: An agent stops unexpectedly

- **WHEN** an agent exits before completing its task
- **THEN** its branch, worktree, commits, and uncommitted diff SHALL remain inspectable for explicit resume, reassignment, or deletion

### Requirement: Git commits are durable checkpoints

Agents SHALL checkpoint accepted intermediate state with coherent commits and SHALL record verification and decision evidence in the corresponding OpenSpec change.

#### Scenario: Harness thread is replaced

- **WHEN** execution continues in a new Codex or Claude Code thread
- **THEN** the new thread SHALL resume from the task branch, last accepted commit, task artifact, and unresolved work rather than a provider conversation record

### Requirement: Local coordination does not depend on Supabase

Creating, claiming, executing, resuming, evaluating, and completing a local agent task SHALL NOT require Supabase task, lease, session, attempt, model-call, or checkpoint records.

#### Scenario: Supabase is offline

- **WHEN** the product database is suspended or unavailable
- **THEN** local Codex and Claude Code development workflows SHALL remain fully operable through Git, worktrees, OpenSpec, and local verification

### Requirement: Harness provenance remains inspectable

Consequential verification SHALL record the harness name and version, source commit, task identity, checks, outputs, and evidence references. Model and thread identifiers MAY be recorded when useful but SHALL NOT be authoritative workflow state.

#### Scenario: Equivalent tasks use different harnesses

- **WHEN** Codex and Claude Code results are compared
- **THEN** the evidence SHALL identify each harness and source state while applying the same acceptance criteria

### Requirement: Model provenance remains inspectable

Consequential Codex verification SHALL record the configured model identifier, reasoning effort, harness version, source commit, task class, checks, outputs, and evidence references. The resolved model identifier SHALL also be recorded when the harness exposes it. Model or thread identifiers SHALL NOT become authoritative workflow state.

#### Scenario: Consequential Codex task completes

- **WHEN** a consequential Codex task produces a handoff or decision
- **THEN** its verification SHALL show whether the declared task class and model default were followed or explicitly overridden

### Requirement: Workflow stages declare their task class

Every stage in every governed workflow manifest SHALL declare `taskClass` as either `bounded-implementation` or `high-judgment`. The workflow contract SHALL reject a stage whose `taskClass` is absent or has any other value.

The declaration SHALL describe the judgment authority required when the stage is launched from accepted inputs. It SHALL provide declarative provenance for a native harness task packet and SHALL NOT act as a repository model router, scheduler, provider adapter, model client, session runtime, subagent coordinator, or task lease.

#### Scenario: Research-to-game workflow is classified

- **WHEN** the `research-to-game` manifest is validated
- **THEN** `opportunity-research`, `concept-design`, and `independent-game-evaluation` SHALL declare `high-judgment`
- **AND** `game-build` and `controlled-release` SHALL declare `bounded-implementation`

#### Scenario: Game-improvement workflow is classified

- **WHEN** the `game-improvement` manifest is validated
- **THEN** `gameplay-analysis` and `experiment-evaluation` SHALL declare `high-judgment`
- **AND** `experiment-build` and `experiment-release` SHALL declare `bounded-implementation`

#### Scenario: Agent-evolution workflow is classified

- **WHEN** the `agent-evolution` manifest is validated
- **THEN** `improvement-observation` and `independent-agent-evaluation` SHALL declare `high-judgment`
- **AND** `challenger-build` and `agent-canary` SHALL declare `bounded-implementation`

#### Scenario: Stage omits task class

- **WHEN** a workflow stage has no `taskClass`
- **THEN** workflow validation SHALL fail before the workflow is accepted or used to prepare a native task packet

#### Scenario: Stage uses an unknown task class

- **WHEN** a workflow stage declares a `taskClass` other than `bounded-implementation` or `high-judgment`
- **THEN** workflow validation SHALL fail before the workflow is accepted or used to prepare a native task packet

#### Scenario: Native task is prepared from a classified stage

- **WHEN** an operator prepares a native Codex task packet from a valid workflow stage
- **THEN** the packet SHALL carry the stage's declared task class and resolve its model and reasoning defaults from the canonical native-harness task-class policy
- **AND** the workflow manifest SHALL NOT duplicate those model or reasoning identifiers

### Requirement: Bounded workflow stages preserve their decision boundary

A stage declared `bounded-implementation` SHALL launch as bounded only after its required specification, hypothesis, evaluation plan, verdict, release parameters, and other decision-bearing inputs are accepted and frozen as applicable to that stage. Its task packet SHALL have narrow writable scope and mechanically verifiable acceptance checks.

A bounded stage that discovers completion requires a new or changed policy, risk, scope, architecture, promotion, rejection, or game-design decision SHALL checkpoint useful work and evidence, stop that decision path, and return the unresolved decision to a `high-judgment` task. It SHALL NOT make or conceal that decision under the bounded declaration.

#### Scenario: Game or experiment build starts from frozen inputs

- **WHEN** `game-build` or `experiment-build` is prepared as a bounded task
- **THEN** its selected specification or experiment hypothesis and its applicable evaluation inputs SHALL already be accepted and frozen
- **AND** the build task SHALL be limited to implementing and deterministically checking those inputs

#### Scenario: Release or canary starts from an accepted verdict

- **WHEN** `controlled-release`, `experiment-release`, or `agent-canary` is prepared as a bounded task
- **THEN** the independent verdict, bounded cohort parameters, and rollback target SHALL already be accepted and frozen
- **AND** the task SHALL have no authority to waive gates or make its own promotion or rejection decision

#### Scenario: Challenger hypothesis yields an exact edit

- **WHEN** `challenger-build` is prepared as `bounded-implementation`
- **THEN** its accepted frozen hypothesis SHALL identify an exact mechanically verifiable edit and deterministic acceptance checks
- **AND** the task packet SHALL preserve the immutable champion, frozen evaluation plan, and hidden-holdout boundary

#### Scenario: Challenger hypothesis does not yield an exact edit

- **WHEN** a frozen challenger hypothesis requires interpretation, design, policy, or scope judgment before an edit can be specified mechanically
- **THEN** `challenger-build` SHALL NOT proceed as bounded
- **AND** useful evidence SHALL be checkpointed and the unresolved decision SHALL be returned to a `high-judgment` task

#### Scenario: Bounded task discovers a new decision

- **WHEN** any bounded workflow stage discovers an undeclared policy, risk, scope, architecture, promotion, rejection, or game-design decision
- **THEN** it SHALL checkpoint completed work and evidence, stop the affected path, and identify the decision for a high-judgment task
- **AND** resumption as bounded SHALL require newly accepted and frozen inputs that resolve the decision

### Requirement: Governed execution is decision-sufficient

Every governed workflow stage SHALL declare the `decision-sufficient` execution mode,
`stop-and-report` decisive-outcome action, `record-unmet` unavailable-gate action, and a retry
limit no greater than two. A native task packet SHALL further name its decision question,
minimum sufficient evidence, stop conditions, maximum new probes, unavailable dependencies,
and checkpoint or fresh-thread condition.

#### Scenario: Hard gate decides rejection

- **WHEN** a reproducible hard failure makes acceptance or promotion impossible
- **THEN** the agent SHALL write the verdict and stop evidence work that cannot change it
- **AND** every remaining planned item SHALL be accounted for without being fabricated

#### Scenario: Required external evidence is unavailable

- **WHEN** a person, device, service, credential, or platform required for acceptance is unavailable
- **THEN** the agent SHALL record the gate once as unmet or unknown
- **AND** it SHALL NOT simulate the evidence or build new infrastructure unless construction is the accepted task

#### Scenario: A checkpoint can replace large transcript context

- **WHEN** accepted Git and OpenSpec artifacts can reconstruct an unfinished task more cheaply than resuming its large native thread
- **THEN** the next task SHALL prefer a fresh thread and treat the old transcript as optional evidence

#### Scenario: Repetition cannot reverse a decisive failure

- **WHEN** minimum repetitions exist for an acceptance claim but a confirmed hard failure has already fixed rejection
- **THEN** unrun repetitions SHALL be accounted for as stopped after the decisive outcome rather than executed for completeness
