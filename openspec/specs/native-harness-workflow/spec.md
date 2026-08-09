# native-harness-workflow Specification

## Purpose

Define a durable, inspectable local agent workflow that delegates execution to Codex or Claude Code while Git and OpenSpec retain authoritative tasks, checkpoints, evidence, and decisions.

## Requirements

### Requirement: Supported harnesses own agent execution

The studio SHALL execute agent work through Codex or Claude Code and SHALL leave thread lifecycle, subagents, tools, context management, permissions, authentication, and model invocation to the selected harness.

#### Scenario: Codex executes a governed task

- **WHEN** a task is assigned to Codex
- **THEN** Codex SHALL consume the same canonical task and acceptance artifacts used by Claude Code without a direct model-provider adapter

#### Scenario: Unsupported harness is requested

- **WHEN** a task requests a harness other than Codex or Claude Code
- **THEN** execution SHALL remain unassigned until an accepted OpenSpec change adds support

### Requirement: Governed work has a canonical task packet

Every consequential task SHALL identify its OpenSpec change, task ID, objective, inputs, writable scope, constraints, acceptance checks, required evidence, and rollback target in versioned repository artifacts.

#### Scenario: Harness context is unavailable

- **WHEN** a new harness thread resumes an unfinished task
- **THEN** the task packet and committed artifacts SHALL provide enough accepted context to continue without the prior transcript

### Requirement: Writable tasks are isolated by Git worktree

Every concurrently writable task SHALL use a dedicated Git branch and worktree whose names identify the harness, change, and task. A worktree or remote branch is the visible claim; no database lease is required.

#### Scenario: Two agents modify source concurrently

- **WHEN** two independent writable tasks run at the same time
- **THEN** they SHALL operate in separate worktrees and integrate through reviewed commits rather than sharing uncommitted files

#### Scenario: An agent stops unexpectedly

- **WHEN** an agent exits before completing its task
- **THEN** its branch, worktree, commits, and uncommitted diff SHALL remain inspectable for explicit resume, reassignment, or deletion

### Requirement: Git commits are durable checkpoints

Agents SHALL checkpoint accepted intermediate state with coherent commits and SHALL record verification and decision evidence in the corresponding OpenSpec change.

#### Scenario: Harness thread is replaced

- **WHEN** execution continues in a new Codex or Claude Code thread
- **THEN** the new thread SHALL resume from the task branch, last accepted commit, task artifact, and unresolved work rather than a provider conversation record

### Requirement: Local coordination does not depend on Supabase

Creating, claiming, executing, resuming, evaluating, and completing a local agent task SHALL NOT require Supabase task, lease, session, attempt, model-call, or checkpoint records.

#### Scenario: Supabase is offline

- **WHEN** the product database is suspended or unavailable
- **THEN** local Codex and Claude Code development workflows SHALL remain fully operable through Git, worktrees, OpenSpec, and local verification

### Requirement: Harness provenance remains inspectable

Consequential verification SHALL record the harness name and version, source commit, task identity, checks, outputs, and evidence references. Model and thread identifiers MAY be recorded when useful but SHALL NOT be authoritative workflow state.

#### Scenario: Equivalent tasks use different harnesses

- **WHEN** Codex and Claude Code results are compared
- **THEN** the evidence SHALL identify each harness and source state while applying the same acceptance criteria
