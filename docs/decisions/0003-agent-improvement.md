# ADR 0003: Agent improvement uses champion/challenger promotion

- Status: superseded by ADR 0004
- Date: 2026-08-09
- Superseded: 2026-08-11

## Context

Platform v2 introduced a generic champion/challenger registry, evaluation suite, and promotion system before a concrete bounded agent capability established the required state and evidence.

## Original decision

Agents could propose challenger versions, independent evaluation compared them with pinned champions, and a distinct promotion authority preserved rollback.

## Supersession

The first autonomous game run falsified the surrounding execution architecture. Platform v3 removes the generic machinery while preserving the durable constraint: an affected agent cannot approve or promote its own change. Any future evaluation and promotion capability must be proposed for a concrete need under ADR 0004's human-owned, fail-closed delegation boundary.
