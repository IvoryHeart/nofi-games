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

### Requirement: Promoted versions remain reversible

Every promoted agent SHALL have a Git-addressable definition and a production rollback target.

#### Scenario: Canary detects drift

- **WHEN** a promoted challenger violates a canary rollback trigger
- **THEN** workflows SHALL return to the pinned champion while preserving canary evidence
