# Research-Selected Catalog Specification

## Purpose

Ensure game genres, concepts, promotion, and retirement are selected from current evidence rather than fixed engineering assumptions or legacy inventory.

## Requirements

### Requirement: Evidence precedes game selection

A human SHALL NOT accept an OpenSpec change that adds a product game to the catalog unless it includes a dated market brief with source provenance, uncertainty, platform fit, competitive analysis, and frozen selection criteria. The brief and criteria SHALL be concise sections within that governing OpenSpec change. Human review SHALL NOT require or accept a custom schema, dedicated artifact type, or artifact factory for these records. This policy SHALL NOT imply that an autonomous research agent or build queue currently exists.

#### Scenario: Agent proposes a game

- **WHEN** a contributor proposes a change that would add a discoverable product game
- **THEN** human review SHALL require the dated market brief and selection criteria inside the governing change before accepting it, without requiring separate generated research artifacts

### Requirement: Multiple concepts compete

A human SHALL NOT select a product game for implementation until concise sections within the governing OpenSpec change compare materially different original concepts against the accepted criteria and preserve the scores, dissent, and sensitivity to scoring assumptions. Human review SHALL NOT require or accept a separate concept-record artifact factory.

#### Scenario: Concept selection runs

- **WHEN** a proposal recommends one concept for product implementation
- **THEN** human review SHALL reject or defer it unless the required competing concepts and comparison are present inside the governing change

### Requirement: Fixtures are not product recommendations

Contract and evaluation fixtures SHALL be excluded from the discoverable player catalog.

#### Scenario: Fixture pack is published for testing

- **WHEN** a fixture pack appears in a development catalog
- **THEN** its manifest SHALL mark it non-discoverable and ineligible for player promotion
