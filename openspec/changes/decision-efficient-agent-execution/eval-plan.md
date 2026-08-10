## Regression and capability tasks

1. Parse the shared policy and every skill/default prompt.
2. Parse all eight versioned agents and all 13 workflow stages.
3. Run positive/negative contract cases for omitted or renamed agent policy, exhaustive mode,
   continue-after-decision, simulated unavailable gates, more than two retries, and unknown
   execution fields.
4. Verify evaluator/build/evolution skills retain independence, failure reporting, quality,
   and protected evidence gates.
5. Run focused TypeScript tests, skill validation, workflow validation, type checking, strict
   OpenSpec validation, and the repository check once after the final relevant source change.
6. Have a fresh independent reviewer inspect only the pinned diff, policy, affected contracts,
   focused tests, and raw command results; it must not repair the challenger.

## Decision question, ordered gates, and earliest stop

Question: does the challenger make the observed continue-after-decision behavior contrary to
both human-readable instructions and machine-readable contracts without weakening evidence?

Order:

1. Reject immediately on a scope, independence, quality, or missing-evidence regression.
2. Reject immediately if any invalid execution-policy fixture parses.
3. Reject if any current agent, skill prompt, or workflow stage omits the policy.
4. If all deterministic gates pass, perform one bounded independent adversarial review.
5. Apply ACCEPT or REJECT. Do not create model-response fixtures, protected holdouts, or
   repeated behavioral trials for this deterministic guardrail claim.

## Evidence, retry, probe, and unavailable-dependency budget

- Retry limit: one retry for an infrastructure/setup failure; zero retries for a stable
  contract failure.
- New evaluator probes: maximum one, only if the focused contract cases cannot decide an
  explicit requirement.
- Independent review commands: focused test, skill validation, workflow validation, strict
  change validation, diff/status inspection, and at most one repository-wide check.
- Unavailable external dependencies: none are required. No browser, device, participant,
  network search, Supabase, Vercel, Claude, or production service may be added to this claim.
- Stop immediately after the deterministic rule and independent verdict are resolved.

## Protected holdout

No answer-bearing model holdout is required because the challenger claim is a strict schema
and prompt-policy guardrail, not improved probabilistic task capability. The negative contract
fixtures are frozen before independent review and include plausible over-engineering values.
The next three real governed tasks form a bounded behavioral canary and preserve their normal
acceptance gates.

## Repetitions, graders, and variance

Deterministic cases run once after the final source change and once independently after the
challenger commit. Variance is not applicable to strict parser/text invariants. One fresh
high-judgment reviewer applies the frozen rule; the challenger author cannot write or alter the
verdict.

## Quality and protected-metric thresholds

- `8/8` agents and `8/8` skills/default prompts carry the policy.
- `13/13` workflow stages carry the exact policy.
- `0` invalid/unknown policy fixtures parse.
- `0` quality, evidence, independence, or rollback protections regress.
- Focused tests, validators, type checking, strict OpenSpec, and final repository check pass
  without ignored failure.
- `0` forbidden execution/runtime/dependency/product surfaces are added.

## Promotion rule

ACCEPT only if every deterministic threshold passes and the independent reviewer finds the
policy concise, decision-sufficient, non-self-excusing, and correctly scoped. REJECT on any
protected regression or schema escape. After acceptance, observe the next three governed
tasks and roll back if an agent performs non-safety work after a decisive outcome, hides an
unmet gate, or uses early stopping to avoid minimum evidence.

## Repair amendment after independent rejection

The first independent review rejected challenger `ae7f8ead15b20ba2ee96b97c0b0b2348a710cbe2`
because `record-unmet` was not mechanically connected to the acceptance decision. The
repository owner authorized this bounded repair without changing the original thresholds.

The repaired challenger must reject an `accept` decision when there are no
acceptance-required gates or when any required gate is `fail`, `unmet`, `unknown`, or
`not-run-after-decisive-stop`. At the agent-promotion boundary, `fail` maps to `reject` and
missing or deliberately unrun required evidence maps to `rerun`; neither may map to
`promote`. A fresh independent review remains required before canary eligibility.
