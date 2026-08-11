## MODIFIED Requirements

### Requirement: Supported harnesses own agent execution

When a human assigns bounded repository work to a supported native coding harness, that harness SHALL own its model calls, conversation lifecycle, context management, permissions, tools, authentication, and subagents. The repository SHALL expose accepted inputs and outputs without implementing provider adapters, conversation managers, model routers, task leases, or subagent coordination.

#### Scenario: Codex executes a governed task

- **WHEN** a human assigns repository work from an accepted OpenSpec change to Codex
- **THEN** Codex SHALL work through the repository's files, Git boundary, and deterministic checks without a studio runtime managing its conversation

#### Scenario: Claude Code adopts a task

- **WHEN** a human deliberately assigns an accepted task to Claude Code
- **THEN** Claude Code SHALL consume the same repository agreements and produce reviewable files and Git changes without requiring Codex conversation state

#### Scenario: Unsupported harness is requested

- **WHEN** work requires a harness whose authority or repository interface has not been accepted
- **THEN** the work SHALL remain human-managed until a later OpenSpec change defines that boundary

## REMOVED Requirements

### Requirement: Codex task class determines the default model

**Reason**: Repository policy for harness-specific model selection is provider lifecycle configuration, not product behavior.

**Migration**: Humans and native harness configuration select suitable models; acceptance remains based on change-specific checks.

### Requirement: Governed work has a canonical task packet

**Reason**: Lightweight proposal, delta, optional design, and tasks provide sufficient canonical input without a separate task-packet contract.

**Migration**: Put objective, constraints, checks, and rollback directly in the change artifacts.

### Requirement: Writable tasks are isolated by Git worktree

**Reason**: Worktree coordination is a contributor convention rather than a studio execution capability.

**Migration**: Retain practical Git safety guidance in contributor instructions where applicable.

### Requirement: Git commits are durable checkpoints

**Reason**: Commit hygiene is a contributor practice and does not require a workflow requirement or evidence artifact.

**Migration**: Continue using coherent commits and reviewable branches through contributor guidance.

### Requirement: Local coordination does not depend on Supabase

**Reason**: The reset removes local agent coordination entirely, making the negative workflow requirement redundant.

**Migration**: Keep product databases scoped to product runtime data; propose any future orchestration persistence separately.

### Requirement: Harness provenance remains inspectable

**Reason**: Mandatory harness provenance was part of the retired evidence machinery and is not needed for deterministic product acceptance.

**Migration**: Future run records may record harness provenance when a concrete diagnosis or comparison requires it.

### Requirement: Model provenance remains inspectable

**Reason**: Mandatory model provenance was part of the retired evidence machinery and is not authoritative workflow identity.

**Migration**: Future bounded-agent contracts may add the minimum model metadata required by a specific evaluation.

### Requirement: Workflow stages declare their task class

**Reason**: The declarative workflow graph and its automatic model-routing inputs are removed.

**Migration**: A future deterministic workflow must define its own typed step contracts without implementing model routing implicitly.

### Requirement: Bounded workflow stages preserve their decision boundary

**Reason**: There are no executable workflow stages in the bootstrap foundation.

**Migration**: The new studio execution boundary constrains any later bounded agent invocation and reserves consequential authority for humans.
