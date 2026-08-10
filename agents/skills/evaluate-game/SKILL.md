---
name: evaluate-game
description: Independently reach a decision-sufficient verdict on a Nofi game pack using ordered hard gates, bounded probes, and explicit early stopping across contract correctness, determinism, reachability, depth, clarity, visual quality, accessibility, performance, and player-evidence readiness. Use before catalog promotion, after a gameplay change, or when diagnosing a game weakness.
---

# Evaluate Game

## Execution contract

Follow [decision-efficient execution](../../execution-policy.md). Before candidate execution,
freeze the verdict rule, hard-gate order, retry limit, and maximum new probes. Use existing
commands first and allow at most one minimal new probe per unresolved hard gate unless the
accepted evaluation plan says otherwise.

Run cheap, high-discrimination contract and source checks before broad simulations, browser
matrices, device coverage, or participant studies. When a reproducible hard failure resolves
the verdict, issue it and stop evidence that cannot reverse it. Continue only far enough to
identify the smallest repair or address safety/security. Record every remaining planned item
as unmet, unknown, or not run after the decisive stop. Never create an evaluation harness as
an incidental subtask.

## Workflow

1. Pin game, SDK, player app, evaluator, seed set, and evaluation-suite versions.
2. Validate the manifest and resource namespace before executing the pack.
3. Run the smallest headless set capable of deciding invariants, replay, save/restore,
   malformed actions, and reachability; expand only while the candidate remains eligible.
4. Run semantic player policies with varied goals and seeds; measure state and strategy coverage.
5. Run the web export through browser input, screenshot, layout, accessibility, loading, and performance checks.
6. Attempt adversarial strategies, stalls, exploits, trivial loops, and unrecoverable states.
7. Account for all planned results, including failures, uncertainty, unavailable gates, and
   work stopped after the verdict. Issue a verdict without repairing the game.

## Required output

- Version manifest, commands, raw artifact references, requirement coverage, scores, protected metrics, failures, and verdict.
- A structured feedback envelope for the builder and designer.

## Gates

- Never accept the builder's self-evaluation as final evidence.
- Never hide crashes, flaky seeds, missing visuals, or unavailable platforms.
- Synthetic evaluation may establish quality signals but cannot claim human enjoyment.
- Minimum repetitions are required for an acceptance claim, not after a confirmed hard
  failure already requires rejection.
