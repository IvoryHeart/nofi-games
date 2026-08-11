## Why

The platform-v3 substrate has a working player, SDK contract, fixture, and catalog boundary but no real product pack. A small research-selected game is the narrowest useful vertical slice: it validates that an original idea can become a deterministic, testable, discoverable pack without introducing an autonomous studio runtime or a second application.

The human has selected **Tide Ledger** for implementation. The two alternatives remain recorded as material dissent and comparison evidence; implementation is now bounded to Tide Ledger.

## What Changes

- Record a dated market brief, three materially different original concepts, frozen selection criteria, scores, dissent, uncertainty, and platform fit in this change.
- Implement the accepted Tide Ledger concept as a small typed-GDScript candidate pack using the existing Nofi SDK and Godot 4.7.1 Compatibility profile.
- Replace the handcrafted-board assumption with a Tide Ledger–owned deterministic generator: `generate(seed, difficulty, generator_version) -> immutable LevelSpec`.
- Accept only boards proven completable by a deterministic solver, measured against three bounded difficulty bands; try at most 32 candidates, then use a known-valid deterministic fallback.
- Derive endless levels from a root seed and level index, and preserve seed, difficulty, generator version, and LevelSpec hash in structured state and replay data.
- Give the pack one strong core mechanic, a complete short play loop, seeded reset, structured actions/observations/objectives, replay save/restore, and keyboard/touch-compatible controls where practical.
- Test a fixed seed corpus for repeatability, solvability, difficulty bounds, and replay restoration.
- Build and mount the pack through the existing single player app, add it to the development catalog as discoverable, and keep the contract fixture non-discoverable.
- Add focused headless checks and run `pnpm check` plus `pnpm build:web`.
- Keep networking, monetization, account systems, telemetry transport, orchestration, agent registries, release automation, and separate game applications out of scope.

## Market Brief

