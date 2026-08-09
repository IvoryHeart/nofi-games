# Research-Selected Catalog Specification

## Purpose

Ensure game genres, concepts, promotion, and retirement are selected from current evidence rather than fixed engineering assumptions or legacy inventory.

## Requirements

### Requirement: Evidence precedes game selection

The studio SHALL require a dated market brief with source provenance, uncertainty, platform fit, and competitive analysis before selecting a game concept.

#### Scenario: Agent proposes a game

- **WHEN** a research agent proposes adding a game to the build queue
- **THEN** the proposal SHALL link to a valid market brief and frozen selection criteria

### Requirement: Multiple concepts compete

The studio SHALL compare materially different original concepts before selecting a game for implementation.

#### Scenario: Concept selection runs

- **WHEN** an opportunity advances beyond research
- **THEN** the studio SHALL preserve all scored concepts, dissent, and sensitivity to scoring assumptions

### Requirement: Fixtures are not product recommendations

Contract and evaluation fixtures SHALL be excluded from the discoverable player catalog.

#### Scenario: Fixture pack is published for testing

- **WHEN** a fixture pack appears in a development catalog
- **THEN** its manifest SHALL mark it non-discoverable and ineligible for player promotion
