# Change Governance Specification

## Purpose

Keep product intent, implementation, evidence, lessons, and decisions synchronized across agent sessions and reversible through Git.

## Requirements

### Requirement: Behavioral changes use OpenSpec

Every change to observable behavior, architecture, contracts, agent definitions, evaluation policy, or release policy SHALL have an OpenSpec change. Before implementing a new subsystem, abstraction, persistent service, execution layer, framework commitment, or substantial operational surface, the change SHALL also pass the strategic-premise gate.

#### Scenario: Agent starts implementation

- **WHEN** an agent intends to modify governed behavior
- **THEN** it SHALL read current capability specs and create or select the appropriate change schema before editing implementation files

#### Scenario: Agent proposes consequential architecture

- **WHEN** an architectural proposal crosses a strategic-premise trigger
- **THEN** the agent SHALL record the required capability reconnaissance, alternatives, boundary, validation method, and rollback before implementation

### Requirement: Archive requires evidence and decision

A change SHALL NOT be archived into durable capability knowledge until verification, retrospective, and decision artifacts are complete.

#### Scenario: Tasks are complete but evaluation failed

- **WHEN** implementation tasks are checked off but acceptance evidence fails
- **THEN** the change SHALL remain unarchived and record rejection, repair, or rollback

### Requirement: Suggestions are not automatically knowledge

Agent feedback and improvement suggestions SHALL remain proposals until evidence supports an accepted OpenSpec change.

#### Scenario: Retrospective suggests a new rule

- **WHEN** an agent proposes changing a specification or skill
- **THEN** the knowledge curator SHALL route it to a change or reject it without silently modifying durable instructions
