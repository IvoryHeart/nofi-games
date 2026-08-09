## Purpose

Provide resumable, cost-visible agent execution without making an ever-growing model conversation the platform's only memory or source of truth.

## ADDED Requirements

### Requirement: Agent identity is independent from execution sessions

The system SHALL represent an agent's versioned role, skill, policy, and evaluation suite independently from any provider conversation or response identifier.

#### Scenario: Agent starts a new workstream

- **WHEN** a registered agent begins work whose scope does not match an existing resumable session
- **THEN** the system SHALL retain the same agent identity while creating a new execution session with its own immutable identifier

### Requirement: Coherent work can resume from a durable session

The system SHALL reuse an active execution session only when agent version, workflow, workstream, policy, and accepted checkpoint remain compatible.

#### Scenario: Interrupted stage resumes

- **WHEN** a stage attempt is interrupted after an accepted checkpoint and its lease expires
- **THEN** a later attempt SHALL resume from that checkpoint without rerunning completed stages or rewriting prior attempt history

#### Scenario: Session context is incompatible

- **WHEN** the agent version, workflow definition, provider policy, or accepted goal changes incompatibly
- **THEN** the system SHALL close the old session and create a fresh session seeded from authoritative checkpoint artifacts

### Requirement: Authoritative memory survives conversation loss

The system SHALL store accepted goals, decisions, outputs, evidence, and reusable lessons as schema-valid content-addressed checkpoints outside provider conversation history.

#### Scenario: Provider conversation is unavailable

- **WHEN** a stored provider conversation cannot be retrieved or continued
- **THEN** the system SHALL reconstruct a new session from versioned definitions and the latest accepted checkpoint, or fail explicitly if required state is missing

### Requirement: Context growth is bounded by policy

Every session SHALL have declared soft and hard limits for context tokens, accumulated cost, idle age, turns, and checkpoint distance, with deterministic compact, rotate, or stop actions.

#### Scenario: Soft context limit is reached

- **WHEN** continuing a session would cross its soft context limit
- **THEN** the runtime SHALL create and validate a compact checkpoint before continuing in the same or a fresh session according to policy

#### Scenario: Hard budget is reached

- **WHEN** a call or session reaches a hard token or cost limit
- **THEN** the runtime SHALL stop further model calls, append a budget-exhausted event, and preserve resumable state

### Requirement: Stage attempts are idempotent and leased

The system SHALL assign each workflow stage attempt an idempotency key and a time-bounded lease, and SHALL accept at most one output for the same stage inputs and policy version.

#### Scenario: Two workers claim one stage

- **WHEN** concurrent workers attempt to claim the same runnable stage
- **THEN** exactly one worker SHALL receive the active lease and all others SHALL observe the existing attempt

#### Scenario: Completed attempt is retried

- **WHEN** a worker retries an idempotency key whose output checkpoint is already accepted
- **THEN** the runtime SHALL return the accepted result without issuing another model call

### Requirement: Agent output is contract validated

Every stage SHALL declare a versioned structured-output contract, and an attempt SHALL NOT advance the workflow until its output validates and every declared evidence gate is satisfied.

#### Scenario: Model returns malformed output

- **WHEN** a model response does not satisfy the stage output contract
- **THEN** the runtime SHALL record the failed attempt and bounded repair action without publishing or accepting the malformed artifact

### Requirement: Model selection is evidence controlled

Every stage SHALL resolve a pinned model and reasoning policy from a versioned routing policy, and changes to that policy SHALL require evaluation against protected quality metrics.

#### Scenario: Less expensive model is proposed

- **WHEN** a cheaper model or lower reasoning effort is proposed for a stage
- **THEN** the system SHALL treat it as a challenger and SHALL NOT promote it unless the stage evaluation suite passes

### Requirement: Provider failure is reversible

Disabling or failing one provider adapter SHALL NOT mutate accepted OpenSpec knowledge, published games, catalogs, or prior evidence.

#### Scenario: Provider credentials are unavailable

- **WHEN** execution begins without valid provider credentials
- **THEN** the runtime SHALL produce a non-secret blocked result and SHALL NOT create a remote model call or advance the workflow
