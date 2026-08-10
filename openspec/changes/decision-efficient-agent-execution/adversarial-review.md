## Leakage and overfitting audit

This was a fresh independent review in the dedicated
`agent/codex/decision-efficient-agent-execution/independent-review` worktree. The reviewed
champion was `6860b6cefeb37fa6349a46b87004e58907ae8a5c`; the reviewed challenger was
`ae7f8ead15b20ba2ee96b97c0b0b2348a710cbe2`. The challenger is descended from the champion,
and the pinned name-status diff did not expose product, game, catalog, dependency,
infrastructure, deployment, monetization, model, or reasoning-default changes. Pre-existing
untracked `.tools` and `node_modules` entries were not treated as challenger source.

The challenger changes `agents/skills/evolve-agent/SKILL.md`, so its new proportional-evidence
language was not used as authority for this verdict. The evaluator instead used the immutable
champion skill from the pinned champion commit and the user-frozen review rule. No challenger
author transcript, raw prior transcript, game/research artifact, custom evidence root,
protected answer holdout, model-response fixture, or behavioral repetition was inspected or
created.

The frozen negative cases are useful but overfit the declaration boundary: they prove that
specific alternative labels such as `continue`, `simulate`, and `exhaustive` do not parse.
They do not prove that an accepted verdict cannot be emitted when a required evidence gate is
recorded as unmet or unknown.

## Reward-hacking and grader audit

The human contract is directionally correct on two protected points. It says minimum
repetitions continue to apply to acceptance or improvement claims while acceptance remains
possible. It also limits continuation after a decisive failure to safety, security, data
preservation, or the minimum evidence needed to identify a repair. These rules avoid treating
evidence volume as quality and do not authorize skipping evidence that can still change an
acceptance decision.

The main adversarial risk is not closed, however. `record-unmet` says to record unavailable
evidence once and forbids simulation or concealment, but it does not explicitly say that an
unmet or unknown gate required for acceptance blocks an `ACCEPT` verdict. The machine
contract only constrains the stage field to the literal string `record-unmet`; it contains no
gate-result or verdict relation. The focused tests likewise reject renamed policy fields and
unknown execution fields but contain no negative case in which acceptance is rejected because
a required gate is unmet. The claim in `results.md` that no pass-on-missing mode exists is
therefore stronger than the implemented machine contract.

This leaves a reward-hacking path: an evaluator can satisfy the schema, account for a required
gate as unmet, and still claim acceptance. That is exactly the premature-stopping failure the
protected metric forbids. A concise human sentence and a strict acceptance invariant or
negative decision fixture are needed before canary eligibility; declaration-only validation
is not sufficient.

## Regression and reproducibility audit

Provenance: native Codex CLI `0.147.0`; task class `high-judgment`; configured model
`gpt-5.6-sol`; reasoning effort `xhigh`; resolved model was not exposed. Rollback remains the
Git-only champion commit `6860b6cefeb37fa6349a46b87004e58907ae8a5c`, and independence was
preserved by making no source repair and writing the verdict only on the review branch.

The identity/diff group passed. The first focused validation command was then run exactly as:

```text
pnpm exec vitest run studio/control-plane/test/decision-efficient-execution.test.ts studio/control-plane/test/workflow-task-classes.test.ts
```

It exited `1` before Vitest executed. pnpm reported
`ERR_PNPM_UNSAFE_MODULES_DIR`: the review worktree's `node_modules` resolves to
`/home/ny/Forge/WizardOfAgents/nofi-studio/node_modules`, which is not a strict subdirectory of
the review root. The failure is preserved and was not retried. Under the frozen rule, any
focused-command failure requires immediate rejection. Project skill validation, workflow
validation, and strict change validation were deliberately not run after that decisive stop;
their independent status is `not-run-after-decisive-stop`, not pass.

Protected-metric disposition at the stop:

- scope, evaluator independence, and Git-only rollback: pass from the pinned identity/diff
  inspection;
- minimum-evidence semantics: fail because `record-unmet` is not connected to acceptance in
  the machine contract and is not explicit enough in the shared human policy;
- repetitions while acceptance remains possible: present in the shared human policy, but not
  sufficient to cure the missing unmet-gate acceptance invariant;
- continuation after decisive failure: limited to safety/security/data preservation or the
  minimum repair boundary in the shared human policy;
- strict frozen invalid-case execution: unmet because the focused command failed before test
  collection;
- project skill, workflow, and strict change validation: not run after the decisive stop;
- behavioral canary and final promotion: withheld.

## Verdict recommendation

**REJECT.** Challenger `ae7f8ead15b20ba2ee96b97c0b0b2348a710cbe2` does not qualify for
the three-task behavioral canary. The focused command failure independently forces rejection,
and source inspection found that the main minimum-evidence risk is not mechanically closed.

The minimum repair boundary is to make an unmet or unknown gate required for acceptance
explicitly prohibit acceptance, enforce that relation at the decision boundary with a strict
negative case, and rerun this same independent bounded review from a worktree with locally
safe dependencies. This record does not authorize those repairs, a re-run, integration,
canary execution, or final promotion.
