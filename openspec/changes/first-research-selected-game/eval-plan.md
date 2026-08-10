# Evaluation plan: Mossbound Measures 0.1.0

## Evaluation purpose and authority

This plan is frozen before implementation. It asks whether Mossbound Measures provides
understandable, self-directed, bounded player value while preserving correctness,
fairness, accessibility, safety, originality, cross-platform parity, and the one-app
pack contract. Completing implementation tasks is not a quality metric.

The plan combines the repository's `game-pack-contract` suite version `1.0.0` with
change-specific suite `mossbound-measures-player-value` version `1.0.0`, defined by this
artifact. Where thresholds differ, the stricter threshold applies. The later evaluation
manifest SHALL pin the game/PCK hash, SDK, player app, catalog, Godot, operating systems,
browser, workflows, agent definitions, harness/model provenance, source/planning/builder
commits, this plan's blob hash, seeds/nonces, instruments, and raw artifact hashes.

Authority is separated:

- A Luna/xhigh bounded builder may run deterministic self-checks but SHALL NOT edit this
  plan, reveal protected holdouts, issue the independent verdict, write `decision.md`,
  or call its own output accepted.
- A fresh Sol/xhigh evaluator in a separate read-only-source claim SHALL execute this
  entire plan after a coherent builder checkpoint. It may write only the later
  verification/decision evidence paths authorized by that claim, SHALL NOT repair the
  game, and has authority to return pass, reject, or inconclusive.
- The evaluator, not the builder or designer, creates and holds each hidden evaluation
  nonce. It commits the nonce hash before execution, reveals the nonce only in the
  sealed raw evidence after the run, and reports every planned result.
- Adult-study recruitment, facilitation, condition labels, qualitative coding, and
  analysis SHALL be independent of the builder. Analysts receive condition labels A/B
  until coding and primary calculations are locked.
- No model's prose, self-reported confidence, single run, screenshot, or synthetic
  policy is evidence of human enjoyment, restoration, accessibility, or return value.

Any missing platform, participant group, repetition, log, or raw artifact makes the
verdict **inconclusive / not acceptable**. It is never silently dropped or pooled away.

## Precommitted hypotheses

### Primary player-value hypothesis H1

After the three-stage tutorial, adults seeking a 5–12 minute thinking break can use the
full tick trace to understand one order-dependent consequence, make more than one viable
plan, activate two disclosed intents, recover, and settle close to their desired stop
with high perceived control. Full trace SHALL outperform an otherwise identical
final-state-only preview on causal explanation without harming agency, exit quality,
accessibility, or performance.

### Expressive-ownership hypothesis H2

The same scenario permits materially different valid edit paths and final awake masks,
and players perceive their settled pattern as a consequence of their choices rather
than a hidden single answer. This is a private structured result, not public UGC.

### Cross-platform/access hypothesis H3

The complete player job survives web, desktop, Android, and iOS; touch,
pointer/keyboard, and controller; sound-off, reduced-motion, high-contrast, linear-list,
and 200% text configurations. Semantic parity is exact, human performance gaps are
bounded, and no affected-player cohort encounters a critical blocker.

### Nonhypotheses

The evaluation SHALL NOT infer stress treatment, relaxation therapy, cognitive or
educational improvement, ecological benefit, durable wellbeing, market size, or value
from time played. Seven-day return is a supportive voluntary-interest proxy and cannot
override clarity, agency, exit, accessibility, originality, privacy, or safety failure.

## Frozen versions, baselines, and conditions

The builder produces one immutable candidate pack. Evaluation derives two presentation
conditions from the same state/rules/content/PCK source and records their hashes:

- **Full trace (candidate):** the normative stepwise six-tick preview from the design.
- **Trace ablation (baseline):** preview shows only the exact final state and intent
  results; it hides intermediate tick columns/deltas. It does not change actions,
  transitions, objectives, timing controls, save/replay, visual theme, or settlement.

The ablation exists only in the evaluation harness behind a pinned flag, is always
labeled baseline in evidence, and cannot be published. Participant condition labels
are neutral. A mechanics-only capture with all moss vocabulary, palette, title, and
decorative shapes replaced by neutral identifiers is the originality baseline.

