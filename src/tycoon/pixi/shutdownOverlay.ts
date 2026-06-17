/**
 * Dice Tycoon — Pixi Shutdown (demolish) overlay.
 *
 * The Depot tiles alternate between Heist (raidOverlay.ts) and SHUTDOWN. This
 * overlay is modelled on /tmp/mgo7.png (the ATTACK! screen): a target rival
 * (Penny-style avatar + "<Name>'s Board"), a row of their standing landmarks,
 * and a procedural wrecking ball. The player taps a landmark → the core's
 * resolveShutdownTarget(i) demolishes it → a wrecking-ball swing connects, the
 * landmark shatters into dust, and a cash payout banner reads out → "Tap to
 * continue" closes the Shutdown.
 *
 * The core is authoritative (resolveShutdownTarget / closeShutdown). This module
 * only renders + hit-tests; geometry comes from the unit-tested
 * shutdownTargetLayout/shutdownHitTest + wreckingBallSwing.
 *
 * IP guardrail: ORIGINAL procedural art — our Penny avatar, our rival names, our
 * own generic skyline buildings (NOT named MGO landmarks). We capture the
 * LAYOUT/feel (a crane + ball wrecking a rival's tower), not their art.
 */

import { Container, Graphics, Text } from 'pixi.js';
import { Rival } from '../../games/dice-tycoon/rivals';
import { ShutdownResultView } from '../../games/dice-tycoon/core/TycoonCore';
import {
  TargetRect,
  shutdownTargetLayout,
  shutdownHitTest,
  wreckingBallSwing,
  formatCoins,
} from './chromeMath';

const GOLD = 0xf7b500;
const GOLD_HI = 0xffe08a;
const INK = 0x3a2a36;
const CREAM = 0xfff7ec;
const SKY = 0x9fd6ef;
const SKY_SH = 0x6fb8d8;
const PENNY_PINK = 0xf6a8c0;
const PENNY_PINK_SH = 0xd97fa0;
const RED = 0xe23b2e;
const CRANE = 0xf4c233;
const BUILDING = 0x7e6bd6;
const BUILDING_SH = 0x5a4aa0;

interface TargetSprite {
  rect: TargetRect;
  container: Container;
  building: Graphics;
  standing: boolean; // false once wrecked
}

export class ShutdownOverlay {
  readonly root = new Container();
  private scrim = new Graphics();
  private panel = new Graphics();
  private title: Text;
  private avatar = new Container();
  private rivalName: Text;
  private targetLayer = new Container();
  private crane = new Container();
  private ball = new Graphics();
  private armLine = new Graphics();
  private payoutText: Text;
  private continueText: Text;
  private targets: TargetSprite[] = [];
  private vw = 1;
  private vh = 1;
  private open = false;
  private resolved = false;
  private animPulse = 0;

  // Swing animation toward the chosen target.
  private swinging = false;
  private swingT = 0;
  private swingTargetIndex = -1;
  private impactDone = false;
  private pivot = { x: 0, y: 0 };
  private armLen = 60;

  constructor(
    private onChoose: (i: number) => ShutdownResultView | null,
    private onClose: () => void,
    private onBurst: (sx: number, sy: number, big: boolean) => void,
  ) {
    this.title = new Text({
      text: 'ATTACK!',
      style: {
        fill: 0xffffff,
        fontSize: 30,
        fontWeight: '900',
        fontFamily: 'system-ui, sans-serif',
        stroke: { color: RED, width: 5 },
      },
    });
    this.title.anchor.set(0.5);
    this.rivalName = new Text({
      text: '',
      style: { fill: INK, fontSize: 16, fontWeight: '900', fontFamily: 'system-ui, sans-serif' },
    });
    this.rivalName.anchor.set(0.5);
    this.payoutText = new Text({
      text: '',
      style: { fill: GOLD, fontSize: 22, fontWeight: '900', fontFamily: 'system-ui, sans-serif', stroke: { color: INK, width: 3 } },
    });
    this.payoutText.anchor.set(0.5);
    this.payoutText.visible = false;
    this.continueText = new Text({
      text: 'Tap to continue',
      style: { fill: CREAM, fontSize: 15, fontWeight: '800', fontFamily: 'system-ui, sans-serif' },
    });
    this.continueText.anchor.set(0.5);
    this.continueText.visible = false;

    this.crane.addChild(this.armLine, this.ball);

    this.root.addChild(
      this.scrim,
      this.panel,
      this.title,
      this.avatar,
      this.rivalName,
      this.targetLayer,
      this.crane,
      this.payoutText,
      this.continueText,
    );
    this.root.visible = false;
    this.root.eventMode = 'static';
    this.root.on('pointertap', this.onTap);

    this.buildPennyAvatar();
  }

