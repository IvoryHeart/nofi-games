# Mossbound Measures Specification

## Purpose

Define the observable player value, deterministic rules, semantic interface, access
behavior, and bounded pack contract for the selected Mossbound Measures concept. The
first version is an evaluation candidate for adults, not an accepted catalog game or a
claim about health, education, or ecology.

## ADDED Requirements

### Requirement: Versioned capability-limited game pack

Mossbound Measures SHALL ship only as game pack `mossbound-measures` version `0.1.0`
for Godot `4.7.1` Compatibility and Nofi SDK `0.1.0`, under
`res://game_packs/mossbound_measures/`. Its manifest SHALL declare a data-only entry
scene, a typed-GDScript entry script, both portrait and landscape orientations,
minimum player-app version `0.1.0`, `discoverable: false`, and only the `local-save`
capability. It SHALL declare the input identifiers in the semantic-action requirement
and SHALL NOT request network, identity, or haptics.

The pack SHALL contain no platform credential, native extension, executable download,
external URL, analytics client, ad/purchase/currency system, user account, public or
private messaging, public UGC, live generated content, or separate-app assumption. Its
core loop SHALL remain fully available offline after the signed pack is present.

#### Scenario: Candidate pack is validated

- **WHEN** version `0.1.0` enters the build or evaluation workflow
- **THEN** its manifest and resource namespace SHALL satisfy the canonical game-pack
  contract
- **AND** its only declared capability SHALL be `local-save`
- **AND** it SHALL remain nondiscoverable until a later independent catalog decision

#### Scenario: An undeclared capability is attempted

- **WHEN** the pack attempts network, identity, native-platform, or direct filesystem
  access
- **THEN** the player app SHALL deny the attempt
- **AND** evaluation SHALL reject the pack

### Requirement: Rendering-independent canonical game state

The canonical game state SHALL be a typed, rendering-independent value containing:

- schema version, game version, seed, scenario-library version, scenario identifier,
  mode (`tutorial` or `main`), and difficulty tier;
- board width and height, fixed row-major cell records, and the three public integer
  properties `moisture`, `warmth`, and `charge`, each restricted to `0..3`;
- each cell's immutable response rule (`dew`, `glow`, `drift`, or `hush`) and current
  Boolean awake state;
- exactly six pulse identifiers (`rain`, `sun`, `wind`, or `still`), one per measure
  slot;
- pending edit, optional structured prediction, preview trace/hash, current phase,
  logical tick, commit counters, one-step rewind snapshot, and recovery reason;
- exactly three intent definitions with current truth values, required intent count 2,
  first qualifying commit, settle availability, and settled result; and
- monotonic accepted-operation sequence and a lowercase hexadecimal SHA-256 hash of the
  canonical state excluding presentation, telemetry/event delivery metadata, rejected
  diagnostics, and the hash field itself.

The pack SHALL calculate every gameplay decision from this canonical state. Rendering,
animation, audio, focus, viewport, wall-clock time, frame rate, and telemetry upload
SHALL NOT alter it.

#### Scenario: Rendering modes differ

- **WHEN** identical seed, semantic actions, and simulation advances run in animated,
  instant, sound-off, portrait, and landscape presentations
- **THEN** every decision-boundary canonical state and state hash SHALL be identical

#### Scenario: A state value is outside its domain

- **WHEN** a replay, save, or internal transition would create a property outside
  `0..3`, an unknown enum, a duplicate cell index, or a noncanonical field
- **THEN** the input SHALL be rejected without mutating the prior valid state
- **AND** the failure SHALL be surfaced in the action result and failure log

### Requirement: Exact pulse transition rules

For each of the six measure ticks, the pack SHALL apply the slot's pulse simultaneously
and independently to every cell's pre-tick tuple `(moisture, warmth, charge)`. It SHALL
use only the following integer transitions, where `min` and `max` clamp to `0..3`:

- `rain`: `(min(3, moisture + 1), max(0, warmth - 1), charge)`;
- `sun`: `(max(0, moisture - 1), min(3, warmth + 1), charge)`;
- `wind` when `moisture > 0`:
  `(moisture - 1, warmth, min(3, charge + 1))`;
