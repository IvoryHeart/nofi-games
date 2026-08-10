---
name: analyze-gameplay
description: Analyze versioned gameplay telemetry, replays, experiments, qualitative feedback, and evaluation evidence to identify causal improvement opportunities. Use after launch or evaluation when explaining player behavior, diagnosing friction, or proposing a controlled game experiment.
---

# Analyze Gameplay

## Execution contract

Follow [decision-efficient execution](../../execution-policy.md). Freeze the analysis
question and smallest decision-bearing sample first; stop once the evidence supports or
disconfirms a bounded hypothesis, and account for unavailable data without widening scope.

## Workflow

1. Pin game, catalog, cohort, event schema, collection interval, and data-quality version.
2. Validate exposure attribution, event completeness, consent, sample construction, and replay compatibility.
3. Segment behavior without inventing demographic attributes or using sensitive traits.
4. Distinguish descriptive patterns from causal claims and inspect contradictory evidence.
5. Identify the smallest meaningful gameplay problem or opportunity.
6. Write a falsifiable hypothesis with intervention, mechanism, expected effect, protected metrics, and disconfirming result.
7. Create a `game-experiment` change; do not directly modify the live game.

## Gates

- Do not optimize raw time spent, compulsion, or a single metric at the expense of player welfare or quality.
- Do not infer enjoyment from retention alone.
- Do not exclude inconvenient cohorts or failed runs without recording the rule and impact.
- Do not promote correlation as causation without a controlled comparison.