The rollback baseline is source commit
`297e07cfd91d471932a8c5354c5afcc19075e677` plus the prior empty/fixture-only,
nondiscoverable catalog. The concepts freeze
`6751fabc575c2196c4e2755f395b38f9ef8e36dd` remains immutable evidence, not a runtime
rollback target.

## Minimum repetitions and sample

### Automated and synthetic minimums

- Every contract, invariant, direct scenario/transform, witness, input-parity,
  save/restore, malformed-input, and hidden-seed case runs from a fresh instance at
  least **3 times**, matching the versioned game-pack suite minimum.
- All 64 base-scenario/dihedral combinations run both declared witnesses in each
  repetition: at least `64 × 2 × 3 = 384` qualifying witness sessions.
- Every performance microbenchmark runs at least 100 measured repetitions after 20
  warmups. Each cold load profile runs 10 fresh-process repetitions. Frame/memory traces
  run 60 seconds at least 3 times per platform/configuration.
- Every hidden seed set contains 32 seeds and is regenerated independently for each of
  3 repetitions from a distinct committed nonce.

### Human evidence minimums

The study runs two independently recruited and facilitated waves, A and B, of 80 adults
each: **160 unique participants total**. Primary proportions SHALL meet their gates in
each wave and pooled; one successful wave cannot rescue another failed wave.

Each wave contains 20 primary assignments per platform:

- pinned Chromium web on desktop, pointer/keyboard;
- native desktop, 10 pointer/keyboard and 10 standard controller first;
- Android phone, touch; and
- iPhone, touch.

At least 20 unique participants per wave (40 total) SHALL be recruited for relevant
access needs, with at least 5 per wave in each planned review stratum: low vision or
color-vision difference; motor/dexterity; cognitive/learning/attention; and Deaf or
hard-of-hearing. Participants may have overlapping needs but one person counts toward
only one minimum stratum. At least 20 participants per wave SHALL be low-frequency,
lapsed, or nonhabitual digital-game players. Recruitment is adults 18+ and
English-proficient for version `0.1.0`; results SHALL NOT be generalized to children,
other languages, or global populations.

Every participant:

1. sets a desired session duration before play;
2. completes or explicitly skips the tutorial;
3. plays two matched, different-seed unguided measures in counterbalanced Full/Ablation
   order;
4. receives up to 15 minutes of free-choice Full condition play with exit always
   available; and
5. may access the Full build for seven days with no reminder, push, streak, payment,
   scarcity, study-performance reward, or obligation to return.

Condition order, platform, seed pair, and scenario transform are block-randomized by the
independent study coordinator. Access participants use the settings they need and also
perform the semantic parity task where safe. Attrition, skip, refusal, and technical
failure remain in the intention-to-treat denominator unless the preplay build failed to
launch; launch failure is instead a protected crash/contract failure.

## Seeded scenario matrix

### Public deterministic matrix

| Matrix               | Cases                                | Policies/operations                                                                                                                 |                      Minimum |
| -------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------: |
| M1 direct library    | S0–S7 × transforms D0–D7             | Witness A, witness B, exhaustive ≤4-commit solver, minimum distance, final-mask diversity                                           |          64 combinations × 3 |
| M2 reset edges       | Seeds below                          | reset twice, action enumeration, preview/commit equivalence, replay/restore                                                         |                 15 seeds × 3 |
| M3 controlled clock  | Every M1 combination                 | advance `1×6`, `2+4`, `6`, `9`, `0`; pause/save after queue and each tick                                                           |       64 × each schedule × 3 |
| M4 input equivalence | Every M1 witness                     | direct semantic, touch, pointer/keyboard, controller adapters                                                                       |      128 plans × 4 paths × 3 |
| M5 recovery          | Every M1 combination                 | legal paths reaching solver distance 0–4, no-reach state if one exists, rewind, repeat rewind, restart, optional-edit loss/recovery | every reachable category × 3 |
| M6 replay mutation   | Every operation/replay field class   | delete, add, wrong type/range/version/hash/order, duplicate sequence, oversize, impossible phase, surplus tick                      |      12 mutation classes × 3 |
| M7 progression/save  | Every base and version/hash mismatch | tutorial skip/replay, settle 2/3, notebook 64/65, storage deny/full/corrupt, rollback key                                           |               every case × 3 |