- `wind` when `moisture == 0`:
  `(moisture, warmth, max(0, charge - 1))`;
- `still` when `charge > 0`:
  `(min(3, moisture + 1), warmth, charge - 1)`;
- `still` when `charge == 0` and `warmth > 0`:
  `(min(3, moisture + 1), warmth - 1, charge)`; and
- `still` when `charge == 0` and `warmth == 0`: no property changes.

After all cells transition for a tick, the pack SHALL recompute awake states without
changing properties:

- `dew` is awake exactly when `moisture >= 2` and `warmth <= 1`;
- `glow` is awake exactly when `warmth >= 2` and `charge >= 1`;
- `drift` is awake exactly when `charge >= 2` and `moisture <= 1`; and
- `hush` is awake exactly when
  `max(moisture, warmth, charge) - min(moisture, warmth, charge) <= 1` and
  `moisture + warmth + charge >= 3`.

No neighbor, animation, random draw, floating-point value, or iteration order SHALL
change a tick result.

#### Scenario: Pulse order changes an outcome

- **WHEN** a cell starts at `(0, 1, 0)` and receives `rain` then `wind`
- **THEN** its tuple after the two ticks SHALL be `(0, 0, 1)`
- **AND WHEN** the same cell instead receives `wind` then `rain`
- **THEN** its tuple SHALL be `(1, 0, 0)`
- **AND** tutorial fixtures SHALL use this or another explicit unequal pair to prove
  order rather than merely state it

#### Scenario: Preview and commit use the same transition

- **WHEN** a pending edit is previewed and then committed from an unchanged source hash
- **THEN** each of the six committed tick states SHALL equal the corresponding preview
  tick state exactly

### Requirement: Observable motif intents

At the end of each completed six-tick measure, the pack SHALL derive an awake-cell mask
and evaluate exactly three disclosed intents from these definitions:

- `bridge-horizontal`: awake cells contain an orthogonally connected path from any cell
  in column 0 to any cell in the last column;
- `bridge-vertical`: awake cells contain an orthogonally connected path from any cell in
  row 0 to any cell in the last row;
- `ring`: the specified nonedge center cell is dormant and at least three of its four
  orthogonal neighbors are awake; and
- `refuge`: at least three of the four cells in the specified in-bounds 2-by-2 square
  are awake.

Adjacency SHALL be four-directional only. Each intent record SHALL expose its type,
parameters, plain-language predicate, involved cell indices, current truth value, and
the first failing clause. A scenario SHALL never hide an intent or change its definition
after reset.

#### Scenario: Two intents are active

- **WHEN** a completed measure's awake mask satisfies any two disclosed intent
  predicates
- **THEN** `settle-measure` SHALL become available
- **AND** neither a third intent, a minimum score, nor further play SHALL be required

#### Scenario: An intent is inactive

- **WHEN** an intent predicate is false
- **THEN** observation and preview SHALL identify the first failing clause using public
  cell indices and state
- **AND** SHALL NOT reveal or prescribe a solution action

### Requirement: Bounded edit-preview-commit-settle loop

Main play SHALL begin in `editing` phase with exactly one six-slot measure and no
pending edit. A turn SHALL permit changing one slot from its current pulse to a
different pulse; the player may revise that same slot or clear the edit before commit
but SHALL NOT change a second slot in the same turn. Preview SHALL simulate all six
ticks from the current source state without mutation. Commit SHALL queue exactly those
six ticks for controlled resolution and SHALL be unavailable without a pending edit.

A scenario SHALL allow at most four committed measures to first satisfy any two
intents. The scenario library SHALL be solver-proven to have at least two distinct valid
edit sequences within that limit. On first qualification, the pack SHALL record the
commit index and allow at most two additional optional committed measures. Settling
SHALL be allowed immediately whenever at least two intents are active. Continuing SHALL
never award a progression advantage over settling.

#### Scenario: Player revises a pending edit

- **WHEN** the player sets slot 2, then sets slot 2 to another pulse before commit
- **THEN** only the latest slot-2 pulse SHALL be pending
- **AND** the canonical bed, commit counter, and logical tick SHALL remain unchanged

#### Scenario: Player attempts a second slot edit

