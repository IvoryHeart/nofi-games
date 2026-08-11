# Single Player App Specification

## Purpose

Define the one application that presents its bundled catalog and loads integrity-checked local game packs without separate game applications.

## Requirements

### Requirement: One distribution application

The repository SHALL build and distribute games through one player application. Catalog games SHALL be versioned packs loaded by that application rather than separately published applications.

#### Scenario: New game becomes available

- **WHEN** a discoverable catalog entry points to a valid bundled PCK
- **THEN** the existing player application SHALL load it without installing or launching a separate game application

### Requirement: Bundled catalog controls presentation

The player SHALL read its bundled generated catalog when present and otherwise its bundled base catalog. It SHALL present only entries marked discoverable, and contract fixtures SHALL remain hidden.

#### Scenario: Catalog contains only a fixture

- **WHEN** the development catalog contains a non-discoverable fixture entry
- **THEN** the player SHALL not present that entry as a playable catalog choice

### Requirement: Local pack loading fails closed

The player SHALL launch a local pack only when the file exists, its SHA-256 matches the catalog, its entry scene and script are in the game-pack namespace, Godot mounts it without replacing existing resources, both declared resources resolve to the expected types, and the resulting instance extends the SDK game-pack root. Any failed condition SHALL leave the pack unlaunched and report an error.

#### Scenario: Local pack is invalid

- **WHEN** any required local-pack integrity, namespace, mount, resource, or contract check fails
- **THEN** the player SHALL return a failed result and SHALL NOT add the pack instance to the scene tree
