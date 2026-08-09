# Game Pack Contract Specification

## Purpose

Define the compatible, testable, capability-limited unit that lets independently produced Godot games run safely inside the single player app.

## Requirements

### Requirement: Versioned manifest

Every game pack SHALL contain a schema-valid manifest declaring identity, semantic version, SDK version, entry scene, entry script, inputs, orientation, capabilities, and minimum player-app version. The entry scene SHALL be data-only; the player app SHALL attach the declared entry script after verifying and mounting the pack so resource UIDs remain pack-independent.

#### Scenario: Pack enters evaluation

- **WHEN** a built pack is submitted to the evaluation workflow
- **THEN** validation SHALL fail before execution if any required manifest field is absent or incompatible

#### Scenario: Player app mounts a pack

- **WHEN** the player app verifies a pack hash and mounts its isolated namespace
- **THEN** it SHALL instantiate the data-only entry scene, attach the declared entry script, and reject any script that does not extend the Nofi game-pack contract

### Requirement: Semantic evaluation interface

Every game pack SHALL expose reset, observation, available-action, action-application, simulation-advance, objective, metric, and replay operations.

#### Scenario: Headless evaluator starts a session

- **WHEN** an evaluator resets the same game version with the same seed and actions
- **THEN** the game SHALL produce the same declared deterministic observations and replay

### Requirement: Unique resource namespace

Every pack SHALL store runtime resources beneath a path derived from its game identifier and SHALL NOT replace player-app or other pack resources.

#### Scenario: Multiple packs are loaded

- **WHEN** the player app loads two compatible packs
- **THEN** neither pack SHALL shadow the other pack or shell resources

### Requirement: Immutable identity

A published game version SHALL resolve to one immutable content hash.

#### Scenario: Content changes

- **WHEN** any file in a published pack changes
- **THEN** the studio SHALL produce a new version and content hash rather than mutate the existing artifact