  isOpen(): boolean {
    return this.open;
  }

  setViewport(vw: number, vh: number): void {
    this.vw = vw;
    this.vh = vh;
    if (this.open) this.relayout();
  }

  /** Open the Shutdown against a rival. */
  show(rival: Rival): void {
    this.open = true;
    this.resolved = false;
    this.swinging = false;
    this.swingT = 0;
    this.swingTargetIndex = -1;
    this.impactDone = false;
    this.continueText.visible = false;
    this.payoutText.visible = false;
    this.root.visible = true;
    this.rivalName.text = `${(rival?.name ?? 'Rival').toUpperCase()}'S BOARD`;
    this.relayout(rival?.landmarks ?? 2);
  }

  hide(): void {
    this.open = false;
    this.root.visible = false;
  }

  update(dt: number): void {
    if (!this.open) return;
    this.animPulse += dt;

    if (this.swinging) {
      this.swingT = Math.min(1, this.swingT + dt * 1.6);
      const { angle, impact } = wreckingBallSwing(this.swingT);
      this.drawBall(angle);
      if (impact && !this.impactDone) {
        this.impactDone = true;
        // Shatter the struck building into dust + a burst.
        const t = this.targets[this.swingTargetIndex];
        if (t) {
          t.standing = false;
          t.building.alpha = 0.0;
          this.onBurst(t.rect.x, t.rect.y, true);
        }
        this.payoutText.visible = true;
      }
      if (this.swingT >= 1) {
        this.swinging = false;
        this.continueText.visible = true;
      }
    }

    if (this.continueText.visible) {
      this.continueText.alpha = 0.6 + Math.sin(this.animPulse * 4) * 0.4;
    }
  }

  // ── Input ────────────────────────────────────────────────────────────────

  private onTap = (e: { global: { x: number; y: number }; stopPropagation: () => void }): void => {
    if (!this.open) return;
    e.stopPropagation();
    if (this.resolved) {
      // Don't allow closing until the swing finishes.
      if (this.swinging) return;
      this.onClose();
      this.hide();
      return;
    }
    const rects = this.targets.filter((t) => t.standing).map((t) => t.rect);
    const i = shutdownHitTest(rects, e.global.x, e.global.y);
    if (i < 0) return;
    const result = this.onChoose(i);
    if (!result) return;
    this.resolved = true;
    // Begin the wrecking-ball swing toward the chosen target.
    this.swingTargetIndex = i;
    this.swinging = true;
    this.swingT = 0;
    this.impactDone = false;
    if (result.payout > 0) {
      this.payoutText.text = `+${formatCoins(result.payout)}`;
    } else if (result.blocked) {
      this.payoutText.text = 'BLOCKED';
    } else {
      this.payoutText.text = 'NO LOOT';
    }
  };

  // ── Layout / build ─────────────────────────────────────────────────────────

