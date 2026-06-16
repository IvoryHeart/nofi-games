# Dice Tycoon — a Monopoly GO–style game for NoFi.Games

**Status:** Phase 1 (offline core) COMPLETE & committed on `feature/social-vibing` · Phase 2 (social) deferred
**Owner:** Yaswanth
**Created:** 2026-06-16
**Game id:** `dice-tycoon` · **URL:** `nofi.games/dice-tycoon` · **Category:** `strategy`

---

## 1. Why this doc exists

We're adapting Monopoly GO to NoFi.Games. This file is the durable record of the
research, the key decisions, the agreed scope, and the spec so we don't
re-litigate as we build across multiple sessions.

---

## 2. Research: what makes Monopoly GO work

Sources: monopolygogame.com, pcgamesn wiki, soaphub (dice economy), thegamer
(free dice), simplegameguide (tiles), udonis (games-like / social loop).

**Core loop:** roll 2 dice → move around a single looping board → land on tiles
that pay or charge you → spend earnings to build landmarks → complete the board →
unlock the next themed board → repeat.

**The retention engine — dice are energy, not infinite.** Rolls regenerate over
real time (~1 per few minutes, ~8–10h to refill from empty), up to a cap. This is
the entire "come back later" hook and the monetization surface in the original.

**Tile types:** Property (earn), Tax (lose), Chance / Community Chest (random
card), Railroad (triggers a mini-game), and corners — GO (salary on pass), Jail,
Free Parking (jackpot pool), Go-to-Jail.

**The social layer is _asynchronous_, not real-time** (the key insight). Coin
Master–style: you **Raid / Shutdown** snapshots of other players' boards to steal
coins, protect yours with **Shields**, and read a **timeline** of who hit you.
You act on a stored snapshot of another player — there is no live turn-based match.

**Meta layers:** roll **multipliers** (bet more dice for proportionally bigger
reward), **sticker albums** (collect → complete sets → rewards), and rotating
daily/weekly **events + tournaments**.

---

## 3. The architectural tension & how we resolve it

