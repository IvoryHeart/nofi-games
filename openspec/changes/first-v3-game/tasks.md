## 1. Accepted concept and generator contract

- [x] 1.1 Obtain direct human approval for Tide Ledger; retain Kite Post and Flicker Forensics as unimplemented comparison evidence.
- [x] 1.2 Update proposal, spec, design, and tasks with Tide Ledger, its exact game id, bounded loop, generated-level contract, and final controls before adding game implementation files.
- [ ] 1.3 Define Tide Ledger's immutable LevelSpec representation, canonical hash, three difficulty bands, generator version, solver result, and stable root-seed/level-index derivation.

## 2. Candidate pack

- [ ] 2.1 Scaffold the approved game under `games/candidates/<game-id>` from the existing template and synchronize the canonical SDK.
- [ ] 2.2 Implement the Tide Ledger game-specific generator with at most 32 deterministic candidate attempts and a known-valid solver-checked fallback for each difficulty band.
- [ ] 2.3 Implement the deterministic solver and measured difficulty values for solution length, required tide flips, branching, and dead ends; reject candidates outside the requested band.
- [ ] 2.4 Implement one strong tide-flip core mechanic, a complete short success/failure/retry loop, and a simple preview presentation with typed GDScript state separated from rendering.
- [ ] 2.5 Implement seeded reset, controllable simulation advance, structured observations/actions/objectives/metrics, invalid-action handling, and keyboard/touch-compatible input mapping.
- [ ] 2.6 Derive endless levels from root seed and level index; include seed, difficulty, generator version, and LevelSpec hash in state and replay, with full LevelSpec data only when reconstruction cannot be proven.
- [ ] 2.7 Implement replay save/restore and verify that restored generated state reproduces the recorded outcome.

## 3. Pack build and catalog preview

- [ ] 3.1 Extend the existing deterministic pack build path only as needed to export the approved candidate PCK, compute its SHA-256, and copy it into the player preview.
- [ ] 3.2 Generate a schema-valid development catalog entry for the approved pack with discoverable product status, pinned hash, local preview path, and game-pack namespace resources.
- [ ] 3.3 Preserve the contract fixture's non-discoverable catalog status and verify the single player app presents only the approved product pack.

## 4. Focused checks and delivery verification

- [ ] 4.1 Add a headless game test for SDK contract validation, deterministic reset, available/invalid actions, objective completion or failure, metrics, and replay restoration.
- [ ] 4.2 Add a fixed multi-band, multi-index seed corpus covering repeatability, expected LevelSpec hashes, solvability proofs, difficulty bounds, attempt/fallback behavior, and replay restoration.
- [ ] 4.3 Run the catalog, SDK, fixture, player pack-loading, and game checks; inspect logs for ignored, swallowed, or unhandled failures.
- [ ] 4.4 Run `pnpm check` and `pnpm build:web`, inspect the generated preview, and record play instructions and known limitations in the change/PR handoff.
- [ ] 4.5 Complete the final human playability gate, then create coherent Git commits, preserve the bootstrap rollback target, and leave the feature branch ready for a PR targeting `platform-v3-bootstrap` without merging or deploying.