  private relayout(landmarks?: number): void {
    const vw = this.vw;
    const vh = this.vh;
    this.scrim.clear();
    this.scrim.rect(0, 0, vw, vh).fill({ color: 0x1a0f18, alpha: 0.72 });

    const pw = Math.min(vw - 28, 360);
    const ph = Math.min(vh - 90, 520);
    const px = (vw - pw) / 2;
    const py = (vh - ph) / 2;
    const p = this.panel;
    p.clear();
    p.roundRect(px, py, pw, ph, 20).fill(CREAM).stroke({ color: GOLD, width: 5 });
    p.roundRect(px + 10, py + 70, pw - 20, ph - 150, 14).fill(SKY).stroke({ color: SKY_SH, width: 3 });

    this.title.position.set(vw / 2, py - 2);
    this.avatar.position.set(vw / 2, py + 36);
    this.avatar.scale.set((Math.min(pw, 360) / 360) * 0.9);
    this.rivalName.position.set(vw / 2, py + 86);

    // Target row (rival landmarks) centered in the sky panel.
    const cy = py + 70 + (ph - 150) / 2 + 10;
    const n = landmarks != null ? landmarks : this.targets.length || 2;
    const rects = shutdownTargetLayout(n, px + 14, pw - 28, cy, 12);
    this.buildTargets(rects);

    // Crane pivot at the bottom-left of the panel; ball swings toward targets.
    this.pivot = { x: px + 30, y: cy - rects[0]?.h / 2 - 30 || cy - 40 };
    this.armLen = Math.max(40, (rects[0]?.x ?? px + 100) - this.pivot.x);
    this.crane.position.set(this.pivot.x, this.pivot.y);
    this.drawBall(-1.1);

    this.payoutText.position.set(vw / 2, cy + (rects[0]?.h ?? 60) / 2 + 28);
    this.continueText.position.set(vw / 2, py + ph - 26);
  }

  private buildTargets(rects: TargetRect[]): void {
    this.targetLayer.removeChildren();
    this.targets = [];
    for (const rect of rects) {
      const container = new Container();
      container.position.set(rect.x, rect.y);
      const building = new Graphics();
      const hw = rect.w / 2;
      const hh = rect.h / 2;
      // Generic procedural tower (3 stacked blocks + roof) — OUR art.
      building.roundRect(-hw * 0.8, -hh, hw * 1.6, rect.h, 6).fill(BUILDING).stroke({ color: BUILDING_SH, width: 2 });
      building.rect(-hw * 0.55, -hh * 0.5, hw * 1.1, hh * 0.18).fill({ color: GOLD_HI, alpha: 0.8 });
      building.rect(-hw * 0.55, 0, hw * 1.1, hh * 0.18).fill({ color: GOLD_HI, alpha: 0.8 });
      building.poly([-hw * 0.8, -hh, 0, -hh - hh * 0.35, hw * 0.8, -hh]).fill(GOLD);
      container.addChild(building);
      this.targetLayer.addChild(container);
      this.targets.push({ rect, container, building, standing: true });
    }
  }

  /** Draw the crane arm + ball at the given swing angle (radians). */
  private drawBall(angle: number): void {
    const bx = Math.cos(angle) * this.armLen;
    const by = Math.sin(angle) * this.armLen + this.armLen * 0.5;
    this.armLine.clear();
    this.armLine.moveTo(0, 0).lineTo(bx, by).stroke({ color: CRANE, width: 4 });
    this.ball.clear();
    this.ball.circle(bx, by, 12).fill(INK).stroke({ color: 0x000000, width: 2 });
    this.ball.circle(bx - 3, by - 3, 3).fill({ color: 0xffffff, alpha: 0.4 });
  }

  /** Penny piggy-bank avatar (ORIGINAL — NOT Mr. Monopoly). */
  private buildPennyAvatar(): void {
    const ring = new Graphics();
    ring.circle(0, 0, 30).fill(CREAM).stroke({ color: GOLD, width: 4 });
    this.avatar.addChild(ring);
    const g = new Graphics();
    g.ellipse(0, 2, 20, 17).fill(PENNY_PINK).stroke({ color: PENNY_PINK_SH, width: 2 });
    g.ellipse(-5, -4, 9, 6).fill({ color: 0xffffff, alpha: 0.35 });
    g.ellipse(0, 8, 9, 6).fill(PENNY_PINK_SH);
    g.circle(-3, 8, 1.6).fill(INK);
    g.circle(3, 8, 1.6).fill(INK);
    g.rect(-7, -16, 14, 4).fill(INK);
    g.poly([-15, -8, -8, -13, -9, -3]).fill(PENNY_PINK_SH);
    g.poly([15, -8, 8, -13, 9, -3]).fill(PENNY_PINK_SH);
    g.circle(7, -1, 2).fill(INK);
    g.circle(7, -1, 5).stroke({ color: GOLD, width: 2 });
    this.avatar.addChild(g);
  }
}
