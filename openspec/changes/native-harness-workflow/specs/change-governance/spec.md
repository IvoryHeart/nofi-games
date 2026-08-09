## MODIFIED Requirements

### Requirement: Behavioral changes use OpenSpec

Every change to observable behavior, architecture, contracts, agent definitions, evaluation policy, or release policy SHALL have an OpenSpec change. Before implementing a new subsystem, abstraction, persistent service, execution layer, framework commitment, or substantial operational surface, the change SHALL also pass the strategic-premise gate.

#### Scenario: Agent starts implementation

- **WHEN** an agent intends to modify governed behavior
- **THEN** it SHALL read current capability specs and create or select the appropriate change schema before editing implementation files

#### Scenario: Agent proposes consequential architecture

- **WHEN** an architectural proposal crosses a strategic-premise trigger
- **THEN** the agent SHALL record the required capability reconnaissance, alternatives, boundary, validation method, and rollback before implementation
