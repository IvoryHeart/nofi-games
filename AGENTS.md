# Agent instructions

These instructions apply to the entire repository.

## Mission

Build and operate a single player app whose game catalog is continuously researched, created, evaluated, released, observed, and improved by agents.

## Mandatory reading order

1. Read `README.md`.
2. Read `docs/product/strategy.md` and `docs/architecture/system.md`.
3. Read `agents/constitution.md`.
4. Read the relevant capability under `openspec/specs/`.
5. Read the active change under `openspec/changes/` before modifying behavior.

## Non-negotiable constraints

- Do not encode a fixed genre or archetype portfolio into the platform. Research proposes the catalog.
- Do not create a separate distribution app for a game. Games ship as packs through the single player app.
- Do not add monetization work unless an accepted OpenSpec change explicitly moves it into scope.
- Do not let an agent promote a change to its own definition, prompt, skills, tools, model, or evaluation policy.
- Do not treat generated prose, self-reported confidence, or a single run as evidence of improvement.
- Do not bypass OpenSpec for behavioral or architectural changes.
- Do not put secrets, raw production traces, large artifacts, or user data in Git.
- Do not edit generated Godot SDK copies under game projects; edit `platform/godot-sdk/addons/nofi_sdk` and run `pnpm godot:sync-sdk`.

## Definition of done

A change is complete only when:

- Its OpenSpec requirements and scenarios are satisfied.
- Tests and evaluations provide reproducible evidence.
- `pnpm check` passes.
- Logs contain no ignored or unhandled failures.
- Documentation and machine-readable contracts agree.
- The change has a rollback target.
- Its retrospective records reusable lessons or explicitly says none were found.

## Skills

Project skills live under `agents/skills/`. Use the narrowest applicable skill and follow its declared inputs, outputs, and gates. Changes to a skill use the `agent-evolution` OpenSpec schema and champion/challenger evaluation.

## Source conventions

- Use typed GDScript for games and the player app.
- Use strict TypeScript for the studio control plane and tooling.
- Keep gameplay state and decisions separable from rendering.
- Make randomness seeded and clocks controllable.
- Prefer structured artifacts and schemas over prose parsing.
- Make operations idempotent and resumable.
- Pin tool and model versions in recorded workflow runs.
