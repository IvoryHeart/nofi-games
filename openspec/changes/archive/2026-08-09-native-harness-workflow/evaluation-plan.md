## Requirement coverage

| Requirement                                              | Evidence method                                                                                | Acceptance threshold                                                                                                    |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Supported harnesses own agent execution                  | TypeScript `HarnessName` test; dependency and source scan; Codex/Claude entry-point inspection | Only `codex` and `claude-code` validate; no direct model SDK, provider coordinator, or live model workflow remains      |
| Governed work has a canonical task packet                | System-change schema/template and runbook inspection; `pnpm premises:validate`                 | Change, task, outcome, inputs, scope, acceptance, evidence, and rollback are versioned before implementation            |
| Writable tasks are isolated by Git worktree              | Temporary sibling worktree smoke plus runbook command review                                   | Separate branch/worktree is visible in `git worktree list`; original worktree remains unchanged; exact cleanup succeeds |
| Git commits are durable checkpoints                      | Resume walkthrough from clean context and source history inspection                            | Task can be reconstructed from OpenSpec, branch, commit, and diff without transcript or provider session data           |
| Local coordination does not depend on Supabase           | Source/dependency scan and `pnpm check` without Supabase environment variables or services     | All non-product agent workflow checks pass; zero active reads/writes to runtime coordination tables                     |
| Harness provenance remains inspectable                   | `WorkflowRun` schema/unit test and demo                                                        | Harness, version, task, source commit, checkpoint commits, optional model/thread provenance, and evidence validate      |
| Consequential proposals validate their strategic premise | System-change schema dependency plus premise validator                                         | Proposal is structurally preceded by complete strategic-premise artifact                                                |
| Existing-capability claims use authoritative evidence    | Manual review of native-harness premise and cited local/product evidence                       | Every material current-capability claim is supported or explicitly marked for later verification                        |
| Abstraction names match their contracts                  | Adversarial scan of contracts/docs                                                             | No model-provider-shaped interface is described as harness-neutral                                                      |
| Evaluations test strategic fit                           | Evaluation plan and strategic-premise suite inspection                                         | Strategic fit, capability reuse, operational surface, outcome preservation, and reversibility are protected             |
| Behavioral changes use OpenSpec                          | Strict OpenSpec validation                                                                     | All changed capabilities have valid deltas and the premise gate is present                                              |
| Version-pinned workflow records                          | Unit test and schema inspection                                                                | Compact workflow record pins harness/source/task provenance and does not require database state                         |

## Protected metrics

- Direct model-provider SDK dependencies in the control plane: `0`.
- Active code paths reading or writing `studio_agent_sessions`, `studio_stage_attempts`, `studio_agent_checkpoints`, or `studio_model_calls`: `0`.
- Supported harness identities: exactly `codex` and `claude-code`.
- Player/game-pack behavior regression: `0`; all existing Godot checks pass.
- Workflow, skill, evaluation, catalog, formatting, and type validation regression: `0`.
- Loss of the rejected change, verification evidence, or hosted migration history: `0`.
- Destructive hosted database operations: `0`.

## Holdout or adversarial cases

- Attempt to validate an unsupported `direct-model-api` harness.
- Resume from a fresh context with no transcript or provider conversation.
- Operate with Supabase stopped and credentials absent.
- Simulate duplicate task claims through two matching branch names; require explicit resolution rather than automatic acceptance.
- Leave an uncommitted diff in an abandoned worktree and prove it remains inspectable.
- Propose a future distributed scheduler and verify the current design treats it as a new premise-gated requirement rather than silently expanding.
- Check that a justified repository-native validator is not rejected merely because reuse is preferred.

## Rollback triggers

- Codex or Claude Code cannot consume the canonical task artifacts without harness-specific duplication of product requirements.
- A fresh thread cannot resume accepted work from Git/OpenSpec artifacts.
- Local execution requires Supabase coordination records or provider API credentials.
- Worktree isolation loses or overwrites another task's uncommitted changes.
- Removal of the runtime breaks player/game-pack behavior or evidence/promotion safeguards.
- The strategic gate systematically blocks justified construction or fails to detect the rejected runtime premise in independent evaluation.
