## ADDED Requirements

### Requirement: Run records remain operational

If deterministic studio orchestration is introduced later, its run records SHALL contain only the explicit state transitions, attempts, compact errors, timings, inputs, outputs, applied delegation-policy identity, eligibility evidence, actions, and artifact references required to operate and diagnose that run. Accepted product intent and decision authority SHALL remain in OpenSpec and human-approved policy rather than the record. Recording an action or agent recommendation SHALL NOT grant authority or prove eligibility.

#### Scenario: Run output conflicts with accepted intent

- **WHEN** a recorded run output would change an accepted requirement or directly human-reserved policy decision
- **THEN** the output SHALL remain a proposal and SHALL NOT mutate current specifications or authority policy

#### Scenario: Delegated eligibility evidence is incomplete

- **WHEN** a run record lacks complete and unambiguous evidence for any condition of a delegated acceptance, release, or promotion action
- **THEN** the record SHALL show a human-review wait state and no authority-bearing action

## REMOVED Requirements

### Requirement: Version-pinned workflow records

**Reason**: The prototype required a comprehensive workflow evidence envelope before a real orchestration need was established.

**Migration**: A later orchestration change may define the smallest run schema justified by its recovery and observability requirements.

### Requirement: Append-only event history

**Reason**: Append-only workflow event storage belongs to a future deterministic orchestrator, not the studio foundation.

**Migration**: Preserve historical prototype records through Git; define attempt retention with the future run-record schema.

### Requirement: Git stores definitions, not large evidence

**Reason**: Large-evidence policy is premature without an implemented workflow or evidence consumer.

**Migration**: Keep the repository-wide prohibition on secrets, raw production traces, large artifacts, and user data; future run storage must define content-addressing when introduced.
