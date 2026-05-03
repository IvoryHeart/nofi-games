# NoFi.Games — Gameplay Improvement Plan

Based on analysis of 1,074 play sessions across 23 days (Apr 9 – May 2, 2026).
Note: maze-paint sessions are primarily developer testing from Firefox Focus (new device IDs each session), so device/retention metrics are not meaningful. This plan focuses on gameplay quality and fun.

---

## Tier 1: Unplayable Games (100% Abandonment — Zero Completions)

Six games were launched by real users but nobody ever finished a round. These need immediate investigation.

### Sudoku (5 starts, 0 completions)
- **Suspected issue**: No visible number pad on mobile. Tapping a cell does nothing obvious.
- **Fix**: Tap cell → show a floating number selector (1-9). Show pencil-mark toggle. Highlight row/col/box conflicts in real-time.
- **Fun boost**: Add "hint" button that reveals one correct cell. Auto-fill pencil marks option for beginners.

### Word Ladder (2 starts, 0 completions)
- **Suspected issue**: Players don't understand the rules, or text input doesn't work on mobile.
- **Fix**: Show an animated example on first play (COLD → CORD → CARD → WARD → WARM). Pre-fill the start/end words clearly. Make letter slots tappable with a letter picker.
- **Fun boost**: Show valid next-words as ghost hints after 10s of inactivity.

### Mastermind (2 starts, 0 completions)
- **Suspected issue**: Peg color selection isn't intuitive on touch. Players may not know the game.
- **Fix**: Tap a slot → cycle through colors (or show a color palette). Add clear visual feedback for correct position vs correct color. Show a "How to Play" panel on first launch.
- **Fun boost**: Add a "process of elimination" helper that grays out impossible colors based on previous guesses.

### Lights Out (2 starts, 0 completions)
- **Suspected issue**: Toggle mechanic unclear — players don't realize tapping affects neighbors.
- **Fix**: On first tap, briefly flash the affected neighbors before toggling. Start Easy with a 3x3 grid (only 1-2 moves from solved). Add move counter and par score.
- **Fun boost**: Add a satisfying glow/pulse animation when lights turn off. Chain reaction visual when solving.

### Nonogram (2 starts, 0 completions)
- **Suspected issue**: Cells too small on mobile. Rules are niche — most casual players have never seen a nonogram.
- **Fix**: Interactive tutorial that walks through a 3x3 puzzle. Tap to fill, long-press to mark X. Minimum 44px cell size. Highlight completed rows/cols.
- **Fun boost**: Reveal what the picture is as you solve it (fade in a preview). Celebrate each completed row/col.

### Flow Connect (1 start, 0 completions)
- **Suspected issue**: May be broken entirely. Touch-drag path drawing may not work.
- **Fix**: Verify the game renders and accepts touch input. If broken, hide from registry until fixed.
- **Fun boost**: Path-drawing animation with a flowing liquid/color-fill effect.

---

## Tier 2: Frustrating Games (Playable but Not Fun)

### Snake — 0% win rate across 46 completed sessions, median score: 0
**57% of sessions end in under 5 seconds.** Players die on their first or second move.

**What's wrong**: Starting speed is too fast for mobile swipe controls. The latency between swipe recognition and direction change means the snake hits a wall before the player can react.

**Fixes**:
- Cut starting speed in half on all difficulties
- Add a 1-second invincibility grace period at game start
- Start the snake in the center with 3+ cells of clearance from every wall
- Spawn the first food piece close to the snake (within 3 cells)
- Add a directional arrow overlay showing the current snake direction
- Consider a "no walls" mode on Easy where the snake wraps around edges

### Breakout — 0% win rate, avg 4.1 inputs per session
**Players barely interact.** Either the paddle doesn't respond to touch, or the ball is too fast to track.

**Fixes**:
- Ensure paddle responds to finger drag anywhere on the lower half of the screen
- Slow initial ball speed by 40%
- Make the ball 50% larger with a trailing glow
- Start Easy with only 3 rows of bricks
- Add screen-edge bounce sound effects for spatial audio feedback
- Add a brief auto-aim assist: paddle slightly magnetizes toward the ball's landing point on Easy

### Bubble Pop — 0% win rate, 1.0 confusion/session, 50% abandonment
**Players are confused about what to do.** The avg confusion count of 1.0 means players pause for 5+ seconds each game.

**Fixes**:
- Add aiming line/trajectory preview showing where the bubble will go
- Highlight matching bubble clusters on hover/aim
- If no matches exist, auto-add a new row and shuffle colors
- Add satisfying pop animation + chain combo counter display
- Win condition: clear the board to 20% remaining (not 0%)

### Gem Swap — 0% win rate, 75% abandonment, 2.5 confusion/session
**Players can't figure out the swap mechanic or give up fast.**

**Fixes**:
- On first play, auto-highlight a valid swap with a pulsing animation
- Add a "hint" button that shows one valid move
- Gems should have distinct shapes (not just colors) for accessibility
- Add satisfying cascade animation + combo score multiplier display
- If no valid moves exist, auto-reshuffle with a visual effect
- Remove time pressure on Easy difficulty

### Water Sort — 71% abandonment
Only 2 completions. The puzzle may be unsolvable, or the pour mechanic is unclear.

**Fixes**:
- Verify every generated puzzle is solvable (run solver before presenting)
- Add an undo button (essential for puzzle games — probably the biggest single improvement)
- Make pour animation slower and more visible
- Add empty tube(s) from the start so there's always room to maneuver
- Tubes should be large enough to easily tap on mobile (min 60px wide)

