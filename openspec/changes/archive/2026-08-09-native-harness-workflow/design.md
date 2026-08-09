## Context

The repository already owns product intent, task decomposition, evidence gates, and decisions through OpenSpec and Git. Codex and Claude Code already own coding-agent execution. The rejected runtime inserted a direct-model coordinator and Supabase state between those layers, creating an unnecessary second harness. See `proposal.md` and the four delta specifications.

Local development is the accepted execution environment. Distributed unattended scheduling is not yet a requirement. Large or sensitive evidence still belongs outside Git by content hash; compact manifests and accepted conclusions remain in Git.

## Goals / Non-Goals

**Goals:**

- Give Codex and Claude Code one canonical, outcome-oriented task protocol.
- Make work visible and resumable through ordinary Git and OpenSpec operations.
- Isolate concurrent writes without leases or a coordination database.
- Preserve harness-specific strengths instead of reducing both harnesses to model calls.
- Remove the custom execution runtime before any live agent workflow depends on it.

**Non-Goals:**

- A common API for every possible harness.
- Automatic cross-harness model selection.
- A globally distributed scheduler or unattended multi-machine claim service.
- Durable storage of raw conversations, chain of thought, or transient tool logs.
- Removing Supabase from player/catalog/telemetry capabilities that later justify shared state.

## Strategic premise

### Desired outcome and required capabilities

Agents must understand a governed task, work independently without corrupting another task, resume after context loss, produce independently verifiable evidence, and preserve accepted knowledge. Those requirements need a task contract, workspace isolation, checkpoints, provenance, and verification. They do not currently require a model API client, conversation database, task lease service, or custom subagent coordinator.

### Existing capabilities considered

- The [Codex SDK](https://developers.openai.com/codex/sdk/) supplies start/continue/resume for local coding-agent threads, while [Codex subagents](https://developers.openai.com/codex/multi-agent/) supply native delegation.
- Claude Code documents native [sessions](https://code.claude.com/docs/en/sessions), [subagents](https://code.claude.com/docs/en/sub-agents), and [worktree isolation](https://code.claude.com/docs/en/worktrees).
- Git supplies branches, worktrees, commits, diffs, merging, rollback, and remote synchronization.
- OpenSpec supplies versioned proposals, tasks, verification, retrospectives, decisions, and accepted capability knowledge.
- CI supplies deterministic checks independent of the authoring harness.

### Alternatives

- Keep the direct Responses runtime: rejected because it duplicates harness execution and makes OpenAI provider semantics the core abstraction.
- Keep Supabase only for task leases: rejected for the current local execution scope because a worktree/branch is visible ownership and explicit recovery is safer than an unnecessary expiring lease.
- Build a generic harness API now: rejected because only Codex and Claude Code are required and lowest-common-denominator APIs would hide native capabilities.
- Use one harness only: rejected because repository artifacts can remain portable across the two requested harnesses at little cost.

### Selected boundary and disconfirming signals

The repository owns task packets, accepted artifacts, Git isolation, verification, decisions, and portable skills. Each harness owns execution. This decision must be revisited if work must be automatically scheduled across untrusted machines, task claims must survive without shared Git visibility, or measured manual coordination failures cannot be resolved with branches/worktrees.

Validation requires completing the same fixture task in clean Codex and Claude Code contexts from repository artifacts, losing harness context, resuming from the last commit, and passing identical checks. Rollback restores the rejected runtime from Git history.

## Decisions

### 1. OpenSpec change plus task item is the task system

`proposal.md` and specs define intent; `tasks.md` defines executable units; verification and decision artifacts close the loop. A task packet is outcome-oriented and does not serialize harness prompts or provider requests.

Alternative task databases add shared-state semantics that are not required locally and become a second source of truth.

### 2. Branch and worktree are claim and isolation

Writable work uses `agent/<harness>/<change>/<task>` branches in sibling worktrees. Locally, `git worktree list` shows active claims. Across machines, a pushed branch or draft PR supplies visibility. Read-only analysis may share a worktree when the harness can guarantee no writes.

There is no automatic expiry. Abandoned state stays visible until a deliberate resume, reassignment, or cleanup, avoiding lease races and hidden loss. Two branches claiming the same task are a detectable coordination error resolved before merge.

### 3. Commits are checkpoints; accepted docs are memory

Agents make coherent checkpoint commits when work can be resumed or independently inspected. Uncommitted diffs are recoverable local evidence, not accepted knowledge. Harness thread resumption is an optimization; a clean thread must reconstruct the task from the branch, OpenSpec artifacts, and committed evidence.

### 4. Harness capability is declared, not normalized away

Canonical tasks contain objectives, inputs, constraints, writable scope, acceptance, evidence, and rollback. Harness-specific subagent strategies, thread identifiers, tools, and models remain native. Verification records the harness/version and available model provenance without making those fields execution inputs.

Only `codex` and `claude-code` are valid harness identities in this version. Adding another harness requires measured need and an OpenSpec change.

### 5. The TypeScript control plane does not invoke models

The control plane validates workflow contracts and evaluation decisions. The direct-provider coordinator, session/model policies, provider smoke workflow, and OpenAI SDK are removed. Existing additive Supabase runtime tables remain unused historical schema because deleting remote evidence is unnecessary for the source correction.

### 6. Strategic validation precedes implementation

`validate-strategic-premise` runs for consequential architecture. Its output is embedded in the proposal or design rather than introducing a separate database or approval service. The gate challenges requirements and reuse before implementation tests can create false confidence.

## Risks / Trade-offs

- [Two agents claim the same task] → Make branch names deterministic, inspect local worktrees and remote branches before assignment, and reject overlapping integration.
- [A local disk is lost before push] → Checkpoint coherent work and push consequential branches; do not treat uncommitted state as durable.
- [Docs drift from source] → CI validates OpenSpec, workflows, skills, tests, and decision artifacts; accepted changes require verification.
- [Codex and Claude interpret portable skills differently] → Keep task outcomes and gates portable, retain harness-specific instructions only at thin entry points, and compare both on fixtures.
- [Distributed scheduling becomes necessary] → Open a new premise-gated change using observed coordination failures; do not prebuild it.
- [Historical Supabase runtime tables confuse operators] → Mark the migration and rejected change as deprecated, remove every runtime command/read path, and document that no new records are written.

## Migration Plan

1. Reject `durable-agent-runtime` and preserve its artifacts as the evidence that triggered this correction.
2. Add canonical Codex/Claude instructions, the strategic-premise skill, and local worktree runbook.
3. Remove the direct-provider implementation, dependencies, policies, commands, tests, and live-provider workflow.
4. Restore outcome-oriented agent/workflow contracts and add harness provenance to compact workflow records.
5. Validate a clean repository, worktree isolation/resume procedure, skill structure, and OpenSpec deltas.
6. Obtain independent evaluation of the strategic-premise challenger before declaring it an agent improvement; user-directed architecture policy may operate while that promotion evidence remains pending.

Source rollback restores commit `c6b891d` or the individual removed files. Hosted Supabase tables are not dropped during rollback or migration.