- **WHEN** one slot has a pending edit and `set-pulse` names a different slot
- **THEN** the action SHALL be rejected with reason `one-slot-per-turn`
- **AND** the existing pending edit SHALL remain unchanged

#### Scenario: Player settles an adequate pattern

- **WHEN** at least two intents are active and the player applies `settle-measure`
- **THEN** the phase SHALL become `settled`
- **AND** the result SHALL preserve the final state, active intents, seed, scenario,
  action provenance, and a local structured keepsake
- **AND** no prompt SHALL imply that continuing or achieving all three was preferable

### Requirement: Seeded scenario library and solver witnesses

Version `0.1.0` SHALL contain the eight exact base scenarios and three tutorial fixtures
specified in `design.md`, with scenario-library version `1`. Each base scenario SHALL
include its dimensions, row-major cell properties/rules, initial measure, three intent
records, tier, at least two distinct qualifying action-sequence witnesses of no more
than four commits, and solver-derived reachable-state counts.

On `reset_game(seed)`, a Godot `RandomNumberGenerator` seeded only with the supplied
signed 64-bit seed SHALL choose a base-scenario index and one of the eight square-board
dihedral transforms, then deterministically order intents and choose a presentation
palette. The selected base ID, transform, transformed complete initial state, PRNG
algorithm/runtime version, and resulting state hash SHALL appear in observation and
replay. Presentation palette SHALL NOT enter canonical state or affect actions.

#### Scenario: Same seed resets twice

- **WHEN** the same version receives the same signed seed twice
- **THEN** the scenario ID, transform, complete canonical observation, available
  actions, objectives, and initial state hash SHALL match byte-for-byte after canonical
  serialization

#### Scenario: Scenario witness is checked

- **WHEN** the shipped solver executes every declared witness from the declared base
  state and transform
- **THEN** the witness SHALL activate at least two intents and allow settlement within
  four commits
- **AND** an exhaustive bounded search SHALL find at least one other distinct qualifying
  sequence for the same transformed scenario

### Requirement: Controllable logical clock

Wall-clock callbacks and process frames SHALL never advance gameplay. Applying
`commit-measure` SHALL change phase to `resolving` and queue six pulse ticks without
applying them. `advance_simulation(n)` SHALL accept only integer `n >= 0`, apply at most
the remaining queued ticks in order, and increase `logical_tick` once per applied pulse.
After tick six it SHALL recompute intents, counters, phase, solver reachability, and
checkpoint eligibility atomically. Surplus ticks SHALL leave canonical state unchanged.

Presentation MAY animate between logical ticks but SHALL not select tick timing. Instant
and reduced-motion modes SHALL request all remaining ticks through the same method.

#### Scenario: Evaluator advances one tick at a time

- **WHEN** an evaluator commits a measure and calls `advance_simulation(1)` six times
- **THEN** it SHALL observe each declared preview state in order
- **AND** the final state SHALL equal one call to `advance_simulation(6)`

#### Scenario: Background frame time passes

- **WHEN** the app is paused, backgrounded, throttled, or left idle without an explicit
  simulation advance
- **THEN** logical tick and every gameplay field SHALL remain unchanged

### Requirement: Semantic action and observation contract

The pack SHALL expose these manifest input/action identifiers:

- `set-pulse` with integer `slot` in `0..5` and pulse enum;
- `record-prediction` with `tick` in `0..5`, valid `cell`, property enum, and direction
  enum `increase|decrease|same`;
- `preview-measure`, `clear-edit`, `commit-measure`, `rewind-commit`,
  `restart-scenario`, `settle-measure`, `inspect-cell`, `skip-tutorial`, `pause-game`,
  and `resume-game`.

`get_available_actions()` SHALL enumerate only actions valid in the current phase and
all valid parameter domains needed by a headless policy. `apply_action()` SHALL return
`accepted`, stable reason code, pre-state hash, post-state hash, and current observation;
read-only actions SHALL have identical pre/post hashes. Unknown identifiers,
out-of-range parameters, extra parameters, wrong types, and actions invalid for phase
SHALL be rejected without mutation.

