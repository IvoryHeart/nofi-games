## Context

The proposal records the market evidence and the human selection of Tide Ledger. The current foundation already provides a typed `NofiGamePack` SDK, a hidden contract fixture, local hash/namespace pack loading, a generated/base catalog distinction, and a single Godot player app. The current build helper packages the fixture; candidate-pack packaging, catalog generation, and a game-specific generated-level seam are the smallest missing product paths.

The implementation must remain inside the existing player/pack boundary. It must not add autonomous research, orchestration, agent-runtime persistence, a second app, or a new generic evaluation framework.

## Goals / Non-Goals

**Goals:**

- Turn the human-approved Tide Ledger concept into one small, inspectable, playable pack.
- Generate an endless deterministic sequence of Tide Ledger levels from a root seed and level index without storing a level catalog.
- Prove generated levels completable and keep structural difficulty within three fixed bands.
- Keep gameplay state separate from rendering and make seed, clock advancement, actions, objectives, metrics, and replay deterministic.
- Reuse the canonical SDK and existing loader/catalog checks.
- Produce a local player preview and focused headless evidence that another contributor can reproduce.
- Keep the fixture available for contract checks while excluding it from product discovery.

**Non-Goals:**

- Implementing the studio's future research, creation, evaluation, promotion, release, observation, or improvement workflow.
- Building all three concepts, a visual level editor, a database level store, a content service, a publishing system, a reusable cross-game generator framework, or an agent/evaluator service.
- Networking, monetization, accounts, remote telemetry transport, persistence beyond the pack's replay contract, or release automation.

## Decisions

### Tide Ledger is the accepted concept

The human selected Tide Ledger after comparing all three concepts. The implementation therefore owns one game-specific generator and solver inside the Tide Ledger pack. Kite Post and Flicker Forensics remain research alternatives and do not receive implementation files.

### Use one procedural 2D pack with an immutable LevelSpec seam

Tide Ledger will keep simulation state in typed GDScript data and render it with simple Godot nodes/drawing, so the core mechanic is testable without scene inspection or external assets. Its generator will return a deep-copy-safe, hashable LevelSpec containing the complete board topology and goals. Gameplay reads the LevelSpec but never mutates it. This preserves a clear semantic seam without introducing a universal content model.

### Generate, solve, measure, then accept

`generate(seed, difficulty, generator_version)` will derive deterministic candidates from a game-owned RNG and evaluate each with a game-owned solver. The solver will search the finite `(position, tide phase, marker mask)` state space, prove a route that collects markers and reaches the lighthouse, and report minimum solution length, required tide flips, reachable branching, and reachable dead ends. A candidate is accepted only if it passes the solver and the fixed band bounds. The generator stops after 32 attempts and uses a known-valid deterministic fallback for the requested band; the fallback is itself solver-checked.

The three bands are `shoal`, `swell`, and `storm`. Their bounds are versioned constants in Tide Ledger rather than a platform-wide policy:

| Band    | Solution length | Required flips | Branching | Dead ends |
| ------- | --------------: | -------------: | --------: | --------: |
| `shoal` |            9–14 |            1–2 |       1–4 |      0–12 |
| `swell` |           15–24 |            2–4 |       1–6 |      0–24 |
| `storm` |           25–36 |            4–7 |       1–8 |      0–40 |

Every accepted LevelSpec must satisfy all four bounds for its requested band, and the fixed corpus pins representative hashes from each band.

### Derive endless levels from provenance

The game will mix the root seed, level index, difficulty, and generator version through a stable integer function to derive each level seed. Replays store those inputs and the LevelSpec hash; full LevelSpec data is included only if the implementation cannot prove exact reconstruction. A fixed seed corpus will exercise all bands and several indices, including a forced fallback path, and will pin expected hashes so generator changes cannot silently alter replay meaning.

### Extend the existing candidate build and catalog path

The implementation will add the minimum deterministic tooling needed to export one candidate PCK, copy it into the player preview, calculate its SHA-256, and generate a catalog entry containing the local preview path and required manifest fields. The existing fixture builder and hidden fixture entry remain authoritative for contract infrastructure. A manual hash or hand-edited artifact would be harder to reproduce; a general pack registry or release service would exceed this slice.

### Test the pack at its semantic seam

The candidate's headless runner will exercise the SDK validator, same-seed reset, generated LevelSpec hashes, solver proofs, difficulty bounds, declared and invalid actions, objective completion/failure, endless-level reconstruction, and replay restoration. Repository checks will additionally validate the catalog, SDK synchronization, fixture behavior, player pack loading, and web export. This gives falsifiable acceptance at the pack seam without creating an evaluator framework.

### Roll back by Git-addressable source and generated-artifact removal

The feature branch starts at `6d2314783c2d3346c1dc242b73602ca285f4ccfa`. Coherent commits will separate the approved plan, pack/tooling implementation, and verification repairs where practical. If the pack or preview fails acceptance, the feature can be reverted to that commit or the candidate/catalog/artifact commit can be reverted without changing `platform-v2`, `main`, or `platform-v3-bootstrap`.

## Risks / Trade-offs

- **[Generated-variety risk]** A solver-proven level can still feel repetitive or trivial → measure branching and dead ends, cover all bands in the fixed corpus, inspect a sequence of generated levels, and require a final human playability gate.
- **[Generator fallback risk]** A difficult seed may exhaust the attempt budget → keep a known-valid per-band fallback construction, solver-check it, and expose the attempt/fallback outcome in structured metrics.
- **[Replay compatibility risk]** A future generator change could reconstruct different bytes for the same inputs → version the generator, pin LevelSpec hashes in the corpus, and reject replay restoration on hash mismatch.
- **[Catalog/build coupling]** The foundation's builder is fixture-specific and the catalog schema has both remote URL and local preview concerns → make the smallest candidate-specific extension, run catalog and player-loader checks, and preserve the fixture path unchanged.
- **[Market inference risk]** Category reports do not validate a concept → record this uncertainty and treat the slice as a foundation validation, not proof of product-market fit.
- **[Scope drift]** A desire for more content or platform services could turn the pack into a framework → stop at one mechanic, one short loop, local state, and the listed checks; update this change before expanding scope.

## Falsifiable Acceptance

The change is accepted only if Tide Ledger's headless test passes the semantic contract, deterministic reset, generator corpus, solver proofs, three-band difficulty bounds, 32-attempt/fallback behavior, actions, objectives, metrics, endless-level reconstruction, and replay checks; the development catalog validates with exactly one discoverable product pack plus a hidden fixture; the player loads the hash-pinned pack through its existing loader; `pnpm check` and `pnpm build:web` pass; the exported preview can be inspected with the documented play controls; and a human passes the final playability gate before archival. Any missing or ambiguous result is a human-review blocker, not permission to lower the bar.
