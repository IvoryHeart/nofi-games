## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Model provenance remains inspectable

Consequential Codex verification SHALL record the configured model identifier, reasoning effort, harness version, source commit, task class, checks, outputs, and evidence references. The resolved model identifier SHALL also be recorded when the harness exposes it. Model or thread identifiers SHALL NOT become authoritative workflow state.

#### Scenario: Consequential Codex task completes

- **WHEN** a consequential Codex task produces a handoff or decision
- **THEN** its verification SHALL show whether the declared task class and model default were followed or explicitly overridden