Public signed 64-bit seeds are:

```text
-9223372036854775808
-9223372036854775807
-104729
-42
-7
-1
0
1
2
7
42
104729
2147483647
9223372036854775806
9223372036854775807
```

The evaluator records the actual base/transform/intent order/palette mapping and proves
same-version repetition. M1 bypasses RNG only through a test-only constructor inside
the game project; production pack APIs remain seed-only.

### Protected holdouts

For each repetition `r`, the evaluator generates a 256-bit cryptographically random
nonce outside Git, stores `sha256(nonce)` before launching the candidate, and derives
seed `i` for `i=0..31` as the signed big-endian two's-complement interpretation of the
first 8 bytes of `sha256("mossbound-measures-holdout-v1" || r || nonce || i)`.

The builder receives neither nonce nor seeds before its final checkpoint. After the
evaluation is sealed, the raw external manifest reveals the nonce, derived seeds, hash,
commands, and outcomes for reproduction. Holdout policies include:

- breadth-first minimum-distance policy;
- alternate valid-path policy constrained to a different first edit/final mask;
- deterministic random-legal policy for six commits or settlement;
- stall policy with repeated preview/inspect/pause and no commit;
- recovery adversary choosing a legal edit with worst solver distance; and
- mutation indices and interruption ticks derived from subsequent nonce bytes.

Protected holdout answers, exact expected hashes, and participant seed assignments are
not added to builder-visible source.

## Correctness and invariant evaluations

### Pack and one-app contract

The evaluator SHALL validate the manifest, unique namespace, data-only entry scene,
attached script type, SDK version, exact `local-save` capability, nondiscoverability,
PCK hash/immutability, Compatibility settings, and catalog status before execution. It
builds the PCK from a clean clone, loads it through `NofiPackLoader`, and proves the
player shell verifies hash and namespace before restore/display.

Static and runtime monitors SHALL find zero direct pack filesystem calls, network/DNS
requests, native extensions, external URLs, credentials, identity, ads, purchases,
currencies, public UGC, live generated content, or separate-app artifacts. A dev
catalog and all screenshots SHALL remain nondiscoverable/nonproduction.

### Rule and state oracle

An evaluator-owned oracle reimplements the exact integer transition and awake/intent
predicates from the spec without importing game code. It exhausts all
`4^3 × 4 response rules × 4 pulses = 1,024` single-cell transition/awake inputs and
compares output. It then compares every preview tick, commit tick, intent/failing
clause, state serialization, SHA-256, action result, objective, metric, and solver
distance across M1–M5 and hidden seeds.

The oracle verifies row-major simultaneity by permuting evaluation iteration order. No
float, rendering property, wall time, frame callback, palette, audio, viewport, or input
family may change the canonical bytes.

### Scenario reachability and fairness

- Reproduce every `states 0/1/2` design count and both witnesses under all transforms.
- Exhaust every unique decision projection through four commits; every scenario and
  transform SHALL have at least two qualifying sequences with different first edits
  and different final awake masks.
- Prove solver minimum distances and no-reach declarations against exhaustive search.
- Prove settle with exactly two intents completes the required objective and that a
  third intent grants no action, content, or persistence advantage.
- Across 100,000 sequential public-test seeds, record base/transform distribution and
  require each of 64 combinations within ±5% of its expected count; this is an RNG
  sanity bound, not player-value evidence.
- Compare success/minimum distances under all D4 transforms; a transform must not alter
  witness length, qualification, or available semantic plans except coordinate mapping.

### Semantic interface, replay, and failure handling

The evaluator checks all phase/action parameter enumerations and applies every action
with missing/extra/wrong-type/out-of-range/unknown fields. Rejection SHALL preserve
canonical hash, accepted-operation sequence, gameplay metrics, replay, and prior valid
state while incrementing only the declared rejected diagnostic and failure log.

Every accepted state-changing operation and applied tick is saved/restored from a fresh
instance. Replays run three times and compare canonical bytes, actions, objectives,
gameplay metrics, events stripped of shell collection metadata, and final hash.
Mutation never partially restores. Maximum-action, repeated-preview, repeated-rewind,
64-keepsake, and resolution-interruption saves remain at or below 64 KiB or fail.

