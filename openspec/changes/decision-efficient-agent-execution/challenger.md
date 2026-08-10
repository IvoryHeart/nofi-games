## Champion manifest

- Source and rollback: `6860b6cefeb37fa6349a46b87004e58907ae8a5c`.
- Agent registry: schema `1`, eight agents at `0.1.0`, no execution policy.
- Workflows: schema `2`, version `0.2.0`, no execution policy.
- Skills: no common decision budget or decisive-failure stop contract.
- Native task policy: task class and model are declared, but execution extent is unbounded.

## Challenger manifest

- Source: the final coherent challenger commit on
  `agent/codex/decision-efficient-agent-execution/challenger-build`.
- Agent registry: schema `2`, eight agents at `0.2.0`, policy
  `decision-sufficient-v1`.
- Workflows: schema `3`, version `0.3.0`, strict per-stage policy with
  `decision-sufficient`, `stop-and-report`, `record-unmet`, and retry limit `1`.
- Skills/prompts: all eight reference the shared policy; builder, evaluator, and agent
  evolution carry role-specific stop behavior.
- Evaluation: deterministic contract cases plus a bounded independent adversarial review;
  the next three governed runs are the behavioral canary.

Final source and file hashes are recorded in `results.md` after the challenger is committed.

## Exact diff boundary

The challenger may change only:

1. repository/constitution/native-runbook execution guidance;
2. the shared execution policy, eight project skills, their UI default prompts, and the agent
   registry;
3. workflow/agent TypeScript contracts, three workflow manifests, validators, and focused
   tests;
4. native-harness and agent-evolution specifications/templates needed to make stopping and
   proportional evidence durable; and
5. this agent-evolution packet.

It may not change models, reasoning defaults, game/player/catalog code, product data,
dependencies, infrastructure, release authority, or accepted evidence thresholds.

## Rollback target

Revert the challenger to `6860b6cefeb37fa6349a46b87004e58907ae8a5c`. The change is
Git-only and creates no external state or migration.
