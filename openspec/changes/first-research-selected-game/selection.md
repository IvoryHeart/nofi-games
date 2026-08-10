# Concept selection: Mossbound Measures

## Frozen criteria and scoring authority

- **Frozen concepts commit:**
  `6751fabc575c2196c4e2755f395b38f9ef8e36dd`
- **Criteria payload fingerprint:**
  `sha256:38bffbd3c109a4ca730655a8acb7e688b8150b37a523ebd790af87482cd678d3`
- **Source artifact:** [Frozen selection contract](concepts.md#frozen-selection-contract)
- **Commit-boundary check:** `concepts.md` at the commit above is the only parent
  input used for scoring. No criterion, weight, score anchor, candidate definition,
  eligibility rule, threshold, or sensitivity method changed after scores were seen.
- **Score formula:** `sum(raw integer score × frozen weight) / 5`, producing 0–100.
- **Selection threshold:** 78, plus the C1/C3/C4/C5/C6 mandatory raw minimum of 3,
  no fatal risk, a lead of at least 3 over the eligible runner-up, a minimum perturbed
  total of 75, and sole eligible rank one under every predeclared perturbation.

Scores judge concept-stage fit and proofability. They are not player evidence, model
self-confidence, an implementation verdict, IP clearance, or catalog acceptance.
“Confidence” below expresses uncertainty in the scoring inference and does not alter a
score.

## Raw scores and weighted totals

| Candidate                                                               | C1 /24 | C2 /14 | C3 /16 | C4 /14 | C5 /14 | C6 /10 | C7 /8 | Weighted total | Confidence                                       | Eligibility                                                        |
| ----------------------------------------------------------------------- | -----: | -----: | -----: | -----: | -----: | -----: | ----: | -------------: | ------------------------------------------------ | ------------------------------------------------------------------ |
| [C01 The Shared Tide](concepts.md#candidate-c01--the-shared-tide)       |      4 |      4 |      5 |      2 |      5 |      4 |     5 |           82.0 | Moderate-high on collision; moderate elsewhere   | **Ineligible:** C4 floor and nearest-neighbor fatal-risk gate fail |
| [C02 Mossbound Measures](concepts.md#candidate-c02--mossbound-measures) |      4 |      4 |      5 |      4 |      5 |      4 |     5 |       **87.6** | Moderate; no first-party play evidence           | **Eligible and rank 1**                                            |
| [C03 Quiet Chorus](concepts.md#candidate-c03--quiet-chorus)             |      4 |      4 |      4 |      2 |      4 |      2 |     3 |           68.8 | Moderate-low                                     | **Ineligible:** total, C4, and C6 fail                             |
| [C04 Folded Bearings](concepts.md#candidate-c04--folded-bearings)       |      4 |      3 |      4 |      3 |      4 |      3 |     4 |           72.4 | Moderate-low                                     | **Ineligible:** total fails                                        |
| [C05 Lantern Exchange](concepts.md#candidate-c05--lantern-exchange)     |      3 |      4 |      5 |      3 |      5 |      4 |     5 |           80.0 | Moderate-low on player value; moderate elsewhere | **Eligible, rank 2; 7.6 behind**                                   |
| [C06 Pocket Palimpsest](concepts.md#candidate-c06--pocket-palimpsest)   |      3 |      3 |      4 |      4 |      5 |      2 |     3 |           69.6 | Moderate-low                                     | **Ineligible:** total and C6 fail                                  |

Weights are shown in the column labels; table cells are unweighted raw integers. The
raw runner-up C01 is not an eligible runner-up because a 2/5 originality score is below
the frozen minimum and its current structural collision is one of the frozen fatal
risks. C05 is the eligible runner-up used by the lead rule.

## Score evidence by candidate

### C01 — The Shared Tide: 82.0, ineligible

- **C1 4 / C2 4:** its exact forecast, shared tradeoff, mooring, partial settlement,
  and nonpunitive recovery directly instantiate the
  [candidate promise and loop](concepts.md#candidate-c01--the-shared-tide). The score
  stops at 4 because player comprehension and restoration are untested.
- **C3 5:** large discrete actions, no timing or modality dependency, offline play,
  bounded crossings, and commit-boundary saves offer an unusually direct four-surface
  proof path.
- **C4 2:** the dated scan found [Field of Polarity](concepts.md#dated-nearest-neighbor-screen),
  which also applies global fields to differently responding bodies. Moorings and clean
  settlement are valuable additions but may not survive the title/art/setting removal
  test as a distinct core identity. This fails the mandatory floor and fatal collision
  gate.
- **C5 5 / C6 4 / C7 5:** finite discrete state, exact previews, semantic actions,
  reachability, replay, recovery, and no external capability make evaluation and pack
  operation unusually tractable. Simultaneous traces and multiple traveller contracts
  retain a working-memory/accessibility risk.
- **Disconfirming evidence applied:** the candidate itself records that blind reviewers
  may reasonably find no decision-level difference. That is treated as selection
  evidence, not deferred as a cosmetic implementation problem.

### C02 — Mossbound Measures: 87.6, eligible rank 1

- **C1 4:** the [edit–preview–commit–settle loop](concepts.md#candidate-c02--mossbound-measures)
  gives the target adult audience a bounded causal decision, multiple compatible
  objectives, visible competence, and a voluntary valid ending. It receives 4 rather
  than 5 because the brief contains no Nofi first-party session-need evidence and no
  player has demonstrated restoration, ownership, or return intent.
- **C2 4:** one-slot edits, full tick traces, disclosed predicates, unlimited precommit
  undo, one committed rewind, and solver-detected recovery make consequence and repair
  observable. Six ticks across multiple properties could still produce blind
  enumeration or spreadsheet-like cognitive load.
- **C3 5:** the complete decision system is a small set of discrete semantic controls
  over at most sixteen cells and six slots. It has explicit portrait/landscape layouts,
  linear focus order, sound/color/motion-independent representations, local offline
  state, and exact suspend/resume boundaries.
- **C4 4:** the screen found crowded ecology/weather and sequence surfaces but no close
  combination of one-slot cyclic program editing, full-measure causal preview,
  persistent nonspatial property change, choice among intent predicates, and voluntary
  settlement. The mechanism remains recognizable when moss, weather terms, sound, and
  art are removed. This is not clearance, so a 5 is unwarranted.
- **C5 5:** finite seeded state, bounded branching, a solver oracle, pre-preview
  predictions, tick traces, semantic state hashes, plan diversity, reachability,
  recovery, and replay allow evaluators to distinguish strategic understanding from
  rendering and content volume.
- **C6 4:** the thesis excludes timing, audio, color-only cues, health/education claims,
  identity, raw text, public UGC, and coercive return. A sequential-list assist and
  simplified-predicate mode are credible, but the multi-property/cyclic model requires
  participatory low-vision and cognitive-access testing.
- **C7 5:** bounded integer simulation, Compatibility-friendly presentation, local
  structured keepsakes, solver-generated finite scenarios, no recurring narrative,
  and no requested platform capability create the cleanest pack/operations boundary in
  the set. Store approval of the player app's pack model remains a platform-level gate
  shared by all candidates.
- **Disconfirming evidence applied:** the selection remains conditional on players
  explaining order effects rather than enumerating previews, producing genuinely
  diverse valid patterns, and perceiving the loop as welcome mastery rather than work.

### C03 — Quiet Chorus: 68.8, ineligible

- **C1 4 / C2 4 / C3 4:** relational prompts, multiple valid structures, private
  finishing, discrete controls, and sound-off representation plausibly support agency
  and expression. Human ownership evidence is indispensable and audio may carry value
  that the redundant channel cannot reproduce.
- **C4 2:** the [neighbor screen](concepts.md#dated-nearest-neighbor-screen) found
  multiple current sequencer/transform puzzle listings. Pair relations do not yet prove
  a distinct core after the audiovisual surface is removed.
- **C5 4:** structure and replay are deterministic, but synthetic metrics cannot judge
  expressive meaning and diversity is partly content-sensitive.
- **C6 2 / C7 3:** a sound-off mode may preserve rules but not the promise; audio/visual
  provenance and combinatorial QA add continuing burden. The primary-value accessibility
  floor therefore fails before implementation.

### C04 — Folded Bearings: 72.4, ineligible

- **C1 4 / C2 3:** transient/persistent adjacency creates a bounded insight and
  recoverable choices, but two-sided transforms may encourage exhaustive previews.
- **C3 4:** named semantic folds and a flattened schematic provide credible input and
  reduced-motion parity; spatial comprehension remains device and access sensitive.
- **C4 3:** adjacency contracts and the persistent bearing differ from platform-path and
  image-reveal neighbors, but “fold to connect” remains an obvious current cluster.
- **C5 4 / C6 3 / C7 4:** topology is finite and replayable, yet animation/linearized
  access parity and generator proofs are more complex than C02. The 72.4 total fails the
  threshold without changing any gate.

### C05 — Lantern Exchange: 80.0, eligible rank 2

- **C1 3:** adequate settlement and reciprocal effects fit the brief, but
  [the candidate's own risk](concepts.md#candidate-c05--lantern-exchange) that contract
  planning feels like administration materially weakens the restorative thesis.
- **C2 4 / C3 5:** public offers, simultaneous traces, reversible rounds, large pair
  selectors, a semantic list, offline state, and no timing give strong clarity,
  recovery, and platform proof paths.
- **C4 3:** endogenous offers and reciprocal temporary contracts differ from spatial
  route building, but abstract network/resource balancing remains structurally
  familiar.
- **C5 5 / C6 4 / C7 5:** graph reachability, path diversity, semantic replay, bounded
  state, no external capability, and no actual social identity are strong. Graph
  cognition and multi-step causality prevent an exceptional accessibility score.
- **Dissent significance:** C05 is a credible fallback if direct player probes show the
  C02 weather-score metaphor obscures causality. It does not win today because its
  specific player-value mechanism is weaker and its lead-independent total trails by
  7.6.

### C06 — Pocket Palimpsest: 69.6, ineligible

- **C1 3 / C2 3 / C3 4:** invariant preservation offers mastery and finite recovery,
  with semantic controls and offline parity, but the bounded sentence builder can feel
  like programming or assessment rather than a restorative break.
- **C4 4 / C5 5:** editing a public rule under a preservation proof is meaningfully
  different from painting a cellular starting state and is exceptionally replayable,
  traceable, and falsifiable.
- **C6 2 / C7 3:** the matrix-plus-grammar identity creates low-vision, language,
  localization, working-memory, and assist-integrity burdens. The accessibility floor
  fails even though the system is technically compact.

## Sensitivity analysis

For each row, one criterion weight changes to 75% or 125% of its frozen value. All
other weights are rescaled proportionally so the total remains 100. Values show the
selected candidate, the raw runner-up, and the eligible runner-up. The complete
calculation uses all six candidates; C02 remains sole rank one in every row.

| Perturbation |    C02 | C01 (ineligible) | C05 (eligible) | C02 rank |
| ------------ | -----: | ---------------: | -------------: | -------- |
| C1 −25%      | 88.200 |           82.158 |         81.579 | 1        |
| C1 +25%      | 87.000 |           81.842 |         78.421 | 1        |
| C2 −25%      | 87.909 |           82.081 |         80.000 | 1        |
| C2 +25%      | 87.291 |           81.919 |         80.000 | 1        |
| C3 −25%      | 87.010 |           81.143 |         79.048 | 1        |
| C3 +25%      | 88.190 |           82.857 |         80.952 | 1        |
| C4 −25%      | 87.909 |           83.709 |         80.814 | 1        |
| C4 +25%      | 87.291 |           80.291 |         79.186 | 1        |
| C5 −25%      | 87.095 |           81.267 |         79.186 | 1        |
| C5 +25%      | 88.105 |           82.733 |         80.814 | 1        |
| C6 −25%      | 87.811 |           82.056 |         80.000 | 1        |
| C6 +25%      | 87.389 |           81.944 |         80.000 | 1        |
| C7 −25%      | 87.330 |           81.609 |         79.565 | 1        |
| C7 +25%      | 87.870 |           82.391 |         80.435 | 1        |

- **Worst perturbed selected total:** 87.000, above the required 75.
- **Perturbed rank result:** sole rank one in 14/14 tests.
- **Lead result:** 7.6 over eligible C05 at frozen weights, above the required 3.

### Diagnostic ablations and counterfactuals

These tests are diagnostic; they do not revise or supersede the frozen criteria.

| Diagnostic                |    C02 |        C01 |    C05 | Interpretation                                                                                                                                                                        |
| ------------------------- | -----: | ---------: | -----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Remove C1 and renormalize | 90.000 |     82.632 | 86.316 | C02 still leads; its result is not only the high-weight player-value criterion.                                                                                                       |
| Remove C4 and renormalize | 88.837 | **88.837** | 83.256 | C02 ties C01. Originality is the decisive protection against the documented current structural collision. Removing it is contrary to the brief, not a plausible production weighting. |
| Equal weights             | 88.571 |     82.857 | 82.857 | C02 remains sole rank one without the frozen weighting profile.                                                                                                                       |

Counterfactual raw-score tests expose what later evidence can reverse:

- If C02's originality were downgraded from 4 to 3 after independent similarity
  evidence, its total would be 84.8 and it would remain eligible and lead C05 by 4.8;
  a downgrade to 2 would fail the mandatory floor and reject selection regardless of
  total.
- If direct player evidence downgraded C02's C1 score from 4 to 3, its total would be
  82.8 but its lead over C05 would shrink to 2.8, below the frozen lead rule. The
  correct outcome would be **reject/reopen research**, not preserve the selection by
  changing weights.

## Dissent and uncertainty

1. **Reject-all dissent:** the market brief contains no Nofi first-party demand or
   participatory accessibility data. A defensible stricter policy would fund paper or
   interactive probes before any game pack. The frozen contract instead selects for a
   bounded implementation/evaluation proof when a candidate clears strong concept-stage
   gates; it does not claim catalog qualification.
2. **C05 dissent:** Lantern Exchange may communicate care and reciprocity more directly
   than abstract property changes, and it is similarly tractable. Its administrative
   feel and familiar network optimization currently make the player-value thesis less
   specific. Direct comparative evidence can reverse that inference.
3. **C01 dissent:** The Shared Tide may be easier to learn and more immediately playful.
   The current Field of Polarity collision is too close to waive, and the C4 floor was
   frozen precisely to prevent familiarity from masquerading as originality.
4. **C02 metaphor dissent:** moss/weather language may imply ecological education or
   “healing nature,” neither of which is evidenced or intended. Implementation must use
   fictional abstract properties, avoid real-world claims, and prove that the temporal
   rule identity survives a neutral presentation.
5. **Measurement uncertainty:** immediate explanation, agency ratings, behavior,
   comparative choice, and delayed voluntary return are complementary. None alone
   establishes restoration, durable value, or wellbeing.

## Selected concept and boundary

**Select C02 — Mossbound Measures** for specification and bounded implementation
evaluation. It passes the 78 threshold at 87.6, all five mandatory raw floors, every
fatal-risk gate, the 3-point eligible-lead rule, and all 14 robustness perturbations.

The selected thesis is: an adult can gain bounded competence and ownership by editing
one slot in a six-pulse deterministic future program, understanding its order-dependent
effect on a small persistent state, choosing among compatible motif intents, and
settling a valid personally preferred result without timing, coercion, or a health
claim.

Selection authorizes later planning artifacts only. It is not implementation,
verification, independent evaluation, release acceptance, store-policy approval, IP
clearance, or a catalog promotion decision. Any later failure of the counterfactual
conditions, protected player-value metrics, accessibility parity, deterministic replay,
or originality review requires rejection or rollback to frozen source commit
`297e07cfd91d471932a8c5354c5afcc19075e677`.
