---
name: evolve-agent
description: Propose, implement, and independently evaluate versioned improvements to an agent's prompt, skill, model, tools, workflow, memory, or policy using champion/challenger trials. Use when retrospectives or run evidence reveal agent failures, inefficiency, drift, or missing capability.
---

# Evolve Agent

## Workflow

1. Create an `agent-evolution` change from reproducible run evidence.
2. Pin champion and challenger manifests and limit the diff to the declared hypothesis.
3. Freeze regression, capability, protected holdout, repetition, grader, quality, and protected-metric rules before execution.
4. Keep holdout answers unavailable to the candidate and its author.
5. Run champion and challenger under equivalent conditions; preserve every result and failure.
6. Assign a fresh independent evaluator to perform adversarial review and decide.
7. If promoted, canary within a bounded workflow cohort and automatically roll back on drift.
8. Route supported lessons through OpenSpec; reject unsupported suggestions.

## Gates

- The affected agent cannot author or alter its promotion verdict.
- Cost and latency count only after quality gates pass.
- A single run, self-report, or public-suite improvement is insufficient.
- Every promotion requires a Git tag, exact manifest, and rollback target.
