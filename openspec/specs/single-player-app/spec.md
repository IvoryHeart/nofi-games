# Single Player App Specification

## Purpose

Define the one application through which every qualified Nofi game is discovered, loaded, operated, updated, and rolled back across supported platforms.

## Requirements

### Requirement: One distribution application

The system SHALL distribute games through one player application rather than requiring a separately published application per game.

#### Scenario: New game becomes available

- **WHEN** a qualified game version is promoted in the catalog
- **THEN** an eligible player app SHALL discover it without installing a separate application

### Requirement: Shell-owned platform capabilities

The player app SHALL own identity, storage, telemetry, network policy, updates, and native platform capabilities.

#### Scenario: Game requests a capability

- **WHEN** a game pack requests a declared capability
- **THEN** the player app SHALL grant or deny it according to catalog policy without exposing platform credentials

### Requirement: Catalog rollback

The player app SHALL support reverting a catalog entry to a known compatible game-pack version.

#### Scenario: Canary violates a rollback trigger

- **WHEN** a monitored canary crosses a protected-metric rollback threshold
- **THEN** the catalog SHALL stop assigning the candidate and restore its pinned rollback version
