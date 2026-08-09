---
name: publish-game-pack
description: Validate, hash, sign, upload, catalog, canary, promote, and roll back an immutable Godot game pack in the single Nofi player app. Use after independent evaluation passes or when changing catalog rollout and rollback state.
---

# Publish Game Pack

## Workflow

1. Require an accepted game-concept or game-experiment decision and independent verification evidence.
2. Build from the pinned Git commit in a clean environment.
3. Validate manifest, SDK compatibility, resource namespace, capabilities, and export reproducibility.
4. Hash and sign the immutable pack; upload by content address.
5. Create a catalog candidate pinning pack hash, entry scene, cohort, minimum shell version, and rollback version.
6. Publish to preview, then bounded canary. Monitor declared protected metrics.
7. Promote or roll back using the precommitted decision rule and append the result to the ledger.

## Gates

- Never mutate an existing published version.
- Never publish a fixture as discoverable.
- Never grant undeclared capabilities.
- Never remove the prior known-good artifact before the rollback window closes.