Player-shell tests kill/relaunch after every phase and logical tick, deny storage, fill
storage, corrupt temp/final files, change game version/hash, and roll back the catalog.
Atomicity, last-valid retention, exact-key isolation, visible failure, and no fallback
identity/network are mandatory.

## Semantic player-policy evaluations

Synthetic policies establish possibility and strategic structure only:

- **minimum policy:** follows oracle-minimum edits;
- **alternate policy:** qualifies through a different first edit and final mask;
- **forecast policy:** predicts one first-tick property, previews once, revises only on
  mismatch, then settles at two intents;
- **no-preview policy:** acts from visible rules to test that preview is support rather
  than the only legal solution path;
- **random-legal policy:** seeded uniform choice over enumerated actions with a cap;
- **greedy-intent policy:** maximizes current active-intent count and exposes local traps;
- **stall/adversarial policy:** previews, inspects, pauses, attempts malformed edits,
  loses qualification during optional play, and exercises recovery; and
- **access policy:** uses only linear-list focus navigation and instant resolution.

Measure objective rate, minimum/actual commits, distinct paths/masks/states, prediction
accuracy, solver distance, rejected actions, preview/recovery behavior, settlement,
stall detection, replay, and cross-input state hashes. No synthetic score is labeled
fun, engagement, agency, ownership, clarity to humans, or accessibility to an affected
person.

## Visual, input, accessibility, and performance evaluations

### Reference profiles

No substitution is allowed without a high-judgment plan update before execution:

| Surface | Fixed reference                                                                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Web     | Repository-pinned Chromium on Intel N100/8 GiB Ubuntu 24.04, 1365×768, 4× CPU throttle; offline after pack load; private/storage-denied variants |
| Desktop | Intel N100/8 GiB Ubuntu 24.04 native Compatibility export at 1280×720 and 2560×1440; keyboard/pointer and USB Xbox Series controller             |
| Android | Google Pixel 6a, 6 GiB, Android 16, 60 Hz; 320×568 logical worst-size emulation plus native device resolution                                    |
| iOS     | iPhone SE 3rd generation, iOS 18.6, 60 Hz; safe-area/rotation and storage-pressure variants                                                      |

The evaluation manifest records exact hardware identifiers, OS/build, drivers, thermal
state, browser/Godot/export template versions, and measurement tools. Policy approval
for downloadable PCK delivery remains a separately documented gate; a local test build
does not imply store compliance.

### Visual and layout matrix

Capture and programmatically inspect every screen/phase at 320×568 portrait, 568×320
landscape, 1280×720, 1365×768, and 2560×1440; 100/150/200% text; all three palettes;
default/linear list; motion/reduced/instant; sound on/off; long localized test strings at
200% even though release is English-only. Every combination runs three times with
pixel-diff baselines and an independent human layout review.

Checks cover no horizontal clipping, vertical scroll reachability, safe areas, 48×48
targets, focus order/return/no trap, visible focus, labels/shape redundancy, contrast,
intent failing clauses, preview deltas, recovery, storage failure, settle prominence,
no continuation reward, and no flash/camera/parallax. Screenshot diffs are diagnostic;
they do not replace manual access review.

### Input parity

Adapter tests apply identical semantic plans through direct calls, touch, pointer,
keyboard, and controller and require byte-identical actions/results/replays. Human
participants complete matched tasks on their assigned input; a counterbalanced subset
of 40 per wave crosses to another available input class. Record completion, errors,
recovery, fatigue/difficulty item, and desired/actual duration by input without pooling.

### Participatory accessibility

Affected participants use their own needed settings and assistive technology where the
platform exposes it. Each stratum tests tutorial, rule/intent inspection, edit,
prediction, preview, commit, recovery, settlement, pause/exit, and save/resume. The
evaluator records critical blockers, task completion, assistance requested, focus or
screen-reader barriers, target errors, motion/sound/color dependence, cognitive load,
and whether an assist preserves the ordering decision. Simulated settings and standards
checks cannot fill a missing stratum.

### Performance

