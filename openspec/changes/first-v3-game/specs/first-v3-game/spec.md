## Purpose

Define the bounded product behavior for one human-approved original game pack that proves the platform-v3 player, SDK contract, deterministic evaluation, and development-catalog preview as one vertical slice.

## ADDED Requirements

### Requirement: Implementation follows human concept approval

The game pack and its discoverable catalog entry SHALL correspond to exactly one concept explicitly accepted by the human in this governing change. The accepted concept for this change SHALL be Tide Ledger; Kite Post and Flicker Forensics SHALL remain unimplemented.

#### Scenario: Accepted concept is implemented

- **WHEN** implementation begins for this change
- **THEN** only Tide Ledger SHALL be implemented or added as a discoverable product catalog entry

### Requirement: The selected pack provides a complete short play loop

The selected game pack SHALL present an understandable goal, a strong core interaction, a successful completion state, and a retry or restart path within a short session. The loop SHALL be playable without networking, accounts, monetization, or external services.

#### Scenario: Player starts a fresh run

- **WHEN** the player loads the selected pack and starts a run with a valid seed
- **THEN** the pack SHALL expose its goal, accept an available input action, and produce an updated structured observation

#### Scenario: Player completes or fails a run

- **WHEN** the run reaches its success condition or a defined failure condition
- **THEN** the pack SHALL expose a terminal objective state and SHALL allow a deterministic reset for another run

### Requirement: Tide Ledger owns deterministic level generation

Tide Ledger SHALL expose a game-specific generator with the contract `generate(seed, difficulty, generator_version) -> immutable LevelSpec`. The returned LevelSpec SHALL contain the complete level topology and goal data needed to play, a canonical content hash, and the generator inputs. Once returned, a LevelSpec SHALL not be mutated by gameplay or generation operations; consumers SHALL receive copies or read-only access. The implementation SHALL NOT move this generator into a cross-game framework or external content store.

#### Scenario: Level is generated from explicit inputs

- **WHEN** Tide Ledger requests a level with a seed, one of its three difficulty bands, and a generator version
- **THEN** it SHALL return an immutable LevelSpec whose canonical hash and contents are fully determined by those inputs

#### Scenario: Same generation inputs repeat

- **WHEN** Tide Ledger generates the same seed, difficulty, and generator version twice
- **THEN** both LevelSpecs SHALL have identical canonical contents and identical hashes

### Requirement: Accepted levels have deterministic solvability proof

Tide Ledger SHALL run a deterministic solver over every candidate LevelSpec before accepting it. The solver SHALL prove a route that collects all required tide markers and reaches the lighthouse under the level's movement and tide rules. A candidate without a solver proof SHALL be rejected and SHALL never be exposed as playable.

#### Scenario: Candidate is completable

- **WHEN** the solver evaluates a candidate LevelSpec
- **THEN** it SHALL return a reproducible proof result containing solvability and the measured solution path required by the difficulty contract

#### Scenario: Candidate is not completable

- **WHEN** the solver cannot find a valid route within the bounded state space
- **THEN** the generator SHALL reject the candidate and SHALL not return it as an accepted level

### Requirement: Generation is bounded and fails to a known-valid fallback

For each generation request, Tide Ledger SHALL evaluate no more than 32 deterministic candidate attempts. If no candidate satisfies the solver proof and requested difficulty band within those attempts, it SHALL return a known-valid deterministic fallback for the same generator version and difficulty band, and SHALL run the solver against that fallback before exposing it. A failure to prove the fallback SHALL fail closed rather than accepting an unverified level.

#### Scenario: Candidate succeeds within the attempt bound

- **WHEN** an accepted candidate is found during attempts 1 through 32
- **THEN** generation SHALL return that solver-proven LevelSpec and SHALL record the attempt count in structured metrics

#### Scenario: Candidate attempts are exhausted

- **WHEN** 32 attempts fail the solver or difficulty-band bounds
- **THEN** generation SHALL use the known-valid deterministic fallback and SHALL expose no unproven candidate

### Requirement: Difficulty is measured in three bounded bands

Tide Ledger SHALL support exactly three difficulty bands: `shoal`, `swell`, and `storm`. Each accepted LevelSpec SHALL include measured integer values for minimum solution length, required tide flips, reachable-state branching, and reachable dead ends. A level SHALL be accepted only when all four measures fall within the fixed bounds for its requested band; the bounds SHALL be versioned with the generator and checked by tests.

#### Scenario: Level meets requested band

- **WHEN** a solver-proven candidate is measured
- **THEN** its solution length, required tide flips, branching, and dead ends SHALL each fall within the requested band bounds before acceptance

#### Scenario: Level misses requested band

