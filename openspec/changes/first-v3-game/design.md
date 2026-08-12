## Context

The proposal records the market evidence and the human selection of Tide Ledger. The current foundation already provides a typed `NofiGamePack` SDK, a hidden contract fixture, local hash/namespace pack loading, a generated/base catalog distinction, and a single Godot player app. The current build helper packages the fixture; candidate-pack packaging, catalog generation, and a game-specific generated-level seam are the smallest missing product paths.

The implementation must remain inside the existing player/pack boundary. It must not add autonomous research, orchestration, agent-runtime persistence, a second app, or a new generic evaluation framework.

## Goals / Non-Goals

**Goals:**

- Turn the human-approved Tide Ledger concept into one small, inspectable, playable pack.
- Generate an endless deterministic sequence of Tide Ledger levels from a root seed and level index without storing a level catalog.
- Prove generated levels completable and keep approachable route and action pressure within three fixed bands.
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

`generate(seed, difficulty, generator_version)` will derive deterministic candidates from a Tide Ledger-owned versioned integer PRNG and evaluate each with a game-owned solver. The solver will search the finite `(position, tide phase, marker mask)` state space, prove a route that collects markers and reaches the lighthouse, require a marker on a non-corridor side branch, and report minimum solution length, required tide flips, reachable branching, reachable dead ends, and the required off-corridor detour. A candidate is accepted only if it passes the solver and the fixed band bounds. The generator stops after 32 attempts and uses a known-valid deterministic fallback for the requested band; the fallback is itself solver-checked, and any fallback validation failure returns no LevelSpec and stops gameplay.

The fallback is a fixed per-band template rather than a seed-randomized candidate: boundaries are placed deterministically, the side branch uses fixed geometry, and its tide matches the corridor at the attachment. The requested seed remains provenance in the LevelSpec, but cannot make the fallback topology invalid. A representative seed range will finalize and solve each fallback band in tests.

The three bands are `shoal`, `swell`, and `storm`. Their bounds are versioned constants in Tide Ledger rather than a platform-wide policy. The revised generator uses a compact 2D shoreline network: a main route plus deterministic or seeded side loops with two connections back to the route. At least one loop is required in every band, and higher bands add more route-choice points and tide-gated crossings. A marker is placed on an off-corridor route, but the route remains readable and solver-proven rather than requiring pixel timing.

| Band    | Solution length | Required flips | Branching | Dead ends |
| ------- | --------------: | -------------: | --------: | --------: |
| `shoal` |           11–18 |            1–2 |       1–4 |      0–12 |
| `swell` |           17–30 |            2–4 |       1–6 |      0–24 |
| `storm` |           27–42 |            4–7 |       1–8 |      0–40 |

In addition to the existing structural bounds, `shoal`, `swell`, and `storm` require at least 1, 2, and 3 meaningful route-choice points respectively. Each accepted level exposes a measured dead-end excursion cost and uses an action budget of proven solution length plus forgiving band slack: 8, 10, and 14 actions respectively. The budget is deliberately generous for a first attempt but prevents unlimited tide-flip wandering from being an automatic solution.

Every accepted LevelSpec must satisfy all four bounds for its requested band, and the fixed corpus pins representative hashes from each band.

### Derive endless levels from provenance

The game will mix the root seed, level index, difficulty, and generator version through a stable integer function to derive each level seed. Candidate generation will use a small game-owned integer PRNG whose algorithm is versioned with the pack rather than relying on Godot's implementation-detail RNG. Replays store those inputs and the LevelSpec hash; full LevelSpec data is included only if the implementation cannot prove exact reconstruction. A fixed seed corpus will exercise all bands and several indices, including a forced fallback path, and will pin expected hashes so generator changes cannot silently alter replay meaning. Every corpus case will also run restore-save-restore checks, plus a multi-level sequence.

The pack boundary treats generator failure as an unavailable state: it clears level-dependent state, renders no board, returns no gameplay actions, and keeps observation/replay access null-safe. It does not expose a partially generated level.

Replay restoration is transactional. The pack snapshots generator identity, seeds, LevelSpec reference, history, action list, and gameplay state before attempting reconstruction; any unsupported version, hash mismatch, invalid action, or state mismatch restores that snapshot. A fresh reset always reinstates the current pack generator version.

### Preserve a small, forgiving play loop

The game remains turn-based and single-player. Movement into a closed tile is rejected without consuming budget, while every accepted movement or tide flip consumes one action. The action budget is `solution_length + band_slack`, where slack is 8 for `shoal`, 10 for `swell`, and 14 for `storm`. This gives a player room to inspect and correct a route while making repeated flips and long detours consequential. Tests will include a deterministic alternating-flip/opportunistic-move policy that must not complete representative levels, while the solver route must complete within budget.

The renderer will use simple asset-free drawing with a stronger visual hierarchy: stable land, currently passable tide tiles, closed tide tiles, loop connectors, marker states, lighthouse goal, crab position, action budget, and a short status hint. No art pipeline or reusable visual framework is introduced.

