# NoFi.Games Play Analytics Report

**Period**: April 9 – May 2, 2026 (23 days since launch)
**Generated**: May 2, 2026

---

## Executive Summary

1,074 play sessions from 79 unique devices across 17 games. Maze-paint accounts for 81% of all sessions (primarily developer testing from Firefox Focus, which generates new device IDs per session — device counts and retention metrics are not meaningful). Excluding maze-paint, the key finding is that **6 games have 100% abandonment** (zero completions ever), **5 arcade games have 0% win rate**, and the games that do work (wordle, sokoban, ricochet, hanoi) show decent engagement. The catalog's fun potential is being held back by broken input on mobile and missing tutorials for niche games.

---

## 1. High-Level Metrics

| Metric | Value |
|---|---|
| Total sessions | 1,074 |
| Completed (final) | 940 (87.5%) |
| Abandoned (partial) | 134 (12.5%) |
| Unique devices | 79 |
| Multi-day returners | 3 (4.4%) |
| Daily mode sessions | 3 |
| Games played | 17 of 17 |
| Date range | Apr 9 – May 2, 2026 |

## 2. Per-Game Breakdown

| Game | Plays | Wins | Win% | Avg Duration | Avg Inputs | Avg Confusion | Abandon% |
|---|---|---|---|---|---|---|---|
| maze-paint | 761 | 380 | 49.9% | 17s | 44 | 0.0 | 1.2% |
| snake | 46 | 0 | **0.0%** | 29s | 16 | 0.0 | 27.0% |
| sokoban | 36 | 18 | 50.0% | 11s | 38 | 0.0 | 10.0% |
| stack-block | 22 | 0 | **0.0%** | 22s | 134 | 0.0 | 38.9% |
| wordle | 17 | 17 | **100%** | 120s | 85 | 3.8 | 37.0% |
| block-drop | 8 | 0 | **0.0%** | 86s | 157 | 0.3 | 60.0% |
| breakout | 7 | 0 | **0.0%** | 23s | 4 | 0.1 | 53.3% |
| ricochet | 7 | 4 | 57.1% | 26s | 6 | 1.7 | 22.2% |
| 2048 | 6 | 0 | **0.0%** | 46s | 136 | 0.2 | 57.1% |
| hanoi | 6 | 3 | 50.0% | 66s | 85 | 0.3 | 40.0% |
| bubble-pop | 6 | 0 | **0.0%** | 72s | 44 | 1.0 | 50.0% |
| minesweeper | 5 | 1 | 20.0% | 46s | 52 | 0.4 | 16.7% |
| memory-match | 4 | 2 | 50.0% | 16s | 43 | 0.0 | 33.3% |
| anagram | 3 | 1 | 33.3% | 56s | 27 | 2.3 | 50.0% |
| water-sort | 2 | 1 | 50.0% | 9s | 14 | 0.0 | 71.4% |
| word-search | 2 | 2 | 100% | 170s | 25 | 7.5 | 81.8% |
| gem-swap | 2 | 0 | **0.0%** | 94s | 53 | 2.5 | 75.0% |

### Games with 100% Abandonment (zero completions)

| Game | Sessions Started | Completions |
|---|---|---|
| sudoku | 5 | 0 |
| word-ladder | 2 | 0 |
| mastermind | 2 | 0 |
| lights-out | 2 | 0 |
| nonogram | 2 | 0 |
| flow-connect | 1 | 0 |

These games were opened but nobody ever finished a single round.

## 3. Retention & Engagement

### Retention
- **95.6% single-day users** — 65 of 68 unique devices never returned after their first day
- Only **3 devices** came back on a subsequent day
- This is the single most critical metric to fix

### Game Discovery
| Games tried | Devices |
|---|---|
| 1 game | 52 (76%) |
| 2 games | 8 (12%) |
| 3 games | 2 (3%) |
| 4+ games | 6 (9%) |

Three quarters of users play exactly one game and leave.

### Session Duration Distribution
| Bucket | Sessions | % |
|---|---|---|
| < 5 seconds | 78 | 8.3% |
| 5 – 30 seconds | 771 | 82.0% |
| 30s – 2 minutes | 75 | 8.0% |
| 2 – 5 minutes | 14 | 1.5% |
| 5 – 15 minutes | 2 | 0.2% |