Use clean release exports and the exact budgets from the spec. Measure PCK/assets,
mounted-to-operable cold load, frame p95/max, action/tick/preview/solver p95, peak memory
delta, replay bytes, input response, and network requests. Profile the declared
worst-case S6/S7 transforms, 200% persistent trace, high contrast, reduced motion, full
notebook, maximum replay, and solver no-reach frontier. Logs must contain zero uncaught,
ignored, or unhandled failures. Missing device tooling is a failed planned result.

## Human player-evidence protocol

### Instruments and behavior

Before play, record desired duration category (`<5`, `5–8`, `9–12`, `>12` minutes),
prior frequency category, primary context, platform familiarity, and needed access
settings. Study identifiers live only in the consented research system; the game pack
receives no identity and emits no raw text.

After tutorial and each unguided measure, collect:

- behavior: time to first consequential edit, tutorial help/skip/retry, structured
  prediction, preview/revision, accepted/rejected edits, objective/settle, recovery,
  desired-stop signal, actual exit, plan/mask, and device/input/settings;
- exact 1–5 items: “I understood why the pattern changed,” “My choices meaningfully
  changed the outcome,” “I could recover from a choice I did not like,” “The challenge
  felt fair,” “The ending felt complete,” and “I would choose this for another short
  break”; and
- unaided prompts, coded blind: “What did your most important choice change?”, “Was
  there one intended answer or several?”, “What made you stop?”, and “What, if anything,
  did this activity claim it would improve?”

At condition crossover, require a forced comparative choice for a hypothetical
ten-minute break plus reason categories; “no preference/neither” is valid. During free
choice, participants press “I would like to stop” before any final edit/settle when
possible; evaluator timing measures stop-to-exit without the game rewarding it.

For seven days, the build records only consented local aggregate opens/settlements and
structured return-reason categories (`mastery`, `curiosity`, `make-another`,
`finish-obligation`, `study-obligation`, `habit`, `other-no-text`). No reminder is sent.
At day seven, a research follow-up—not game telemetry—collects the same categories,
time-displacement/sleep concern, and any perceived therapeutic, educational, ecological,
or compulsion claim. Raw free text remains outside Git and is independently coded.

### Analysis

- Primary analysis is intention-to-treat by wave, condition order, platform/input,
  player-frequency group, and declared access stratum, plus pooled estimates.
- Report numerator/denominator, point estimate, 95% Wilson interval for proportions,
  median/IQR for ordinal/time measures, bootstrap 95% interval for paired condition
  differences and device gaps, missingness, attrition, and every exclusion.
- Two coders independently score causal explanations with a frozen 0–2 rubric:
  `0` incorrect/no causal relation; `1` names a pulse/property change but not order;
  `2` correctly connects slot order to at least one observed property/tick. Resolve
  disagreement without condition labels and report Cohen's kappa; acceptance requires
  kappa at least 0.70.
- Ownership coding requires the participant to name their edit/intent tradeoff and deny
  a single hidden answer; visual preference alone is insufficient.
- Primary thresholds must pass separately in wave A, wave B, and pooled. Subgroup
  protected boundaries must pass in each planned platform/access stratum where stated.
  Multiple exploratory slices are labeled exploratory and cannot rescue a failure.

## Originality, IP, privacy, and safety evaluation

Within seven days before evaluation, an independent researcher repeats the documented
Apple, Google Play, Steam, and open-web/itch structural search with saved queries,
cutoff, regions, inclusion/exclusion, direct links, and captures. At least seven
independent game-design/IP reviewers receive randomized, mechanics-only captures of the
candidate and closest neighbors plus the selection's structural claims. They answer
before discussion whether the core decision identity is the same, adjacent, or
distinct and describe the difference unaided.

Audit names/trademarks, primitive shapes, code, fonts, SDK, tools, any generated
material, licenses, credits, and Git provenance. This is a similarity/provenance gate,
not legal advice or universal clearance. Any copied protected expression, unclear
license, undeclared generated asset, or platform-copycat concern blocks acceptance.

Inspect pack/source/runtime network and storage behavior and every telemetry event.
Schema allowlists must pass 100%; no personal/stable/device/raw-text field may appear;
consent off must leave play/save identical; raw participant data and production traces
must remain outside Git with content-addressed references and retention/deletion rules.

Safety review tests clean exit, no streak/scarcity/notification/continuation reward,
storage failure, optional third intent, absence return, all copy, and adult-only study
boundary. Participant misconception coding separately tracks therapeutic, cognitive,
educational, real-ecology, and “longer is better” claims.

