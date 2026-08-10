# Agent Evolution Specification

## Purpose

Allow agents to improve their knowledge, procedures, prompts, tools, models, and workflows without self-confirming promotion or irreversible drift.

## Requirements

### Requirement: Champion and challenger are pinned

Every agent improvement SHALL compare an immutable champion manifest with an immutable challenger manifest and an exact declared diff.

#### Scenario: Agent improvement is proposed

- **WHEN** an observation becomes an agent-evolution change
- **THEN** the change SHALL identify champion, challenger, hypothesis, rollback target, and protected metrics

### Requirement: Independent promotion

An agent SHALL NOT author or alter the final promotion decision for a challenger that changes that agent.

#### Scenario: Challenger passes its public evaluation

- **WHEN** a challenger produces passing results
- **THEN** an independent evaluator SHALL still run protected holdouts and issue the promotion verdict

### Requirement: Improvement requires reproducible evidence

An agent change SHALL NOT be classified as improvement based solely on self-report, one run, efficiency, or public-suite performance.

#### Scenario: Challenger is cheaper but lower quality

- **WHEN** a challenger reduces tokens or latency but fails a quality or protected-metric threshold
- **THEN** the system SHALL reject it as an improvement

### Requirement: Agent evaluation is proportional to the claim

Agent evaluation SHALL use the cheapest evidence capable of deciding the frozen claim. A
deterministic prompt, schema, or policy guardrail MAY qualify for a bounded canary through
exhaustive positive and negative contract cases plus bounded independent adversarial review.
Observed canary behavior SHALL decide final promotion. A probabilistic capability or quality
claim SHALL use repeated protected champion/challenger trials.

#### Scenario: Deterministic policy guardrail is changed

- **WHEN** the challenger adds a machine-validated stop or authority rule with no claim of
  improved probabilistic capability
- **THEN** deterministic contract cases and independent review MAY decide canary eligibility
  without model repetitions that cannot add discriminating evidence

#### Scenario: Protected hard gate fails

- **WHEN** a reproducible protected failure makes promotion impossible
- **THEN** the evaluator SHALL reject and stop remaining trials that cannot restore eligibility

#### Scenario: Required evidence is unavailable

- **WHEN** an acceptance-required gate is failed, unmet, unknown, or deliberately unrun
- **THEN** the decision boundary SHALL prohibit promotion even when every executed check passes

#### Scenario: Required evidence remains unavailable after two reruns

- **WHEN** the second automated rerun still cannot satisfy an acceptance-required gate
- **THEN** the decision boundary SHALL prohibit another rerun and SHALL select the frozen human-review or park disposition

### Requirement: Promoted versions remain reversible

Every promoted agent SHALL have a Git-addressable definition and a production rollback target.

#### Scenario: Canary detects drift

- **WHEN** a promoted challenger violates a canary rollback trigger
- **THEN** workflows SHALL return to the pinned champion while preserving canary evidence