`get_observation()` SHALL expose every canonical field needed to decide, the public
pulse and response rules, intent predicates and failing clauses, valid parameter
domains, and current objective/metrics. It SHALL NOT expose solver solution witnesses,
hidden preferred actions, presentation-only state, evaluator holdouts, or future random
draws.

#### Scenario: Headless policy asks what it can do

- **WHEN** `get_available_actions()` is called in editing phase without a pending edit
- **THEN** it SHALL enumerate every slot/pulse change that differs from the current
  measure plus valid read-only, pause, restart, and tutorial actions
- **AND** commit, clear, preview, prediction, and settle SHALL appear only when their
  preconditions are met

#### Scenario: Malformed action is applied

- **WHEN** an action has an unknown field or invalid parameter type
- **THEN** it SHALL return `accepted: false` and reason `malformed-action`
- **AND** its state hash, accepted-action sequence, gameplay metrics, and replay SHALL
  remain unchanged
- **AND** a noncanonical rejected-action diagnostic SHALL increment for failure evidence

### Requirement: Objectives and gameplay metrics

`get_objectives()` SHALL expose:

- required objective `settle-two-intents`, complete only after a settled state that has
  at least two active intents;
- optional objective `settle-three-intents`, complete only when all three were active
  at settlement; and
- tutorial objectives for each active tutorial step, omitted in main mode.

`get_metrics()` SHALL return deterministic values at least for accepted/rejected action
counts, previews, commits, rewinds, restarts, logical ticks, current/maximum active
intent counts, prediction attempts/correctness, distinct state hashes visited,
settlement, qualifying edit length, and solver distance expressed as the minimum
remaining commits to any two-intent state. Optional-objective completion SHALL NOT be
combined into the required objective or used as a power/reward gate.

#### Scenario: Adequate settlement completes the required objective

- **WHEN** the player settles with exactly two active intents
- **THEN** `settle-two-intents.complete` SHALL be true
- **AND** `settle-three-intents.complete` SHALL be false
- **AND** the session SHALL be represented as successful rather than partial failure

### Requirement: Recovery without punitive loss

Before each commit the pack SHALL preserve one canonical rewind snapshot. The player
MAY rewind the latest completed commit any number of times across a session, but only
one historical commit depth SHALL be retained. Rewind SHALL restore cells, measure,
intents, counters, objective availability, and logical tick from that snapshot while
remaining an explicit replay event. Restart SHALL recreate the seed's initial state and
retain only session-level attempt metrics.

After each completed measure, an exhaustive bounded solver SHALL determine whether any
two-intent state remains reachable within the remaining required or optional commit
budget. If none is reachable, phase SHALL become `recovery`, name reason
`no-qualifying-state-within-budget`, and offer rewind or restart; it SHALL NOT display
death, blame, lost currency, a timer, or an irreversible fail state.

#### Scenario: No qualifying state remains

- **WHEN** a completed measure leaves no two-intent state reachable within the remaining
  budget
- **THEN** commit and settle SHALL be unavailable
- **AND** observation SHALL expose the stable recovery reason
- **AND** rewind and restart SHALL remain available

#### Scenario: Application is interrupted during resolution

- **WHEN** interruption occurs after any of the six logical ticks
- **THEN** the exact queued tick index, canonical state, pending resolution, and rewind
  snapshot SHALL be checkpointable and restorable
- **AND** no committed edit SHALL be silently skipped or applied twice

### Requirement: Deterministic replay and checkpoint format

`save_replay()` SHALL return a dictionary with exactly these top-level fields:
`schema_version: 1`, `game_id`, `game_version`, `sdk_contract_version`,
`scenario_library_version`, signed `seed`, `mode`, `scenario_id`, `transform_id`,
`initial_state_hash`, ordered `operations`, `checkpoint`, and `final_state_hash`.

Each operation SHALL contain a zero-based sequence, required `post_state_hash`, and
exactly one of:

- `{kind: "action", action: <complete semantic action>}` for accepted state-changing
  actions, including explicit rewind/restart/settle; or
- `{kind: "advance", ticks: <nonnegative integer>}` for every simulation advance that
  applied at least one queued tick.

