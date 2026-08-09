---
name: evaluate-game
description: Independently evaluate a Nofi game pack for contract correctness, determinism, reachability, strategic depth, clarity, visual quality, accessibility, performance, and player-evidence readiness. Use before catalog promotion, after a gameplay change, or when diagnosing a game weakness.
---

# Evaluate Game

## Workflow

1. Pin game, SDK, player app, evaluator, seed set, and evaluation-suite versions.
2. Validate the manifest and resource namespace before executing the pack.
3. Run headless invariants, deterministic replays, save/restore, malformed actions, and objective reachability.
4. Run semantic player policies with varied goals and seeds; measure state and strategy coverage.
5. Run the web export through browser input, screenshot, layout, accessibility, loading, and performance checks.
6. Attempt adversarial strategies, stalls, exploits, trivial loops, and unrecoverable states.
7. Report all planned results, including failures and uncertainty. Issue a verdict without repairing the game.

## Required output

- Version manifest, commands, raw artifact references, requirement coverage, scores, protected metrics, failures, and verdict.
- A structured feedback envelope for the builder and designer.

## Gates

- Never accept the builder's self-evaluation as final evidence.
- Never hide crashes, flaky seeds, missing visuals, or unavailable platforms.
- Synthetic evaluation may establish quality signals but cannot claim human enjoyment.
