## MODIFIED Requirements

### Requirement: Behavioral changes use OpenSpec

Every change to observable behavior, architecture, contracts, agent boundaries, evaluation policy, or release policy SHALL have a concise OpenSpec change before implementation. The change SHALL identify affected current requirements, the proposed delta, implementation tasks, acceptance checks, and a Git-addressable rollback target. Design notes SHALL be included only when they preserve consequential reasoning not evident from the requirements and tasks.

#### Scenario: Agent starts implementation

- **WHEN** an agent or contributor intends to modify governed behavior
- **THEN** they SHALL read the relevant current specs and create or select a lightweight OpenSpec change before editing implementation files

#### Scenario: Agent proposes consequential architecture

- **WHEN** a proposed change creates a subsystem, persistent service, execution layer, framework commitment, or substantial operational surface
- **THEN** its optional design notes SHALL record existing capabilities, alternatives including doing nothing, the minimal owned boundary, falsifiable acceptance, and rollback before implementation

## ADDED Requirements

### Requirement: Current specs contain accepted behavior

Only accepted, currently enforced behavioral requirements SHALL remain under `openspec/specs`. Proposed behavior SHALL remain under an active change until it is accepted directly by a human or through a bounded deterministic action under previously human-approved policy. Changes to authority, delegation, evaluation, promotion, safety, or release policy itself SHALL always require direct human acceptance. Obsolete prototype behavior SHALL be removed from current specs or clearly quarantined as non-normative history.

#### Scenario: Prototype architecture is rejected

- **WHEN** a prototype's premise is falsified
- **THEN** its requirements SHALL stop presenting that architecture as current behavior while its Git-addressable history remains recoverable

### Requirement: Delegated acceptance is fail-closed

Any delegated acceptance SHALL apply only when complete, current, valid, and unambiguous eligibility evidence satisfies every deterministic condition of a previously human-approved policy, including separation of duties and rollback. Otherwise acceptance SHALL pause for human review. An agent affected by a change SHALL NOT approve that change.

#### Scenario: Acceptance evidence is incomplete or ambiguous

- **WHEN** a proposed change lacks any required eligibility evidence or the evidence admits conflicting policy outcomes
- **THEN** the change SHALL remain proposed and SHALL be presented for human review without updating current specifications

## REMOVED Requirements

### Requirement: Archive requires evidence and decision

**Reason**: Mandatory verification, retrospective, and decision artifacts made OpenSpec a workflow and evidence system instead of a lightweight agreement layer.

**Migration**: Put deterministic acceptance checks in tasks, operational facts in run records when they exist, and acceptance in human review or a fail-closed action under previously human-approved policy and Git history.

### Requirement: Suggestions are not automatically knowledge

**Reason**: The replacement current-spec rule defines the same authority boundary without requiring a knowledge-curator workflow or promotion machinery.

**Migration**: Keep suggestions in proposed deltas until direct human acceptance or an eligible delegated acceptance updates current specs; policy changes always remain directly human-approved.