The checkpoint SHALL contain operation count, complete canonical state, and its hash so
the shell can restore interruption state. The replay SHALL contain no frame times,
wall-clock timestamps, focus events, raw text, device identifiers, or personal data.
Serialized replay/checkpoint size SHALL be at most 64 KiB.

`restore_replay()` SHALL validate all fields and version compatibility, regenerate the
initial state from the seed, replay operations through the public action/simulation
paths, compare every available checkpoint/final hash, and mutate the live state only
after complete validation. It SHALL return false and retain prior state on any mismatch,
unknown operation, malformed action, impossible sequence, or unsupported version.

#### Scenario: Replay is restored on a fresh instance

- **WHEN** a fresh version `0.1.0` instance restores a valid replay saved during any
  logical tick or decision phase
- **THEN** its observation, available actions, objectives, metrics, operation log, and
  state hash SHALL exactly equal the saved checkpoint

#### Scenario: Replay hash is altered

- **WHEN** any replay operation, checkpoint value, or state hash is altered
- **THEN** restore SHALL return false
- **AND** the receiving instance SHALL retain its complete pre-restore state

### Requirement: Interactive tutorial proves clarity

The first-run tutorial SHALL use the same canonical transition and semantic action
paths as main play and SHALL contain exactly three skippable, replayable stages:

1. change one pulse, predict one property's direction, preview, commit, and observe the
   six-tick trace on a single cell;
2. compare an order-sensitive two-pulse fixture, make a structured prediction before
   preview, and recover from one deliberately nonqualifying edit; and
3. choose between at least two valid edits on a complete 3-by-3 fixture, activate two
   disclosed intents, and settle.

Each stage SHALL introduce a maximum of one new control and one new rule before the
player acts. Required instructions SHALL be present beside the affected control, not
only in a manual or modal. The tutorial SHALL accept retries without penalty, permit
skip at any point, and remain accessible from settings. Main play SHALL not rely on
remembering hidden tutorial text; pulse rules and intent predicates SHALL remain
inspectable.

#### Scenario: New player completes the tutorial without opening help

- **WHEN** the player follows visible in-context controls through all three stages
- **THEN** each stage objective SHALL be achievable through the same action and tick
  rules used in main play
- **AND** completion SHALL unlock no power or reward beyond marking the tutorial seen

#### Scenario: Player skips the tutorial

- **WHEN** `skip-tutorial` is applied
- **THEN** main play SHALL become available immediately
- **AND** all public rules, replay tutorial option, access settings, and recovery
  controls SHALL remain available

### Requirement: Noncoercive progression and local keepsakes

Progression SHALL consist only of a local versioned record of tutorial state, scenarios
seen/settled, disclosed difficulty tier, best qualifying edit length per scenario, and
structured keepsakes containing final semantic patterns plus seed/action provenance.
It SHALL NOT contain currency, consumables, power upgrades, login rewards, daily gates,
streaks, scarcity, push notifications, rankings, social comparison, or penalties for
absence.

All eight base scenarios SHALL be selectable through an `unlock-all` access setting.
Without that setting the UI MAY recommend the next tier after one settled scenario in
the current tier, but SHALL permit the player to replay, stop, or reveal all scenarios
without grinding. Deleting a keepsake SHALL not affect scenario access or metrics.

#### Scenario: Player returns after an absence

- **WHEN** the player launches after any elapsed wall-clock interval
- **THEN** no streak, missed reward, decayed state, or urgency message SHALL appear
- **AND** the last valid checkpoint and all previously selectable scenarios SHALL remain
  available

### Requirement: Accessible and equivalent interaction

The pack SHALL provide the same complete decisions and outcomes through touch,
pointer, keyboard, and controller. It SHALL use discrete focusable controls with a
minimum target of 48 by 48 logical pixels; a visible focus indicator; deterministic
focus order; no hover-only, drag-only, multi-touch, held, repeated, or simultaneous
input; and remappable Godot input actions. Equivalent semantic action sequences from
all input families SHALL produce identical state hashes.

The UI SHALL:

- reflow without horizontal clipping from 320-by-568 portrait through 2560-by-1440
  landscape, respect safe areas, and support 100–200% text scale;
