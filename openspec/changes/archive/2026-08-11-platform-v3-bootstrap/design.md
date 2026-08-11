## Context

See `proposal.md` for motivation. `platform-v2` combines a working Godot distribution substrate with an unproven studio execution stack. The substrate is concentrated under `platform/`, `games/fixtures/contract-smoke/`, `tools/godot/`, the catalog validator, and CI. The execution stack is separately identifiable in `agents/registry.yaml`, most agent skills and evals, `studio/control-plane/`, `studio/workflows/`, custom OpenSpec schemas and artifact-heavy changes, and the workflow/agent tables in both Supabase migrations.

The current catalog validator imports its manifest schemas from `studio/control-plane`; those product contracts must move before that directory can be removed. The first Supabase migration also mixes product catalog/gameplay tables with workflow, evidence, registry, and promotion tables, so merely deleting the later runtime migration would leave heavyweight persistence in a fresh database.

## Goals / Non-Goals

**Goals:**

- Make the normative repository describe only the preserved product substrate and a small future studio boundary.
- Make deletion verifiable through named entry points, dependencies, database objects, and current specs.
- Keep the player, SDK, fixture, pack contract, catalog validation, build/export tooling, product-only database baseline, and CI operational.
- Leave enough architectural guidance to prevent another model-led orchestration loop without prematurely designing its replacement.
- Preserve the autonomous-studio north star and a path from initially human-approved actions to bounded deterministic delegation without weakening human ownership of policy.

**Non-Goals:**

- Compatibility with `platform-v2` studio runtime records or its custom change schemas on this branch.
- Data migration or deployment against any production environment.
- Implementing even a skeletal orchestrator, bounded-agent runner, model client, run-record store, delegation engine, or human-approval UI in this reset.
- Reworking Godot runtime behavior, game-pack APIs, research policy, telemetry semantics, or catalog release behavior.

## Strategic premise

### Desired outcome and required capabilities

The outcome is a comprehensible, green foundation from which the autonomous studio can be rebuilt in bounded increments. It requires: durable behavioral agreements; deterministic build and verification commands; native harnesses for human-initiated implementation work; separation of future control flow, judgment, observations, and authority; a path for humans to delegate bounded actions under accepted deterministic rules; recoverable prototype history; and the existing single-app game-pack distribution substrate. It does not require an agent runtime, registry, autonomous scheduler, promotion engine, provider adapter, session store, delegation engine, or comprehensive evidence ledger in this reset.

### Existing capabilities considered

- The installed OpenSpec `spec-driven` schema already supplies proposal, delta specs, optional design, and tasks; `openspec schemas --json` reports it as a package workflow. The four project schemas under `openspec/schemas/` duplicate and expand that agreement layer.
- Git already preserves the exact prototype on branch `platform-v2` at `201cfdda07e18b41cc5cd4f72a353e3882ab3456`; `git worktree list` shows existing game and agent experiments remain separately claimed. No branch, worktree, remote ref, or PR record needs mutation for the reset.
- Native harnesses already own model calls, conversations, permissions, tools, authentication, context, and subagents. Repository implementations of those lifecycle concerns would create another provider-shaped runtime.
- `tools/godot/check.mjs`, the contract-smoke fixture, the SDK sync/build commands, catalog validation, and `.github/workflows/check.yml` already provide deterministic substrate checks.
- The repository itself exposes the duplication: `studio/control-plane/src/contracts.ts` combines product pack/catalog contracts with workflow, agent, evaluation, and run contracts; `202608090001_platform_v2.sql` combines product tables with workflow/evidence/promotion tables; `202608090002_durable_agent_runtime.sql` adds sessions, leases, attempts, checkpoints, and model calls; the active game-run task packet is hundreds of lines before execution.

### Alternatives

1. **Refactor `platform-v2` in place.** This preserves theoretical reuse, but keeps the falsified abstractions as the organizing frame and makes absence hard to prove. Rejected because the reset must reduce cognitive and operational surface, not merely rename it.
2. **Move the entire prototype into a tracked quarantine directory.** This makes history locally browseable, but leaves obsolete schemas and machinery in every clone, formatter traversal, search result, and review. Rejected because the exact branch and commit are a stronger, cheaper quarantine. Historical branches, worktrees, remote refs, and PR evidence remain untouched.
3. **Build a smaller orchestrator and run schema during the reset.** This could demonstrate the desired boundary, but no accepted workflow has yet established its states, recovery needs, or agent interfaces. Rejected by the explicit non-goal and because “do nothing yet” is the reversible choice.
4. **Remove all studio and product infrastructure.** This is simpler but discards the independently useful player/pack foundation and single-app direction. Rejected because those contracts have deterministic checks and are explicitly preserved.

