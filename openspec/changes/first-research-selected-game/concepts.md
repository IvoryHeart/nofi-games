# Concept set: first research-selected game

## Scope and evidence boundary

This artifact converts the dated [market brief](market-brief.md) into six original,
falsifiable candidates. It does not select a game and contains no candidate scores.
All candidates target adults aged 18 and over for the first evaluation cohort; broad-age
transfer remains an empirical question rather than an “everyone” claim. The primary
job is a bounded, self-directed interval of competence and positive affect, not stress
treatment, cognitive improvement, education, or maximum engagement.

The market evidence supports investigating jobs and constraints, not predicting that
any concept is enjoyable. In particular, the concepts inherit the brief's contrary
evidence that play time does not establish wellbeing, that session needs and Nofi
first-party demand are unmeasured, and that downloadable-pack store-policy treatment
is unresolved. Each thesis below therefore names an inexpensive way to disconfirm it.

## Frozen selection contract

### Evidence-derived criteria

The criteria and weights were fixed before any candidate was scored. The anchors are
the brief's observations, ranked opportunity spaces, player-value countermetrics, and
safety/accessibility/operating gates—not genre familiarity or monetization.

| ID  | Criterion                                           | Weight | Evidence anchor                                                                                                                                                                                           | What the score must judge                                                                                                                                                                                                             |
| --- | --------------------------------------------------- | -----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Specific player-value and restorative-mastery fit   |     24 | [O2–O5](market-brief.md#observations), [rank 1 opportunity](market-brief.md#ranked-opportunity-spaces-to-investigate), E01–E03, E07–E11                                                                   | Whether a named adult audience can understand a consequential choice, exercise competence and agency, and reach a satisfying player-chosen ending in a bounded first session without a health claim.                                  |
| C2  | Decision clarity, agency, and recovery              |     14 | [minimum evidence design](market-brief.md#a-minimum-evidence-design-for-later-concepts), [discriminating questions 1–2 and 5–6](market-brief.md#discriminating-questions-for-the-concept-agent), E07, E11 | Whether choices and consequences are legible, meaningfully nontrivial, previewable where needed, and recoverable without punitive loss or reliance on a manual.                                                                       |
| C3  | Cross-platform parity and reclaimable-session fit   |     16 | [cross-platform/session constraints](market-brief.md#cross-platform-and-session-constraints), O1, E04, E06, E13, E17–E18, E25                                                                             | Whether the complete primary value survives touch, pointer/keyboard, controller, small/large screens, sound-off use, offline play, suspension, and clean exit/resume.                                                                 |
| C4  | Observable originality and defensibility            |     14 | O6–O7, [originality/IP gates](market-brief.md#originality-and-ip-gates), E14–E16, E20, E26                                                                                                                | Whether the decision experience remains distinctive after removing title, setting, art, and copy; whether current structural neighbors leave a player-observable difference and bounded IP/provenance risk.                           |
| C5  | Deterministic evaluability and agent-learning value |     14 | [evaluation feasibility](market-brief.md#evaluation-feasibility-and-continuous-agent-improvement), discriminating question 5, [game-pack contract](../../specs/game-pack-contract/spec.md)                | Whether seeded semantic play can measure decision quality, clarity, reachability, recovery, replay, and countermetrics independently of rendering or content volume.                                                                  |
| C6  | Accessibility, safety, and privacy resilience       |     10 | [safety/privacy gates](market-brief.md#safety-and-privacy-gates), [accessibility gates](market-brief.md#accessibility-gates), E06–E07, E11–E12, E19, E27                                                  | Whether the core identity survives removal of color, sound, fine motor speed, strict timing, and motion; avoids compulsion, public-social, child-data, and personal-data burdens.                                                     |
| C7  | Bounded operations and pack feasibility             |      8 | [content/operations burden](market-brief.md#content-and-operations-burden), [single-app constraints](market-brief.md#cross-platform-and-session-constraints), E17–E25                                     | Whether offline core play, bounded content/QA, Compatibility rendering, local save, and capability-limited pack delivery can support the thesis without network, identity, public UGC, live generation, or recurring authored volume. |

### Canonical criteria payload

The UTF-8 bytes between `criteria-payload-start` and `criteria-payload-end`, excluding
the marker lines and including the final newline, are the canonical fingerprint input.

<!-- criteria-payload-start -->

```yaml
criteriaVersion: selection-criteria-v1
scoreScale:
  minimum: 0
  maximum: 5
  integersOnly: true
  anchors:
    0: contradicts the brief or has an unresolved fatal dependency
    1: major structural conflict with no credible mitigation
    2: material weakness; mitigation would alter the concept thesis
    3: plausible minimum fit with important evidence gaps or bounded risks
    4: strong fit with observable mechanisms and credible mitigations
    5: exceptional fit with unusually direct, low-risk, reproducible proof path
criteria:
  - id: C1
    weight: 24
  - id: C2
    weight: 14
  - id: C3
    weight: 16
  - id: C4
    weight: 14
  - id: C5
    weight: 14
  - id: C6
    weight: 10
  - id: C7
    weight: 8
selectionRules:
  weightedThreshold: 78
  weightedFormula: sum(rawScore * weight) / 5
  mandatoryMinimums:
    C1: 3
    C3: 3
    C4: 3
    C5: 3
    C6: 3
  minimumLeadOverEligibleRunnerUp: 3
  fatalRisksForbidden:
    - core value requires network, identity, public UGC, live generation, or monetization
    - primary value requires an inaccessible modality or strict/fine-motor timing
    - nearest-neighbor collision leaves no observable structural difference
    - deterministic semantic evaluation cannot represent the core decisions
  robustness:
    minimumPerturbedTotal: 75
    perturbation: vary each criterion weight independently by plus-or-minus 25 percent and renormalize all other weights proportionally to total 100
    rankRule: selected candidate remains sole eligible rank one in every perturbation
  diagnosticAblations:
    - remove C1 and renormalize
    - remove C4 and renormalize
    - replace all weights with equal weights
```

<!-- criteria-payload-end -->

- **Criteria fingerprint:**
  `sha256:38bffbd3c109a4ca730655a8acb7e688b8150b37a523ebd790af87482cd678d3`
- **Immutable boundary:** the first concept checkpoint will contain only this artifact.
  That commit freezes this payload, all candidate definitions, and the neighbor scan
  before scoring. `selection.md` must cite the checkpoint hash. If any frozen field
  changes, selection must stop and a new concepts-only freeze commit must supersede it;
  no score from this run may be retained.
- **Eligibility:** a candidate is eligible only when it meets the weighted threshold,
  every mandatory minimum, every fatal-risk gate, the lead rule, and the perturbation
  rank rule. Otherwise this opportunity is rejected and later artifacts stop.
- **Evidence interpretation:** raw scores describe concept-stage fit and proofability,
  not observed enjoyment. Confidence and dissent are recorded separately during
  selection and cannot increase a raw score.

## Dated nearest-neighbor screen

The screen was run on 2026-08-10 against discoverable Apple App Store, Google Play,
Steam, and open-web/itch.io listings using structural queries (simultaneous global
control, deterministic ecosystem/weather planning, music-sequence puzzles, folding
space, network/resource connection, and rule-editing cellular systems). Listings are
publisher/developer descriptions, not proof of quality, demand, complete mechanics, or
legal clearance. Search retrieval is incomplete and region-sensitive. These products
are collision tests only; none is a design blueprint.

| Candidate risk area      | Closest listing observations                                                                                                                                                                                                                                                                                                                                                    | Consequence for candidate definition                                                                                                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C01 global control       | [Field of Polarity](https://store.steampowered.com/app/3070080/_/) describes changing global fields so positive and negative bodies move differently; [Synchronous](https://store.steampowered.com/app/3099030/Synchronous/) describes simultaneous control of distinct boxes.                                                                                                  | C01 must differ through forecast-and-contract decisions, persistent moorings, recovery, and player-chosen settlement. Even so, the global-field identity has high collision risk.                                                                              |
| C02 ecology/weather      | [Weather Dragger](https://store.steampowered.com/app/4254840) centers spatial cloud/sun placement; [BloomLoop](https://play.google.com/store/apps/details?id=com.pacapp.bloomloop) centers moving ecosystem elements before automatic evolution; [Preserve](https://apps.apple.com/pl/app/preserve/id6739257316) centers flora/fauna card placement.                            | C02 forbids spatial placement, creature simulation, card/tile drafting, and “restore nature” claims. Its identity is editing one slot in a cyclic temporal program, previewing the whole six-pulse transformation, then deciding when the pattern is resolved. |
| C03 musical construction | [NoteGrid](https://play.google.com/store/apps/details?id=com.wimbo.makemusic) uses a grid sequencer and daily completion prompts; [Sequvo](https://apps.apple.com/us/app/sequvo-music-puzzle-game/id6760843901) transforms loops toward a target; [Conspintrix](https://play.google.com/store/apps/details?id=com.butterssoft.concentrix) uses beat-synchronized ring matching. | C03 cannot claim originality from a sequencer, short loop, or audiovisual feedback. It must be evaluated as relational composition without target imitation or timing; the crowded adjacency remains material.                                                 |
| C04 folding topology     | [Foldception](https://josephbremer.itch.io/foldception) connects paths by folding world geometry; [Paper Reveal](https://tejassh.itch.io/paper-reveal) orders overlapping paper folds.                                                                                                                                                                                          | C04 is limited to reversible adjacency contracts on a two-sided strip rather than platform navigation or image revelation, but “fold to connect” remains an obvious neighbor phrase.                                                                           |
| C05 connection planning  | [To Be Connected](https://store.steampowered.com/app/4130420/To_Be_Connected/) combines spatial placement, town links, and resource limits.                                                                                                                                                                                                                                     | C05 removes land building, route drawing, territory expansion, and score chasing. Its graph edges are temporary reciprocal exchanges whose future offers change; differentiation must be observable in negotiation-like tradeoffs.                             |
| C06 rule editing         | [Colorful Matter](https://www.matussek.com/projects/colorful-matter/en/index.php) permits changing cells in a deterministic evolving field; the broader cellular-automata sandbox cluster offers generative patterns without fixed authored outcomes.                                                                                                                           | C06 forbids cell painting and free-running simulation. The player edits one named rule predicate, predicts exactly three discrete transitions, and preserves a self-chosen motif under a limited proof obligation. Clarity and access risk remain high.        |

No listing found in this bounded screen combines C02's one-slot cyclic weather program,
full-measure preview, nonspatial state transitions, and player-chosen resolved ending.
That absence is weak negative evidence, not an originality finding. Before any catalog
promotion, a fresh evaluator must repeat the search in all release regions, inspect
play footage/builds where available, review title/trademark and visual similarity, and
audit every asset/license.

## Candidate C01 — The Shared Tide

### Player promise and audience/job

For adults seeking a five-to-ten-minute thinking break, make one calm, consequential
choice that coordinates several travellers at once, recover from a poor forecast, and
decide when enough have reached safety. The job is competence with a clean ending, not
speed or perfect completion.

### Semantic inputs

- `inspect_forecast(direction)` previews a north/east/south/west tide without changing
  state.
- `commit_tide(direction)` advances one deterministic turn.
- `place_mooring(cell_id)` spends the scenario's single mooring to create a recovery
  point.
- `undo_turn`, `restart_crossing`, `settle_crossing`, `pause`, and `resume` are
  available through equivalent touch, pointer, keyboard, and controller actions.

No action depends on gesture path, hover, simultaneous buttons, reaction time, sound,
or color alone.

### Original core loop

A compact orthogonal chart contains two to four travellers. Every committed tide moves
all active travellers simultaneously, but each public “travel contract” transforms the
same direction differently: follow, turn clockwise, repeat the previous tide, or wait
then follow. Before committing, the player sees exact destinations, conflicts, and
which travellers would reach a haven. Once per crossing the player may place a mooring
on a visited safe cell. The player forecasts, commits, reads the changed shared state,
and either continues or settles after at least one arrival. The structural claim is
shared forecasting plus one persistent recovery commitment, not simply moving several
pieces together.

### Decisions

- Trade one traveller's immediate progress against another's future route.
- Spend the single mooring early for safety or preserve it for a later branching point.
- Accept a partial resolved crossing or continue for additional arrivals.
- Use undo as learning or restart from the seed with a new plan; neither affects
  progression rewards.

### Failure and recovery

Travellers cannot die. A traveller pushed off-chart returns to the latest mooring (or
its origin) with a visible “one tide lost” consequence. Conflicting destinations cause
both to hold. The latest committed turn is always undoable; the seed can be restarted;
and settling a partial crossing records an honest result without a fail screen.

### Mastery and progression

Mastery is predicting interactions among public transformation rules, recognizing
reversible versus committing tides, and choosing an adequate rather than compulsory
perfect ending. A fixed tutorial sequence introduces one traveller, then two contracts,
then a mooring. Progression unlocks deterministic scenario families and rule
combinations, never power, streaks, consumables, or time gates.

### Cross-platform and session fit

The chart uses large discrete cells, one-tap/select actions, text/shape labels, scalable
layout, motion reduction, and optional instant resolution. A crossing is 4–10 decisions
and targets 3–10 minutes; exact state saves after every commit and on suspension. Core
play is offline and sound-independent in portrait or landscape.

### Falsifiable thesis and evaluation

**Thesis:** after one guided and two unguided crossings, at least 80% of adult concept
testers can predict the effect of two traveller contracts, identify one meaningful
tradeoff unaided, and choose to settle within two minutes of their desired stop, while
rating control over the outcome at least 4/5.

Compare full exact forecasts with endpoint-only previews. Measure tutorial prompt use,
prediction accuracy, distinct viable tide sequences, undo-to-recovery rate, partial
settlement, desired-versus-actual duration, input-surface parity, and replay identity.
Do not use longer play or return alone as success.

### Risks and disconfirming evidence

- **Originality/IP:** the current Field of Polarity listing shares the global-field and
  heterogeneous-response structure. Independent reviewers may reasonably describe C01
  as the same decision identity despite the mooring/settlement layer.
- **Clarity/accessibility:** several traveller rules may overload working memory or
  become illegible on a small screen; motion could obscure simultaneous resolution.
- **Safety/operations:** low ongoing burden and no personal data, but procedural seeds
  need solvability/reachability proofs.
- **Disconfirm:** reject if unaided prediction remains below 80%, if touch produces more
  than a 10 percentage-point completion deficit, if most successful paths are forced,
  or if blind similarity reviewers identify no structural difference from a current
  neighbor.

## Candidate C02 — Mossbound Measures

### Player promise and audience/job

For adults reclaiming a five-to-twelve-minute interval, shape a tiny living pattern by
changing one beat of its future weather, understand why the whole pattern changes, and
close the measure when it feels complete. The job is restorative mastery through
legible causality, not nature education, optimization, or ecological virtue.

### Semantic inputs

- `select_slot(slot_index)` chooses one of six future positions.
- `set_pulse(slot_index, pulse_id)` changes that slot to `rain`, `sun`, `wind`, or
  `still` without advancing state.
- `preview_measure` computes all six deterministic ticks and exposes a tick-by-tick
  semantic trace.
- `commit_measure`, `undo_edit`, `restart_measure`, `settle_measure`, `inspect_cell`,
  `pause`, and `resume` are discrete equivalent actions.

Every state and action has text, icon-shape, and high-contrast representations; audio,
animation, drag, and timing are optional presentation.

### Original core loop

A scenario begins with a 3-by-3 bed of abstract moss cells and a six-slot cyclic
“weather measure.” Cells do not move. Each cell has three visible integer properties—
moisture, warmth, and spore charge—and one of a small set of public response rules.
Rain, sun, wind, and stillness update those properties in a fixed order. Neighbor
relationships can cause a response at the next tick, producing a named motif such as a
bridge, ring, or refuge when a public predicate is met. On each turn the player edits
exactly one slot, previews all six ticks, commits the transformed bed, then receives one
fresh edit. After satisfying any two of three disclosed motif intents, the player may
settle immediately or spend up to two optional edits pursuing a personally preferred
third motif. The settled semantic cell pattern becomes a local keepsake.

The distinctive decision identity is editing one element of a cyclic future program
and reasoning across its full, previewable transformation of persistent nonspatial
state. It is not tile placement, creature simulation, a match target, or a music test.

### Decisions

- Decide which single future pulse to replace, knowing order changes causal effects.
- Choose among multiple motif intents and accept that some combinations conflict.
- Commit a forecast to create the next persistent starting state or undo the edit.
- Settle after the required pair or use optional edits for a chosen expressive result.

### Failure and recovery

There is no death, decay timer, or irreversible save. A committed measure may leave no
motif reachable within the remaining required edits; the system detects this via the
same bounded solver used by evaluation and offers rewind to the last reachable state or
restart from the seed, explaining the first broken predicate. Undo is unlimited before
commit and one committed measure can be rewound. Settling a valid pair is success even
when the third intent is unresolved.

### Mastery and progression

Mastery is reading order-sensitive cause and effect, predicting one change before
preview, using cyclic wraparound deliberately, and selecting compatible intents. A
three-scenario tutorial introduces one property/pulse, then ordering, then neighbor
response. Progression adds response-rule combinations and bed seeds only after mastery
checks; it does not increase board dimensions beyond 4-by-4, gate daily content, grant
power, or require exhaustive collection. Completed patterns form an optional local
notebook with seed and action provenance.

### Cross-platform and session fit

The entire interaction is six large slots, up to sixteen inspectable cells, and
semantic buttons. Portrait stacks timeline above bed; landscape/desktop places them
side by side. Keyboard/controller focus order matches touch reading order. Instant
preview and reduced-motion modes remove animation; information never relies on sound or
color. State saves after edits, commits, and settle; resume returns to the exact tick
preview or decision boundary. Core play is offline.

### Falsifiable thesis and evaluation

**Thesis:** after the three-scenario tutorial, at least 80% of adult testers can explain
one order-dependent cell change without supplied vocabulary, complete two of three
motifs in an unguided seed within 12 minutes, identify at least two viable edit plans,
and settle within two minutes of their desired stop; at least 60% choose a different
valid final pattern when offered the same seed, without a device-class performance gap
greater than 10 percentage points.

Use frozen solvable and adversarial seeds. Compare full tick trace with final-state-only
preview. Record first consequential edit, prediction before preview, preview revisions,
motif path, rewind/recovery, settle reason category, desired/actual duration, valid plan
diversity, input method, deterministic state hashes, and delayed unprompted return
reason. A human interview asks what changed and why; synthetic evaluation establishes
correctness and strategic possibility, never enjoyment.

### Risks and disconfirming evidence

- **Clarity/cognitive:** six ticks times several cells may feel like spreadsheet work;
  a preview can turn agency into trial-and-error rather than understanding.
- **Originality/IP:** ecosystem and “relaxing nature” presentation is crowded. The
  temporal-program identity must survive removal of moss art and avoid resembling a
  sequencer skin.
- **Accessibility:** cell density, cyclic wraparound, and multi-property state may tax
  low vision or working memory; sequential list and simplified-predicate assists must
  preserve real choices.
- **Safety/privacy/operations:** no network, identity, raw text, public UGC, health
  claim, or recurring authored content. Procedural seeds require solver-backed
  reachability and difficulty bounds; keepsakes remain local structured state.
- **Disconfirm:** reject if fewer than 80% can explain an order effect, if preview use is
  mostly blind enumeration, if valid final patterns converge above 80%, if an access
  assist removes the ordering decisions, or if independent reviewers reduce the system
  to an existing spatial ecology or music-loop puzzle.

## Candidate C03 — Quiet Chorus

### Player promise and audience/job

For adults who want private expression in a short break, build a small audiovisual
conversation whose parts answer one another, make a legible compositional choice, and
save or discard it without public performance.

### Semantic inputs

- `place_voice(voice_id, step_index)`, `set_relation(source_voice, target_voice,
relation_id)`, `mute_voice`, `preview_cycle`, `commit_cycle`, `undo`,
  `finish_chorus`, `pause`, and `resume`.
- Relations are `echo`, `answer`, `hold`, and `leave-space`; they transform visual
  shape/position and optional pitch/rhythm together.

No pitch recognition, beat timing, microphone, raw audio, gesture precision, or hearing
is required.

### Original core loop

The player places up to four voices on an eight-step strip, then gives pairs a relation
rather than matching a target melody. Committing a cycle applies relations in public
order and reveals where voices reinforce, answer, crowd, or leave space. A prompt asks
for two relational qualities (for example, “one answer and one open interval”), while
the final pattern remains player-authored. The player revises, previews, commits, and
finishes a private structured chorus.

### Decisions

Choose which voice leads, which pair relation consumes limited attention, whether to
resolve a prompt directly or preserve an unexpected pattern, and when the piece feels
finished. Multiple valid structures are required.

### Failure and recovery

Crowded or silent cycles are diagnostic states, not loss. The player can isolate any
voice, inspect a textual/visual relation trace, undo without limit, revert one committed
cycle, or finish an off-prompt chorus labeled “free form.”

### Mastery and progression

Mastery is anticipating relation order, creating contrast with fewer placements, and
explaining a compositional intention. Progression introduces relation combinations and
sound/shape palettes with documented provenance, never daily prompts, rankings,
sharing requirements, or unlock currency.

### Cross-platform and session fit

An eight-step list/grid fits portrait and landscape with large targets and linear focus
navigation. Visual, textual, haptic-off, and audio-off modes communicate identical
relations. A chorus targets 4–12 minutes, saves every edit, runs offline, and has no
identity or public export in the first pack.

### Falsifiable thesis and evaluation

**Thesis:** at least 75% of adult testers, including sound-off participants, can create
two structurally distinct valid choruses in ten minutes, correctly describe one relation
they intentionally used, and report ownership at 4/5 or higher without believing there
was one hidden target.

Measure valid structure diversity, relation prediction, edit/recovery paths,
sound-on/off parity, prompt interpretation, ownership, perceived hidden-answer rate,
and independent similarity. Use action/state replays for correctness; human evidence is
required for expression.

### Risks and disconfirming evidence

- **Originality:** current sequencer and music-puzzle listings make the surface highly
  crowded; pair relations may not create enough decision-level difference.
- **Accessibility:** hearing loss is mitigable, but a non-audio presentation may erase
  the emotional promise; cognitive load and VoiceOver navigation need affected-player
  testing.
- **Operations/IP:** each sound and visual palette needs provenance; expressive output
  increases QA combinations even without public UGC.
- **Disconfirm:** reject if sound-off ownership is more than one Likert point lower, if
  outputs converge, if players search for a single answer, or if similarity reviewers
  identify the same transform-target loop as a current neighbor.

## Candidate C04 — Folded Bearings

### Player promise and audience/job

For adults wanting a compact spatial insight, make a paperlike route become possible by
changing which places are adjacent, understand the fold you made, and return the map to
a personally satisfying closed form.

### Semantic inputs

- `preview_fold(boundary_id, direction)`, `commit_fold`, `traverse(port_id)`,
  `unfold_last`, `mark_bearing(port_id)`, `finish_map`, `pause`, and `resume`.
- Direct manipulation is optional presentation; every fold is a named boundary and
  direction selectable through list, keyboard, controller, or large touch target.

### Original core loop

A two-sided strip has twelve panels, each with zero to two edge ports. A fold creates a
temporary, explicitly listed adjacency contract between aligned ports; the explorer
then traverses one contract before the strip must partially unfold. The player has one
persistent bearing mark that keeps a chosen adjacency valid across an unfold. A route
requires visiting two disclosed anchors and returning to the edge, but many final fold
shapes are accepted. The core is planning transient versus persistent adjacency, not
moving through folded platform geometry or revealing an image.

### Decisions

Choose fold order, spend the one bearing mark, select which aligned port to traverse,
and finish with a valid but personally chosen closed form.

### Failure and recovery

An invalid fold is blocked before commit with the conflicting panels named. A stranded
explorer automatically returns to the last bearing at no progression cost. Every fold
can be unfolded in reverse and the seed restarted.

### Mastery and progression

Mastery is mentally composing adjacency contracts and using one persistent exception.
Progression adds two-sided port rules and alternative anchor sets, not tighter timing or
larger than twelve-panel maps.

### Cross-platform and session fit

List-based equivalent controls, a flattened schematic, high-contrast edge labels, and
reduced-motion instant folding preserve the full logic without 3D animation or drag.
One map targets 5–12 minutes and saves at every fold/traverse boundary offline.

### Falsifiable thesis and evaluation

**Thesis:** after two tutorial folds, at least 80% of adult testers can predict one new
adjacency, recover from a strand without instruction, and complete an unguided map in
12 minutes, with reduced-motion completion no more than 10 percentage points below the
animated condition.

Measure prediction, illegal preview attempts, route diversity, bearing timing,
recovery, spatial-language explanation, motion-mode parity, and replay identity.

### Risks and disconfirming evidence

- **Clarity/accessibility:** two-sided transforms can overwhelm spatial working memory;
  screen-reader linearization may preserve rules but not insight.
- **Originality/IP:** “fold space to connect a route” has current direct neighbors even
  though transient adjacency contracts differ.
- **Operations:** bounded authored/generator burden, but every generated map needs
  topological solvability proof and fold-animation QA.
- **Disconfirm:** reject if players rely on exhaustive previews, if reduced-motion or
  linearized modes erase mastery, or if blind reviewers cannot state a structural
  difference from current folding games.

## Candidate C05 — Lantern Exchange

### Player promise and audience/job

For adults seeking a calm planning interval, help a small network become mutually
stable through a few reversible exchanges, see the consequences of each agreement, and
stop once the network is good enough rather than maximally efficient.

### Semantic inputs

- `inspect_exchange(source_id, target_id)`, `propose_exchange`, `commit_round`,
  `withdraw_exchange`, `undo_round`, `settle_network`, `pause`, and `resume`.
- Nodes and resources always have icon-shape, text, and high-contrast state; drawing
  edges is never required.

### Original core loop

Six lanterns form a fixed nonspatial graph. Each publicly offers one unit it can spare
and requests one condition, such as warmth now in exchange for light next round. The
player may establish up to two reciprocal exchanges per round. Committing resolves all
offers simultaneously; fulfilled lanterns change what they can offer next, while
overused links rest for one round. The player seeks any network where at least five
lanterns are stable for two rounds, then may settle or attempt all six. The intended
identity is temporary reciprocal contracts with endogenous future offers, not route
building or territory growth.

### Decisions

Prioritize a short reciprocal pair or a chain with future value; leave one lantern
temporarily unsupported; spend a resting link; and settle an adequate network rather
than chase a perfect score.

### Failure and recovery

No lantern is harmed or lost. An unstable loop exposes the unmet condition and can be
withdrawn before commit. One committed round can be undone, and a scenario can restart
without penalty. A five-lantern stable state is a valid close.

### Mastery and progression

Mastery is anticipating simultaneous contract resolution and second-order changes to
offers. Progression adds offer rules and graph seeds but no economy, currency, streak,
ranking, or persistent scarcity.

### Cross-platform and session fit

The graph has a linear semantic list and large pair selectors; no fine routing or
timing. One network targets 4–10 minutes, saves every proposal/round, runs offline, and
uses neither social identity nor real players.

### Falsifiable thesis and evaluation

**Thesis:** at least 80% of adult testers can identify one reciprocal benefit, predict
a next-round offer change, and settle a five-lantern network within ten minutes; at
least two materially different stable exchange graphs exist for 90% of evaluation
seeds.

Measure prediction, graph/path diversity, unstable-loop diagnosis, undo/recovery,
adequate-versus-perfect settlement, desired duration, input parity, reachability, and
deterministic replay.

### Risks and disconfirming evidence

- **Player value:** contract/resource language may feel like administrative work rather
  than restoration; caring presentation cannot rescue a dry optimization loop.
- **Originality:** network balancing and resource-chain systems are common even when
  current screened neighbors emphasize spatial links.
- **Accessibility/operations:** graph comprehension and multi-step causality are risks;
  bounded state and no external content keep operational burden low.
- **Disconfirm:** reject if fewer than 70% describe the session as a welcome break, if
  one exchange pattern dominates more than 70% of solvable seeds, or if players cannot
  predict second-order offer changes without exhaustive preview.

## Candidate C06 — Pocket Palimpsest

### Player promise and audience/job

For adults who enjoy abstract rule discovery, preserve a chosen pattern through three
changes by rewriting one transformation rule, then keep the result as a private record
of the rule they understood.

### Semantic inputs

- `select_rule(rule_id)`, `set_predicate(property_id, comparator, value)`,
  `set_effect(effect_id)`, `preview_transition(step_index)`, `commit_rule`,
  `rewind`, `finish_proof`, `pause`, and `resume`.
- A constrained sentence builder replaces raw code, typing, or cell painting.

### Original core loop

A 4-by-4 field begins with a disclosed arrangement of three symbol states. Three
existing named rules transform it for exactly three steps. The player chooses one of
two motif predicates worth preserving, rewrites exactly one rule through a bounded
sentence builder, predicts the next transition, and previews the three-step trace.
They may revise or commit; a valid proof preserves the chosen motif while changing at
least four other cells. The final rule and trace form the keepsake. The identity is
editing a public rule under a preservation proof, not painting an initial automaton
state or letting a sandbox run.

### Decisions

Choose which motif matters, which one rule to replace, how broad its predicate should
be, and whether an unexpected but valid transformation better expresses the chosen
motif.

### Failure and recovery

Invalid or nonterminating rule combinations are impossible in the constrained grammar.
A failed proof names the first step and predicate that broke. Unlimited revision,
stepwise rewind, and seed restart are available without penalty.

### Mastery and progression

Mastery is forming and testing a causal rule, generalizing beyond one cell, and
explaining why a motif persists. Progression adds predicate/effect pairs only after
demonstrated comprehension; it never adds free-form code, competitive ranking, or
unbounded field size.

### Cross-platform and session fit

The sentence builder, state table, and field share a linear focus model and large
controls. Text, shape, and position are redundant; animation is optional. A proof
targets 6–15 minutes, saves every rule edit, and runs offline.

### Falsifiable thesis and evaluation

**Thesis:** after a two-rule tutorial, at least 75% of adult testers can construct a
valid rule, predict its first transition before preview, and explain why their motif
survived; at least half produce a valid rule not used by another participant on the
same seed.

Measure predicate comprehension, pre-preview prediction, rule diversity, failed-proof
recovery, explanation accuracy, assist-mode parity, deterministic trace hashes, and
perceived creativity versus test-taking.

### Risks and disconfirming evidence

- **Clarity/player value:** rule editing can resemble programming or assessment,
  conflicting with the desired restorative interval.
- **Accessibility:** a cell matrix plus symbolic grammar burdens low vision, language,
  and working memory; simplification may erase the concept's identity.
- **Originality/IP/operations:** the preservation proof is distinct from cell painting,
  but deterministic cellular systems are longstanding; localization of predicate
  grammar and generator proofing add recurring burden.
- **Disconfirm:** reject if fewer than 75% predict the first transition, if participants
  describe it mainly as work/test-taking, if assistive presentation removes rule
  choice, or if outputs converge on one obvious predicate.

## Diversity check

The candidates are not setting or art variants. Their irreducible player decisions,
state topologies, and primary reserve hypotheses differ:

| Candidate              | Irreducible decision                                                                   | State topology                                   | Opportunity emphasis                             | Primary failure mode                              |
| ---------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------- |
| C01 The Shared Tide    | Apply one global direction to heterogeneous contracts; place one recovery commitment   | Spatial simultaneous movement                    | Restorative mastery; cross-context fit           | Structural neighbor collision                     |
| C02 Mossbound Measures | Edit one slot in a cyclic causal program; choose compatible intents and stopping point | Temporal program over persistent cell properties | Restorative mastery; private expression          | Preview-driven trial-and-error                    |
| C03 Quiet Chorus       | Define relations among authored voices without a target answer                         | Relational audiovisual sequence                  | Private expressive agency                        | Crowded sequencer identity; hearing/access parity |
| C04 Folded Bearings    | Create transient adjacency and spend one persistent bearing                            | Reversible two-sided topology                    | Spatial cognitive confidence                     | Transform comprehension/access                    |
| C05 Lantern Exchange   | Commit reciprocal contracts whose future offers change                                 | Nonspatial dynamic graph                         | Restorative planning; indirect prosocial meaning | Administrative optimization feel                  |
| C06 Pocket Palimpsest  | Rewrite one transformation rule to preserve a chosen invariant                         | Rule system over a finite field                  | Cognitive confidence; private expression         | Programming/test feel and language burden         |

All six permit deterministic semantic evaluation, but that common platform constraint is
not their concept identity. None requires a fixed catalog genre, separate application,
network, identity, public UGC, live generative content, monetization, child-directed
data, or an unbounded authored-content feed.
