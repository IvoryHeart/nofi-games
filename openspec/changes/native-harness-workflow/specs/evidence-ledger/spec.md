## MODIFIED Requirements

### Requirement: Version-pinned workflow records

Every consequential workflow run SHALL pin its Git commit, OpenSpec change, workflow, harness and harness version, agents, available model provenance, prompts, skills, tools, inputs, outputs, evaluation suite, baseline, and event history. Git/OpenSpec records SHALL be sufficient for local agent-task coordination without database session, lease, attempt, or checkpoint state.

#### Scenario: Behavior changes between runs

- **WHEN** two runs produce different outcomes
- **THEN** the ledger SHALL expose the source, harness, version, and input differences needed to investigate the divergence

#### Scenario: Product database is unavailable

- **WHEN** a local governed task starts or resumes without Supabase
- **THEN** its versioned Git and OpenSpec records SHALL preserve the task, accepted checkpoints, evidence, and decision trail