### Selected boundary, assumptions, and validation

The repository owns behavioral agreements, deterministic product/build code, product contracts, and later—only through another accepted change—domain-specific deterministic orchestration. Native harnesses own coding-agent lifecycle. A future bounded agent owns one judgment transformation but no durable control flow or ability to grant authority. A future run record owns operational facts but no policy. Humans permanently own authority, delegation, evaluation, promotion, safety, and release policy and initially approve every authority-bearing action. Humans may delegate bounded acceptance, release, and promotion actions to deterministic orchestration under previously accepted rules; the orchestration—not an agent or run record—evaluates eligibility, fails closed to human review on missing or ambiguous evidence, and enforces that an affected agent cannot approve or promote its own change. Product runtime owns player/catalog/game state.

Assumptions are that the current Godot checks are independent of the removed studio stack, catalog schemas can move without changing their JSON contract, preview databases can be rebuilt from a clean foundation baseline, and branch history is an acceptable quarantine. Disconfirming signals are any preserved check that actually requires registry/workflow/runtime code, any player/catalog contract drift, strict OpenSpec requiring custom factories, any fresh database containing agent-runtime objects, or reviewers needing live prototype files to understand current behavior. Such a signal stops deletion at the smallest dependency and requires a design update rather than a replacement subsystem.

The premise is validated when deterministic checks pass from the reduced tree, forbidden entry points and database objects are absent, current specs and docs agree on the five boundaries and delegation constraints, the autonomous-studio north star remains explicit, and no autonomous execution path exists in the bootstrap. Roll back by abandoning this branch or resetting deployment inputs to `platform-v2@201cfdd`; no production data migration is part of this change.

## Decisions

### 1. Preserve by allowlist; remove by responsibility

Keep `platform/**`, `games/fixtures/contract-smoke/**`, `tools/bootstrap/**`, `tools/godot/**`, `tools/validate-catalog.ts` plus its relocated product contracts, `.github/**`, deployment files, and relevant product docs/specs. Remove executable files whose primary responsibility is agent identity, workflow control, agent evaluation/promotion, evidence governance, or agent runtime persistence. This responsibility test avoids retaining coupled fragments merely because they compile.

Alternative: enumerate individual dead files opportunistically. Rejected because it is more likely to leave entry points, validators, dependencies, or documentation that imply the removed system still exists.

### 2. Use Git as the prototype quarantine

Delete obsolete machinery and active/custom change packets from the v3 tree while leaving `platform-v2`, existing worktrees/branches, remote refs, and PR evidence untouched. Add a short history note containing the rollback ref and what was intentionally retired. Existing archived decisions that remain useful may be summarized in current product/architecture docs; the heavy artifact copies do not remain normative.

Alternative: move all files under `archive/platform-v2/`. Rejected because it preserves search and maintenance burden and produces a rename-dominated PR.

### 3. Reset OpenSpec to package `spec-driven`

Set the default schema to `spec-driven`, remove project artifact factories, retain only current accepted behavioral specs, and keep this change as the example of the lightweight form. Design stays optional for ordinary work; it is present here because the reset is cross-cutting. Acceptance follows human-owned policy—through direct review initially and, where separately authorized, a bounded fail-closed deterministic action backed by task checks—not a mandatory `verification.md`/`decision.md`/`retrospective.md` pipeline.

Alternative: simplify the custom `system-change` schema. Rejected because the package schema already expresses the requested four artifacts and requires no local factory maintenance.

### 4. Separate product contracts before deleting the control plane

Move only the Zod identifiers, game-pack manifest, catalog entry, and catalog schemas needed by `tools/validate-catalog.ts` to a product-focused tooling module. Remove workflow, run, evidence, evaluation, agent, and promotion contracts with `studio/control-plane`. Keep strict TypeScript validation for the relocated module.

Alternative: duplicate the schemas in the validator. Rejected because one small shared product-contract module keeps catalog validation maintainable without preserving a falsely broad control plane.

### 5. Replace prototype database history with a clean product baseline

Because this branch is a pre-cutover bootstrap, replace the mixed prototype migrations with one clean baseline containing only catalog and consented gameplay data, required policies, and the private game-pack bucket. Remove workflow/evidence/agent tables, the evidence bucket, session/attempt/checkpoint/model-call functions, and related tests. Database tests must assert both required product behavior and absence of retired object families. Do not apply migrations to any remote or production environment in this change.

Alternative: append destructive drop migrations. Rejected because there is no production cutover or data-migration requirement, while a clean baseline is reproducible and avoids carrying false history into v3.

### 6. Apply 12-factor-agent principles only at the future seam

The authoritative principle list is HumanLayer's [12-Factor Agents](https://github.com/humanlayer/12-factor-agents). The applicable mapping is:

