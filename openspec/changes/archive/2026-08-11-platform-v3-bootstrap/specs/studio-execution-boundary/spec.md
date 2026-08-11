## Purpose

Preserve the autonomous-studio north star while defining a minimal, inspectable separation of responsibilities for future automation without introducing a workflow or duplicating native harness capabilities in the bootstrap.

## ADDED Requirements

### Requirement: Studio responsibilities have explicit owners

The studio SHALL keep five distinct responsibility boundaries: OpenSpec for accepted intent and durable product knowledge; deterministic orchestration for control flow, durable transitions, and delegated actions; bounded agents for scoped judgment; run records for operational facts and artifact references; and humans for authority policy and initially for every authority-bearing action. Product runtime state SHALL remain outside all five.

#### Scenario: A new studio behavior is proposed

- **WHEN** a proposal assigns a responsibility to more than one boundary or leaves it unowned
- **THEN** the proposal SHALL resolve the overlap or gap before implementation

### Requirement: OpenSpec is an agreement layer

OpenSpec SHALL contain current behavioral requirements, concise proposed deltas, optional design decisions, and executable tasks. It SHALL NOT act as an agent registry, workflow runtime, lease store, session store, run ledger, prompt transcript, or large-artifact repository.

#### Scenario: A change needs runtime progress

- **WHEN** work needs attempt status, retry state, timing, model-call data, or resumable execution state
- **THEN** that data SHALL remain outside OpenSpec and the change SHALL contain only the accepted behavior and implementation work

### Requirement: Deterministic orchestration owns control flow

Any future multi-step studio process SHALL express branching, retries, idempotency, pause and resume, side effects, delegation eligibility, and terminal states in deterministic code over explicit typed state. Model context, model responses, and provider conversation identifiers SHALL NOT be authoritative orchestration state.

#### Scenario: A process resumes after interruption

- **WHEN** a future studio run is resumed
- **THEN** deterministic code SHALL derive the next valid transition from persisted run state without requiring a prior model conversation

### Requirement: Agents are bounded stateless judgment functions

Any future studio agent invocation SHALL have one focused objective, repository-owned prompt and context assembly, schema-valid inputs, structured outputs or tool requests, explicit tool authority, and bounded completion conditions. Given the same accepted input state, the invocation SHALL behave as a stateless reducer from that state to a proposed next state. An agent SHALL NOT grant, expand, or delegate authority to itself; change authority, delegation, evaluation, promotion, safety, or release policy; approve or promote a change that affects itself; or own global workflow control.

#### Scenario: An agent requests an action

- **WHEN** a bounded agent determines that a tool or human action is required
- **THEN** it SHALL return a structured request for deterministic code or an authorized human to accept and execute

### Requirement: Run records are facts, not authority

Any future run record SHALL capture inputs, outputs, transitions, timestamps, compact errors, attempts, applied delegation-policy identity, eligibility evidence, and content-addressed artifact references needed for diagnosis and resume. A run record SHALL NOT redefine accepted requirements, grant authority, select policy, or become a hidden agent memory store.

#### Scenario: A run fails and is retried

- **WHEN** deterministic orchestration retries a failed step
- **THEN** the record SHALL preserve the failed attempt and compact error while the accepted OpenSpec agreement remains unchanged

### Requirement: Authority policy remains human-owned

Humans SHALL initially approve every authority-bearing action and SHALL permanently own approval of authority, delegation, evaluation, promotion, safety, and release policy and changes to those policies. Policy-changing authority SHALL NOT be delegated. Humans MAY authorize deterministic orchestration to execute bounded acceptance, release, and promotion actions under a previously accepted policy, but an agent output or run record SHALL NOT create or expand that delegation.

#### Scenario: A policy change is proposed

- **WHEN** a run proposes changing authority, delegation, evaluation, promotion, safety, or release policy
- **THEN** orchestration SHALL pause for human approval regardless of any existing action delegation

### Requirement: Delegated execution is bounded and fail-closed

A human-approved delegation SHALL identify the eligible subject and action, required evidence, deterministic thresholds, scope, separation-of-duties constraints, rollback, and revocation or expiry conditions. Deterministic orchestration MAY execute only an acceptance, release, or promotion action fully authorized by that policy. Missing, conflicting, stale, invalid, or ambiguous eligibility evidence SHALL make the action ineligible and SHALL pause execution for human review. An agent affected by a change SHALL NOT approve or promote that change, whether directly or through a delegated action.

#### Scenario: Evidence unambiguously satisfies delegated rules

- **WHEN** complete valid evidence satisfies every condition of a currently accepted delegation and separation-of-duties rule
- **THEN** deterministic orchestration MAY execute the bounded action without per-action human approval and SHALL record the policy, evidence, action, and rollback target

#### Scenario: Eligibility is missing or ambiguous

- **WHEN** any required eligibility fact is missing, conflicting, stale, invalid, or admits more than one policy interpretation
- **THEN** orchestration SHALL execute no acceptance, release, or promotion action and SHALL enter an explicit human-review state with the relevant facts and uncertainty

#### Scenario: An affected agent recommends its own change

- **WHEN** an agent produces evidence or a recommendation about a change that affects that agent
- **THEN** orchestration SHALL exclude that agent from approval and promotion evidence and SHALL require direct human action or a delegated deterministic path whose separation-of-duties evidence is independent of the affected agent

### Requirement: Autonomous studio remains the north star

The studio SHALL retain the product direction of an agent-operated loop that researches, creates, evaluates, releases, observes, and improves the single catalog. Human-owned policy and fail-closed delegation SHALL bound that autonomy without requiring per-action human approval when previously accepted deterministic rules fully authorize an action. The bootstrap SHALL define this direction without implementing the loop.

#### Scenario: Foundation documentation describes future operation

- **WHEN** a contributor reads the current product and architecture documentation
- **THEN** it SHALL distinguish the absent bootstrap workflow from the preserved autonomous-studio goal and its bounded delegation model

### Requirement: Bootstrap contains no autonomous workflow

The studio-foundation reset SHALL leave no executable research-to-release, game-improvement, or agent-evolution workflow and no agent-runtime persistence. Adding any such execution path SHALL require a later accepted OpenSpec change with deterministic acceptance checks and a rollback target.

#### Scenario: Foundation verification runs

- **WHEN** the reset is checked
- **THEN** repository validation SHALL prove the preserved player and game-pack substrate remains green and that autonomous workflow, registry, promotion, and runtime-persistence entry points are absent