**Dated 2026-08-11; sources accessed 2026-08-11.** The market is large but mature: Newzoo reports 3.6B players and $188.8B in 2025 revenue, while noting slowing mobile growth in mature markets ([Global Games Market Report 2025](https://newzoo.com/reports/global-games-market-report)). Sensor Tower similarly reports $82B mobile game IAP revenue in 2025 despite slower download growth, describing the opportunity as retaining and engaging existing players through quality and innovation ([State of Gaming 2026](https://sensortower.com/press/press-release-sensor-tower-state-of-gaming-gaming-drove-52-billion-downloads-82b-iap-revenue-on-mobile-and-12b-premium-revenue-on-steam)). Its 2025 mobile summary identifies Strategy, Puzzle, and Action as growth categories ([State of Mobile 2025](https://sensortower.com/state-of-mobile-2025)).

For this non-monetized player, those reports are directional rather than a business case. They support a legible mechanic, quick first success, and replayable mastery over a large content or live-ops burden. The same Sensor Tower report describes 2025 PC/console demand as helped by indie Action and low-friction friend-group experiences; that is useful evidence for a compact cross-platform hook, but it does not prove demand for any particular concept. GDC's 2025 industry summary says 80% of surveyed developers focused on PC and half self-funded, which supports an asset-light, PC-compatible slice but is supply-side evidence, not player preference ([GDC State of the Game Industry 2025](https://reg.gdconf.com/state-of-game-industry-2025)).

The selection implication is to favor a two-minute loop that reads in one sentence, has a distinct interaction rather than a genre checklist, works with keyboard and touch, and can be evaluated from structured state. We will not infer a permanent genre portfolio from this snapshot. There is no direct concept test, regional segmentation, competitor funnel data, or evidence that a free player-app preview converts into repeat play; those remain uncertainties for later human-led evaluation.

## Bounded Competitive Analysis

This is a concise comparator check added during review reconciliation, not a second research round or a rescoring exercise. Each concept is compared with no more than two familiar reference points:

- **Kite Post:** _Alto's Adventure_ demonstrates readable one-touch aerial flow, while _Flappy Bird_ demonstrates immediate obstacle timing; Kite Post differentiates through route choice, tether tension, and wind-resource management, with the risk that balancing may feel familiar without strong feedback.
- **Tide Ledger:** _Sokoban_ demonstrates deterministic route planning, while _Baba Is You_ demonstrates rule-driven topology changes; Tide Ledger differentiates through a compact shoreline whose tide phase changes traversability and whose required side-marker detour makes the route choice visible, with the risk that generated boards can still feel corridor-like.
- **Flicker Forensics:** _Return of the Obra Dinn_ demonstrates evidence-based deduction, while _Keep Talking and Nobody Explodes_ demonstrates signal interpretation under pressure; Flicker Forensics differentiates through short solo lighthouse-signal cases, with the risks of flashing/pulsing presentation, photosensitivity, and a visual-code puzzle feeling opaque without careful accessibility treatment.

## Original Concepts

### 1. Kite Post (`kite-post`) — real-time route arcade

You are a paper kite delivering three letters across a changing city skyline before dusk. The core interaction is balancing lift and tether tension: rising clears rooftops but burns the limited wind, while diving catches gusts and threads narrow windows. A run ends when all letters reach the mailbox or the tether snaps; the seeded route, wind pockets, and a calm-versus-risk score make a failed run immediately replayable. Keyboard steering and a touch drag/hold equivalent are natural. The visual identity can be made from simple shapes, sky gradients, and readable wind lines.

### 2. Tide Ledger (`tide-ledger`) — turn-based shoreline puzzle

You guide a tiny cartographer crab to stamp stranded tide markers. Each turn chooses a move or flips the shoreline's tide phase; the phase changes which sand cells, bridges, and current lanes exist, so the player plans around a board that alternates between two topologies. Every accepted board includes at least one required marker on a side branch, so the shortest successful route must make an off-corridor choice before reaching the lighthouse. A Tide Ledger–owned generator derives each level from a root seed, level index, difficulty band, and generator version, while a deterministic solver proves that accepted boards are completable. Reaching the lighthouse completes the level and advances to the next generated board. Tap-to-move and directional keys both fit, and bounded generation replaces a large handcrafted-content burden.

### 3. Flicker Forensics (`flicker-forensics`) — signal deduction puzzle

You repair a night watch station by rotating three shutters to separate overlapping lighthouse signals. Each short case presents a handful of timed pulses; rotate and lock shutters until the target beacon is isolated, then identify its distress pattern before the battery runs out. The core loop is observe, form a hypothesis, commit, and learn from the result, with seeded signal cases and a score for correct deductions. It is distinct and accessible with taps or keys, but it needs more authored pattern variety and careful feedback to avoid feeling like a visual code quiz.

## Selection Criteria

Scores are 1 (weak) to 5 (strong), frozen for this selection.

1. **Immediate hook:** a player can understand the action and goal within one short preview.
2. **Distinctive position:** the mechanic has a memorable original twist without relying on licensed IP.
3. **Short-loop replay:** a complete first session is brief and repeated attempts have meaningful mastery.
4. **Slice scope:** one small pack can reach polish without large content, art, or systems.
5. **Deterministic evaluation:** reset, actions, objectives, metrics, and replay can be checked from structured state.
6. **Platform fit:** keyboard and touch are practical in the existing single app and SDK boundary.

## Scoring and Recommendation

| Concept           | Hook | Distinct | Replay | Scope | Eval | Platform |  Total |
| ----------------- | ---: | -------: | -----: | ----: | ---: | -------: | -----: |
| Kite Post         |    5 |        4 |      5 |     5 |    5 |        5 | **29** |
| Tide Ledger       |    4 |        4 |      5 |     4 |    5 |        5 | **27** |
| Flicker Forensics |    3 |        5 |      4 |     3 |    4 |        4 | **23** |

**Selection decision: Tide Ledger.** Although Kite Post scored higher for immediate preview appeal, Tide Ledger was selected because its turn-based state, deterministic solver, and replayable generated levels give this first real pack a stronger test of the SDK's semantic contract. The implementation will not build Kite Post or Flicker Forensics.

**Material dissent:** Kite Post remains the strongest candidate for immediate tactile preview appeal, while Flicker Forensics remains the most unusual. Tide Ledger's main risk is that generated boards may be technically solvable but visually repetitive or insufficiently varied; the solver, required side-marker detour, and measured difficulty bands protect correctness but do not replace the final human playability gate.

**Uncertainty:** Category-level market reports do not establish concept-level demand, and the scoring is a small-team hypothesis rather than player evidence. Generator metrics prove bounded structural difficulty, not enjoyment; level variety, feedback clarity, and perceived fairness remain human-playability questions.

## Platform Fit

Tide Ledger will be one `NofiGamePack` instance with a game-specific generator and solver kept inside `games/candidates/tide-ledger`. Its structured state and replay data will carry the root seed, level index, difficulty band, generator version, and LevelSpec hash; full LevelSpec data will be retained in replay only when exact reconstruction cannot be proven. It needs no network, credentials, monetization, account, or platform service. The existing player can mount its candidate PCK under `res://game_packs/`, and the development catalog can expose it while the contract fixture remains hidden. The pack will use the canonical SDK copy under `platform/godot-sdk/addons/nofi_sdk`; generated game copies will be synchronized by the existing tool.

## Preview and Play Instructions

Run `pnpm build:web`, serve `dist/player` from a local static server, and open its `index.html`. Select the visible Tide Ledger pack; the contract fixture remains hidden. Use arrow keys or WASD to move the crab, `Space` to flip the tide, `R` to restart the current level, and `N` after completion to generate the next level. On touch, tap an adjacent tile to move and use the lower flip control to change tide. Collect every marker, then reach the lighthouse. A failed route can be restarted, and replay/state checks use the same seed and generator version to reconstruct the board.

## Known Limitations and Deferred Automation

The pack uses simple drawn presentation and a bounded structural generator; solver proofs and difficulty metrics establish correctness and repeatability, not visual variety, accessibility completeness, or player enjoyment. Preview artifacts are local build outputs, there is no remote content or publishing service, and the contract fixture is intentionally excluded from discovery. Flicker Forensics is not implemented, but its flashing/photosensitivity risk is recorded here rather than treated as an accessibility strength. A concrete later orchestration opportunity is a deterministic acceptance runner that gathers the fixed-corpus, catalog, pack-load, and preview evidence into a human-review packet and pauses when any eligibility fact is missing; no such workflow is part of this slice.

## Capabilities

### New Capabilities

- `first-v3-game`: one human-selected, contract-conforming original game pack with a complete short loop and deterministic headless acceptance.

### Modified Capabilities

None. The existing research-selected-catalog, game-pack-contract, and single-player-app requirements already govern the evidence, pack contract, and one-app distribution; this change supplies a concrete candidate under those requirements.

## Impact

Expected changes are limited to `games/candidates/tide-ledger`, its focused generator/game tests, the existing pack-build/catalog path, and the existing player preview. The generator, solver, fallback, and seed corpus remain Tide Ledger–specific; no reusable cross-game generator framework, editor, level database, content service, or publishing system is introduced. The fixture remains untouched as a hidden contract fixture except for any shared SDK synchronization required by the repository. The rollback target is the starting commit `6d2314783c2d3346c1dc242b73602ca285f4ccfa` on `platform-v3-bootstrap`.
