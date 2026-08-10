---
name: design-game-concept
description: Turn an accepted market brief into multiple original, falsifiable game concepts and a selected OpenSpec game specification. Use after opportunity research, when comparing mechanics, defining rules and progression, or preparing a candidate for Godot implementation.
---

# Design Game Concept

## Execution contract

Follow [decision-efficient execution](../../execution-policy.md). Freeze the selection
question and rejection rule first; stop when no concept qualifies or one decision is robust
to the declared sensitivity checks. Do not elaborate rejected concepts.

## Workflow

1. Read the market brief and frozen selection criteria.
2. Generate materially different concepts rather than cosmetic variants.
3. For each concept define player promise, core loop, decisions, failure, mastery, progression, originality, evaluation method, and risks.
4. Score every concept against the criteria fixed before scoring. Preserve dissent and sensitivity to weights.
5. Select a concept or reject the opportunity if none qualifies.
6. Write observable requirements, semantic actions, state, objectives, telemetry, replay, accessibility, and performance expectations.

## Required output

- `concepts.md`, `selection.md`, delta specs, `design.md`, and `eval-plan.md` in the active `game-concept` change.
- No implementation code.

## Gates

- Do not clone a named game, character, visual identity, level, or protected expression.
- Do not alter selection criteria to favor a concept after scoring.
- Do not rely on an instruction manual to compensate for unclear interaction.
- Keep the game compatible with the single player app and semantic evaluation contract.
