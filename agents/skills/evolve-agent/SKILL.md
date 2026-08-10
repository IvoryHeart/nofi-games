---
name: evolve-agent
description: Propose, implement, and independently evaluate versioned improvements to an agent's prompt, skill, model, tools, workflow, memory, or policy using champion/challenger trials. Use when retrospectives or run evidence reveal agent failures, inefficiency, drift, or missing capability.
---

# Evolve Agent

## Execution contract

Follow [decision-efficient execution](../../execution-policy.md). Match evaluation cost to the
claim: deterministic prompt/schema guardrails require negative contract tests and bounded
independent review; probabilistic capability or quality claims require repeated protected
champion/challenger trials. Reject on the first confirmed protected hard-gate regression and
stop trials that cannot restore promotion eligibility.

## Workflow

1. Create an `agent-evolution` change from reproducible run evidence.
2. Pin champion and challenger manifests and limit the diff to the declared hypothesis.
3. Freeze regression, capability, protected holdout, repetition, grader, quality, and protected-metric rules before execution.
4. Keep holdout answers unavailable to the candidate and its author.
5. Run champion and challenger under equivalent conditions when the hypothesis makes a
   probabilistic behavioral claim; otherwise run the frozen deterministic contract cases.
6. Assign a fresh independent evaluator to perform adversarial review and decide.
7. If promoted, canary within a bounded workflow cohort and automatically roll back on drift.
8. Route supported lessons through OpenSpec; reject unsupported suggestions.

## Gates

- The affected agent cannot author or alter its promotion verdict.
- Cost and latency count only after quality gates pass.
- Promote only when every frozen acceptance-required gate is `pass`; any required failed,
  unmet, unknown, or deliberately unrun gate prohibits promotion.
- Allow at most two automated reruns. After the second unsuccessful rerun, stop and route the
  change to the predeclared human-review or park disposition.
- A single self-report or public-suite improvement is insufficient. Deterministic guardrails
  may enter a bounded canary after exhaustive positive/negative contract cases plus
  independent review; observed canary behavior decides final promotion.
- Every promotion requires a Git tag, exact manifest, and rollback target.