| Principle                                                      | Foundation interpretation                                                                                                                          |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Natural language to tool calls; tools as structured outputs    | Agents propose schema-valid tool or human requests; deterministic code validates and executes them.                                                |
| Own prompts and context                                        | Prompt text and context assembly belong to the bounded invocation contract, not hidden framework defaults or persistent conversation state.        |
| Unify execution and business state; launch/pause/resume simply | One explicit typed run state will drive transitions and resume; OpenSpec and model context are not shadow state stores.                            |
| Contact humans with tool calls                                 | Non-delegable policy decisions and ambiguous or ineligible delegated actions become explicit waiting transitions with structured decision packets. |
| Own control flow                                               | Deterministic domain code owns branches, retries, idempotency, and side effects.                                                                   |
| Compact errors                                                 | Run records retain bounded diagnostic summaries plus references to detailed artifacts.                                                             |
| Small, focused agents; stateless reducer                       | Each invocation performs one scoped judgment from accepted state to proposed next state.                                                           |
| Trigger from anywhere                                          | Deferred until a concrete workflow needs transport adapters; triggers will not alter domain transitions or authority.                              |

These are constraints on later proposals, not justification for creating an agent framework now.

### 7. Separate human-owned policy from delegated execution

Humans initially approve every authority-bearing action and permanently approve authority, delegation, evaluation, promotion, safety, and release policy itself. A later accepted policy may delegate only a bounded acceptance, release, or promotion action. The delegation must name its subject and action, required evidence, deterministic thresholds, scope, separation-of-duties rules, rollback, and expiry or revocation. Execution fails closed: any missing, conflicting, stale, invalid, or ambiguous eligibility evidence enters human review without acting. An affected agent cannot approve or promote its own change, and no agent output or run record can grant or expand authority.

Alternative: require a human for every action permanently. Rejected because it turns the authority boundary into a permanent throughput bottleneck and abandons the autonomous-studio direction. Alternative: let an agent interpret incomplete policy or choose when delegation applies. Rejected because it makes authority self-expanding and converts ambiguity into unsafe action.

## Risks / Trade-offs

- **Useful product schema is accidentally removed with the control plane** → Relocate and test catalog contracts before deleting the source directory.
- **Fresh database passes while old agent objects survive elsewhere** → Scope this change to reproducible local/preview reset, assert forbidden objects in database tests, and perform no remote migration.
- **Git-only quarantine is mistaken for lost history** → Record the exact rollback commit and verify branch/worktree refs before and after; do not delete or force-update refs.
- **Documentation promises an orchestrator that does not exist** → Label every execution boundary as future-facing and add an absence check for workflow/runtime entry points.
- **Human authority is mistaken for permanent per-action approval** → State the autonomous north star and bounded delegation path in product, architecture, constitution, and current specs.
- **Delegation expands through inference or incomplete evidence** → Require a previously human-approved deterministic envelope and route every missing, invalid, stale, conflicting, or ambiguous eligibility fact to human review without action.
- **An agent influences approval of its own change** → Make affected-agent ineligibility a non-overridable separation-of-duties rule for both direct and delegated approval or promotion.
- **Deleting generic eval machinery weakens game-pack verification** → Preserve Godot contract tests and fixture checks; remove only eval suites and validators coupled to agent/workflow governance.
- **OpenSpec archive behavior leaves empty retired capability shells** → Keep the active deltas valid during implementation, then archive/sync only after every task and check passes; remove empty retired capability directories if the archive operation leaves them behind and re-run strict validation.
- **A broad deletion obscures review** → Structure the commit by foundation boundary, retain a concise removal inventory, and finish with one coherent reviewable commit rather than opportunistic refactors.

## Migration Plan

1. Capture the rollback ref and verify branch/worktree claims without modifying them.
2. Relocate the minimal catalog contract and get its focused checks green.
3. Remove agent/workflow/evaluation/runtime entry points, custom OpenSpec factories, and heavyweight change packets; simplify scripts and contributor docs.
4. Replace the mixed Supabase schema with the product-only baseline and absence tests.
5. Update current specs and architecture/product docs to the five-boundary model, autonomous north star, human-owned policy, bounded delegation envelope, fail-closed review path, and affected-agent separation.
6. Run formatting, strict type/OpenSpec/catalog/Godot checks, the full `pnpm check`, web build, and local database tests when Docker is available; inspect all logs for ignored failures.
7. Verify `platform-v2@201cfdd` and existing worktree refs are unchanged, review the deletion allowlist, archive the completed lightweight change into current specs, and create one focused commit and PR against `platform-v2` without merging it.

Rollback is branch-level: no production mutation is authorized, so reviewers can reject the branch and continue from the pinned `platform-v2` commit.
