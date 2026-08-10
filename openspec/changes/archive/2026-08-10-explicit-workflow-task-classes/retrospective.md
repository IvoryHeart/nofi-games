# Retrospective

## Evidence-backed reusable lessons

- A required field at the existing `WorkflowDefinition` parser is sufficient to make stage classification deterministic when every repository manifest is migrated atomically. The focused matrix test and positive repository validator both exercised that boundary.
- Task class must remain a declarative authority/judgment property, not a derivation from mutation or publication flags. The 13-row test preserved high judgment for evaluation and verdict stages even when those stages do not mutate source.
- A bounded class is useful only with a frozen-input preflight. The runbook now makes accepted inputs, narrow scope, mechanical checks, rollback, exact challenger edits, and checkpoint/escalation explicit without adding an execution service.
- Versioning a breaking manifest boundary makes rollback inspectable. The isolated snapshot reproduced schema version 1 and workflow version `0.1.0` for all three pre-change manifests with no external cleanup.
- Shared setup symlinks can invalidate exact package-manager commands in a worktree even when direct pinned binaries work. Acceptance evidence should retain the initial failure and use a reversible, non-committed setup adjustment for the retry.

## Invalidated assumptions

- It was not safe to assume that `pnpm` would accept the pre-existing shared `node_modules` symlink; it rejected the first exact command before executing tests.
- It was not safe to assume that every worktree had the ignored repository-local Godot binary; the first full check stopped at `godot:check` until an existing binary was linked temporarily.
- No planning assumption about a second workflow-definition consumer or an external/persisted schema-version-1 workflow definition was invalidated. Repository search found none, so no high-judgment design update was required.

No new policy, model-routing rule, dependency, runtime component, or unsupported recommendation is proposed by this retrospective. Independent review remains the authority for acceptance or rejection.