### Extend the existing candidate build and catalog path

The implementation will add the minimum deterministic tooling needed to export one candidate PCK, copy it into the player preview, calculate its SHA-256, and generate a catalog entry containing the local preview path and required manifest fields. The existing fixture builder and hidden fixture entry remain authoritative for contract infrastructure. A manual hash or hand-edited artifact would be harder to reproduce; a general pack registry or release service would exceed this slice.

### Test the pack at its semantic seam

The candidate's headless runner will exercise the SDK validator, same-seed reset, generated LevelSpec hashes, immutable accessor behavior, solver proofs, required off-corridor detours, route-choice and dead-end excursion bounds, action-budget behavior, fail-closed fallback behavior, applicable and invalid actions, objective completion/failure, endless-level reconstruction, every-corpus replay restoration, and replay round trips. It will also prove that a blind alternating-flip/opportunistic-move policy does not bypass representative levels while the solver route remains accepted. Repository checks will additionally validate the catalog, SDK synchronization, fixture behavior, player pack loading, and web export. This gives falsifiable acceptance at the pack seam without creating an evaluator framework.

### Roll back by Git-addressable source and generated-artifact removal

The feature branch starts at `6d2314783c2d3346c1dc242b73602ca285f4ccfa`. Coherent commits will separate the approved plan, pack/tooling implementation, and verification repairs where practical. If the pack or preview fails acceptance, the feature can be reverted to that commit or the candidate/catalog/artifact commit can be reverted without changing `platform-v2`, `main`, or `platform-v3-bootstrap`.

## Risks / Trade-offs

- **[Generated-variety risk]** A solver-proven level can still feel repetitive or trivial → require 2D route loops and band-specific route-choice points, measure branching and dead-end excursion cost, cover all bands in the fixed corpus, inspect a sequence of generated levels, and require a final human playability gate.
- **[Brute-force risk]** A player can win by alternating tide and movement without reading the board → charge accepted flips and movement against a forgiving finite budget, require route choices, and test an opportunistic blind policy against representative levels.
- **[Overcorrection risk]** Action pressure can turn a readable puzzle into a frustrating precision challenge → keep blocked inputs free, give each band explicit slack, preserve the solver route within budget, and require human review before archival.
- **[Visual clarity risk]** A better topology can still look like noise → use consistent colors/shapes for tide state, route connectors, markers, goal, player, and budget; keep visual changes inside the Tide Ledger renderer.
- **[Generator fallback risk]** A difficult seed may exhaust the attempt budget → keep a known-valid per-band fallback construction, solver-check it, and expose the attempt/fallback outcome in structured metrics.
- **[Fallback integrity risk]** A future change could invalidate the fallback → return no LevelSpec on failed fallback proof, fail the pack closed, and test the rejection path with a deliberately invalid fallback payload.
- **[Fallback seed-coupling risk]** A seed-dependent fallback can fail only for some exhaustion seeds → use fixed per-band geometry, match branch tide to the attachment corridor, and property-test a representative seed range.
- **[Replay compatibility risk]** A future generator change could reconstruct different bytes for the same inputs → version the generator, pin LevelSpec hashes in the corpus, and reject replay restoration on hash mismatch.
- **[Replay state risk]** Replaying actions could produce a superficially valid but non-identical saved replay → preserve action history during restore and compare observation, objectives, metrics, and replay bytes across repeated round trips.
- **[Failure-boundary risk]** A missing LevelSpec can leak into rendering or observation helpers → use an explicit unavailable state, null-safe accessors, no-action output, and an injected pack-boundary failure test.
- **[Catalog/build coupling]** The foundation's builder is fixture-specific and the catalog schema has both remote URL and local preview concerns → make the smallest candidate-specific extension, run catalog and player-loader checks, and preserve the fixture path unchanged.
- **[Market inference risk]** Category reports do not validate a concept → record this uncertainty and treat the slice as a foundation validation, not proof of product-market fit.
- **[Scope drift]** A desire for more content or platform services could turn the pack into a framework → stop at one mechanic, one short loop, local state, and the listed checks; update this change before expanding scope.

## Falsifiable Acceptance

The change is accepted only if Tide Ledger's headless test passes the semantic contract, deterministic reset, immutable LevelSpec accessors, generator corpus, solver proofs, required off-corridor detours, three-band difficulty bounds, route-choice and dead-end excursion bounds, forgiving action budgets, 32-attempt/fail-closed fallback behavior across the representative fallback seed range, applicable actions, objectives, metrics, endless-level reconstruction, every-corpus replay round trips, atomic rejected-replay checks, pack-boundary generation-failure checks, and the blind-policy regression; the development catalog validates with exactly one discoverable product pack plus a hidden fixture; the player loads the hash-pinned pack through its existing loader; `pnpm check` and `pnpm build:web` pass; the exported preview can be inspected with the documented keyboard and visible touch controls; and a human passes the final playability gate before archival. Any missing or ambiguous result is a human-review blocker, not permission to lower the bar.
