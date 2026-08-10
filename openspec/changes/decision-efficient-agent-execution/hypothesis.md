## Component change

Add one concise, shared `decision-sufficient-v1` execution policy and make every agent, skill
prompt, and workflow stage declare it. Update the builder, evaluator, and evolution procedures
with cheapest-first checks, explicit unavailable-gate accounting, bounded retries/probes,
fresh-thread guidance, and hard-stop behavior. Validate the policy at existing schema and
skill-validation boundaries.

## Strategic premise

- Desired outcome: agents preserve rigor while reaching useful build or verdict handoffs
  without consuming context on work that cannot affect the result.
- Required capabilities: ordered checks, explicit stopping/retry/unavailable rules, compact
  canonical checkpoints, policy validation, and independent review.
- Existing capabilities considered: native Codex/Claude context lifecycle, Git checkpoints,
  OpenSpec task/decision artifacts, Zod workflow contracts, and project skill validation
  already provide every enforcement boundary needed for a declarative challenger.
- Alternatives rejected: a token-metering service, scheduler, model router, custom harness,
  automatic thread killer, or evidence database would repeat native/runtime capabilities and
  add operational failure modes; informal retrospective prose would not prevent drift.
- Selected repository-owned boundary: one concise policy referenced by skills and prompts,
  required identifiers in agent/workflow manifests, and deterministic validation/tests.
- Assumptions and disconfirming signals: native agents follow loaded repository instructions;
  reject this boundary if canary runs still continue after decisive outcomes or if it causes
  premature stopping before minimum evidence.
- Decision, validation, and rollback: implement the Git-only challenger, validate strict
  positive/negative cases and one bounded independent review, canary on three governed tasks,
  and revert to `6860b6cefeb37fa6349a46b87004e58907ae8a5c` on drift.

## Expected quality effect and mechanism

The challenger will reach the same or safer verdict with less post-decision work because it
must test high-discrimination gates first, reproduce a decisive hard failure at most once,
write the outcome before optional evidence, and stop checks that cannot reverse it. Machine
contracts prevent prompts and workflow manifests from silently dropping the policy.

The policy does not lower acceptance thresholds. It changes the order and termination of
evidence collection. Unavailable evidence remains an unmet gate, and candidates that survive
hard gates still receive the full evidence needed for acceptance.

## Protected metrics

- Critical-error and swallowed-failure rate remain zero.
- Acceptance is never inferred from unavailable or deliberately unrun evidence.
- Every planned result is accounted for as pass, fail, unmet, unknown, or stopped after a
  decisive outcome.
- Independent evaluation and self-promotion prohibitions remain intact.
- All eight skills and all 13 workflow stages carry the policy.
- Invalid modes, continue-after-decision actions, simulated unavailable gates, excessive
  retries, and undeclared execution fields fail deterministically.
- Post-decision unnecessary work is zero in the bounded review fixture.
- No scheduler, model router, token-metering service, custom harness, persistence layer, or new
  dependency is added.

## Disconfirming result

Reject the challenger if it hides missing coverage, stops before a verdict is reproducible,
weakens quality/safety/independence gates, blocks a candidate that remains eligible, permits
policy drift through unvalidated prompts or manifests, or requires runtime orchestration to
enforce the declarative boundary.