- meet at least 4.5:1 text and 3:1 nontext/control contrast in every palette;
- encode pulse, rule, property, awake, intent, selection, error, and focus through text
  and shape in addition to color;
- convey no required information through audio, vibration, animation, or motion;
- provide captions for any meaningful optional speech, though version `0.1.0` SHALL
  contain no speech;
- provide reduced-motion and instant-resolution modes, no camera shake/parallax, and
  no flashing pattern or transition above three flashes per second;
- provide a linear cell-state list, stepwise preview trace, persistent rule glossary,
  adjustable animation speed including instant, and `unlock-all` as assists; and
- impose no decision timer, dexterity test, limited hint currency, or failure penalty.

Assists SHALL expose state and causality but SHALL NOT choose an edit, change pulse
rules, silently solve an intent, or make evaluation runs indistinguishable from default
rules; active assist identifiers SHALL be observable and recorded in telemetry/replay
metadata outside the canonical decision state.

#### Scenario: Input families apply the same plan

- **WHEN** touch, pointer/keyboard, and controller runs apply the same semantic plan to
  the same seed
- **THEN** accepted/rejected action results, tick states, objective result, replay, and
  final state hash SHALL match exactly

#### Scenario: Required modalities are removed

- **WHEN** the game runs sound-off, haptics-off, reduced-motion, high-contrast, and 200%
  text modes
- **THEN** every rule, intent, state change, failure reason, control, and settlement
  choice SHALL remain perceivable and operable

### Requirement: Minimal versioned gameplay telemetry

The pack SHALL emit only SDK schema-version-1 events from this allowlist:

| Event                     | Allowed properties in addition to common fields                                         |
| ------------------------- | --------------------------------------------------------------------------------------- |
| `game-session-started`    | `mode`, `scenario_id`, `tier`, `input_family`, `assist_ids`                             |
| `tutorial-step-completed` | `step`, `attempts`, `prediction_correct`, `skipped`                                     |
| `pulse-edit-set`          | `commit_index`, `slot`, `from_pulse`, `to_pulse`, `state_hash`                          |
| `prediction-recorded`     | `commit_index`, `tick`, `cell`, `property`, `direction`                                 |
| `measure-previewed`       | `commit_index`, `source_hash`, `preview_hash`, `active_intent_count`                    |
| `measure-committed`       | `commit_index`, `source_hash`, `pending_measure_hash`                                   |
| `logical-tick-applied`    | `commit_index`, `tick_in_measure`, `pulse`, `state_hash`                                |
| `measure-resolved`        | `commit_index`, `final_hash`, `active_intent_ids`, `logical_tick`, `solver_distance`    |
| `recovery-used`           | `kind`, `reason`, `commit_index`, `state_hash`                                          |
| `scenario-settled`        | `scenario_id`, `active_intent_ids`, `commits_used`, `rewinds`, `previews`, `final_hash` |
| `game-session-exited`     | `phase`, `settled`, `commits_used`, `logical_tick`, `state_hash`                        |
| `access-setting-changed`  | `setting_id`, `enabled`                                                                 |

Every event SHALL include common properties `game_id`, `game_version`,
`scenario_library_version`, zero-based per-reset `event_sequence`, and SHALL use the
SDK-provided `game_seed`. Enum and identifier values SHALL come from the versioned
allowlists above. The pack SHALL NOT emit name, email, account or advertising ID,
stable player/session ID, IP address, location, contact, raw/free text, raw input
gesture, accessibility diagnosis, device fingerprint, external URL, wall-clock
timestamp, or cross-game profile. The shell SHALL own consent, collection, transport,
retention, and deletion; lack of telemetry consent SHALL not alter play or local save.

#### Scenario: Same deterministic run emits gameplay events

- **WHEN** two instances execute the same seed, accepted semantic actions, and
  simulation advances with the same declared input/assist metadata
- **THEN** their ordered event names and allowed gameplay properties SHALL match
- **AND** no telemetry delivery outcome SHALL change game state

#### Scenario: Event includes an undeclared property

- **WHEN** an event contains a property outside its event and common allowlists
- **THEN** the telemetry contract test SHALL fail
- **AND** the event SHALL not be silently accepted or relabeled

### Requirement: Save, interruption, and version behavior

