# Native harness workflow

Codex and Claude Code execute work natively. Git and OpenSpec provide the shared protocol; Supabase is not required.

Native capability references: [Codex SDK](https://developers.openai.com/codex/sdk/), [Codex subagents](https://developers.openai.com/codex/multi-agent/), [Claude Code sessions](https://code.claude.com/docs/en/sessions), [Claude Code subagents](https://code.claude.com/docs/en/sub-agents), and [Claude Code worktrees](https://code.claude.com/docs/en/worktrees).

## 1. Define the task

Select or create an OpenSpec change. Before implementation, ensure `tasks.md` identifies:

- task ID and objective;
- required inputs and writable scope;
- constraints and dependencies;
- acceptance commands and required evidence;
- rollback target.

For a new subsystem, abstraction, persistent service, execution layer, framework commitment, or substantial operational surface, apply `agents/skills/validate-strategic-premise/SKILL.md` and include its output in the proposal or design.

## 2. Inspect active claims

```bash
git worktree list
git branch --list 'agent/*'
git branch --remotes --list 'origin/agent/*'
```

Do not start a second writable claim for the same task. Read-only analysis may share a source worktree only when it cannot write.

## 3. Create an isolated worktree

From the integration worktree, choose a sibling path and deterministic branch:

```bash
git worktree add ../nofi-<task> -b agent/<codex-or-claude-code>/<change>/<task>
```

Start Codex or Claude Code in that worktree and give it the OpenSpec change and task ID. Let the harness manage its own thread, subagents, tools, context, permissions, and model.

## 4. Checkpoint and verify

Make coherent commits whenever another clean harness thread could safely continue. Before handoff:

```bash
git status --short
pnpm check
```

Record the source commit, harness/version, checks, outputs, evidence references, failures, and unresolved work in the change's verification or task artifacts. Push consequential checkpoint branches when loss of the local disk would be material.

## 5. Resume or reassign

A replacement thread reads `AGENTS.md`, the active OpenSpec change, the task item, the branch history, and the current diff. It resumes from committed state; the old transcript is optional.

An abandoned worktree never expires silently. Inspect it, commit or preserve useful work, then deliberately reassign or remove it.

## 6. Integrate and close

Review commits and evidence from the integration worktree. Run acceptance checks again after integration. Complete verification, retrospective, and independent decision artifacts before archive.

After merge, remove only the exact finished worktree and branch:

```bash
git worktree remove ../nofi-<task>
git branch -d agent/<codex-or-claude-code>/<change>/<task>
```

Never use recursive deletion or broad paths to clean worktrees.
