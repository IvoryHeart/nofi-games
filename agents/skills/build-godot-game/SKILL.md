---
name: build-godot-game
description: Implement an accepted OpenSpec game concept as a deterministic, testable Godot 4 game pack for the single Nofi player app. Use when scaffolding or changing a game project, SDK integration, semantic action interface, replay, tests, assets, or pack manifest.
---

# Build Godot Game

## Workflow

1. Read the active game change, `game-pack-contract` spec, and SDK source.
2. Create the project with `pnpm game:new -- <game-id>`; never fork another product game as a hidden template.
3. Implement typed GDScript beneath `res://game_packs/<game_id>/`.
4. Separate deterministic rules and state from rendering, audio, and platform services.
5. Implement reset, observation, available actions, action application, simulation advance, objectives, metrics, and replay.
6. Declare only required shell capabilities and emit schema-valid telemetry.
7. Add headless tests for invariants, deterministic replay, goals, failure, save/restore, and malformed actions.
8. Run `pnpm game:test -- <game-id>` and the active evaluation plan.

## Gates

- Do not access native APIs, secrets, arbitrary network targets, or production data.
- Do not use unseeded randomness or wall-clock time in gameplay rules.
- Do not edit generated SDK copies.
- Do not mark OpenSpec tasks complete until their evidence exists.