### Word Search — 82% abandonment, 7.5 confusion/session
The 2 players who figured it out both won. The game works — the UX doesn't.

**Fixes**:
- Add a drag-to-select tutorial on first play (animated finger gesture)
- Show found letters with a colored highlight that stays
- Make the word list checkable with strike-through for found words
- On Easy, highlight the first letter of each word
- Increase letter font size on mobile (currently probably too small)

---

## Tier 3: Games That Work but Could Be More Fun

### 2048 — 0% win rate (6 sessions, max score 1,296)
The 2048 tile requires ~2,000+ points minimum. Current players top out at 1,296.

**Fixes**:
- Easy: win at reaching the 256 tile
- Medium: win at 512
- Hard: win at 1024
- Expert: win at 2048
- Add an undo button (1 free undo per game, earn more by merging)
- Show a "best tile" indicator and personal best comparison

### Block Drop — 0% win rate, 60% abandonment
8 completions, decent scores (up to 6,666) but nobody "wins."

**Fixes**:
- Add a score-target win condition: Easy 3,000 / Medium 10,000 / Hard 25,000
- Add ghost piece showing landing position
- Show next 2 pieces (not just 1)
- Add a "hard drop" gesture (swipe down)
- Speed ramp should be gentler on Easy (every 20 lines instead of 10)

### Stack Block — 0% win rate in 22 sessions
No win condition = no satisfaction.

**Fixes**:
- Add height-based win targets: Easy 10 blocks / Medium 20 / Hard 30
- Add a "perfect stack" bonus animation when block aligns exactly
- Show the target height as a goal line on the screen
- Add a "wobble" visual when the tower gets unstable (above target)

### Minesweeper — 20% win rate (1 win in 5 plays)
Works but could be more forgiving.

**Fixes**:
- First click is always safe (standard minesweeper rule — verify this is implemented)
- Add a long-press to flag (verify touch UX)
- Show remaining mine count prominently
- Add a "safe reveal" hint (reveals one safe cell) — 1 free per game on Easy
- Timer display for speedrun motivation

### Hanoi — 50% win rate, decent engagement (66s avg)
Working well! Minor polish only.

**Fixes**:
- Add a move counter vs. optimal move count ("Moves: 12 / Optimal: 7")
- Add a subtle disk shadow/3D effect if not already present
- Celebrate with different animations based on how close to optimal

### Wordle — 100% win rate, 3.8 confusion/session
Everyone wins, but the confusion score suggests the keyboard/input UX causes hesitation.

**Fixes**:
- Verify the virtual keyboard highlights used/unused letters clearly
- Add letter-state coloring to the keyboard (green/yellow/gray) if not already there
- Add a word validity check on submit (shake animation for invalid words)
- Hard mode: must use revealed hints in subsequent guesses

### Sokoban — 50% win rate, but 50% ultra-short sessions
Players either solve it fast or give up immediately.

**Fixes**:
- Add an undo button (critical — one wrong push can make the puzzle unsolvable)
- Add a "reset level" button
- Start with a 3x3 tutorial level that teaches push mechanics
- Show move count vs. par
- Add a hint system: highlight the next box to push

### Anagram — 33% win rate, 2.3 confusion/session
Players pause frequently, likely struggling to find words.

**Fixes**:
- Show letter tiles that can be rearranged by drag (not just text input)
- Add a "shuffle" button to rearrange available letters
- Reveal one letter of the answer after 30s as a hint
- Show how many valid words remain to find
- Add a "give up" option that reveals the answer

---

## Tier 4: Telemetry Improvements

### Fix Misclick Detection
Misclick count is 0 across all 940 sessions. The `enrichSession()` function isn't detecting misclicks. Either the event type filter is wrong or the detection window is too tight. Fix this to get real UX friction data.

### Fix Maze-Paint Dual Events
Maze-paint fires both a win and loss session per game round, inflating counts and creating an artificial 50% win rate. Should only send one final event per completed game.

### Add Game-Launch Tracking
Can't distinguish "opened game but didn't play" from "never opened game." Add a lightweight game_launched event.

---

## Top 10 Quick Wins (Ranked by Fun-Per-Hour-of-Dev)

| # | Fix | Effort | Expected Impact |
|---|---|---|---|
| 1 | Add undo to sokoban + water-sort + 2048 | 2h | Transforms puzzle games from frustrating to satisfying |
| 2 | Snake: halve starting speed + center spawn | 30m | Makes the game actually playable |
| 3 | Add score-based win conditions to stack-block + block-drop | 1h | Gives players a goal and a win celebration |
| 4 | Sudoku: add number pad overlay | 2h | Makes the most popular puzzle game in the world playable |
| 5 | Breakout: fix touch controls + slow ball | 1h | Paddle may literally not work on mobile |
| 6 | Add hint button to gem-swap + bubble-pop | 1h | Reduces confusion for players who don't see matches |
| 7 | 2048: lower win threshold per difficulty | 30m | Lets casual players actually experience a win |
| 8 | Word search: add drag tutorial overlay | 1h | The 82% who abandon probably don't know how to select |
| 9 | Add first-play tutorial animations to lights-out + nonogram + mastermind | 3h | These games have niche rules that need explanation |
| 10 | Fix misclick telemetry | 1h | Unlocks real UX friction data for future improvements |
