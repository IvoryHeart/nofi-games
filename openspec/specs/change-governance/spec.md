# Change Governance Specification

## Purpose

Keep accepted behavioral knowledge concise, current, human-authorized, and reversible through Git.

## Requirements

### Requirement: Behavioral changes use OpenSpec

Every change to observable behavior, architecture, contracts, agent boundaries, evaluation policy, or release policy SHALL have a concise OpenSpec change before implementation. The change SHALL identify affected current requirements, the proposed delta, implementation tasks, acceptance checks, and a Git-addressable rollback target. Design notes SHALL be included only when they preserve consequential reasoning not evident from the requirements and tasks.

#### Scenario: Agent starts implementation

- **WHEN** an agent or contributor intends to modify governed behavior
- **THEN** they SHALL read the relevant current specs and create or select a lightweight OpenSpec change before editing implementation files

#### Scenario: Agent proposes consequential architecture

- **WHEN** a proposed change creates a subsystem, persistent service, execution layer, framework commitment, or substantial operational surface
- **THEN** its optional design notes SHALL record existing capabilities, alternatives including doing nothing, the minimal owned boundary, falsifiable acceptance, and rollback before implementation

### Requirement: Current specs contain accepted behavior

Only accepted requirements with the enforcement required for their claim type SHALL remain under `openspec/specs`. A runtime or product behavior claim SHALL map to observable implementation and focused deterministic tests that exercise that behavior. A repository or contributor constraint SHALL map to a deterministic repository check. Human-owned policy SHALL count as current enforcement only for approval, authority, and selection decisions that it actively governs. Human policy or prose alone SHALL NOT establish runtime or product behavior. Product aspirations and unimplemented runtime behavior SHALL remain in non-normative strategy or a proposed change until implementation and its acceptance tests exist. Changes to authority, delegation, evaluation, promotion, safety, or release policy itself SHALL always require direct human acceptance.

#### Scenario: Runtime capability is audited

- **WHEN** a contributor checks a current runtime or product requirement against the repository
- **THEN** they SHALL be able to identify both its observable implementation and focused deterministic tests

#### Scenario: Repository constraint is audited

- **WHEN** a contributor checks a current repository or contributor constraint
- **THEN** they SHALL be able to identify the deterministic repository check that enforces it

#### Scenario: Human policy is cited as enforcement

- **WHEN** a current requirement relies on human-owned policy rather than implementation or a repository check
- **THEN** it SHALL govern an approval, authority, or selection decision and SHALL NOT be cited as proof of runtime or product behavior

#### Scenario: Prototype architecture is rejected

- **WHEN** a requirement describes rejected prototype behavior or an unimplemented product aspiration
- **THEN** it SHALL be removed from current specs or remain proposed without being presented as current behavior

### Requirement: Delegated acceptance is fail-closed

Any delegated acceptance SHALL apply only when complete, current, valid, and unambiguous eligibility evidence satisfies every deterministic condition of a previously human-approved policy, including separation of duties and rollback. Otherwise acceptance SHALL pause for human review. An agent affected by a change SHALL NOT approve that change.

#### Scenario: Acceptance evidence is incomplete or ambiguous

- **WHEN** a proposed change lacks any required eligibility evidence or the evidence admits conflicting policy outcomes
- **THEN** the change SHALL remain proposed and SHALL be presented for human review without updating current specifications
