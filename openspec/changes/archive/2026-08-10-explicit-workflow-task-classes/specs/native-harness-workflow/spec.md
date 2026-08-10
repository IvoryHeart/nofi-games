## ADDED Requirements

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
