/**
 * Dice Tycoon — Pixi PX3 MGO-style chrome (control bar + cash counter).
 *
 * Procedural ONLY. Builds:
 *  - the bottom control bar: two glossy 3D dice cubes (pips, tumble→settle on a
 *    real roll), a big glossy GO! button, and a ×1/×5/×20 multiplier dial whose
 *    colour reflects affordability (gold/green/plum);
 *  - the top cash counter: a glossy pill with a coin glyph + odometer tick-roll
 *    count-up, plus a compact dice / shields / board-level readout.
 *
 * Modelled on /tmp/mgo1.png (style), /tmp/mgo2.png (shields/coin pills) and the
 * bottom HUD from MGO knowledge. Layout + odometer + pip + tumble + tone math
 * are the unit-tested pure helpers in chromeMath.
 */

import { Container, Graphics, Text } from 'pixi.js';
import { MULTIPLIERS } from '../../games/dice-tycoon/economy';
import {
  ControlBarLayout,
  controlBarLayout,
  dicePips,
  diceTumbleFace,
  formatCoins,
  multiplierTone,
  odometerStep,
} from './chromeMath';

const GOLD = 0xf7b500;
const GOLD_HI = 0xffe08a;
const GOLD_SH = 0xb97e00;
const INK = 0x3a2a36;
const CREAM = 0xfff7ec;
const GREEN = 0x3fa97a;
const GREEN_SH = 0x2c8460;
const PLUM = 0x7e6bd6;
const PLUM_SH = 0x5a4aa8;

const TONE_FILL: Record<string, number> = { gold: GOLD, green: GREEN, plum: PLUM };
const TONE_SH: Record<string, number> = { gold: GOLD_SH, green: GREEN_SH, plum: PLUM_SH };

/** A glossy 3D die cube with live pips. */
class DieCube {
  readonly root = new Container();
  private body = new Graphics();
  private pips = new Graphics();
  private face = 1;
  private r = 16;
  // tumble state
  private tumbling = false;
  private tElapsed = 0;
  private tDuration = 0.5;
  private tFinal = 1;
  private tSeed = 0;

  constructor() {
    this.root.addChild(this.body, this.pips);
    this.draw();
  }

  setSize(r: number): void {
    this.r = r;
    this.draw();
  }

  /** Begin a tumble that settles on `finalFace`. */
  roll(finalFace: number, seed: number, duration = 0.5): void {
    this.tumbling = true;
    this.tElapsed = 0;
    this.tDuration = duration;
    this.tFinal = finalFace;
    this.tSeed = seed;
  }

  /** Show a static face (e.g. on resume). */
  setFace(f: number): void {
    this.face = f;
    this.tumbling = false;
    this.drawPips();
  }

  update(dt: number): void {
    if (!this.tumbling) return;
    this.tElapsed += dt;
    const r = diceTumbleFace(this.tElapsed, this.tDuration, this.tFinal, this.tSeed);
    if (this.face !== r.face) {
      this.face = r.face;
      this.drawPips();
    }
    // A little wobble while tumbling.
    const p = Math.min(this.tElapsed / this.tDuration, 1);
    this.root.rotation = Math.sin(p * Math.PI * 4) * (1 - p) * 0.18;
    if (r.done) {
      this.tumbling = false;
      this.root.rotation = 0;
    }
  }

  private draw(): void {
    const g = this.body;
    const r = this.r;
    g.clear();
    g.roundRect(-r, -r + 2, r * 2, r * 2, r * 0.32).fill({ color: 0x000000, alpha: 0.18 });
    g.roundRect(-r, -r, r * 2, r * 2, r * 0.32).fill(CREAM).stroke({ color: INK, width: 2, alpha: 0.5 });
    // Glossy top-left sheen.
    g.roundRect(-r + 3, -r + 3, r * 1.4, r * 0.7, r * 0.25).fill({ color: 0xffffff, alpha: 0.55 });
    this.drawPips();
  }

  private drawPips(): void {
    const g = this.pips;
    g.clear();
    const pr = this.r * 0.16;
    for (const p of dicePips(this.face, this.r)) {
      g.circle(p.x, p.y, pr).fill(INK);
    }
  }
}