## Protected metrics and thresholds

“Accept” means eligible for a later independent candidate decision, not catalog
promotion. A hard-gate failure is immediate rejection. For human estimates, an
inconclusive band triggers a preregistered fresh study; it does not permit acceptance or
post hoc threshold changes.

| Metric                                   | Accept threshold                                                                                                                           | Reject / rollback threshold                                                                 | Protection                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Contract pass rate                       | 1.000 in every repetition/platform                                                                                                         | Any failure                                                                                 | Hard gate; stricter/equal to suite         |
| Deterministic replay rate                | 1.000 for all public/hidden/action/tick/save cases                                                                                         | Any mismatch or partial restore                                                             | Hard gate                                  |
| Crash/unhandled/ignored failure rate     | 0                                                                                                                                          | Any occurrence                                                                              | Hard gate                                  |
| Objective reachability                   | 1.000 for all 64 combinations; ≥2 distinct qualifying paths/masks each                                                                     | Any unreachable transform, false solver result, or single forced qualifying path            | Hard gate; stricter than suite 0.95        |
| Rule/oracle agreement                    | 1.000 across 1,024 cell cases and all scenario traces                                                                                      | Any mismatch                                                                                | Hard gate                                  |
| Telemetry/privacy/capability conformance | 1.000 allowlist; zero forbidden field/request/capability                                                                                   | Any personal data, raw text, direct save, network, identity, or consent-dependent play/save | Hard gate                                  |
| Tutorial clarity                         | ≥90% complete/explicitly skip without external manual; no hidden-rule reliance                                                             | <80% in either wave                                                                         | 80–89% inconclusive                        |
| Causal explanation                       | ≥80% score 2 in each wave and pooled; Wilson lower bound ≥70%; kappa ≥0.70                                                                 | <70% or kappa <0.60                                                                         | Primary H1; 70–79% inconclusive            |
| Unguided two-intent completion           | ≥80% within 12 min each wave/platform pooled; Wilson lower ≥70%                                                                            | <70% in a wave or platform point estimate                                                   | Primary mastery; 70–79% inconclusive       |
| Agency/control                           | ≥80% rate agency item 4–5 and median ≥4 in each wave                                                                                       | <70% or median <3                                                                           | Primary H1; 70–79% inconclusive            |
| Recovery                                 | ≥85% of encountered setbacks recover without external answer; item median ≥4                                                               | <75% or any unrecoverable valid state                                                       | Protected; 75–84% inconclusive             |
| Exit agency                              | ≥90% exit/settle within 2 min of desired-stop signal; median desired-vs-actual absolute gap ≤2 min; unwanted continuation ≤10%             | <80%, median gap >3 min, or unwanted continuation >20%                                      | Hard player-welfare gate                   |
| Full-trace clarity lift                  | ≥10 percentage points over ablation in score-2 explanation; paired interval excludes 0                                                     | ≤0 or candidate regresses agency/exit by >5 points                                          | H1 causal support; 1–9 points inconclusive |
| Choice/ownership diversity               | Modal final mask ≤40%, ≥4 valid masks and ≥4 edit paths per matched-seed cohort; ≥60% correctly report several answers and own a tradeoff  | Modal share >60% or ownership <50%                                                          | H2; middle inconclusive                    |
| Full-condition preference                | ≥60% choose Full over Ablation; “neither” retained                                                                                         | ≤50%                                                                                        | Engagement proxy only; 51–59% inconclusive |
| Voluntary 7-day return                   | ≥30% return with no reminder; ≥70% of returners cite mastery/curiosity/make-another, not obligation/habit                                  | <20% or obligation/habit ≥40%                                                               | Supportive gate; cannot override others    |
| Semantic input parity                    | 1.000 identical canonical/replay outcomes                                                                                                  | Any mismatch                                                                                | Hard gate                                  |
| Human platform/input parity              | Completion-rate max gap ≤10 points; median error gap ≤1; no input-only blocker                                                             | Completion gap >15, error gap >2, or blocker                                                | H3; gaps 11–15 inconclusive                |
| Participatory accessibility              | Zero critical blockers; ≥75% task completion in each access stratum; assist preserves ordering choice; max gap to matched group ≤15 points | Any critical blocker, <65% completion, or assist erases core decision                       | H3 hard boundary; middle inconclusive      |
| Performance/artifact budgets             | Every spec budget passes every fixed profile                                                                                               | Any budget failure or missing profile                                                       | Hard gate                                  |
| Originality distinction                  | ≥6/7 reviewers call distinct and accurately name cyclic one-slot causal program; player unaided mechanism mention ≥70%                     | ≤4/7 distinct, copied expression, or mechanism mention <50%                                 | 5/7 or 50–69% inconclusive                 |
| Safety misconception                     | Each forbidden-claim category ≤10%; zero coercive UI finding                                                                               | Any category >20% or any streak/scarcity/continuation reward                                | 11–20% inconclusive; hard UI gate          |
| Store/distribution policy                | Written current analysis permits the exact one-app PCK evaluation/release path or explicitly confines it to nonstore research              | Rejection, unresolved production interpretation at promotion, or separate-app workaround    | Hard promotion boundary                    |

