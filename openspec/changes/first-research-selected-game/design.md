# Design: Mossbound Measures 0.1.0

## Decision summary and fixed boundaries

Mossbound Measures is a deterministic, turn-based pattern game for an initial adult
evaluation cohort. The player changes one slot in a six-pulse future measure, predicts
and previews how that order transforms a small field of integer states, commits the six
logical ticks, and may settle as soon as two of three public spatial intents are true.
The player promise is a bounded interval of understandable mastery and a self-chosen
ending. It is not a health, education, ecology, collection, or retention claim.

This design implements the selected C02 thesis from
[selection.md](selection.md#selected-concept-and-boundary) and the observable deltas in
[the game spec](specs/mossbound-measures/spec.md) and
[the player-app delta](specs/single-player-app/spec.md). The fixed runtime boundaries
are:

- Godot `4.7.1`, Compatibility renderer, typed GDScript, Nofi SDK `0.1.0`;
- pack ID `mossbound-measures`, pack version `0.1.0`, minimum player app `0.1.0`;
- one data-only entry scene and attached `NofiGamePack` script under the unique pack
  namespace;
- only `local-save`; no network, identity, haptics, native extension, monetization,
  social feature, public UGC, live generation, or separate application;
- deterministic integer gameplay, explicit simulation ticks, semantic actions,
  canonical replay, and shell-owned persistence; and
- nondiscoverable candidate status until independent evidence and a later decision.

The builder is not authorized to substitute mechanics, tune thresholds, add content,
change the audience, or make product/evaluation decisions. Any ambiguity that would
alter these boundaries returns to a high-judgment task.

## Player experience

### First ten minutes

1. The pack opens on a quiet static field, a six-slot measure, and two visible actions:
   “Try the three-step guide” and “Start a measure.” Neither choice is time-limited.
2. The guide teaches by action. It first asks the player to replace one pulse and make
   a structured prediction, then shows the exact six-tick trace. It next contrasts
   `rain → wind` with `wind → rain`. Its final fixture uses the complete loop and ends
   only after the player activates two intents and chooses Settle.
3. Main play displays three intent cards, every pulse rule, and every cell's three
   integer properties. The player selects one slot and replacement pulse. A pending
   edit does not mutate the field.
4. Preview expands into six discrete columns. Each changed property has a signed
   integer delta and text label. The player may inspect, revise the same slot, clear it,
   or commit.
5. Commit resolves only through six explicit logical ticks. Animated mode steps through
   them; instant/reduced-motion mode requests the same six ticks without transition
   motion. Intent cards update only after tick six.
6. When two intents are true, Settle becomes the primary non-flashing action and the
   copy reads: “This measure is complete. Settle now, or make up to two optional edits.”
   The optional path grants no unlock, score multiplier, or better save state.
7. Settlement shows the final semantic pattern, the two or three satisfied intent
   names, the seed, and a compact action strip. “Keep in notebook,” “play another,” and
   “exit” have equal visual weight. The notebook remains local and is not a feed.

### Tone and representation

Version `0.1.0` uses abstract mosslike cushions as a metaphor for state, never species,
real ecosystems, restoration, healing, mindfulness, or “brain training.” Copy uses
“awake/dormant,” “moisture,” “warmth,” “charge,” “pulse,” “intent,” and “measure” only
as fictional system vocabulary. A persistent glossary states each exact predicate.

There is no speech or required audio. Visual response uses Godot-drawn flat shapes,
gentle opacity changes when motion is enabled, and a static update when it is not. No
external bitmap, font, music, sound, character, dataset, or generated expressive asset
is required. This bounds provenance and avoids making art similarity the concept's
identity.

## Rules, state, actions, and objectives

### Canonical model

`MossModel` is a `RefCounted` domain object with no scene-tree, rendering, input, audio,
storage, telemetry-transport, or wall-clock dependency. It contains only booleans,
signed integers, strings from fixed enums, arrays, and dictionaries with these records:

```text
CellState = {
  index: int, x: int, y: int,
  rule: "dew" | "glow" | "drift" | "hush",
  moisture: int[0..3], warmth: int[0..3], charge: int[0..3],
  awake: bool
}

IntentState = {
  id: string,
  type: "bridge-horizontal" | "bridge-vertical" | "ring" | "refuge",
  x: int?, y: int?, involved_cells: Array[int],
  description_key: string, active: bool, first_failing_clause: string
}

PendingEdit = {slot: int[0..5], from_pulse: Pulse, to_pulse: Pulse} | null
Prediction = {tick: int[0..5], cell: int, property: Property, direction: Direction} | null
RewindSnapshot = {canonical_state_before_commit_without_history: Dictionary} | null
```

The top-level state includes all fields required by the game specification in this
stable order: schema/version provenance; scenario provenance; mode/tier; dimensions;
cells; measure; pending edit; prediction; preview trace/hash; phase; resolution queue
and tick; counters/history; intents/objectives; progression/settlement projection;
accepted-operation sequence; state hash. Presentation/access and telemetry-event
sequence are adjacent session metadata, not gameplay state. Rejected-action diagnostics
and unavailable-operation logs are also adjacent evidence metadata: they may increment
after a rejected call without changing the canonical state hash, accepted-action
sequence, objectives, or replay.

Canonical serialization recursively sorts dictionary keys in Unicode code-point order,
preserves array order, uses JSON lowercase booleans/null and base-10 integers with no
leading zero, escapes strings using JSON rules, and rejects floats or unsupported
variants. The serializer omits `state_hash`, preview display cache, and presentation
metadata before SHA-256. `HashingContext.HASH_SHA256` produces 64 lowercase hexadecimal
characters. All tests compare canonical bytes as well as the hash.

### Pulse and awake rules

The normative transition table is in the spec. Implementation uses one pure function:

```text
transition_cell(pre_tick_cell, pulse) -> post_tick_properties
```

It reads only the pre-tick tuple. The engine maps it over the row-major cell array,
creates a new array, then derives awake values in a second pass. It never mutates a cell
while another cell for the same tick is being read. Awake derivation never changes a
property. Intent evaluation runs after awake derivation at tick six only, while preview
also records intermediate awake masks for explanation.

### Intent evaluation

- Bridge evaluation is breadth-first search over awake cells with neighbor order
  north, east, south, west; the order affects only stable failure explanation, not the
  Boolean result.
- A ring names an interior coordinate. Its center must be dormant and at least three of
  north/east/south/west must be awake.
- A refuge names the upper-left coordinate of a 2-by-2 square. At least three of its
  four cells must be awake.
- `first_failing_clause` checks requirements in this order: valid geometry, required
  dormant center for ring, awake-count threshold, bridge start edge, bridge connectivity,
  bridge destination edge. It names facts, never a recommended edit.

### Phase machine

| Current phase                  | Accepted state-changing actions                                                                       | Result                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `tutorial`                     | fixture-valid actions, `skip-tutorial`, pause                                                         | Advances only the active tutorial objective or enters main setup    |
| `editing` without pending edit | `set-pulse`, `restart-scenario`, pause                                                                | Creates one pending edit or resets                                  |
| `editing` with pending edit    | same-slot `set-pulse`, `record-prediction`, `clear-edit`, `commit-measure`, `restart-scenario`, pause | Revises/clears metadata or queues six ticks                         |
| `resolving`                    | no semantic decision; only `advance_simulation`, pause                                                | Applies zero to six controlled ticks                                |
| `qualified`                    | editing actions, `settle-measure`, `rewind-commit`, restart, pause                                    | Settles, starts an optional edit, or restores one decision boundary |
| `recovery`                     | `rewind-commit`, `restart-scenario`, pause                                                            | Restores the last decision boundary or seed                         |
| `settled`                      | `restart-scenario`, pause                                                                             | Preserves result or begins the same seed anew                       |
| `paused`                       | `resume-game`, `restart-scenario`                                                                     | Returns to the prior phase or resets                                |

`preview-measure` and `inspect-cell` are accepted read-only actions in any nonresolving,
nonsettled editing/qualified phase where their parameters are valid. They never change
the state hash. `record-prediction` may be replaced before preview but becomes immutable
for that commit after preview. Invalid actions never advance action/event sequence.

### Commit and budget rules

- `commit_index` is zero-based before commit and `commits_used` becomes one higher only
  after tick six completes.
- Before queueing, the exact precommit canonical state becomes the one-depth rewind
  snapshot. Commit phase changes to `resolving`, resolution index becomes 0, and the
  pending measure is fixed.
- Each applied tick increments both resolution index and global logical tick. Tick six
  atomically installs the preview-equivalent state, clears edit/prediction/preview,
  evaluates intents, increments commits, and queries the bounded solver.
- Before first qualification, a fifth commit is never available. At first
  qualification, `first_qualified_commit = commits_used`; the maximum future commit
  count is that value plus two.
- Two active intents set phase `qualified`; zero or one active intent sets `editing`
  only when the solver proves qualification remains reachable in budget. Otherwise the
  phase is `recovery`.
- Rewind restores every gameplay field from the snapshot, appends one explicit replay
  operation, increments session rewind metrics, and clears the snapshot. A newly
  committed measure creates the next snapshot, so the player may learn through repeated
  one-depth rewinds without accumulating an arbitrary history.
- Restart recreates the full seed state and progression projection, retains only
  per-session attempt/restart metrics, and appends an explicit replay restart operation.

### Semantic controls

`main.gd` maps UI events to the exact action dictionaries below. The model is never
called directly by a Control node.

| Action                       | Exact parameter object                                  | Preconditions                                                                            |
| ---------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `set-pulse`                  | `{id, slot: 0..5, pulse: Pulse}`                        | editing/qualified; no pending edit or same slot; replacement differs                     |
| `record-prediction`          | `{id, tick: 0..5, cell: valid index, property: moisture | warmth                                                                                   | charge, direction: increase | decrease | same}` | pending edit, before preview |
| `preview-measure`            | `{id}`                                                  | pending edit                                                                             |
| `clear-edit`                 | `{id}`                                                  | pending edit                                                                             |
| `commit-measure`             | `{id}`                                                  | pending edit, not solver-pending, budget remains                                         |
| `rewind-commit`              | `{id}`                                                  | rewind snapshot exists, not resolving                                                    |
| `restart-scenario`           | `{id}`                                                  | any phase except currently applying a tick; resolving restart queues until tick boundary |
| `settle-measure`             | `{id}`                                                  | at least two active intents, not resolving                                               |
| `inspect-cell`               | `{id, cell: valid index}`                               | nonresolving; read-only                                                                  |
| `skip-tutorial`              | `{id}`                                                  | tutorial only                                                                            |
| `pause-game` / `resume-game` | `{id}`                                                  | not already in target pause state                                                        |

The manifest lists exactly these identifiers. `get_available_actions()` returns one
concrete dictionary for every currently valid parameter combination: 18 `set-pulse`
dictionaries before an edit, the three same-slot replacements after an edit, all valid
structured prediction combinations before preview, one `inspect-cell` per cell, and
each valid parameterless action. Observation also publishes the compact parameter
schemas. This exact enumeration satisfies the current validator and leaves no
representation choice to the builder.

## Scenario library and deterministic content

### Compact encoding

Scenario-library version 1 contains eight immutable base records. A cell token is
`rule:mwc`, where `m`, `w`, and `c` are single digits for moisture, warmth, and charge.
Tokens are row-major. An intent token is `bh`, `bv`, `rXY`, or `qXY` for horizontal
bridge, vertical bridge, ring center `(X,Y)`, or refuge upper-left `(X,Y)`. A witness
step `S:P` means set slot `S` to pulse `P`, commit, and advance exactly six ticks.

The `states 0/1/2` field is the cumulative number of unique solver projections—cell
properties, six pulses, and active-intent bits—found by a deterministic breadth-first
authoring check after zero, one, and two commits. It is a compact baseline, not a
runtime acceptance substitute. Builder tests must reproduce each count and exhaust the
specified four-commit bound.

### Exact base records

#### S0 — tier 0, 3 by 3

- Measure: `sun, still, wind, sun, wind, still`
- Intents: `q11`, `bh`, `r11`
- Cells: `drift:012 dew:333 glow:113 / dew:113 dew:013 hush:121 / hush:311 drift:113 drift:101`
- States 0/1/2: `1 / 19 / 327`
- Witness A: `0:rain > 1:rain` → `q11 + bh`, mask `000001111`
- Witness B: `3:rain > 0:wind` → `q11 + r11`, mask `110001011`

#### S1 — tier 0, 3 by 3

- Measure: `rain, sun, sun, rain, sun, wind`
- Intents: `bv`, `q00`, `bh`
- Cells: `drift:321 hush:210 hush:003 / drift:113 drift:003 glow:120 / hush:230 glow:212 drift:220`
- States 0/1/2: `1 / 19 / 312`
- Witness A: `1:rain` → `bv + q00`, mask `110110100`
- Witness B: `1:still` → `bv + q00`, mask `010110100`

#### S2 — tier 0, 3 by 3

- Measure: `still, wind, wind, sun, rain, still`
- Intents: `bh`, `bv`, `r11`
- Cells: `drift:320 glow:130 drift:320 / glow:003 drift:231 dew:032 / hush:120 glow:133 hush:300`
- States 0/1/2: `1 / 19 / 323`
- Witness A: `5:sun` → `bh + bv`, mask `111010010`
- Witness B: `0:rain > 4:sun` → `bh + bv`, mask `111110111`

#### S3 — tier 1, 3 by 3

- Measure: `rain, wind, still, sun, wind, wind`
- Intents: `bh`, `bv`, `r11`
- Cells: `dew:222 hush:333 glow:220 / dew:020 drift:022 drift:233 / dew:311 dew:122 dew:210`
- States 0/1/2: `1 / 19 / 322`
- Witness A: `3:rain > 4:rain` → `bh + bv`, mask `100100111`
- Witness B: `3:still > 4:still` → all three, mask `110100111`

#### S4 — tier 1, 3 by 3

- Measure: `wind, rain, still, rain, still, still`
- Intents: `bh`, `bv`, `r11`
- Cells: `hush:122 hush:010 hush:223 / hush:032 drift:232 hush:313 / hush:003 glow:222 glow:220`
- States 0/1/2: `1 / 19 / 248`
- Witness A: `2:wind > 5:sun` → all three, mask `111101100`
- Witness B: `4:sun > 5:wind` → `bh + bv`, mask `111111100`

#### S5 — tier 1, 3 by 3

- Measure: `sun, wind, rain, wind, still, sun`
- Intents: `bh`, `bv`, `r11`
- Cells: `hush:223 hush:223 dew:120 / glow:022 hush:033 drift:211 / glow:300 glow:133 glow:333`
- States 0/1/2: `1 / 19 / 328`
- Witness A: `1:rain` → `bh + bv`, mask `110110011`
- Witness B: `3:rain` → `bh + bv`, mask `111010011`

#### S6 — tier 2, 4 by 4

- Measure: `still, wind, wind, wind, sun, still`
- Intents: `r11`, `q12`, `bh`
- Cells: `dew:123 glow:023 glow:000 dew:232 / glow:320 hush:032 drift:002 glow:312 / drift:020 glow:221 glow:233 dew:132 / glow:131 dew:130 glow:111 dew:223`
- States 0/1/2: `1 / 19 / 335`
- Witness A: `3:sun` → `r11 + q12`, mask `0100100101101010`
- Witness B: `0:rain > 3:sun` → `r11 + q12`, mask `0110100101101010`

#### S7 — tier 2, 4 by 4

- Measure: `still, wind, sun, rain, rain, still`
- Intents: `q01`, `r11`, `bv`
- Cells: `hush:222 dew:102 drift:212 dew:312 / hush:120 glow:313 drift:000 drift:211 / dew:112 hush:211 glow:302 glow:223 / dew:100 drift:212 dew:330 glow:013`
- States 0/1/2: `1 / 19 / 318`
- Witness A: `0:rain > 5:sun` → `q01 + r11`, mask `0101100011001010`
- Witness B: `0:sun > 4:wind` → `q01 + bv`, mask `1010110101010101`

The scenario data above was derived against the normative transition in a temporary
offline enumerator. It is accepted planning input only after the builder reproduces the
counts, witnesses, transforms, and exhaustive reachability using shipped tests. Any
mismatch is a failed plan assumption to escalate, not a license to tune records.

### Exact tutorial fixtures

| Stage                 | Dimensions/cells     | Initial measure                         | Required interaction and expected fact                                                                                                                                                      |
| --------------------- | -------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1 property transfer  | 1×1; `dew:010`       | `sun, wind, still, still, still, still` | Guided `0:rain`; predict moisture `increase`; tick 0 becomes `100`; preview and commit use identical six ticks.                                                                             |
| T2 order and recovery | 1×1; `dew:010`       | `wind, wind, sun, sun, sun, sun`        | Choice `0:rain` gives tick-2 `001`; choice `1:rain` gives tick-2 `100`. The first deliberately wrong prediction is retryable through clear/rewind with no penalty.                          |
| T3 full settlement    | Exact S0 base record | Exact S0 measure/intents                | Present both first steps `0:rain` and `3:rain` as nonprescriptive examples after player inspection; permit either witness family, require two active intents, then require explicit Settle. |

T1 and T2 do not expose production intents or progression. Their objective is the named
structured fact. T3 uses the complete production phase/action/objective path and tags
its keepsake as tutorial-only so it does not affect main metrics.

### Seed mapping and transforms

`reset_game(seed)` performs exactly this operation sequence with one fresh Godot
`RandomNumberGenerator`:

1. assign the signed 64-bit `seed` to `rng.seed`;
2. `base_index = rng.randi_range(0, 7)`;
3. `transform_id = rng.randi_range(0, 7)`;
4. Fisher–Yates shuffle the three intent display records for `i = 2` then `1`, drawing
   `j = rng.randi_range(0, i)` each time;
5. `palette_id = rng.randi_range(0, 2)` for presentation metadata only.

For square size `n`, coordinate transforms are:

|  ID | `(x, y)` becomes |
| --: | ---------------- |
|   0 | `(x, y)`         |
|   1 | `(n-1-y, x)`     |
|   2 | `(n-1-x, n-1-y)` |
|   3 | `(y, n-1-x)`     |
|   4 | `(n-1-x, y)`     |
|   5 | `(n-1-y, n-1-x)` |
|   6 | `(x, n-1-y)`     |
|   7 | `(y, x)`         |

Cells retain properties/rules and move to the transformed coordinate. Ring centers are
transformed directly. For refuge, transform its four cells and use the minimum
transformed x/y as the new upper-left. For bridges, transform the two source/destination
edge sets; left/right remains horizontal, top/bottom remains vertical, and quarter-turn
or diagonal reflection swaps the type. Intent display order never changes predicates.
Scenario ID is `mm1-s<base_index>-d<transform_id>`.

Replay stores the complete transformed initial canonical state, so a replay remains
inspectable even if a later immutable pack version uses another RNG algorithm. Version
`0.1.0` replays only against Godot `4.7.1` and library 1; there is no migration.

### Runtime solver

The solver uses deterministic breadth-first search from a decision-boundary state:

1. Return distance 0 if two intents are active.
2. Queue the canonical gameplay projection with depth 0; deduplicate on packed cell
   properties, six pulses, and active intent bits (rules/intent definitions are fixed by
   scenario).
3. Expand slot 0 through 5, then pulse order `rain`, `sun`, `wind`, `still`, skipping the
   current pulse. Each edge applies one edit and all six pure ticks without presentation.
4. On first qualifying state, record minimum distance but continue the frontier when an
   exhaustive diversity/reachability test requests it. Runtime recovery may return at
   the first minimum; proving “none” exhausts the budget.
5. Stop expanding at the remaining commit budget. Cache by `(state_hash, budget,
scenario_library_version)` and clear only on version change.

The solver never appears in observation as a solution. Observation exposes only its
minimum distance and no-reach reason after calculation. It runs synchronously while
under 16 ms; otherwise it yields between fixed frontiers, sets `solver-pending`, disables
commit with that reason, and remains below the 50 ms p95 total budget. Async scheduling
may change presentation timing only; result and expansion order remain fixed.

## Progression and content

- Tier 0 is S0–S2, tier 1 is S3–S5, and tier 2 is S6–S7. The recommended next tier
  appears after one settlement in the current tier.
- All tiers are always available through `unlock-all`; no content requires repetition,
  optimal play, all-three settlement, a streak, elapsed time, account, or payment.
- The local notebook stores up to 64 keepsakes in insertion order. On the 65th, the UI
  asks the player to delete one or decline saving; it never silently evicts. A keepsake
  contains game/library version, seed, scenario/transform, final semantic cells,
  active intents, accepted operation strip, state hash, and optional palette ID. It
  contains no player-authored text.
- “Best qualifying edit length” is shown as personal prior context only after settlement
  and has no leaderboard or prompt to improve. The setting `hide-efficiency` removes it.
- There is no daily scenario. “Another measure” draws a new seed from shell-provided
  evaluation/session context or permits explicit seed entry in developer mode; core
  gameplay does not read wall-clock date.

## Accessibility and input

### Visual system

The three built-in palettes use these fixed sRGB values:

| Role            | Meadow    | Dusk      | High contrast |
| --------------- | --------- | --------- | ------------- |
| Background      | `#11150F` | `#15131B` | `#000000`     |
| Panel           | `#20271C` | `#272231` | `#101010`     |
| Primary text    | `#F3F7ED` | `#F7F2FF` | `#FFFFFF`     |
| Secondary text  | `#C5CEBC` | `#CDC3D9` | `#FFFFFF`     |
| Focus/selection | `#FFD166` | `#79D7FF` | `#00FFFF`     |
| Error/recovery  | `#FF8C82` | `#FF9B9B` | `#FFBF00`     |

Automated contrast tests calculate the spec ratios for every foreground/background
pair. Color is redundant:

- pulses: rain downward drop + “Rain”; sun eight-ray circle + “Sun”; wind three offset
  horizontal strokes + “Wind”; still outlined square + “Still”;
- rules: dew droplet, glow star, drift spiral, hush concentric circle, always with text;
- properties: `M`, `W`, `C` plus full accessible labels and integer values;
- awake: double border plus the word “Awake”; dormant: single border plus “Dormant”;
- intents: shape diagram, involved cell indices, predicate text, and pass/fail label.

All icons are drawn from Godot primitives in pack code. They are not stored bitmaps or
copied symbols.

### Layout

- At widths below 720 logical pixels, one vertical `ScrollContainer` orders header,
  intents, field, measure, pending edit/preview, then toolbar. The measure slots are a
  3-by-2 grid at 320 px and a 6-by-1 row when at least 480 px fits. No horizontal scroll
  is used.
- At widths 720 and above, the field/intents occupy the left 52% and measure/trace/actions
  the right 48%. Both panes may scroll vertically at 200% text.
- Safe-area insets add to a 16 px outer margin. Controls have at least 48×48 logical
  pixels and 8 px separation. Field cells have a minimum 64 px visual size at default
  text; the linear list becomes the primary representation when cells would be smaller.
- Focus order follows visible reading order. Opening a preview moves focus to its heading;
  closing returns to the originating pulse slot. Errors focus the inline reason, then
  return on dismissal. No focus trap is permitted.

### Input equivalence

| Semantic operation | Touch/pointer                     | Keyboard default        | Controller default    |
| ------------------ | --------------------------------- | ----------------------- | --------------------- |
| Navigate/focus     | tap/click target                  | arrows or Tab/Shift+Tab | D-pad                 |
| Activate/select    | tap/click                         | Enter/Space             | south/A               |
| Cancel/back/pause  | visible Back/Pause                | Escape                  | east/B                |
| Preview            | visible Preview                   | `P`                     | west/X                |
| Commit             | visible Commit                    | `C`                     | north/Y               |
| Clear/rewind       | visible context action            | `Z`                     | left shoulder         |
| Settle             | visible Settle                    | `S`                     | right shoulder        |
| Restart            | visible Restart in pause/recovery | `R`                     | hold-free menu action |

Defaults are remappable through project input actions. No semantic operation depends on
the shortcut; every one is focusable. Gamepad axis input is thresholded only for focus
navigation and cannot affect model values. Pointer hover previews nothing that keyboard
focus does not also expose. Touch uses no swipe, pinch, drag, long press, or multitouch.

### Access settings

`text_scale` (100/125/150/175/200), `reduced_motion`, `instant_resolution`,
`high_contrast`, `linear_cell_list`, `persistent_trace`, `hide_efficiency`, and
`unlock_all` are local shell-owned preferences. The pack receives values but no medical
or disability label. Settings alter layout/presentation/progression visibility only and
are included as declared evaluation metadata. A fresh evaluator tests the default and
adversarial combinations.

## SDK, persistence, telemetry, and replay

### Pack file structure

The bounded builder creates exactly this game-owned structure through the repository
template, plus Godot-generated UID sidecars where the engine requires them:

```text
games/candidates/mossbound-measures/
  README.md                  # controls, access, local reproduction, provenance
  game-pack.json
  project.godot
  game_packs/mossbound_measures/
    main.tscn                 # one Node, no script
    main.gd                   # attached by player; extends NofiGamePack
    domain/model.gd
    domain/rules.gd
    domain/scenario_library.gd
    domain/solver.gd
    domain/canonical_json.gd
    domain/replay_codec.gd
    ui/game_view.gd
    ui/game_theme.gd
  tests/run_tests.gd
  tests/run_scenario_tests.gd
  tests/run_replay_tests.gd
  tests/run_ui_tests.gd
```

`main.gd` owns the domain model, maps the SDK methods, emits local gameplay events, and
instantiates one programmatic `GameView`. UI code receives immutable observations and
dispatches action dictionaries; it never edits model fields. Rules/solver/replay files
import no UI class. Tests exercise domain files without rendering, then the attached
entry script through `NofiContractValidator`.

The builder does not edit generated SDK copies under the game. If an SDK defect blocks
the specified contract, it stops and escalates; this change does not authorize a new SDK
surface.

### SDK mapping

| SDK method/signal           | Mossbound implementation                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `reset_game(seed)`          | Create the exact seeded library state, clear replay/session metrics, emit session start, render observation               |
| `get_observation()`         | Deep duplicate of canonical/public state and access metadata; no solver witnesses                                         |
| `get_available_actions()`   | Phase-filtered identifiers and parameter domains/instances                                                                |
| `apply_action(action)`      | Validate exact schema, dispatch model transition, emit allowlisted event, request view refresh, return hashes/observation |
| `advance_simulation(ticks)` | Apply queued logical ticks only, emit one `logical-tick-applied` per tick and `measure-resolved` at tick six              |
| `get_objectives()`          | Required/optional/tutorial objective records                                                                              |
| `get_metrics()`             | Deterministic counters and solver distance from model/session metrics                                                     |
| `save_replay()`             | Versioned operation log plus latest complete checkpoint, ≤64 KiB                                                          |
| `restore_replay(replay)`    | Validate into a temporary model, replay public paths, compare hashes, atomically swap only on success                     |
| `telemetry_emitted`         | Existing local signal carrying only the allowlisted event envelope; shell decides persistence/transport                   |

### Replay and save flow

Replay records only accepted state-changing actions and advances that apply at least one
tick. Read-only previews are deterministic metrics/events but are not required to
reconstruct canonical gameplay; their counts and prediction metadata are contained in
the checkpoint model. To make checkpoint verification exact, the replay codec compares
the regenerated canonical state after each operation to the required operation
`post_state_hash`.

The shell adds `platform/player-app/src/pack_checkpoint_store.gd` and unit tests. It
constructs a save key by SHA-256 of
`game_id + NUL + version + NUL + pack_sha256 + NUL + replay_schema_version`, writes a
wrapper `{key fields, saved_replay, checkpoint_hash}` to a same-directory temporary
file under `user://checkpoints/`, flushes, then atomically renames. It never uses a
pack-supplied filename. On signal, pause, close, settlement, or pack replacement, it
serializes, checks UTF-8 byte size, JSON compatibility, game/version fields, and
checkpoint/final hash shape before replacing the last valid file.

On load, the shell verifies catalog/pack first, finds only the exact key, parses and
size-checks it, calls restore before showing the game, and compares the restored
observation hash with `checkpoint_hash`. Failure preserves the file, reports an inline
recovery screen, and offers Retry, Start clean, or Delete saved checkpoint. “Start
clean” does not delete. No telemetry consent is needed for this local flow.

### Telemetry implementation

All event construction passes through `emit_mm_event(name, properties)`, which:

1. rejects a name outside the spec allowlist;
2. merges game/version/library/event sequence common fields;
3. validates exact property keys and enum/range types from a constant schema;
4. increments per-reset event sequence only after validation; and
5. calls the SDK's `emit_gameplay_event`.

The pack contains no HTTP/database client. Deterministic event comparison removes any
shell-added collection time before hashing. The local checkpoint listener remains
connected regardless of telemetry transport consent; the shell's future uploader is
outside this game change.

## Performance approach

- The field contains at most 16 cells, and a preview allocates exactly six cell arrays.
  Domain methods reuse fixed enum constants and do no resource loading.
- `GameView` updates only controls whose observation values changed. It uses Godot
  `Control` nodes and `_draw` primitives under Compatibility; no particles, shaders,
  physics bodies, camera, 3D scene, postprocessing, dynamic texture, or per-frame model
  polling.
- Animation is fixed to opacity/scale interpolation below 10% amplitude and may be
  removed entirely. Model transition already exists before animation and never awaits
  it.
- The solver uses compact integer/string keys, cached distances, fixed expansion order,
  and yielded frontiers as described. Tests profile all 64 base-transform combinations.
- A pack-size gate rejects accidental imported source assets and verifies no asset over
  2 MiB. Built-in fonts and primitives keep the expected PCK materially below 8 MiB.
- UI profiling uses default, 200% text, persistent trace, high contrast, and reduced
  motion. Headless profiling separates pure transition, preview, solver, replay, and
  canonical-hash costs.

## Risks, alternatives, and rollback

| Risk                                                | Precommitted response                                                                                                                       | Rollback/rejection trigger                                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Preview becomes blind enumeration                   | Require structured pre-preview prediction in tutorial/eval; inspect explanations and action diversity; never score preview count as mastery | Reject player-value thesis if explanation/prediction gates fail or convergent brute force dominates             |
| Six ticks × cells overload working memory           | Persistent step trace, linear list, one new tutorial rule, 3×3 early tiers, 4×4 only tier 2, participatory access test                      | Reject/revise if access mode removes ordering decisions or protected completion gap exceeds threshold           |
| Moss/weather skin appears derivative or educational | Neutral primitive art, exact abstract vocabulary, blind mechanics-only similarity review, repeated current-store scan                       | Reject on C4 fatal collision, trademark/visual concern, or ecological/health misconception above eval threshold |
| Runtime solver stalls                               | Compact BFS, deterministic cache, yielded fixed frontier, explicit solver-pending state                                                     | Reject build if any performance budget fails; never silently skip reachability                                  |
| Save signal is too coarse or storage is unavailable | Emit each logical tick/action locally; atomic version/hash-scoped shell checkpoint; visible storage failure                                 | Roll back player persistence changes on corruption, cross-version restore, lost action, or silent failure       |
| Store policy rejects downloadable PCK behavior      | Preserve one app and nondiscoverable evaluation; obtain documented policy interpretation outside builder                                    | Remove candidate evaluation catalog entry and PCK; do not ship a separate app                                   |
| Human value is absent despite contract quality      | Independent adult study and delayed comparative evidence; synthetic results cannot fill human gates                                         | Reject catalog candidacy; preserve evidence without rationalizing via retention/time played                     |

Alternatives rejected at selection remain documented in `selection.md`; the builder does
not hybridize them into this pack. In particular, there is no global-field movement,
music target, folding geometry, social resource exchange, or free rule editor.

The product-behavior baseline is integrated commit
`297e07cfd91d471932a8c5354c5afcc19075e677`. The builder branch's exact Git rollback
target is the final planning checkpoint containing this design and `tasks.md`; its hash
is supplied at handoff and recorded before implementation. During evaluation the catalog
rollback is the prior nondiscoverable empty/fixture state: remove the candidate entry
and restore the pinned player-app source rather than mutate an immutable `0.1.0` pack.
The concepts-only freeze commit
`6751fabc575c2196c4e2755f395b38f9ef8e36dd` remains evidence and is never rolled back
or rewritten.

No design artifact authorizes implementation acceptance, catalog promotion, production
release, policy approval, IP clearance, or an agent to evaluate its own work.