export class ControlBar {
  readonly root = new Container();
  readonly goButton = new Container();
  private goBg = new Graphics();
  private goLabel: Text;
  private die1 = new DieCube();
  private die2 = new DieCube();
  private dial = new Container();
  private dialBg = new Graphics();
  private dialLabel: Text;
  private layout: ControlBarLayout;
  private vw = 1;
  private vh = 1;

  constructor(
    private onRoll: () => void,
    private onCycleMult: () => void,
  ) {
    this.layout = controlBarLayout(1, 1);
    // GO! button.
    this.goLabel = new Text({
      text: 'GO!',
      style: { fill: INK, fontSize: 26, fontWeight: '900', fontFamily: 'system-ui, sans-serif' },
    });
    this.goLabel.anchor.set(0.5);
    this.goButton.addChild(this.goBg, this.goLabel);
    this.goButton.eventMode = 'static';
    this.goButton.cursor = 'pointer';
    this.goButton.on('pointertap', (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      this.onRoll();
    });
    // Multiplier dial.
    this.dialLabel = new Text({
      text: '×1',
      style: { fill: INK, fontSize: 16, fontWeight: '900', fontFamily: 'system-ui, sans-serif' },
    });
    this.dialLabel.anchor.set(0.5);
    this.dial.addChild(this.dialBg, this.dialLabel);
    this.dial.eventMode = 'static';
    this.dial.cursor = 'pointer';
    this.dial.on('pointertap', (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      this.onCycleMult();
    });

    this.root.addChild(this.die1.root, this.die2.root, this.dial, this.goButton);
  }

  setViewport(vw: number, vh: number): void {
    this.vw = vw;
    this.vh = vh;
    this.layout = controlBarLayout(vw, vh);
    const L = this.layout;
    this.die1.setSize(L.dieR);
    this.die2.setSize(L.dieR);
    this.die1.root.position.set(L.die1.x, L.die1.y);
    this.die2.root.position.set(L.die2.x, L.die2.y);
    this.goButton.position.set(L.go.x, L.go.y);
    this.dial.position.set(L.dial.x, L.dial.y);
    this.drawGo();
  }

  /** Tumble the dice on a real roll. */
  rollDice(d1: number, d2: number): void {
    this.die1.roll(d1, 0, 0.55);
    this.die2.roll(d2, 3, 0.62);
  }

  setDiceFaces(d1: number, d2: number): void {
    this.die1.setFace(d1);
    this.die2.setFace(d2);
  }

  /** Update the multiplier dial + GO! affordability dimming. */
  refresh(multIndex: number, dice: number, canRoll: boolean): void {
    const mult = MULTIPLIERS[multIndex];
    this.dialLabel.text = `×${mult}`;
    const tone = multiplierTone(multIndex, dice);
    this.drawDial(tone);
    this.goButton.alpha = canRoll ? 1 : 0.45;
    this.goButton.eventMode = canRoll ? 'static' : 'none';
  }

  update(dt: number): void {
    this.die1.update(dt);
    this.die2.update(dt);
  }

  private drawGo(): void {
    const r = this.layout.goR;
    const g = this.goBg;
    g.clear();
    g.circle(0, 4, r).fill({ color: 0x000000, alpha: 0.22 });
    g.circle(0, 0, r).fill(GOLD).stroke({ color: GOLD_SH, width: 4 });
    g.circle(0, 0, r * 0.86).stroke({ color: GOLD_HI, width: 2, alpha: 0.7 });
    // Glossy top sheen.
    g.ellipse(0, -r * 0.34, r * 0.62, r * 0.32).fill({ color: 0xffffff, alpha: 0.4 });
    this.goLabel.style.fontSize = Math.round(r * 0.6);
  }

  private drawDial(tone: 'gold' | 'green' | 'plum'): void {
    const r = this.layout.dialR;
    const g = this.dialBg;
    g.clear();
    g.circle(0, 3, r).fill({ color: 0x000000, alpha: 0.2 });
    g.circle(0, 0, r).fill(TONE_FILL[tone]).stroke({ color: TONE_SH[tone], width: 3 });
    g.ellipse(0, -r * 0.32, r * 0.55, r * 0.28).fill({ color: 0xffffff, alpha: 0.32 });
    this.dialLabel.style.fill = tone === 'gold' ? INK : CREAM;
    this.dialLabel.style.fontSize = Math.round(r * 0.5);
  }
}

