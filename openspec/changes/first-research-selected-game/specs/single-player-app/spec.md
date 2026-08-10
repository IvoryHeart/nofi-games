# Single Player App Delta: Candidate Checkpoint Persistence

## ADDED Requirements

### Requirement: Shell-owned version-scoped game checkpoint

The player app SHALL own checkpoint persistence for a mounted game pack that declares
`local-save`. It SHALL treat `save_replay()` output as untrusted opaque structured data,
validate that it is a JSON-compatible dictionary no larger than 64 KiB, and persist it
atomically under a shell-owned key composed of the immutable game ID, game version,
pack content hash, and replay schema version. A game pack SHALL receive no filesystem,
browser-storage, platform credential, or database handle.

The shell SHALL request and persist the latest valid replay after every local gameplay
telemetry signal, on application pause/background/close notifications, immediately
after pack settlement, and before replacing the mounted pack. A gameplay telemetry
signal SHALL remain a local checkpoint trigger even when the player has not consented
to telemetry collection or transport. Coalescing repeated identical state hashes is
permitted; skipping a distinct accepted state is not.

#### Scenario: Local-save candidate emits a gameplay event

- **WHEN** a mounted pack with granted `local-save` emits its existing local
  `telemetry_emitted` signal after a state-changing action or logical tick
- **THEN** the shell SHALL call `save_replay()` and atomically persist a valid changed
  replay under the pack's version-scoped key
- **AND** telemetry consent or upload availability SHALL not gate the checkpoint

#### Scenario: Pack has no local-save grant

- **WHEN** a pack without a granted `local-save` capability emits telemetry or the app
  is backgrounded
- **THEN** the shell SHALL NOT persist or restore pack state
- **AND** the pack SHALL receive no storage authority

#### Scenario: Checkpoint is malformed or oversized

- **WHEN** `save_replay()` returns a non-JSON value, exceeds 64 KiB, or fails its pack's
  replay contract
- **THEN** the shell SHALL retain the last valid atomic checkpoint
- **AND** SHALL visibly report and log the new checkpoint failure
- **AND** SHALL NOT truncate, partially write, or silently relabel it as success

### Requirement: Exact checkpoint restore and safe fallback

After verifying and mounting the same game ID, version, and content hash, the player app
SHALL load any matching checkpoint and call `restore_replay()` before revealing an
operable game surface. It SHALL reveal the restored surface only when restore returns
true and the resulting state hash equals the checkpoint hash. Restore failure SHALL
retain the stored bytes for diagnosis, start a clean seed only after informing the
player, and offer a non-destructive retry or explicit delete. It SHALL never pass one
version's checkpoint to another version or silently migrate it.

#### Scenario: Matching checkpoint is restored

- **WHEN** the player launches a previously interrupted immutable pack version with a
  valid matching checkpoint
- **THEN** the first operable game state SHALL match the saved decision or logical-tick
  boundary exactly
- **AND** no accepted action or pulse SHALL be skipped or duplicated

#### Scenario: Catalog rolls back the game version

- **WHEN** a catalog entry returns from a candidate pack to its pinned rollback version
- **THEN** the shell SHALL use only the rollback version's own checkpoint key
- **AND** SHALL preserve the candidate checkpoint without passing it to or mutating it
  from the rollback version

#### Scenario: Local persistence is unavailable

- **WHEN** an atomic write fails because storage is denied, unavailable, private-mode
  volatile, or full
- **THEN** current in-memory play SHALL continue
- **AND** the shell SHALL disclose that resume is unavailable and log the exact failure
- **AND** SHALL NOT request identity, network sync, or direct pack storage as fallback

### Requirement: Candidate remains inside one application

The player app SHALL load Mossbound Measures through the existing verified pack-loader
path and SHALL NOT introduce a game-specific executable, separate application,
credential, native integration, or distribution channel. Development and evaluation
catalog entries SHALL set `discoverable: false`; a later accepted decision is required
before any cohort can discover the game.

#### Scenario: Builder runs player-app integration

- **WHEN** the versioned Mossbound Measures PCK is inserted into an evaluation catalog
- **THEN** the player app SHALL verify its hash, mount its isolated namespace,
  instantiate its data-only scene, attach its declared script, restore only a matching
  checkpoint, and expose one in-app game surface
- **AND** the test catalog SHALL remain nondiscoverable and nonproduction
