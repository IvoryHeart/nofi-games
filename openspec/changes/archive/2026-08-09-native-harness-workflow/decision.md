## Verdict

PROMOTE

Promote the native-harness architecture and archive its capability deltas. The repository owner explicitly selected Codex and Claude Code, Git worktrees, and versioned documentation instead of a custom harness or Supabase coordination. This verdict accepts that architecture and its verified source correction; it does not promote the strategic-premise skill as an empirically superior agent version.

## Evidence

- Implementation commit `57e3d8bc` removes the direct OpenAI provider, custom stage coordinator, session/model policies, live-provider workflow, runtime commands/tests, and associated SDK dependencies.
- Codex and Claude Code entry points consume one canonical OpenSpec/Git protocol while leaving execution native.
- A temporary named worktree proved branch isolation, visibility, and exact cleanup.
- `pnpm check`, `pnpm build:web`, the skill quick validator, `pnpm studio:demo`, strict OpenSpec validation, source/dependency scans, and `git diff --check` pass.
- Current official Codex and Claude Code documentation supports native resumable sessions/threads, subagents, and the selected worktree approach.
- The rejected runtime change, hosted migration, and verification evidence remain preserved and marked unused rather than being destructively rewritten.

## Protected-metric result

- Direct model SDK dependencies in the studio control plane: pass (`0`).
- Active Supabase coordination-table paths: pass (`0`).
- Supported harness identities: pass (exactly `codex`, `claude-code`).
- Player/game-pack, workflow, skill, evaluation, catalog, type, and format regressions: pass (`0`).
- Hosted evidence or migration loss: pass (`0`).
- Destructive database operations: pass (`0`).
- Strategic-premise agent improvement: not evaluated; separate `strategic-premise-gate` verdict is `RE-RUN`.

No architecture rollback trigger is active for the accepted local/trusted scope. Cross-harness quality equivalence and distributed scheduling remain explicitly outside the promoted claim.

## Rollback target

Restore implementation commit `c6b891dc93b659bc0462a7957fd1b93632902870` or recover individual deleted files from Git. Do not reset Supabase or delete historical evidence. If only the strategic-premise skill is later rejected, remove its instruction/schema/validator diff without restoring the custom runtime.