/**
 * Top cash counter: a glossy pill with a coin glyph + odometer count-up, plus a
 * compact dice / shields / board-level readout chip to the right.
 */
export class CashCounter {
  readonly root = new Container();
  private pill = new Graphics();
  private coinGlyph = new Graphics();
  private cashText: Text;
  private metaChip = new Graphics();
  private metaText: Text;
  private displayed = 0;
  private target = 0;
  private vw = 1;

  constructor() {
    this.cashText = new Text({
      text: '0',
      style: { fill: INK, fontSize: 20, fontWeight: '900', fontFamily: 'system-ui, sans-serif' },
    });
    this.cashText.anchor.set(0, 0.5);
    this.metaText = new Text({
      text: '',
      style: { fill: CREAM, fontSize: 12, fontWeight: '800', fontFamily: 'system-ui, sans-serif' },
    });
    this.metaText.anchor.set(0, 0.5);
    this.root.addChild(this.pill, this.coinGlyph, this.cashText, this.metaChip, this.metaText);
  }

  /** Set the target coin count (odometer rolls toward it). `snap` jumps instantly. */
  setCoins(n: number, snap = false): void {
    this.target = n;
    if (snap) {
      this.displayed = n;
      this.cashText.text = formatCoins(n);
      this.relayout();
    }
  }

  /** Set the compact meta readout (dice / shields / board level). */
  setMeta(dice: number, shields: number, boardLevel: number): void {
    this.metaText.text = `\u{1F3B2}${dice}  \u{1F6E1}${shields}  L${boardLevel}`;
    this.relayout();
  }

  layout(vw: number, _vh: number): void {
    this.vw = vw;
    this.root.x = 12;
    this.root.y = 30;
    this.relayout();
  }

  update(dt: number): void {
    if (this.displayed === this.target) return;
    // dt-scaled rate so the odometer reads as a tick-roll regardless of fps.
    this.displayed = odometerStep(this.displayed, this.target, dt * 6, Math.max(1, Math.ceil(Math.abs(this.target - this.displayed) * 0.02)));
    this.cashText.text = formatCoins(this.displayed);
    this.relayout();
  }

  /** Screen-space position of the cash glyph (coins fly here on payouts). */
  glyphScreenPos(): { x: number; y: number } {
    return { x: this.root.x + 22, y: this.root.y + 18 };
  }

  private relayout(): void {
    const pad = 14;
    const glyphR = 13;
    this.cashText.x = pad + glyphR * 2 + 6;
    this.cashText.y = 18;
    const cashRight = this.cashText.x + this.cashText.width + pad;

    // Pill.
    const g = this.pill;
    g.clear();
    g.roundRect(0, 3, cashRight, 36, 18).fill({ color: 0x000000, alpha: 0.18 });
    g.roundRect(0, 0, cashRight, 36, 18).fill(CREAM).stroke({ color: GOLD_SH, width: 2.5 });
    g.roundRect(4, 3, cashRight - 8, 12, 9).fill({ color: 0xffffff, alpha: 0.45 });

    // Coin glyph.
    const cg = this.coinGlyph;
    cg.clear();
    cg.circle(pad + glyphR, 18, glyphR).fill(GOLD).stroke({ color: GOLD_SH, width: 2 });
    cg.circle(pad + glyphR - 3, 15, glyphR * 0.45).fill({ color: GOLD_HI, alpha: 0.85 });

    // Meta chip to the right of the cash pill.
    const mx = cashRight + 8;
    const mc = this.metaChip;
    mc.clear();
    const mw = Math.max(70, this.metaText.width + 16);
    mc.roundRect(mx, 4, mw, 28, 14).fill({ color: 0x6b4566, alpha: 0.92 }).stroke({ color: 0x3a2a36, width: 1.5, alpha: 0.4 });
    this.metaText.x = mx + 8;
    this.metaText.y = 18;
  }
}
