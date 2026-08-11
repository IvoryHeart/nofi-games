# Agent instructions

These instructions apply to the entire repository.

## Mission

Build one player app whose research-selected catalog can eventually be continuously researched, created, evaluated, released, observed, and improved by agents. The current repository is only the studio foundation; it implements no autonomous workflow.

## Mandatory reading order

1. Read `README.md`.
2. Read `docs/product/strategy.md` and `docs/architecture/system.md`.
3. Read `agents/constitution.md`.
4. Read the relevant current capability under `openspec/specs/`.
5. Read the active change under `openspec/changes/` before modifying behavior.

## Non-negotiable product constraints

- Do not encode a fixed genre or archetype portfolio. Research proposes the catalog.
- Do not create a separate distribution app for a game. Games ship as packs through the single player app.
- Do not add monetization unless a directly human-approved OpenSpec policy change moves it into scope.
- Do not put secrets, raw production traces, large artifacts, or user data in Git.
- Do not edit generated SDK copies under game projects; edit `platform/godot-sdk/addons/nofi_sdk` and run `pnpm godot:sync-sdk`.

## Authority

- Humans permanently approve authority, delegation, evaluation, promotion, safety, and release policy and changes to those policies.
- Only bounded acceptance, release, and promotion actions may be delegated under previously accepted deterministic rules.
- Missing, conflicting, stale, invalid, or ambiguous eligibility evidence pauses without action for human review.
- An agent cannot grant or expand its authority, change applicable policy, or approve or promote a change that affects itself.
- Generated prose, self-reported confidence, a run record, one run, or lower cost is not authority or evidence of improvement.

## Change protocol

- Use lightweight OpenSpec for behavioral or architectural changes: current specs, concise delta, optional design, and tasks.
- For consequential architecture, record existing capabilities, alternatives including doing nothing, the minimal owned boundary, falsifiable acceptance, and rollback in design. No dedicated artifact factory is required.
- Do not implement a model client, conversation manager, task lease service, model router, or subagent coordinator when a native harness supplies the capability.
- Do not call an interface harness-neutral if it exposes provider lifecycle semantics.
- OpenSpec is not a runtime, run ledger, transcript, evidence store, or authority database.

## Definition of done

A change is complete only when:

- its requirements and scenarios are satisfied;
- deterministic tests and checks provide reproducible results;
- `pnpm check` passes;
- logs contain no ignored, swallowed, or unhandled failures;
- documentation and machine-readable contracts agree;
- generated artifacts, secrets, large traces, and user data are not staged; and
- the rollback target is Git-addressable.

## Work execution

- Codex is the primary native coding harness; Claude Code remains supported. Harness threads, subagents, permissions, tools, authentication, context, and model calls remain native to the selected harness.
- Keep tasks bounded by their OpenSpec agreement. Stop and update the agreement if implementation reveals an undeclared policy, safety, scope, or architecture decision.
- For concurrent writable tasks, inspect `git worktree list` and matching branches first, then use a dedicated branch/worktree. The visible Git claim replaces a task-lease database.
- Create writable worktrees with `pnpm worktree:new -- <sibling-path> <branch>`. Never symlink `node_modules` between worktrees.
- Use coherent commits as recoverable checkpoints. Conversation history is never the only copy of accepted knowledge.

## Source conventions

- Use typed GDScript for games and the player app.
- Use strict TypeScript for product tooling and any future deterministic orchestration.
- Keep gameplay state and decisions separate from rendering.
- Make randomness seeded and clocks controllable.
- Prefer typed state and structured outputs over prose parsing.
- Make operations idempotent and resumable.
