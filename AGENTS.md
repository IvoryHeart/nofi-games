# Agent instructions

These instructions apply to the entire repository.

## Mission

Build and operate a single player app whose game catalog is continuously researched, created, evaluated, released, observed, and improved by agents.

## Mandatory reading order

1. Read `README.md`.
2. Read `docs/product/strategy.md` and `docs/architecture/system.md`.
3. Read `agents/constitution.md`.
4. Read the relevant capability under `openspec/specs/`.
5. Read the active change under `openspec/changes/` before modifying behavior.
6. For consequential architecture, apply `agents/skills/validate-strategic-premise/SKILL.md` before implementation.
7. Follow `agents/execution-policy.md` for every consequential task.

## Non-negotiable constraints

- Do not encode a fixed genre or archetype portfolio into the platform. Research proposes the catalog.
- Do not create a separate distribution app for a game. Games ship as packs through the single player app.
- Do not add monetization work unless an accepted OpenSpec change explicitly moves it into scope.
- Do not let an agent promote a change to its own definition, prompt, skills, tools, model, or evaluation policy.
- Do not treat generated prose, self-reported confidence, or a single run as evidence of improvement.
- Do not bypass OpenSpec for behavioral or architectural changes.
- Do not implement a model client, conversation manager, task lease service, or subagent coordinator for studio agent execution when Codex or Claude Code already supplies the required capability.
- Do not describe an interface as harness-neutral when it exposes model-provider lifecycle semantics.
- Do not put secrets, raw production traces, large artifacts, or user data in Git.
- Do not edit generated Godot SDK copies under game projects; edit `platform/godot-sdk/addons/nofi_sdk` and run `pnpm godot:sync-sdk`.
- Do not continue work that cannot change a frozen decision, or build evaluation infrastructure merely to account for an unavailable gate.

## Definition of done

A change is complete only when:

- Its OpenSpec requirements and scenarios are satisfied.
- Tests and evaluations provide reproducible evidence.
- `pnpm check` passes.
- Logs contain no ignored or unhandled failures.
- Documentation and machine-readable contracts agree.
- The change has a rollback target.
- Its retrospective records reusable lessons or explicitly says none were found.
- Its execution record shows that declared stop conditions, retries, unavailable gates, and deliberately unrun work were honored.

## Skills

Project skills live under `agents/skills/`. Use the narrowest applicable skill and follow its declared inputs, outputs, and gates. Changes to a skill use the `agent-evolution` OpenSpec schema and champion/challenger evaluation.

## Work execution

- Codex is the primary execution harness. Claude Code remains supported and adoptable through the same artifact protocol; ordinary Codex work does not require active Claude execution. Harness threads, subagents, permissions, tools, authentication, compaction, and model calls remain native to the selected harness.
- Classify consequential Codex tasks in their task packet. Use `bounded-implementation` with `gpt-5.6-luna` and `xhigh` reasoning for narrow, settled, deterministically checked implementation. Use `high-judgment` with `gpt-5.6-sol` and `xhigh` reasoning for strategy, architecture, ambiguous design, premise validation, adversarial review, and promotion or rejection decisions.
- If a bounded task discovers undeclared strategic or architectural ambiguity, checkpoint useful work and return the decision to a high-judgment task. Do not silently broaden scope or build automatic model routing.
- Prepare every consequential task with a decision question, minimum sufficient evidence, hard stop conditions, retry limit, maximum new probes, unavailable dependencies, and checkpoint/thread-reset condition. Use the workflow's `executionPolicy` as the default.
- Optimize for time-to-trustworthy-decision, not context consumed or artifacts produced. Run high-discrimination checks first; after a reproducible hard gate makes acceptance impossible, report and stop work that cannot alter the verdict.
- Treat planned but unavailable or unnecessary checks as accounted `unmet`, `unknown`, or `not-run-after-decisive-stop`. Never fabricate coverage and never interpret missing evidence as a pass.
- Resume a native thread only when its uncommitted context is materially cheaper to recover than the canonical Git/OpenSpec checkpoint. Long context capacity is not a reason to reuse a costly thread.
- OpenSpec artifacts are the canonical task, evidence, retrospective, and decision record. Conversation history is never the only copy of accepted knowledge.
- Use a dedicated `agent/<harness>/<change>/<task>` branch and worktree for every concurrent writable task. A branch/worktree is the task claim; a coherent commit is a checkpoint.
- Create writable worktrees with `pnpm worktree:new -- <sibling-path> <branch>`. Never symlink `node_modules` between worktrees; pnpm shares package content through its store while keeping each worktree's module layout local and safe.
- Before assigning work, inspect `git worktree list` and matching local/remote branches. Resolve duplicate claims explicitly; do not add a database lease for local coordination.
- Record harness/version, task class, configured model, and reasoning effort in consequential verification. Record the resolved model when exposed. Model or thread identifiers are evidence, not workflow identity.
- A distributed scheduler, another harness, or automatic model routing requires a separately accepted, premise-gated OpenSpec change.

## Source conventions

- Use typed GDScript for games and the player app.
- Use strict TypeScript for the studio control plane and tooling.
- Keep gameplay state and decisions separable from rendering.
- Make randomness seeded and clocks controllable.
- Prefer structured artifacts and schemas over prose parsing.
- Make operations idempotent and resumable.
- Pin tool and model versions in recorded workflow runs.
