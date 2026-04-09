# NoFi.Games — Continuous Improvement Workflow

## The Loop

```
  COLLECT → ANALYZE → HYPOTHESIZE → TEST → SHIP → MONITOR
     ↑                                                 │
     └─────────────────────────────────────────────────┘
```

## 1. Collect (automatic)

Players opt in via Settings → "Help improve games". Data flows to Supabase:
- **Session summaries**: game, difficulty, score, won, duration, input timing, confusion moments
- **Replay logs**: full event streams for every session

No action needed — this runs 24/7 as long as players have opted in.

## 2. Analyze (on demand)

```bash
# Set your Supabase access token (or add to .env.local)
export SUPABASE_ACCESS_TOKEN=your-token

# Pull the telemetry dashboard
npm run analyze
```

This prints:
- **Overview**: total sessions, unique devices, overall win rate
- **Win rates by game + difficulty**: the key balance metric
- **Most played games**: what players are actually engaging with
- **Confusion hotspots**: games where players frequently pause >5 seconds
- **Daily active devices**: retention trend
- **Platform breakdown**: mobile vs desktop vs tablet split
- **Replay log stats**: how many replays stored, avg events per replay

### What to look for

| Signal | Meaning | Action |
|--------|---------|--------|
| Easy win rate < 40% | Too hard for beginners | Reduce grid size, add hints, increase time |
| Hard win rate > 70% | Too easy for experienced players | Add obstacles, reduce time, increase grid |
| High confusion count | Players are stuck / lost | Improve tutorial, add visual cues, simplify rules |
| Short avg duration | Players quit early | Check if the game is too punishing on first mistakes |
| Low play count for a game | Players don't try it | Improve the card thumbnail, description, or icon |
| Mobile-heavy platform split | Prioritize touch UX over keyboard | Focus testing on mobile gestures |

## 3. Hypothesize

Based on the analysis, form a concrete hypothesis:
- "Minesweeper Easy has a 15% win rate because the grid starts with too many mines"
- "Snake players average 3 confusion moments because the controls feel jerky on mobile"
- "Wordle isn't being played much because the word list is too obscure"

## 4. Test locally with the autoplay agent

```bash
# Run the baseline (before your change)
npm run autoplay 2>&1 | tee /tmp/baseline.txt

# Make your change (e.g. reduce Minesweeper Easy mines from 10 to 7)
# ... edit the game file ...

# Run again (after your change)
npm run autoplay 2>&1 | tee /tmp/after.txt

# Compare
diff /tmp/baseline.txt /tmp/after.txt
```

Look for:
- Did Easy win rate go UP? (good — more accessible)
- Did Hard win rate stay LOW? (good — still challenging)
- Did any game crash? (bad — regression)
- Did score distributions change as expected?

### Autoplay strategies

The agent uses different strategies per game type:
- **Directional** (2048, Snake, Block Drop): random arrow keys
- **Tap-grid** (Minesweeper, Nonogram, Sudoku): random coordinates
- **Type-letters** (Wordle, Anagram): random A-Z + Enter + Backspace
- **Random** (Breakout, Stack Block): mix of keys and taps

The random baseline answers: "Can a monkey win this game?" If a monkey can win Easy 50%+ of the time, Easy is probably too easy.

Future: add smarter strategies (Wordle solver, Sudoku backtracker, Snake pathfinder) to test realistic difficulty curves.

## 5. Ship

```bash
git add -A && git commit -m "Reduce Minesweeper Easy mines from 10 to 7"
git push  # Vercel auto-deploys
```

## 6. Monitor

Wait 24-48 hours for real player data to accumulate, then run `npm run analyze` again. Compare the new win rates / confusion counts with the previous batch.

If the change improved things → move on.
If not → revert or try a different approach.

## Cadence

- **Weekly**: run `npm run analyze`, scan for outliers
- **On every game change**: run `npm run autoplay` before and after
- **On user feedback**: check the specific game's metrics in the dashboard

## Tools Reference

| Command | What it does | When to run |
|---------|-------------|-------------|
| `npm run analyze` | Query Supabase for real player metrics | Weekly or on-demand |
| `npm run autoplay` | Play all 16 games locally with synthetic inputs | Before/after any game change |
| `npm test` | Run the 1197-test suite | Before every commit |
| `npm run build` | Production build | Before pushing (CI also runs it) |
