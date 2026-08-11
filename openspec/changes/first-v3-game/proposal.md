## Why

The platform-v3 substrate has a working player, SDK contract, fixture, and catalog boundary but no real product pack. A small research-selected game is the narrowest useful vertical slice: it validates that an original idea can become a deterministic, testable, discoverable pack without introducing an autonomous studio runtime or a second application.

This proposal is approval-gated. The three concepts below are candidates only; no concept is accepted and no game implementation is authorized until the human selects one.

## What Changes

- Record a dated market brief, three materially different original concepts, frozen selection criteria, scores, dissent, uncertainty, and platform fit in this change.
- After human approval, implement exactly one selected concept as a small typed-GDScript candidate pack using the existing Nofi SDK and Godot 4.7.1 Compatibility profile.
- Give the pack one strong core mechanic, a complete short play loop, seeded reset, structured actions/observations/objectives, replay save/restore, and keyboard/touch-compatible controls where practical.
- Build and mount the pack through the existing single player app, add it to the development catalog as discoverable, and keep the contract fixture non-discoverable.
- Add focused headless checks and run `pnpm check` plus `pnpm build:web`.
- Keep networking, monetization, account systems, telemetry transport, orchestration, agent registries, release automation, and separate game applications out of scope.

## Market Brief

**Dated 2026-08-11; sources accessed 2026-08-11.** The market is large but mature: Newzoo reports 3.6B players and $188.8B in 2025 revenue, while noting slowing mobile growth in mature markets ([Global Games Market Report 2025](https://newzoo.com/reports/global-games-market-report)). Sensor Tower similarly reports $82B mobile game IAP revenue in 2025 despite slower download growth, describing the opportunity as retaining and engaging existing players through quality and innovation ([State of Gaming 2026](https://sensortower.com/press/press-release-sensor-tower-state-of-gaming-gaming-drove-52-billion-downloads-82b-iap-revenue-on-mobile-and-12b-premium-revenue-on-steam)). Its 2025 mobile summary identifies Strategy, Puzzle, and Action as growth categories ([State of Mobile 2025](https://sensortower.com/state-of-mobile-2025)).

For this non-monetized player, those reports are directional rather than a business case. They support a legible mechanic, quick first success, and replayable mastery over a large content or live-ops burden. The same Sensor Tower report describes 2025 PC/console demand as helped by indie Action and low-friction friend-group experiences; that is useful evidence for a compact cross-platform hook, but it does not prove demand for any particular concept. GDC's 2025 industry summary says 80% of surveyed developers focused on PC and half self-funded, which supports an asset-light, PC-compatible slice but is supply-side evidence, not player preference ([GDC State of the Game Industry 2025](https://reg.gdconf.com/state-of-game-industry-2025)).

The selection implication is to favor a two-minute loop that reads in one sentence, has a distinct interaction rather than a genre checklist, works with keyboard and touch, and can be evaluated from structured state. We will not infer a permanent genre portfolio from this snapshot. There is no direct concept test, regional segmentation, competitor funnel data, or evidence that a free player-app preview converts into repeat play; those remain uncertainties for later human-led evaluation.

## Original Concepts

### 1. Kite Post (`kite-post`) — real-time route arcade

You are a paper kite delivering three letters across a changing city skyline before dusk. The core interaction is balancing lift and tether tension: rising clears rooftops but burns the limited wind, while diving catches gusts and threads narrow windows. A run ends when all letters reach the mailbox or the tether snaps; the seeded route, wind pockets, and a calm-versus-risk score make a failed run immediately replayable. Keyboard steering and a touch drag/hold equivalent are natural. The visual identity can be made from simple shapes, sky gradients, and readable wind lines.

### 2. Tide Ledger (`tide-ledger`) — turn-based shoreline puzzle

You guide a tiny cartographer crab to stamp three stranded tide markers. Each turn chooses a move or flips the shoreline's tide phase; the phase changes which sand cells, bridges, and current lanes exist, so the player plans around a board that alternates between two topologies. Reaching the lighthouse completes a compact board and records the route. Seeded boards, undo-free deliberate turns, and a small action vocabulary make the state highly inspectable. Tap-to-move and directional keys both fit, but creating satisfying boards is a greater content-design risk.

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

| Concept | Hook | Distinct | Replay | Scope | Eval | Platform | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| Kite Post | 5 | 4 | 5 | 5 | 5 | 5 | **29** |
| Tide Ledger | 4 | 4 | 5 | 4 | 5 | 5 | **27** |
| Flicker Forensics | 3 | 5 | 4 | 3 | 4 | 4 | **23** |

**Recommendation: Kite Post.** It offers the clearest tactile hook, a complete one-minute-to-two-minute loop, strong keyboard/touch symmetry, and a high-confidence asset-light implementation while still leaving room for mastery. It is a recommendation, not an acceptance.

**Material dissent:** Tide Ledger is the safer evaluation candidate: turn-based state is easier to inspect, replay, and make accessible, and it avoids real-time tuning. The dissenting concern is that its board-generation/content burden may consume the slice and that its hook is less immediately legible. Kite Post's main risk is feel: placeholder physics or unreadable wind feedback could make the concept score worse than this paper estimate.

**Uncertainty:** Category-level market reports do not establish concept-level demand, and the scoring is a small-team hypothesis rather than player evidence. The largest sensitivity is the weighting of scope and evaluation: if those criteria dominate, Tide Ledger wins; if first-second clarity and preview appeal dominate, Kite Post's lead widens.

## Platform Fit

All three concepts can be implemented as one `NofiGamePack` instance with local seeded state, structured observations and actions, an objective array, metrics, and replay data. They need no network, credentials, monetization, account, or platform service. The existing player can mount a candidate PCK under `res://game_packs/`, and the development catalog can expose the selected entry while the contract fixture remains hidden. The selected pack will use the canonical SDK copy under `platform/godot-sdk/addons/nofi_sdk`; generated game copies will be synchronized by the existing tool.

## Capabilities

### New Capabilities

- `first-v3-game`: one human-selected, contract-conforming original game pack with a complete short loop and deterministic headless acceptance.

### Modified Capabilities

None. The existing research-selected-catalog, game-pack-contract, and single-player-app requirements already govern the evidence, pack contract, and one-app distribution; this change supplies a concrete candidate under those requirements.

## Impact

After approval, expected changes are limited to one `games/candidates/<game-id>` pack, its focused tests, the existing pack-build/catalog path, and the existing player preview. The fixture remains untouched as a hidden contract fixture except for any shared SDK synchronization required by the repository. The rollback target is the starting commit `6d2314783c2d3346c1dc242b73602ca285f4ccfa` on `platform-v3-bootstrap`.
