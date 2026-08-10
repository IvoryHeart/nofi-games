---
name: validate-strategic-premise
description: Challenge the premise of consequential architecture, infrastructure, platform, workflow, dependency, or build-versus-integrate proposals before implementation. Use when a change would create a new subsystem, execution layer, abstraction, persistent service, orchestration mechanism, framework commitment, or substantial operational surface.
---

# Validate Strategic Premise

## Execution contract

Follow [decision-efficient execution](../../execution-policy.md). Test the cheapest premise
that can invalidate construction first. Once an existing capability or missing requirement
decides the build-versus-integrate question, stop deeper architecture work and report the
smallest owned boundary.

## Workflow

1. Restate the user outcome, constraints, and explicit non-goals without embedding a solution.
2. List the capabilities the outcome actually requires. Separate product knowledge, coordination, execution harness, model, persistence, and distribution concerns.
3. Inspect the repository and authoritative current documentation for capabilities already supplied by the selected stack, harnesses, frameworks, and infrastructure.
4. Compare reuse, composition, adaptation, and custom construction. Include “do nothing yet” when requirements are not established.
5. Identify the narrowest boundary the repository must own. Keep vendor or harness lifecycle details behind opaque provenance unless the product depends on them.
6. Record assumptions, disconfirming evidence, switching costs, reversibility, and a falsifiable outcome in the OpenSpec proposal or design.
7. Stop implementation when a material premise is unverified, an existing capability has not been evaluated, or the proposed abstraction is named more broadly than its contract supports.
8. Permit implementation only after the strategic-premise gate below is reviewable.

## Gate

Require all of the following:

- Outcome and constraints are solution-independent.
- Existing-capability reconnaissance cites authoritative sources or repository evidence.
- Build-versus-integrate alternatives include lifecycle, portability, operational burden, and failure recovery.
- The selected abstraction level distinguishes control plane, execution harness, model, and product runtime where relevant.
- The repository-owned boundary is minimal but not a lowest-common-denominator interface; implementation-specific capabilities remain discoverable.
- The choice has a falsifiable success condition and a Git-addressable rollback target.
- Evaluation tests strategic fit in addition to internal implementation correctness.

## Output

Write a concise `## Strategic premise` section containing:

- desired outcome;
- required capabilities;
- existing capabilities considered and evidence;
- alternatives and rejection reasons;
- selected repository-owned boundary;
- assumptions and disconfirming signals;
- decision, validation method, and rollback.

Do not treat code volume, implementation completeness, or passing tests against self-authored requirements as evidence that the premise is correct.
