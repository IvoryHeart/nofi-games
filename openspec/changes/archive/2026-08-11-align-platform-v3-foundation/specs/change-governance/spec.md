## MODIFIED Requirements

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
