# ADR 0001: One player app with versioned game packs

- Status: accepted
- Date: 2026-08-09

## Context

Publishing every generated game as a separate store application creates signing, review, metadata, rollout, update, and operational work that cannot be compressed by code generation.

## Decision

Distribute one Godot player application. Research-selected games are immutable, versioned packs loaded through a signed catalog. The shell owns platform capabilities and rollback.

## Consequences

- Game packs require a strict compatibility and capability contract.
- Pack loading becomes a security boundary.
- Store-policy validation is required before remote packs become the mobile production path.
- An alternate bundled-catalog release remains possible without changing game contracts.
