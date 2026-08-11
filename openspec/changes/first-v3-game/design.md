## Context

The proposal records the market evidence and approval-gated recommendation. The current foundation already provides a typed `NofiGamePack` SDK, a hidden contract fixture, local hash/namespace pack loading, a generated/base catalog distinction, and a single Godot player app. The current build helper packages the fixture; candidate-pack packaging and catalog generation are the smallest missing product path.

The implementation must remain inside the existing player/pack boundary. It must not add autonomous research, orchestration, agent-runtime persistence, a second app, or a new generic evaluation framework.

## Goals / Non-Goals

**Goals:**

- Turn one human-approved concept into one small, inspectable, playable pack.
- Keep gameplay state separate from rendering and make seed, clock advancement, actions, objectives, metrics, and replay deterministic.
- Reuse the canonical SDK and existing loader/catalog checks.
- Produce a local player preview and focused headless evidence that another contributor can reproduce.
- Keep the fixture available for contract checks while excluding it from product discovery.

**Non-Goals:**

- Implementing the studio's future research, creation, evaluation, promotion, release, observation, or improvement workflow.
- Building all three concepts, a content pipeline, a reusable game framework, or an agent/evaluator service.
- Networking, monetization, accounts, remote telemetry transport, persistence beyond the pack's replay contract, or release automation.

## Decisions

### Approval is a hard implementation gate

The proposal and this spec remain candidate-oriented until the human selects one concept. After selection, the proposal, spec, design, and tasks will be updated with the accepted concept and exact bounded tasks before any game source is added. Implementing all candidates would spend the vertical slice on comparison rather than validating the product boundary; doing nothing would preserve the foundation but leave the real-pack path unvalidated.

### Use one procedural 2D pack with owned state

The selected pack will keep simulation state in typed GDScript data and render it with simple Godot nodes/drawing, so the core mechanic is testable without scene inspection or external assets. This is preferred over an asset-heavy scene because the acceptance target is the platform boundary and a complete loop, not a production art pipeline. The selected concept may still use authored constants or a small deterministic layout, but it will not require a new content system.

### Extend the existing candidate build and catalog path

The implementation will add the minimum deterministic tooling needed to export one candidate PCK, copy it into the player preview, calculate its SHA-256, and generate a catalog entry containing the local preview path and required manifest fields. The existing fixture builder and hidden fixture entry remain authoritative for contract infrastructure. A manual hash or hand-edited artifact would be harder to reproduce; a general pack registry or release service would exceed this slice.

### Test the pack at its semantic seam

The candidate's headless runner will exercise the SDK validator, same-seed reset, declared and invalid actions, objective completion/failure, and replay restoration. Repository checks will additionally validate the catalog, SDK synchronization, fixture behavior, player pack loading, and web export. This gives falsifiable acceptance at the pack seam without creating an evaluator framework.

### Roll back by Git-addressable source and generated-artifact removal

The feature branch starts at `6d2314783c2d3346c1dc242b73602ca285f4ccfa`. Coherent commits will separate the approved plan, pack/tooling implementation, and verification repairs where practical. If the pack or preview fails acceptance, the feature can be reverted to that commit or the candidate/catalog/artifact commit can be reverted without changing `platform-v2`, `main`, or `platform-v3-bootstrap`.

## Risks / Trade-offs

- **[Real-time feel risk]** The recommended Kite Post concept can be technically correct but unpleasant if steering or feedback is weak → keep the run short, expose readable state, use deterministic tuning, and treat playability inspection as acceptance evidence.
- **[Catalog/build coupling]** The foundation's builder is fixture-specific and the catalog schema has both remote URL and local preview concerns → make the smallest candidate-specific extension, run catalog and player-loader checks, and preserve the fixture path unchanged.
- **[Market inference risk]** Category reports do not validate a concept → record this uncertainty and treat the slice as a foundation validation, not proof of product-market fit.
- **[Scope drift]** A desire for more content or platform services could turn the pack into a framework → stop at one mechanic, one short loop, local state, and the listed checks; update this change before expanding scope.

## Falsifiable Acceptance

The change is accepted only if the chosen pack's headless test passes the semantic contract, deterministic reset, actions, objectives, metrics, and replay checks; the development catalog validates with exactly one discoverable product pack plus a hidden fixture; the player loads the hash-pinned pack through its existing loader; `pnpm check` and `pnpm build:web` pass; and the exported preview can be inspected with the documented play controls. Any missing or ambiguous result is a human-review blocker, not permission to lower the bar.