No primary player-value metric may regress more than 5 percentage points against the
trace ablation except the intended clarity improvement, and no accessibility, exit,
crash, privacy, or determinism regression is allowed. Longer sessions, more previews,
more commits, all-three completion, notebook count, or raw return may never compensate.

## Verdict logic and rollback triggers

The independent evaluator issues:

- **eligible for later candidate decision** only if every hard gate passes, H1/H2/H3
  accept thresholds pass in both waves and pooled, supportive preference/return gates
  pass, all planned evidence exists, and no unresolved policy/IP/safety blocker remains;
- **reject** on any reject/hard threshold, evidence-integrity breach, swallowed failure,
  inaccessible core identity, same-core originality finding, prohibited capability, or
  failure to reproduce the frozen scenario assumptions; or
- **inconclusive / no acceptance** for any middle band, missing confidence/support,
  unavailable platform/group, conflicting waves, or unplanned ambiguity. A new
  high-judgment change must preregister the next test.

Before any later canary, automatic rollback triggers include one crash, replay/save
corruption, cross-version checkpoint use, privacy/capability violation, objective
unreachability, semantic input divergence, critical access blocker, performance budget
breach, coercive UI regression, IP/policy complaint judged credible, or protected human
metric crossing its rejection boundary. Rollback removes the candidate assignment and
restores the pinned empty/fixture catalog and source baseline; immutable `0.1.0` is not
patched in place.

## Required evidence artifacts

Large/raw artifacts remain outside Git under a content-addressed evaluation root; later
`verification.md` stores hashes and compact references only. The evaluator SHALL
produce:

- version/provenance manifest and clean-clone source/build/PCK/catalog hashes;
- exact command transcript with exit codes, environment, retries, and no omitted stderr;
- contract, namespace, capability, static network/storage, and player-load reports;
- oracle implementation/hash, 1,024-case output, scenario counts/witnesses, exhaustive
  reachability, public/hidden seed manifests, policies, and all replay files;
- checkpoint corruption/storage/rollback evidence and atomic-write traces;
- action/failure/event/telemetry schema reports with consent-on/off comparisons;
- screenshots and focus/layout/contrast/flash/accessibility reports for the full matrix;
- input adapter logs, canonical hashes, browser/device videos, performance traces,
  pack/asset sizes, frame/memory/network captures, and thermal metadata;
- nonce precommit/reveal files and holdout derivation tool/hash;
- dated competitor queries/captures, blinded reviewer instrument/results, provenance,
  license, naming, and safety/privacy reviews;
- preregistration, consent/ethics record, recruitment/sample/attrition table, condition
  assignments, exact instruments, deidentified event extract, codebook, dual-coder
  results, analysis script/output, wave/subgroup estimates, delayed-return reasons, and
  all failures/unknowns; and
- machine-readable requirement-to-evidence coverage, protected-metric table, evaluator
  verdict, and tested rollback reproduction.

Raw participant text, consent records, identities, device identifiers, secrets, large
traces, and holdout material SHALL NOT enter Git. Absence of a required artifact is
itself recorded as a failed planned result.

This plan performs no implementation, verification, catalog acceptance, promotion, or
production release. Those remain separated later stages.
