## 1. Human selection gate

- [ ] 1.1 Obtain direct human approval for exactly one of the three documented concepts.
- [ ] 1.2 Update proposal, spec, design, and tasks with the accepted concept, exact game id, bounded loop, and final controls before adding game implementation files.

## 2. Candidate pack

- [ ] 2.1 Scaffold the approved game under `games/candidates/<game-id>` from the existing template and synchronize the canonical SDK.
- [ ] 2.2 Implement one strong core mechanic, a complete short success/failure/retry loop, and a simple preview presentation with typed GDScript state separated from rendering.
- [ ] 2.3 Implement seeded reset, controllable simulation advance, structured observations/actions/objectives/metrics, invalid-action handling, and keyboard/touch-compatible input mapping.
- [ ] 2.4 Implement replay save/restore and verify that restored state reproduces the recorded outcome.

## 3. Pack build and catalog preview

- [ ] 3.1 Extend the existing deterministic pack build path only as needed to export the approved candidate PCK, compute its SHA-256, and copy it into the player preview.
- [ ] 3.2 Generate a schema-valid development catalog entry for the approved pack with discoverable product status, pinned hash, local preview path, and game-pack namespace resources.
- [ ] 3.3 Preserve the contract fixture's non-discoverable catalog status and verify the single player app presents only the approved product pack.

## 4. Focused checks and delivery verification

- [ ] 4.1 Add a headless game test for SDK contract validation, deterministic reset, available/invalid actions, objective completion or failure, metrics, and replay restoration.
- [ ] 4.2 Run the catalog, SDK, fixture, player pack-loading, and game checks; inspect logs for ignored, swallowed, or unhandled failures.
- [ ] 4.3 Run `pnpm check` and `pnpm build:web`, inspect the generated preview, and record play instructions and known limitations in the change/PR handoff.
- [ ] 4.4 Create coherent Git commits, preserve the bootstrap rollback target, and leave the feature branch ready for a PR targeting `platform-v3-bootstrap` without merging or deploying.
