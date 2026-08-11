# ADR 0004: Human-owned policy with bounded deterministic delegation

- Status: accepted
- Date: 2026-08-11

## Context

Requiring humans to approve every action forever would abandon the autonomous-studio direction. Allowing agents or run records to infer or expand authority would make ambiguity unsafe and permit self-confirming promotion.

## Decision

Humans permanently approve authority, delegation, evaluation, promotion, safety, and release policy and initially approve every authority-bearing action.

Humans may later delegate a bounded acceptance, release, or promotion action under previously accepted deterministic rules. The rules name the eligible subject and action, required evidence, thresholds, scope, separation of duties, rollback, and expiry or revocation.

Delegated execution fails closed. Missing, conflicting, stale, invalid, or ambiguous eligibility evidence pauses without acting for human review. Policy changes are never delegable. An affected agent cannot approve or promote its own change.

OpenSpec records intent, deterministic orchestration owns control flow, bounded agents supply judgment, run records hold facts, and native harnesses own model lifecycle.

## Consequences

- Routine qualified actions may eventually proceed without per-action human approval.
- No agent output, confidence, or run record can grant or expand authority.
- Future orchestration and delegation require separate accepted OpenSpec changes.
- The v3 bootstrap implements the boundary but no autonomous workflow.
