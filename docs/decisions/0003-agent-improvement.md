# ADR 0003: Agent improvement uses champion/challenger promotion

- Status: accepted
- Date: 2026-08-09

## Context

Allowing agents to rewrite and promote their own instructions creates self-confirming drift and makes regressions difficult to attribute.

## Decision

Agents may propose challenger versions of any agent component. Independent evaluation compares the challenger with a pinned champion across regression, capability, and holdout suites. A distinct promotion authority decides and preserves rollback.

## Consequences

- Every agent component is versioned and hashable.
- Holdout integrity is protected from the candidate agent.
- Efficiency improvements count only after quality and protected metrics pass.
