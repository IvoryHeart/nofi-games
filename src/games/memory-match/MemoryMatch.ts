import { GameEngine, GameConfig, GameSnapshot } from '../../engine/GameEngine';
import { registerGame } from '../registry';

interface Card {
  symbolIndex: number;
  faceUp: boolean;
  matched: boolean;
  row: number;
  col: number;
  // Flip animation: 0 = face-down, 1 = face-up
  flipProgress: number;
  flipDirection: number; // 1 = flipping up, -1 = flipping down, 0 = idle
  // Match animation
  matchAlpha: number;      // 1 -> 0.6 on match
  sparkleTime: number;     // counts up from 0 when matched
  // Shake animation (mismatch)
  shakeTime: number;       // counts down from SHAKE_DURATION
  // Win bounce
  bounceTime: number;      // counts up when win wave reaches this card
  bounceDelay: number;     // stagger delay for wave effect
}

// ── Difficulty configs ───────────────────────────────────────
interface DifficultyConfig {
  cols: number;
  rows: number;
  pairs: number;
}

const DIFFICULTY_CONFIGS: DifficultyConfig[] = [
  { cols: 3, rows: 4, pairs: 6 },   // Easy:       3×4 = 12 cards
  { cols: 4, rows: 4, pairs: 8 },   // Medium:     4×4 = 16 cards
  { cols: 4, rows: 5, pairs: 10 },  // Hard:       4×5 = 20 cards
  { cols: 5, rows: 6, pairs: 15 },  // Extra Hard: 5×6 = 30 cards
];

const GAP = 8;
const TOP_HUD = 72;

const SYMBOL_COLORS = [
  '#E8928A', '#7CA8BF', '#8DC5A2', '#F0D08C',
  '#B49FCC', '#E8A0BF', '#F0B088', '#6B8FA3',
  // Extra symbols (indices 8-14) for difficulty 3
  '#D4836A', '#70BFA8', '#C7A94E', '#9A7FD4',
  '#E07B7B', '#6FA0D2', '#A3C76B',
];

const FLIP_DURATION = 0.25;    // 250ms
const SHAKE_DURATION = 0.3;    // 300ms
const SPARKLE_DURATION = 0.6;  // sparkle burst duration
const MATCH_FADE_SPEED = 3;    // alpha units per second
const MISMATCH_SHOW_TIME = 0.6;
const BOUNCE_DURATION = 0.4;
const BOUNCE_HEIGHT = 10;

// Easing: ease-in-out quad
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

class MemoryMatchGame extends GameEngine {
  private cards: Card[] = [];
  private flippedIndices: number[] = [];
  private mismatchTimer = 0;
  private moves = 0;
  private pairsFound = 0;
  private numPairs = 8;
  private elapsedTime = 0;
  private lockInput = false;
  private gameFinished = false;
  private winTimer = 0;

  // Grid layout (computed dynamically)
  private cols = 4;
  private rows = 4;
  private cardW = 74;
  private cardH = 98;
  private gridX = 0;
  private gridY = 0;
  private symbolScale = 1;

  constructor(config: GameConfig) {
    super(config);
  }