NoFi.Games is **offline-first, zero-network** (see CLAUDE.md "Performance
Principles"). Monopoly GO looks always-online. But its social layer is **async
snapshot-raiding, not live multiplayer**, which maps cleanly onto our existing
stack **without websockets**:

| Monopoly GO feature | NoFi adaptation | Cost |
|---|---|---|
| Dice = energy, regen over time | Local-clock regen, timestamp in IndexedDB | Offline, free |
| Rivals to raid | Deterministic **AI** boards by default | Offline, free |
| (online) Raid real players | Optional Supabase board **snapshots** | Later phase |
| Daily/weekly events, tournaments | **Vercel cron** rotates a global seed | Later phase |
| Sticker albums | Seeded packs via `this.rng()` | Offline, free |

**Decision:** ship a **fully-playable offline single-player game first**, with the
async-social layer as a later, gracefully-degrading enhancement. Confirmed with
user 2026-06-16: *"Offline core first."*

This respects the #1 principle (performance / offline) while leaving a clean seam
for the social layer the user explicitly wants (Vercel crons, multiplayer-ish).

---

## 4. Scope decisions (locked)

- **Phase 1 (this build):** offline core only. No Supabase, no cron, no new tables.
- AI rivals are **deterministic** (generated from a seed), so they're stable across
  saves and identical in Daily Mode.
- `continuableAfterWin: true` — completing a board is a celebration, play continues
  on the next board (like 2048 passing 2048). The "win" fires on **first board
  completion**.
- `dailyMode: true` — a seeded daily board challenge. All randomness MUST go
  through `this.rng()` (never `Math.random()`), unlike the older 2048 code.
- Difficulty maps to economy tuning (rival aggression, regen rate, costs), not to
  board size.

---

## 5. Game design spec (Phase 1)

### 5.1 Board
- Single looping track of **20 tiles** (corners at indices 0/5/10/15), rendered as
  a square ring around the canvas with a center info/action panel.
- Player token hops tile-by-tile when a roll resolves (animated, ~90ms/hop).
- All coordinates relative to `this.width`/`this.height`; content stays below
  `HUD_CLEARANCE` (72px).

### 5.2 Tiles
| Tile | Effect |
|---|---|
| GO (corner 0) | Collect salary when landing on **or passing** |
| Property | Earn coins = `base × boardLevel × multiplier`. Build slot for landmarks. |
| Tax | Lose coins (`-tax × multiplier`) |
| Chance | Draw a seeded card: bonus coins / +dice / +shield / sticker / "go to" |
| Treasure (Community Chest) | Mostly-positive seeded card (coins/dice/sticker) |
| Railroad / Heist (corner-ish) | Trigger **Raid** mini-event vs a rival |
| Jail (corner 5) | Skip next roll (1 turn) |
| Free Parking (corner 10) | Collect the accumulated jackpot pool (taxes feed it) |
| Go-to-Jail (corner 15) | Sends token to Jail |

### 5.3 Economy & resources
- **Coins** — primary currency. Spent to build landmarks.
- **Dice (energy)** — consumed per roll (× multiplier). Regenerate **1 per N
  minutes** (difficulty-tuned, e.g. 5 min) up to a **cap** (e.g. 30). Stored as a
  count + a `lastRegenAt` timestamp; on load we credit elapsed regen. Daily Mode
  gives a fixed dice budget and does **not** regen (deterministic).
- **Shields** — absorb one rival raid each (cap ~3).
- **Multiplier** — ×1 / ×3 / ×10. Spends that many dice per roll, scales all coin
  rewards/penalties by the same factor.

### 5.4 Landmarks & board completion
- Each board has **4 landmarks**, each with a coin cost. Build them in order from
  earned coins. Building the last landmark = **board complete**.
- Board complete → `gameWin()` on the **first** completion (celebration), award a
  bonus (coins + dice + a guaranteed sticker), advance `boardLevel`, regenerate a
  fresh themed board, keep playing. Higher boards = higher costs and payouts.

### 5.5 AI rivals & raids
- A small roster of **deterministic** rival profiles (name, coin pile, shield
  count) seeded from the run seed + boardLevel.
- Landing on a Heist/Railroad tile opens a quick **Raid**: pick one of 3 face-down
  vaults (seeded outcome) to steal a cut of a rival's coins, unless they have a
  shield (then it's blocked, consuming their shield). Pure single-player vs AI in
  Phase 1.
- Rivals also periodically "raid you back" between your turns (drains coins unless
  you hold a shield) — creates the timeline/tension without a server.

### 5.6 Stickers
- A small album (e.g. 3 sets × 4 stickers). Cards/board-completions grant seeded
  sticker drops. Completing a set grants coins + dice. Persisted in the save.

### 5.7 Score
- Score = **net worth** proxy: `coins + landmarksBuilt × weight + boardLevel ×
  weight + stickers × weight`. Reported via `setScore()` so the HUD pill and
  leaderboard/best-score path work unchanged.

### 5.8 Input
- **Tap / Space / Enter** = roll. Tap the multiplier chip to cycle ×1/×3/×10.
- Raid mini-event: tap a vault. Help (`?`) lists controls.
- No app-level binding of Space/arrows on game screen (per CLAUDE.md) — game owns them.

### 5.9 Difficulty (economy tuning, not board size)
| Level | Regen | Rival aggression | Landmark cost | Start dice |
|---|---|---|---|---|
| Easy | fast | low | low | high |
| Medium | medium | medium | medium | medium |
| Hard | slow | high | high | low |
| Extra | slowest | highest | highest | lowest |

### 5.10 Save / resume
- `serialize()`: board level, tiles, token pos, coins, dice + `lastRegenAt`,
  shields, multiplier, landmarks built, rivals, sticker album, jackpot pool,
  jail/skip state.
- `deserialize()`: validate defensively; reset transient hop/raid animations.
- `canSave()`: false during hop/raid animations.
- Daily Mode: no auto-resume (always fresh from the daily seed).

---

## 6. Files (Phase 1)

| File | Purpose |
|---|---|
| `src/games/dice-tycoon/DiceTycoon.ts` | The game (extends `GameEngine`, self-registers) |
| `src/games/registry.ts` | Add `import('./dice-tycoon/DiceTycoon')` to `loadAllGames()` |
| `src/games/icons.ts` | Add `dice-tycoon` SVG icon |
| `src/styles/theme.css` | Add `--game-dice-tycoon` color token |
| `public/sitemap.xml` | Add `nofi.games/dice-tycoon` |
| `tests/integration/dice-tycoon.test.ts` | serialize round-trip, canSave guards, regen math, raid/shield, board-completion win, all 4 difficulties, dailyMode determinism |

Registration metadata: `category: 'strategy'`, `continuableAfterWin: true`,
`dailyMode: true`, `canvasWidth/Height` ~360×640, `controls` text,
`perGameSettings` (optional: e.g. "Auto-roll" toggle — TBD).

---

## 7. Phase 2+ (NOT in this build — recorded so we don't forget the vision)

The user explicitly wants the social/multiplayer layer eventually (Vercel crons +
stack). Deferred design:

- **Tables** (`supabase/migrations/003_tycoon.sql`): `tycoon_players` (device_id,
  board snapshot, coins, shields, score; anon INSERT/UPSERT own row, read for
  raid-target selection), `tycoon_raids` (attacker, target, amount, ts — feeds the
  timeline). Reuse existing RLS pattern (anon insert-only, no cross-player reads of
  PII; raids expose only coin deltas).
- **API** (`api/tycoon/*.ts`, `@vercel/node` like existing `api/chat.ts`):
  `snapshot.ts` (publish my board), `raid.ts` (fetch a raidable opponent +
  record outcome).
- **Cron** (`api/cron/tycoon-event.ts` + `vercel.json` `crons`): rotate a daily
  global event seed and reset a weekly tournament leaderboard window.
- **Graceful degradation:** if offline / no consent / endpoints down, fall back to
  AI rivals. Online is strictly additive.

Open questions for Phase 2: identity bridge (device_id → future auth), anti-cheat
(replay logs already captured by the engine), leaderboard scope (global vs
friends).

---

## 8. Decision log

- **2026-06-16** — Researched Monopoly GO. Identified async-raid (not live MP) as
  the key fit. User chose **"Offline core first"** for the build scope. Name:
  **Dice Tycoon**. This doc written to preserve the plan.
- **2026-06-16** — Phase 1 built via orchestrated agents (4 parallel worktree
  agents for the pure modules `economy`/`board`/`rivals`/`stickers`, then 1
  integrator for `DiceTycoon.ts` + wiring + integration tests). Landed on
  `feature/social-vibing` (commits 9da86d6, eafe62c, 2ef5a61, 5b19e91, 5d14bee).
  **97 unit tests + 25 integration tests**; full suite **1790 pass / 0 fail**;
  `npm run build` green (DiceTycoon chunk 8KB gzip, under the 50KB budget).
  Follow-up before launch: balance pass (landmark cost escalation, board-completion
  bonus, daily 40-dice budget are untuned guesses) + a UI polish pass on the
  360×640 center panel / raid overlay.
