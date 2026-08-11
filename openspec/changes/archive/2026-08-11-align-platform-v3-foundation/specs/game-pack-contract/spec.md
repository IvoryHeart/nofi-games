## MODIFIED Requirements

### Requirement: Versioned manifest

Every cataloged game pack SHALL have a schema-valid manifest declaring identity, semantic version, SDK version, entry scene, entry script, discoverability, inputs, orientations, capabilities, and minimum player-app version. Its catalog entry SHALL also pin a pack location, SHA-256 content hash, rollout value, and lifecycle status. The player SHALL attach the declared entry script only after the catalog entry and local pack pass integrity and namespace checks. Manifest validation SHALL validate the version fields' schema and string formats without claiming an SDK/player compatibility decision that is not implemented.

#### Scenario: Pack enters evaluation

- **WHEN** a generated or base catalog is checked
- **THEN** validation SHALL reject a missing, schema-invalid, duplicate, or discoverable fixture entry before the player build is accepted

#### Scenario: Player app mounts a pack

- **WHEN** the player loads a valid local catalog entry
- **THEN** it SHALL verify the pack hash, request a mount with resource replacement disabled, instantiate the declared entry scene, attach the declared entry script, and require the result to extend the SDK game-pack root

### Requirement: Semantic evaluation interface

Every conforming game pack SHALL implement the SDK operations for seeded reset, observation, available actions, action application, simulation advance, objectives, metrics, replay save, and replay restore. Contract checks SHALL verify structured observations, actions, and objectives plus deterministic reset for an identical seed; the fixture SHALL exercise actions and replay restoration headlessly.

#### Scenario: Headless evaluator starts a session

- **WHEN** the repository runs the Godot contract checks
- **THEN** the fixture SHALL pass interface validation, produce the same observation after repeated reset with the same seed, accept its declared actions, and restore its saved replay

### Requirement: Unique resource namespace

A catalog entry's declared scene and script SHALL resolve beneath the game-pack namespace. The player SHALL request the PCK mount with resource replacement disabled so a colliding resource in the new pack cannot replace a player-app or previously mounted resource; a collision alone SHALL NOT imply that the whole pack was rejected.

#### Scenario: Catalog entry escapes the pack namespace

- **WHEN** a local entry declares a scene or script outside `res://game_packs/`
- **THEN** the player SHALL reject the entry without launching the pack

#### Scenario: Multiple packs are loaded

- **WHEN** the player mounts another local PCK
- **THEN** it SHALL disable resource replacement so an existing player or pack resource remains authoritative at any colliding path, without claiming the attempted collision rejects the pack

### Requirement: Immutable identity

A validated catalog SHALL contain at most one entry for each game identifier and semantic version, and each entry SHALL pin one SHA-256 hash for the artifact it loads. The player SHALL reject bytes that do not match that pinned hash.

#### Scenario: Catalog identity or content conflicts

- **WHEN** a catalog repeats an identifier/version pair or a local PCK differs from its entry's hash
- **THEN** catalog validation or pack loading SHALL fail rather than choosing or accepting content implicitly

#### Scenario: Content changes

- **WHEN** locally built pack bytes change
- **THEN** the generated catalog SHALL pin the new artifact hash and the player SHALL reject the prior hash for those bytes

## ADDED Requirements

### Requirement: Pack hash claims match verified scope

The repository SHALL describe a pack build as reproducible across clean worktrees only when the pinned source and toolchain produce an identical SHA-256 hash in two independently created clean worktrees. Otherwise documentation SHALL state the narrower verified scope, and the generated catalog SHALL pin the actual hash of the artifact it bundles.

#### Scenario: Reproducibility is claimed

- **WHEN** verification describes the fixture PCK as reproducible across clean worktrees
- **THEN** recorded checks SHALL show identical hashes from two clean worktrees at the same commit and pinned Godot version

#### Scenario: Clean-worktree hashes differ

- **WHEN** independently clean builds produce different hashes
- **THEN** the change SHALL fail the reproducibility claim, preserve the differing result, and use only content-addressed statements that remain true