The pack SHALL request shell persistence only through its `local-save` capability and
the replay/checkpoint interface. It SHALL never call `FileAccess`, `DirAccess`, browser
storage, mobile storage, or a network service for player state. It SHALL produce a valid
checkpoint after every accepted state-changing action, every applied logical tick,
settlement, tutorial step, and progression-record change.

Restoring the same immutable game version SHALL return to the exact decision or
resolution boundary. Starting a different game version SHALL use a version-scoped save
key, preserve but not mutate the older save, and start from that version's own valid
state unless an explicit, separately specified migration exists. Version `0.1.0` SHALL
define no cross-version migration.

#### Scenario: Process is killed after a logical tick

- **WHEN** the shell has persisted the latest valid checkpoint and the process restarts
- **THEN** restoring version `0.1.0` SHALL reproduce that tick, pending resolution,
  available actions, objectives, metrics, and state hash exactly

#### Scenario: Local storage is denied or full

- **WHEN** the shell cannot persist a checkpoint
- **THEN** current in-memory play SHALL continue
- **AND** the UI SHALL disclose that this session may not resume
- **AND** the pack SHALL NOT request identity, network, or direct storage as a fallback

### Requirement: Performance and artifact budgets

Version `0.1.0` SHALL satisfy all of these budgets on the reference profiles fixed in
`eval-plan.md`:

- PCK size at or below 8 MiB and no individual runtime asset above 2 MiB;
- from already-mounted entry instantiation to first operable control at or below 1.0 s
  native and 2.0 s web at p95 over 10 cold instances;
- steady decision-screen frame time at or below 16.7 ms p95 and 33.3 ms maximum over a
  60 s trace, including 200% text and reduced-motion variants;
- canonical `apply_action` at or below 4 ms p95, one logical pulse tick at or below 2 ms
  p95, full six-tick preview at or below 12 ms p95, and bounded solver query at or below
  50 ms p95 over every shipped scenario/transform, each over at least 100 repetitions;
- peak resident memory increase after pack load at or below 96 MiB over the player-app
  baseline;
- serialized replay/checkpoint at or below 64 KiB after the maximum six commits; and
- zero network requests, uncaught errors, ignored failed operations, or frame-dependent
  gameplay state changes during core-play evaluation.

If the solver exceeds its synchronous budget, the UI MAY calculate asynchronously but
SHALL disable commit with an explicit `solver-pending` reason, preserve input
responsiveness, and produce the same deterministic result. It SHALL NOT guess or omit a
recovery result.

#### Scenario: Worst shipped scenario is profiled

- **WHEN** the declared worst-case scenario and transform run with maximum preview,
  solver, text-scale, and trace load
- **THEN** every applicable size, latency, frame, memory, and save budget SHALL pass
- **AND** any unavailable measurement or failure SHALL be reported rather than ignored

### Requirement: Player-value and safety boundary

Version `0.1.0` SHALL describe its promise as a bounded pattern-and-causality game. It
SHALL NOT claim or imply relaxation treatment, stress reduction, mindfulness therapy,
cognitive training/improvement, education, real ecological restoration, diagnostic
value, or benefit from longer/more frequent play. It SHALL not display session-length
goals, streaks, urgency, scarcity, randomized rewards, loss aversion, or notifications.

The UI SHALL present `settle` as a complete valid ending whenever two intents are
active, preserve an always-visible pause/exit path, and avoid rewarding continued play
after a valid settlement. External player studies SHALL recruit adults for this first
change unless a later accepted safeguarding/privacy plan expands the audience.

#### Scenario: Player reaches a valid stopping point

- **WHEN** two intents become active
- **THEN** settlement and exit SHALL be visible without a countdown or continuation
  reward
- **AND** telemetry/evaluation SHALL treat desired-versus-actual duration and exit
  agency as protected countermetrics rather than optimize time played

#### Scenario: Player-value evidence is absent

- **WHEN** only contract, synthetic policy, or model-authored evidence exists
- **THEN** the game SHALL NOT be described as enjoyable, restorative, accessible to an
  affected population, or catalog-qualified
- **AND** independent human evidence gates in `eval-plan.md` SHALL remain unsatisfied
