# Native Harness Workflow Specification

## Purpose

Keep model and conversation lifecycle inside supported native coding harnesses while repository agreements define reviewable work and deterministic acceptance.

## Requirements

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