  init(): void {
    this.cards = [];
    this.flippedIndices = [];
    this.mismatchTimer = 0;
    this.moves = 0;
    this.pairsFound = 0;
    this.elapsedTime = 0;
    this.lockInput = false;
    this.gameFinished = false;
    this.winTimer = 0;

    // Pick difficulty config
    const diff = Math.min(Math.max(this.difficulty, 0), 3);
    const cfg = DIFFICULTY_CONFIGS[diff];
    this.cols = cfg.cols;
    this.rows = cfg.rows;
    this.numPairs = cfg.pairs;

    // Compute card sizing to fit canvas
    this.computeLayout();

    // Build deck: two of each symbol
    const symbols: number[] = [];
    for (let i = 0; i < this.numPairs; i++) {
      symbols.push(i, i);
    }

    // Fisher-Yates shuffle
    for (let i = symbols.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [symbols[i], symbols[j]] = [symbols[j], symbols[i]];
    }

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const idx = r * this.cols + c;
        this.cards.push({
          symbolIndex: symbols[idx],
          faceUp: false,
          matched: false,
          row: r,
          col: c,
          flipProgress: 0,
          flipDirection: 0,
          matchAlpha: 1,
          sparkleTime: -1,
          shakeTime: 0,
          bounceTime: -1,
          bounceDelay: 0,
        });
      }
    }

    this.setScore(0);
  }

  // ── Save / Resume ─────────────────────────────────────────

  serialize(): GameSnapshot {
    // Find the first revealed card (user's first pick of a pair, before
    // the second is chosen). Only meaningful when exactly one card is up.
    const firstPickIndex =
      this.flippedIndices.length === 1 ? this.flippedIndices[0] : -1;

    return {
      cols: this.cols,
      rows: this.rows,
      numPairs: this.numPairs,
      moves: this.moves,
      pairsFound: this.pairsFound,
      elapsedTime: this.elapsedTime,
      gameActive: !this.gameFinished,
      firstPickIndex,
      cards: this.cards.map((c) => ({
        symbolIndex: c.symbolIndex,
        faceUp: c.faceUp,
        matched: c.matched,
        row: c.row,
        col: c.col,
      })),
    };
  }

  deserialize(state: GameSnapshot): void {
    const cols = state.cols as number | undefined;
    const rows = state.rows as number | undefined;
    const rawCards = state.cards as Array<Record<string, unknown>> | undefined;

    if (
      typeof cols !== 'number' ||
      typeof rows !== 'number' ||
      cols <= 0 ||
      rows <= 0 ||
      !Array.isArray(rawCards) ||
      rawCards.length !== cols * rows
    ) {
      // Corrupt or mismatched payload — leave fresh init() state in place.
      return;
    }

    this.cols = cols;
    this.rows = rows;
    this.numPairs = (state.numPairs as number | undefined) ?? this.numPairs;
    this.moves = (state.moves as number | undefined) ?? 0;
    this.pairsFound = (state.pairsFound as number | undefined) ?? 0;
    this.elapsedTime = (state.elapsedTime as number | undefined) ?? 0;

    const gameActive = (state.gameActive as boolean | undefined) ?? true;
    this.gameFinished = !gameActive;

    // Recompute card geometry now that cols/rows may have changed.
    this.computeLayout();

    // Determine which (if any) card was the first pick of an in-progress pair.
    // Discard any "second pick pending flip-back" state — that's transient.
    const firstPickIndex = (state.firstPickIndex as number | undefined) ?? -1;

    this.cards = rawCards.map((raw, idx) => {
      const symbolIndex = (raw.symbolIndex as number | undefined) ?? 0;
      const matched = (raw.matched as boolean | undefined) ?? false;
      // Only the single first-pick card stays face-up; everything else
      // is either matched (face-up) or face-down. No mid-mismatch state.
      const faceUp = matched || idx === firstPickIndex;
      const row = (raw.row as number | undefined) ?? Math.floor(idx / cols);
      const col = (raw.col as number | undefined) ?? idx % cols;
      return {
        symbolIndex,
        faceUp,
        matched,
        row,
        col,
        flipProgress: faceUp ? 1 : 0,
        flipDirection: 0,
        matchAlpha: matched ? 0.6 : 1,
        sparkleTime: -1,
        shakeTime: 0,
        bounceTime: -1,
        bounceDelay: 0,
      };
    });

    // Restore flippedIndices to reflect at most the first pick.
    this.flippedIndices =
      firstPickIndex >= 0 && firstPickIndex < this.cards.length
        ? [firstPickIndex]
        : [];

    // No transient flip-back in flight on resume.
    this.mismatchTimer = 0;
    this.lockInput = false;
    this.winTimer = 0;
  }

  canSave(): boolean {
    // Don't save while a mismatch flip-back is pending or in progress.
    if (this.mismatchTimer > 0) return false;
    for (const card of this.cards) {
      if (card.flipDirection === -1) return false;
    }
    return !this.gameFinished;
  }

  private computeLayout(): void {
    const availW = this.width - GAP * 2;  // side padding
    const availH = this.height - TOP_HUD - GAP * 2;  // top HUD + bottom padding

    // Max card width/height fitting the grid with gaps
    const maxCardW = (availW - (this.cols - 1) * GAP) / this.cols;
    const maxCardH = (availH - (this.rows - 1) * GAP) / this.rows;

    // Maintain ~3:4 aspect ratio (w:h)
    const aspectW = 3;
    const aspectH = 4;

    let cw = maxCardW;
    let ch = cw * (aspectH / aspectW);

    if (ch > maxCardH) {
      ch = maxCardH;
      cw = ch * (aspectW / aspectH);
    }

    // Floor to whole pixels
    this.cardW = Math.floor(cw);
    this.cardH = Math.floor(ch);

    // Scale symbols relative to a "standard" card size of 74×98
    this.symbolScale = Math.min(this.cardW / 74, this.cardH / 98);

    // Center the grid
    const gridW = this.cols * this.cardW + (this.cols - 1) * GAP;
    const gridH = this.rows * this.cardH + (this.rows - 1) * GAP;
    this.gridX = Math.floor((this.width - gridW) / 2);
    this.gridY = Math.floor(TOP_HUD + (this.height - TOP_HUD - gridH) / 2);
  }

  // ── Input ─────────────────────────────────────────────────

  protected handlePointerDown(x: number, y: number): void {
    if (this.lockInput || this.gameFinished) return;

    const col = Math.floor((x - this.gridX) / (this.cardW + GAP));
    const row = Math.floor((y - this.gridY) / (this.cardH + GAP));

    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;

    // Check tap is inside card (not in gap)
    const cardX = this.gridX + col * (this.cardW + GAP);
    const cardY = this.gridY + row * (this.cardH + GAP);
    if (x < cardX || x > cardX + this.cardW || y < cardY || y > cardY + this.cardH) return;

    const idx = row * this.cols + col;
    const card = this.cards[idx];

    if (card.faceUp || card.matched) return;
    if (this.flippedIndices.includes(idx)) return;
    if (this.flippedIndices.length >= 2) return;

    // Start flip to face-up
    card.flipDirection = 1;
    card.faceUp = true;
    this.flippedIndices.push(idx);

    if (this.flippedIndices.length === 2) {
      this.moves++;
      this.lockInput = true;
    }
  }

  // ── Update ────────────────────────────────────────────────

  update(dt: number): void {
    this.elapsedTime += dt;

    // Update flip animations
    let anyFlipping = false;
    for (const card of this.cards) {
      if (card.flipDirection !== 0) {
        const speed = 1 / FLIP_DURATION; // full flip in FLIP_DURATION seconds
        card.flipProgress += card.flipDirection * speed * dt;
        if (card.flipProgress >= 1) {
          card.flipProgress = 1;
          card.flipDirection = 0;
        } else if (card.flipProgress <= 0) {
          card.flipProgress = 0;
          card.flipDirection = 0;
          card.faceUp = false;
        } else {
          anyFlipping = true;
        }
      }

      // Match fade
      if (card.matched && card.matchAlpha > 0.6) {
        card.matchAlpha = Math.max(0.6, card.matchAlpha - MATCH_FADE_SPEED * dt);
      }

      // Sparkle timer
      if (card.sparkleTime >= 0 && card.sparkleTime < SPARKLE_DURATION) {
        card.sparkleTime += dt;
      }

      // Shake timer
      if (card.shakeTime > 0) {
        card.shakeTime = Math.max(0, card.shakeTime - dt);
      }

      // Bounce timer
      if (card.bounceTime >= 0 && card.bounceTime < BOUNCE_DURATION) {
        card.bounceTime += dt;
      }
    }

    // Pair evaluation
    if (this.flippedIndices.length === 2 && !anyFlipping && this.mismatchTimer <= 0) {
      const a = this.cards[this.flippedIndices[0]];
      const b = this.cards[this.flippedIndices[1]];

      if (a.flipProgress === 1 && b.flipProgress === 1) {
        if (a.symbolIndex === b.symbolIndex) {
          // Match!
          a.matched = true;
          b.matched = true;
          a.sparkleTime = 0;
          b.sparkleTime = 0;
          this.pairsFound++;
          this.flippedIndices = [];
          this.lockInput = false;

          const seconds = Math.floor(this.elapsedTime);
          const score = Math.max(1000 - this.moves * 20 - seconds * 2, 100);
          this.setScore(score);

          // Check win
          if (this.pairsFound === this.numPairs) {
            this.gameFinished = true;
            this.winTimer = 0;
            // Start bounce wave
            for (const card of this.cards) {
              card.bounceDelay = (card.row * this.cols + card.col) * 0.06;
              card.bounceTime = -card.bounceDelay; // negative = waiting
            }
            this.gameWin();
            setTimeout(() => this.gameOver(), 1500);
          }
        } else {
          // Mismatch: start shake then timer
          a.shakeTime = SHAKE_DURATION;
          b.shakeTime = SHAKE_DURATION;
          this.mismatchTimer = MISMATCH_SHOW_TIME;
        }
      }
    }

    // Mismatch timer
    if (this.mismatchTimer > 0) {
      this.mismatchTimer -= dt;
      if (this.mismatchTimer <= 0) {
        this.mismatchTimer = 0;
        for (const idx of this.flippedIndices) {
          this.cards[idx].flipDirection = -1;
        }
        this.flippedIndices = [];
        this.lockInput = false;
      }
    }

    // Win animation timer
    if (this.gameFinished) {
      this.winTimer += dt;
      // Advance bounce timers for wave
      for (const card of this.cards) {
        if (card.bounceTime < 0) {
          card.bounceTime += dt;
          if (card.bounceTime > 0) card.bounceTime = 0;
        }
      }
    }
  }

  // ── Render ────────────────────────────────────────────────

  getHudStats(): Array<{ label: string; value: string }> {
    return [
      { label: 'Moves', value: `${this.moves}` },
      { label: 'Pairs', value: `${this.pairsFound}/${this.numPairs}` },
    ];
  }

  render(): void {
    this.clear('#FEF0E4');

    // Draw cards
    for (const card of this.cards) {
      this.renderCard(card);
    }

    // Win overlay
    if (this.gameFinished && this.winTimer > 0.5) {
      const overlayAlpha = Math.min((this.winTimer - 0.5) * 2, 0.7);
      this.ctx.fillStyle = `rgba(254, 240, 228, ${overlayAlpha})`;
      this.ctx.fillRect(0, 0, this.width, this.height);

      const textAlpha = Math.min((this.winTimer - 0.6) * 3, 1);
      this.ctx.globalAlpha = textAlpha;
      this.drawText('All Pairs Found!', this.width / 2, this.height / 2 - 16, {
        size: 24,
        color: '#3D2B35',
        weight: '700',
      });
      this.drawText(`${this.moves} moves`, this.width / 2, this.height / 2 + 16, {
        size: 16,
        color: '#8B5E83',
        weight: '500',
      });
      this.ctx.globalAlpha = 1;
    }
  }

  private renderCard(card: Card): void {
    const baseX = this.gridX + card.col * (this.cardW + GAP) + this.cardW / 2;
    const baseY = this.gridY + card.row * (this.cardH + GAP) + this.cardH / 2;

    // Bounce offset (win animation)
    let bounceOffsetY = 0;
    if (card.bounceTime >= 0 && card.bounceTime < BOUNCE_DURATION) {
      const bt = card.bounceTime / BOUNCE_DURATION;
      bounceOffsetY = -BOUNCE_HEIGHT * Math.sin(bt * Math.PI) * easeOutBack(bt < 0.5 ? bt * 2 : 1);
    }

    // Shake offset (mismatch)
    let shakeOffsetX = 0;
    if (card.shakeTime > 0) {
      const st = card.shakeTime / SHAKE_DURATION;
      shakeOffsetX = Math.sin(st * Math.PI * 6) * 2;
    }

    const cx = baseX + shakeOffsetX;
    const cy = baseY + bounceOffsetY;

    // Flip animation with easing
    const rawProgress = card.flipProgress;
    let scaleX: number;
    let showFront: boolean;

    if (rawProgress <= 0.5) {
      // Back side shrinking
      const t = rawProgress * 2; // 0 -> 1
      scaleX = 1 - easeInOut(t);
      showFront = false;
    } else {
      // Front side expanding
      const t = (rawProgress - 0.5) * 2; // 0 -> 1
      scaleX = easeInOut(t);
      showFront = true;
    }

    if (scaleX < 0.02) scaleX = 0.02;

    const drawW = this.cardW * scaleX;
    const drawX = cx - drawW / 2;
    const drawY = cy - this.cardH / 2;
    const cornerR = Math.max(6, Math.round(this.cardW * 0.1));

    this.ctx.save();

    if (showFront || card.matched) {
      // ── Front face ──
      this.ctx.globalAlpha = card.matched ? card.matchAlpha : 1.0;

      // White card with subtle border
      this.drawRoundRect(drawX, drawY, drawW, this.cardH, cornerR, '#FFFFFF', '#E2E8F0');

      // Draw symbol
      this.ctx.save();
      this.ctx.translate(cx, cy);
      this.ctx.scale(scaleX * this.symbolScale, this.symbolScale);
      this.drawSymbol(card.symbolIndex, 0, 0);
      this.ctx.restore();

      // Sparkle effect on match
      if (card.sparkleTime >= 0 && card.sparkleTime < SPARKLE_DURATION) {
        this.renderSparkles(cx, cy, card.sparkleTime);
      }
    } else {
      // ── Back face ──
      this.drawRoundRect(drawX, drawY, drawW, this.cardH, cornerR, '#8B5E83');

      // Inner lighter rect
      const inset = 5 * scaleX;
      if (drawW > inset * 2 + 4) {
        this.drawRoundRect(
          drawX + inset,
          drawY + 5,
          drawW - inset * 2,
          this.cardH - 10,
          Math.max(4, cornerR - 2),
          '#9D7396',
        );
        // Small diamond in center
        this.ctx.save();
        this.ctx.translate(cx, cy);
        this.ctx.scale(scaleX * this.symbolScale, this.symbolScale);
        this.ctx.beginPath();
        this.ctx.moveTo(0, -10);
        this.ctx.lineTo(8, 0);
        this.ctx.lineTo(0, 10);
        this.ctx.lineTo(-8, 0);
        this.ctx.closePath();
        this.ctx.fillStyle = '#B08AAA';
        this.ctx.fill();
        this.ctx.restore();
      }
    }

    this.ctx.restore();
  }

  private renderSparkles(cx: number, cy: number, time: number): void {
    const progress = time / SPARKLE_DURATION;
    const alpha = 1 - progress;
    const spread = 15 + progress * 25 * this.symbolScale;

    this.ctx.save();
    this.ctx.globalAlpha = alpha * 0.8;

    const sparkleCount = 8;
    for (let i = 0; i < sparkleCount; i++) {
      const angle = (i / sparkleCount) * Math.PI * 2 + progress * 1.5;
      const dist = spread * (0.6 + 0.4 * Math.sin(i * 2.3));
      const sx = cx + Math.cos(angle) * dist;
      const sy = cy + Math.sin(angle) * dist;
      const size = (2 + Math.sin(i * 1.7) * 1.5) * this.symbolScale * (1 - progress * 0.5);

      // Draw a small 4-point star
      this.ctx.fillStyle = i % 2 === 0 ? '#F0D08C' : '#E8A0BF';
      this.ctx.beginPath();
      this.ctx.moveTo(sx, sy - size);
      this.ctx.lineTo(sx + size * 0.3, sy);
      this.ctx.lineTo(sx, sy + size);
      this.ctx.lineTo(sx - size * 0.3, sy);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.moveTo(sx - size, sy);
      this.ctx.lineTo(sx, sy + size * 0.3);
      this.ctx.lineTo(sx + size, sy);
      this.ctx.lineTo(sx, sy - size * 0.3);
      this.ctx.closePath();
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  // ── Symbol Drawing ────────────────────────────────────────
  // All drawn at (0,0) in local coordinates, pre-scaled by caller.

  private drawSymbol(index: number, ox: number, oy: number): void {
    const color = SYMBOL_COLORS[index] || SYMBOL_COLORS[0];
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;

    switch (index) {
      case 0:  this.drawStar(ox, oy, color); break;
      case 1:  this.drawHeart(ox, oy, color); break;
      case 2:  this.drawDiamond(ox, oy, color); break;
      case 3:  this.drawSymCircle(ox, oy, color); break;
      case 4:  this.drawSquare(ox, oy, color); break;
      case 5:  this.drawTriangle(ox, oy, color); break;
      case 6:  this.drawMoon(ox, oy, color); break;
      case 7:  this.drawCross(ox, oy, color); break;
      case 8:  this.drawPentagon(ox, oy, color); break;
      case 9:  this.drawArrow(ox, oy, color); break;
      case 10: this.drawLightning(ox, oy, color); break;
      case 11: this.drawSpiral(ox, oy, color); break;
      case 12: this.drawFlower(ox, oy, color); break;
      case 13: this.drawWave(ox, oy, color); break;
      case 14: this.drawRing(ox, oy, color); break;
    }
  }

  // ── Original 8 symbols ──

  private drawStar(ox: number, oy: number, color: string): void {
    const spikes = 5;
    const outerR = 20;
    const innerR = 9;
    this.ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (Math.PI / 2 * 3) + (i * Math.PI / spikes);
      const px = ox + Math.cos(angle) * r;
      const py = oy + Math.sin(angle) * r;
      if (i === 0) this.ctx.moveTo(px, py);
      else this.ctx.lineTo(px, py);
    }
    this.ctx.closePath();
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }

  private drawHeart(ox: number, oy: number, color: string): void {
    const s = 1.1;
    this.ctx.beginPath();
    this.ctx.moveTo(ox, oy + 8 * s);
    this.ctx.bezierCurveTo(ox - 2 * s, oy + 2 * s, ox - 18 * s, oy - 2 * s, ox - 18 * s, oy - 10 * s);
    this.ctx.bezierCurveTo(ox - 18 * s, oy - 20 * s, ox, oy - 18 * s, ox, oy - 8 * s);
    this.ctx.bezierCurveTo(ox, oy - 18 * s, ox + 18 * s, oy - 20 * s, ox + 18 * s, oy - 10 * s);
    this.ctx.bezierCurveTo(ox + 18 * s, oy - 2 * s, ox + 2 * s, oy + 2 * s, ox, oy + 8 * s);
    this.ctx.closePath();
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }

  private drawDiamond(ox: number, oy: number, color: string): void {
    this.ctx.beginPath();
    this.ctx.moveTo(ox, oy - 22);
    this.ctx.lineTo(ox + 15, oy);
    this.ctx.lineTo(ox, oy + 22);
    this.ctx.lineTo(ox - 15, oy);
    this.ctx.closePath();
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }

  private drawSymCircle(ox: number, oy: number, color: string): void {
    this.ctx.beginPath();
    this.ctx.arc(ox, oy, 18, 0, Math.PI * 2);
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }

  private drawSquare(ox: number, oy: number, color: string): void {
    const size = 30;
    this.ctx.beginPath();
    this.ctx.roundRect(ox - size / 2, oy - size / 2, size, size, 4);
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }

  private drawTriangle(ox: number, oy: number, color: string): void {
    this.ctx.beginPath();
    this.ctx.moveTo(ox, oy - 20);
    this.ctx.lineTo(ox + 20, oy + 14);
    this.ctx.lineTo(ox - 20, oy + 14);
    this.ctx.closePath();
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }

  private drawMoon(ox: number, oy: number, color: string): void {
    this.ctx.beginPath();
    this.ctx.arc(ox - 3, oy, 18, 0, Math.PI * 2);
    this.ctx.fillStyle = color;
    this.ctx.fill();
    // Cut-out (use card front color)
    this.ctx.beginPath();
    this.ctx.arc(ox + 7, oy - 3, 15, 0, Math.PI * 2);
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fill();
  }

  private drawCross(ox: number, oy: number, color: string): void {
    const arm = 20;
    const thick = 10;
    this.ctx.beginPath();
    this.ctx.roundRect(ox - thick / 2, oy - arm, thick, arm * 2, 3);
    this.ctx.fillStyle = color;
    this.ctx.fill();
    this.ctx.beginPath();
    this.ctx.roundRect(ox - arm, oy - thick / 2, arm * 2, thick, 3);
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }

  // ── Extra 7 symbols for difficulty 3 ──

  private drawPentagon(ox: number, oy: number, color: string): void {
    const r = 18;
    this.ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const px = ox + Math.cos(angle) * r;
      const py = oy + Math.sin(angle) * r;
      if (i === 0) this.ctx.moveTo(px, py);
      else this.ctx.lineTo(px, py);
    }
    this.ctx.closePath();
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }

  private drawArrow(ox: number, oy: number, color: string): void {
    this.ctx.beginPath();
    // Arrow pointing up
    this.ctx.moveTo(ox, oy - 22);
    this.ctx.lineTo(ox + 16, oy - 4);
    this.ctx.lineTo(ox + 8, oy - 4);
    this.ctx.lineTo(ox + 8, oy + 18);
    this.ctx.lineTo(ox - 8, oy + 18);
    this.ctx.lineTo(ox - 8, oy - 4);
    this.ctx.lineTo(ox - 16, oy - 4);
    this.ctx.closePath();
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }

  private drawLightning(ox: number, oy: number, color: string): void {
    this.ctx.beginPath();
    this.ctx.moveTo(ox + 2, oy - 22);
    this.ctx.lineTo(ox + 14, oy - 22);
    this.ctx.lineTo(ox + 4, oy - 4);
    this.ctx.lineTo(ox + 14, oy - 4);
    this.ctx.lineTo(ox - 6, oy + 22);
    this.ctx.lineTo(ox - 2, oy + 4);
    this.ctx.lineTo(ox - 12, oy + 4);
    this.ctx.closePath();
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }

  private drawSpiral(ox: number, oy: number, color: string): void {
    this.ctx.beginPath();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 3;
    this.ctx.lineCap = 'round';
    const turns = 2.5;
    const maxR = 18;
    const steps = 60;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = t * turns * Math.PI * 2;
      const r = t * maxR;
      const px = ox + Math.cos(angle) * r;
      const py = oy + Math.sin(angle) * r;
      if (i === 0) this.ctx.moveTo(px, py);
      else this.ctx.lineTo(px, py);
    }
    this.ctx.stroke();
    this.ctx.lineCap = 'butt';
  }

  private drawFlower(ox: number, oy: number, color: string): void {
    const petalR = 9;
    const dist = 10;
    const petals = 5;
    this.ctx.fillStyle = color;
    for (let i = 0; i < petals; i++) {
      const angle = (i / petals) * Math.PI * 2 - Math.PI / 2;
      const px = ox + Math.cos(angle) * dist;
      const py = oy + Math.sin(angle) * dist;
      this.ctx.beginPath();
      this.ctx.arc(px, py, petalR, 0, Math.PI * 2);
      this.ctx.fill();
    }
    // Center circle
    this.ctx.beginPath();
    this.ctx.arc(ox, oy, 5, 0, Math.PI * 2);
    this.ctx.fillStyle = '#F0D08C';
    this.ctx.fill();
  }

  private drawWave(ox: number, oy: number, color: string): void {
    this.ctx.beginPath();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 4;
    this.ctx.lineCap = 'round';
    const amplitude = 10;
    const waveWidth = 36;
    const startX = ox - waveWidth / 2;
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const px = startX + t * waveWidth;
      const py = oy + Math.sin(t * Math.PI * 3) * amplitude;
      if (i === 0) this.ctx.moveTo(px, py);
      else this.ctx.lineTo(px, py);
    }
    this.ctx.stroke();
    this.ctx.lineCap = 'butt';
  }

  private drawRing(ox: number, oy: number, color: string): void {
    this.ctx.beginPath();
    this.ctx.arc(ox, oy, 18, 0, Math.PI * 2);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 5;
    this.ctx.stroke();
    // Inner dot
    this.ctx.beginPath();
    this.ctx.arc(ox, oy, 5, 0, Math.PI * 2);
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }
}

// ── Self-register ─────────────────────────────────────────

registerGame({
  id: 'memory-match',
  name: 'Memory',
  description: 'Find all matching pairs',
  icon: '\u2663',
  color: '--game-memory',
  bgGradient: ['#D8704D', '#F0A880'],
  category: 'card',
  createGame: (config) => new MemoryMatchGame(config),
  canvasWidth: 340,
  canvasHeight: 400,
  controls: 'Tap cards to flip and find pairs',
});
