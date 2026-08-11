## Purpose

Define the bounded product behavior for one human-approved original game pack that proves the platform-v3 player, SDK contract, deterministic evaluation, and development-catalog preview as one vertical slice.

## ADDED Requirements

### Requirement: Implementation follows human concept approval

The game pack and its discoverable catalog entry SHALL correspond to exactly one concept explicitly accepted by the human in this governing change. Before that acceptance, the change SHALL contain no implemented game pack and SHALL not expose a discoverable product entry.

#### Scenario: Concept is still awaiting approval

- **WHEN** the three candidates are documented but no candidate has human acceptance
- **THEN** no candidate SHALL be implemented or added as a discoverable product catalog entry

#### Scenario: One concept is accepted

- **WHEN** the human accepts one documented candidate
- **THEN** subsequent implementation SHALL be bounded to that candidate and the change SHALL record the accepted concept before implementation begins

### Requirement: The selected pack provides a complete short play loop

The selected game pack SHALL present an understandable goal, a strong core interaction, a successful completion state, and a retry or restart path within a short session. The loop SHALL be playable without networking, accounts, monetization, or external services.

#### Scenario: Player starts a fresh run

- **WHEN** the player loads the selected pack and starts a run with a valid seed
- **THEN** the pack SHALL expose its goal, accept an available input action, and produce an updated structured observation

#### Scenario: Player completes or fails a run

- **WHEN** the run reaches its success condition or a defined failure condition
- **THEN** the pack SHALL expose a terminal objective state and SHALL allow a deterministic reset for another run

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
