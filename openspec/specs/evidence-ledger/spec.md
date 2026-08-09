# Evidence Ledger Specification

## Purpose

Preserve enough immutable run context to attribute decisions, reproduce failures, compare versions, and roll back games, workflows, and agents.

## Requirements

### Requirement: Version-pinned workflow records

Every consequential workflow run SHALL pin its Git commit, OpenSpec change, workflow, harness and harness version, agents, available model provenance, prompts, skills, tools, inputs, outputs, evaluation suite, baseline, and event history. Git/OpenSpec records SHALL be sufficient for local agent-task coordination without database session, lease, attempt, or checkpoint state.

#### Scenario: Behavior changes between runs

- **WHEN** two runs produce different outcomes
- **THEN** the ledger SHALL expose the source, harness, version, and input differences needed to investigate the divergence

#### Scenario: Product database is unavailable

- **WHEN** a local governed task starts or resumes without Supabase
- **THEN** its versioned Git and OpenSpec records SHALL preserve the task, accepted checkpoints, evidence, and decision trail

### Requirement: Append-only event history

Workflow status changes and decisions SHALL append new events rather than rewriting prior events.

#### Scenario: Failed run is retried

- **WHEN** a failed run resumes
- **THEN** both the failure and retry SHALL remain ordered and queryable

### Requirement: Git stores definitions, not large evidence

Git SHALL contain versioned definitions and compact evidence manifests while large artifacts and sensitive runtime evidence SHALL be stored outside Git by content hash.

#### Scenario: Visual evaluation produces media

- **WHEN** an evaluation produces screenshots, video, or replay bundles
- **THEN** Git SHALL store references and hashes without committing the large artifacts