- **WHEN** any measured difficulty value falls outside the requested band
- **THEN** the generator SHALL reject the candidate even if it is solvable

### Requirement: Endless levels are reproducible from a root seed

Tide Ledger SHALL derive each level request deterministically from a root seed, level index, difficulty band, and generator version. Advancing to the next level SHALL not depend on wall-clock time, prior process state, or an unseeded random source. The same root seed and level index SHALL reconstruct the same LevelSpec and hash.

#### Scenario: Level index advances

- **WHEN** a player completes level `n` and requests level `n + 1`
- **THEN** Tide Ledger SHALL derive the next level from the same root seed and generator version plus the new index, without persisting a full level catalog

#### Scenario: Endless sequence is replayed

- **WHEN** a replay restores a root seed, level index, difficulty, and generator version
- **THEN** Tide Ledger SHALL reconstruct the same LevelSpec hash before applying the recorded actions

### Requirement: Generator provenance is part of structured state and replay

Tide Ledger observations, objectives, metrics, and replay data SHALL include the root seed, current level index, requested difficulty band, generator version, and LevelSpec hash. Full LevelSpec data SHALL be stored in replay data only when exact reconstruction from those inputs cannot be proven; otherwise replay SHALL store the reconstruction inputs and hash.

#### Scenario: State reports generator identity

- **WHEN** a player or headless evaluator reads the current observation
- **THEN** it SHALL receive the seed, level index, difficulty, generator version, and LevelSpec hash as structured fields

#### Scenario: Replay restores generated state

- **WHEN** replay restoration reconstructs a LevelSpec from its provenance fields
- **THEN** restoration SHALL verify the reconstructed hash before accepting actions or declaring the replay restored

### Requirement: A fixed seed corpus covers generator behavior

The Tide Ledger test suite SHALL contain a fixed, repository-owned seed corpus covering all three difficulty bands and multiple level indices. The corpus SHALL verify repeatability, solver-proven solvability, difficulty-band bounds, LevelSpec hashes, generator-attempt/fallback behavior, and replay restoration.

#### Scenario: Generator corpus is checked headlessly

- **WHEN** the Tide Ledger headless tests run against the fixed corpus
- **THEN** every corpus case SHALL reproduce its expected hash, pass the solver, remain within its requested band, and pass replay restoration

#### Scenario: Generator version changes

- **WHEN** the generator version changes
- **THEN** the corpus SHALL make the version and resulting hash change explicit rather than silently treating old LevelSpecs as interchangeable

### Requirement: The selected pack is contract-complete and deterministic

The pack SHALL implement the SDK semantic evaluation interface for seeded reset, observation, available actions, action application, simulation advance, objectives, metrics, replay save, and replay restore. Resetting with the same seed SHALL produce the same initial observation, and restoring a saved replay SHALL reproduce the recorded outcome.

#### Scenario: Headless contract check evaluates the pack

- **WHEN** the focused game test invokes the SDK contract validator and deterministic checks
- **THEN** the pack SHALL return structured observations, actions, and objectives, accept valid declared actions, reject an invalid action without corrupting state, and pass identical-seed reset

#### Scenario: Replay is restored

- **WHEN** a test saves a replay after a sequence of valid actions, resets to another seed, and restores that replay
- **THEN** restore SHALL succeed and the resulting observation, objective state, and relevant metrics SHALL match the recorded outcome

### Requirement: The selected pack is discoverable only through the one player app

The built pack SHALL have a schema-valid versioned manifest and catalog entry with a pinned content hash, game-pack namespace entry resources, local preview availability, and discoverable product status. The contract fixture SHALL remain non-discoverable, and no separate game application SHALL be created.

#### Scenario: Development catalog presents the product pack

- **WHEN** the development catalog is generated with the selected pack and the player app starts
- **THEN** the player SHALL present the selected pack as a catalog choice and SHALL continue to hide the contract fixture

#### Scenario: Pack integrity or namespace is invalid

- **WHEN** the player attempts to load a selected-pack entry whose local bytes do not match its catalog hash or whose scene/script escapes `res://game_packs/`
- **THEN** the player SHALL fail closed and SHALL not launch the pack

### Requirement: Inputs are practical across preview platforms

The selected pack SHALL expose at least one keyboard action and a touch-compatible equivalent for its core interaction where the platform can provide touch input. Input labels and available actions SHALL be represented in structured pack state rather than inferred from prose.

#### Scenario: Keyboard input is used

- **WHEN** a player uses the declared keyboard control during a run
- **THEN** the pack SHALL apply the corresponding available action and update its observation or terminal state

#### Scenario: Touch input is used

- **WHEN** a player uses the practical touch equivalent for the core interaction
- **THEN** the pack SHALL apply the corresponding action without requiring a separate application or network service
