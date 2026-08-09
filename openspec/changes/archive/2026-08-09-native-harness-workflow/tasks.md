## Work packet

- Change: `native-harness-workflow`
- Supported harness: `codex`
- Branch/worktree: `platform-v2` integration worktree; no concurrent writer is assigned
- Inputs and dependencies: rejected `durable-agent-runtime`, user architecture direction, current Codex/Claude capabilities, Git/OpenSpec conventions
- Writable scope: repository agent instructions, OpenSpec, docs, control-plane contracts/tests, workflow manifests, dependencies, CI, and rejected-runtime source paths
- Acceptance commands: skill quick validation, `pnpm check`, `pnpm build:web`, strict OpenSpec validation, temporary worktree smoke, dependency/source scans
- Required evidence: commands, hashes, harness versions, source commit, limitations, rollback
- Rollback target: Git commit `c6b891d`; do not reset or delete hosted Supabase evidence

## 1. Reject the incorrect premise

- [x] 1.1 Record the missing harness reconnaissance and change the durable runtime decision from recommendation to rejection.
- [x] 1.2 Add premise-gated native-harness capability, governance, and evidence-ledger deltas.
- [x] 1.3 Preserve the additive hosted migration as inert history rather than destructively rewriting the restored project.

## 2. Establish native harness execution

- [x] 2.1 Add canonical Codex and Claude Code entry instructions and the Git worktree/checkpoint runbook.
- [x] 2.2 Restore outcome-oriented agent/workflow definitions and add compact native-harness provenance to workflow records.
- [x] 2.3 Remove the OpenAI provider, custom coordinator, model/session policies, runtime commands, live smoke workflow, tests, and SDK dependencies.

## 3. Add the strategic-premise gate

- [x] 3.1 Add the premise skill, prerequisite OpenSpec artifact/schema, project rule, task-packet template, and structural validator.
- [x] 3.2 Add public regression fixtures, rubric, and protected evaluation suite for the champion/challenger process.

## 4. Verify and hand off

- [x] 4.1 Run formatting, types, unit tests, skills, premises, OpenSpec, evals, workflows, catalog, Godot, and web export checks.
- [x] 4.2 Run an isolated temporary worktree/resume smoke and scan for active direct-provider or Supabase-coordination paths.
- [x] 4.3 Record verification, retrospective, decision, final hashes, and the independent-evaluation limitation.