90% of sessions end within 30 seconds. Even excluding maze-paint (which has fast rounds by design), sessions are very short.

### Ultra-Short Sessions (< 5s) — Frustration Indicator
| Game | Ultra-short / Total | % |
|---|---|---|
| snake | 26 / 46 | **57%** |
| sokoban | 18 / 36 | **50%** |
| block-drop | 3 / 8 | 38% |
| stack-block | 3 / 22 | 14% |
| breakout | 1 / 7 | 14% |

Snake and sokoban have over half their sessions ending in under 5 seconds.

## 4. Maze-Paint Deep Dive

Maze-paint dominates with 81% of all sessions. Key characteristics:
- **Median session**: 14.9 seconds (P10: 9.5s, P90: 22.8s)
- **Win rate**: exactly 50% (every game produces a win + loss event pair due to partial checkpointing)
- **Input interval**: 267ms median — consistent with real human swipe/drag input
- **41 unique devices** played it, with highly variable engagement (2–114 sessions per device)
- **99% completion rate** — almost nobody abandons mid-game
- **Confusion count**: near-zero — the game is instantly understandable

This game works. It's fast, intuitive, and addictive. But it's masking the failure of every other game.

## 5. Confusion Hotspots

Games where players pause for > 5 seconds (confusion moments):

| Game | Avg Confusion per Session |
|---|---|
| word-search | 7.5 |
| wordle | 3.8 |
| gem-swap | 2.5 |
| anagram | 2.3 |
| ricochet | 1.7 |
| bubble-pop | 1.0 |

Word-search and wordle have the most "thinking pauses." For word-search this is expected (scanning for words). For wordle, 3.8 confusion moments per session suggests letter input UX may need work.

## 6. Misclick Detection

**Misclick count is 0 across all 940 sessions.** The misclick detection in `enrichSession()` is either broken or the detection threshold is wrong. This metric is currently useless.

## 7. Daily Mode

Only **3 sessions** used daily mode in 23 days. The feature is invisible to users. It needs prominent placement and possibly push notifications.

## 8. Daily Activity Trend

| Date | Sessions | Devices | Games Played |
|---|---|---|---|
| Apr 9 | 21 | 4 | 7 |
| Apr 10 | 60 | 12 | 12 |
| Apr 11 | 45 | 12 | 6 |
| Apr 12 | 1 | 1 | 1 |
| Apr 17 | 9 | 2 | 1 |
| Apr 18 | 127 | 5 | 2 |
| Apr 19 | 248 | 6 | 1 |
| Apr 20 | 96 | 5 | 4 |
| Apr 21 | 92 | 6 | 1 |
| Apr 22 | 60 | 6 | 1 |
| Apr 23 | 92 | 4 | 1 |
| Apr 25 | 22 | 2 | 1 |
| Apr 26 | 21 | 3 | 1 |
| Apr 27 | 8 | 2 | 1 |
| Apr 29 | 28 | 4 | 2 |
| May 1 | 2 | 1 | 1 |
| May 2 | 8 | 1 | 1 |

The Apr 10 spike (12 different games played) was the best day for game diversity. After Apr 11, almost all activity collapsed to maze-paint only. The Apr 18-19 spike (375 sessions) was entirely maze-paint.

## 9. Peak Hours (UTC)

Peak play times: **14:00** (111 sessions), **16:00** (105), **21:00** (174). Given most users are in Europe/London and Asia/Calcutta timezones, this maps to afternoon and late evening play — typical casual gaming hours.

## 10. Platform Split

| Platform | Devices |
|---|---|
| Mobile | ~73 (86%) |
| Desktop | ~15 (14%) |

Overwhelmingly mobile users. Screen sizes cluster around 427x949 (likely a specific Android device model used for sharing/testing).

---

## Score Distributions (Arcade Games)

| Game | Min | P25 | Median | P75 | Max |
|---|---|---|---|---|---|
| snake | 0 | 0 | 0 | 10 | 245 |
| 2048 | 340 | 376 | 548 | 604 | 1,296 |
| block-drop | 0 | 136 | 781 | 6,466 | 6,666 |
| stack-block | 5 | 30 | 235 | 1,130 | 2,670 |

Snake's median score of **0** confirms players are dying immediately.
