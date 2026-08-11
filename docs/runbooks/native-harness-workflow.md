# Native harness workflow

Codex is the primary coding harness. Claude Code remains adoptable through the same Git, OpenSpec, and deterministic-check boundary. The repository does not manage provider conversations, models, permissions, authentication, context, or subagents.

## 1. Agree the change

Read current capability specs and create or select a lightweight OpenSpec change. Before implementation, ensure its proposal/deltas/tasks identify:

- the desired behavior and non-goals;
- affected current requirements;
- consequential design decisions when needed;
- deterministic acceptance commands; and
- a Git-addressable rollback target.

If implementation reveals an undeclared policy, safety, scope, or architecture decision, checkpoint useful work and update the agreement before continuing.

## 2. Inspect active claims

```bash
git worktree list
git branch --list 'agent/*'
git branch --remotes --list 'origin/agent/*'
```

Do not start a second writable claim for the same task. No task-lease database exists.

## 3. Isolate concurrent writes

```bash
pnpm worktree:new -- ../nofi-<task> agent/<harness>/<change>/<task>
```

Never symlink `node_modules` between worktrees. Let the selected harness manage its native execution lifecycle.

## 4. Implement and verify

Keep writes inside the accepted scope. Mark OpenSpec tasks complete only after their checks pass. Before handoff:

```bash
git status --short
pnpm check
```

Do not relabel, swallow, or ignore failures. Operational command output is evidence for review but does not require a custom OpenSpec evidence artifact.

## 5. Resume or integrate

A replacement thread reads `AGENTS.md`, current specs, the active change, branch history, and the current diff. Prior conversation state is optional.

Use coherent commits as checkpoints. Review the integrated diff and rerun checks. Remove only exact finished worktrees and branches after merge; never use broad recursive cleanup.
