/**
 * Dice Tycoon — Pixi PX3 vault raid / heist overlay.
 *
 * Replaces PX2's silent auto-resolve. Modelled on /tmp/mgo2.png (the STEAL /
 * Bank Heist screen): a target rival (Penny-style avatar + name + their bank /
 * coins), shields, and a row of face-down vault tiles. The player taps a vault
 * → the core's chooseVault(i) resolves it → the tile flips to reveal +stolen or
 * BLOCKED with a particle burst → "Tap to continue" closes the raid.
 *
 * The core is authoritative (chooseVault / closeRaid). This module only renders
 * + hit-tests; the geometry comes from the unit-tested vaultLayout/vaultHitTest.
 *
 * IP guardrail: ORIGINAL art — Penny piggy-bank avatar, our rival names, our own
 * glyphs. We capture the LAYOUT/feel, not their art.
 */

import { Container, Graphics, Text } from 'pixi.js';
import { Rival } from '../../games/dice-tycoon/rivals';
import { RaidResultView } from '../../games/dice-tycoon/core/TycoonCore';
import { VaultRect, vaultLayout, vaultHitTest, formatCoins } from './chromeMath';

const GOLD = 0xf7b500;
const GOLD_HI = 0xffe08a;
const GOLD_SH = 0xb97e00;
const INK = 0x3a2a36;
const CREAM = 0xfff7ec;
const PANEL_BLUE = 0x2f9bd0;
const PANEL_BLUE_SH = 0x1f6f99;
const PENNY_PINK = 0xf6a8c0;
const PENNY_PINK_SH = 0xd97fa0;
const RED = 0xe23b2e;
const NUM_VAULTS = 3;

interface VaultSprite {
  rect: VaultRect;
  container: Container;
  faceDown: Graphics;
  faceUp: Container;
  flip: number; // 0..1 reveal progress
  revealed: boolean;
}

export class RaidOverlay {
  readonly root = new Container();
  private scrim = new Graphics();
  private panel = new Graphics();
  private title: Text;
  private avatar = new Container();
  private rivalName: Text;
  private bankText: Text;
  private shieldRow = new Container();
  private vaults: VaultSprite[] = [];
  private continueText: Text;
  private vaultLayer = new Container();
  private vw = 1;
  private vh = 1;
  private open = false;
  private resolved = false;
  private animPulse = 0;

  // Callbacks the view wires to the core.
  constructor(
    private onChoose: (i: number) => RaidResultView | null,
    private onClose: () => void,
    private onBurst: (sx: number, sy: number, big: boolean) => void,
  ) {
    this.title = new Text({
      text: 'STEAL!',
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
    this.bankText = new Text({
      text: '',
      style: { fill: GOLD_HI, fontSize: 15, fontWeight: '900', fontFamily: 'system-ui, sans-serif' },
    });
    this.bankText.anchor.set(0.5);
    this.continueText = new Text({
      text: 'Tap to continue',
      style: { fill: CREAM, fontSize: 15, fontWeight: '800', fontFamily: 'system-ui, sans-serif' },
    });
    this.continueText.anchor.set(0.5);
    this.continueText.visible = false;

    this.root.addChild(
      this.scrim,
      this.panel,
      this.title,
      this.avatar,
      this.rivalName,
      this.bankText,
      this.shieldRow,
      this.vaultLayer,
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

  /** Open the raid against a rival with the given shields. */
  show(rival: Rival, playerShields: number): void {
    this.open = true;
    this.resolved = false;
    this.continueText.visible = false;
    this.root.visible = true;
    this.rivalName.text = (rival?.name ?? 'Rival').toUpperCase();
    this.bankText.text = `\u{1F4B0} ${formatCoins(rival?.coins ?? 0)}`;
    this.buildShields(rival?.shields ?? 0, playerShields);
    this.relayout();
  }

  /** Hide + reset. */
  hide(): void {
    this.open = false;
    this.root.visible = false;
  }

  update(dt: number): void {
    if (!this.open) return;
    this.animPulse += dt;
    // Flip-reveal animation per vault.
    for (const v of this.vaults) {
      if (v.revealed && v.flip < 1) {
        v.flip = Math.min(1, v.flip + dt * 4);
        const f = v.flip;
        // Two-phase Y-scale flip (squash to 0 then back) swapping face.
        const sx = Math.abs(Math.cos(f * Math.PI));
        v.container.scale.x = Math.max(0.04, sx);
        const showUp = f >= 0.5;
        v.faceDown.visible = !showUp;
        v.faceUp.visible = showUp;
      }
    }
    if (this.resolved && this.continueText.visible) {
      this.continueText.alpha = 0.6 + Math.sin(this.animPulse * 4) * 0.4;
    }
  }

  // ── Input ────────────────────────────────────────────────────────────────

  private onTap = (e: { global: { x: number; y: number }; stopPropagation: () => void }): void => {
    if (!this.open) return;
    e.stopPropagation();
    if (this.resolved) {
      this.onClose();
      this.hide();
      return;
    }
    const rects = this.vaults.map((v) => v.rect);
    const i = vaultHitTest(rects, e.global.x, e.global.y);
    if (i < 0) return;
    const result = this.onChoose(i);
    if (!result) return;
    this.resolved = true;
    this.revealVault(i, result);
    // Reveal the other two as decoys (face-up but greyed), so the grid reads.
    for (let j = 0; j < this.vaults.length; j++) {
      if (j !== i) this.revealVault(j, null);
    }
    this.continueText.visible = true;
  };

  private revealVault(i: number, result: RaidResultView | null): void {
    const v = this.vaults[i];
    if (!v || v.revealed) return;
    v.revealed = true;
    v.flip = 0;
    // Build the face-up content.
    v.faceUp.removeChildren();
    const g = new Graphics();
    const hw = v.rect.w / 2;
    const hh = v.rect.h / 2;
    const chosen = result != null;
    if (chosen && result!.blocked) {
      g.roundRect(-hw, -hh, v.rect.w, v.rect.h, 10).fill(0x9a3b4e).stroke({ color: CREAM, width: 3 });
      v.faceUp.addChild(g);
      const t = new Text({
        text: 'BLOCKED',
        style: { fill: CREAM, fontSize: 13, fontWeight: '900', fontFamily: 'system-ui, sans-serif' },
      });
      t.anchor.set(0.5);
      v.faceUp.addChild(t);
    } else if (chosen) {
      g.roundRect(-hw, -hh, v.rect.w, v.rect.h, 10).fill(GOLD).stroke({ color: GOLD_SH, width: 3 });
      // Coin stack glyph.
      g.ellipse(0, -hh * 0.18, hw * 0.5, hh * 0.18).fill(GOLD_HI);
      v.faceUp.addChild(g);
      const t = new Text({
        text: `+${formatCoins(result!.stolen)}`,
        style: { fill: INK, fontSize: 14, fontWeight: '900', fontFamily: 'system-ui, sans-serif' },
      });
      t.anchor.set(0.5);
      t.y = hh * 0.22;
      v.faceUp.addChild(t);
      // Burst at the vault, scaled to the steal.
      this.onBurst(v.rect.x, v.rect.y, result!.stolen > 0);
    } else {
      // Decoy: dim face-up.
      g.roundRect(-hw, -hh, v.rect.w, v.rect.h, 10).fill({ color: CREAM, alpha: 0.5 }).stroke({ color: INK, width: 2, alpha: 0.3 });
      v.faceUp.addChild(g);
      v.faceUp.alpha = 0.55;
    }
  }

  // ── Layout / build ─────────────────────────────────────────────────────────

  private relayout(): void {
    const vw = this.vw;
    const vh = this.vh;
    // Full-screen scrim.
    this.scrim.clear();
    this.scrim.rect(0, 0, vw, vh).fill({ color: 0x1a0f18, alpha: 0.72 });

    // Centered panel.
    const pw = Math.min(vw - 28, 360);
    const ph = Math.min(vh - 90, 520);
    const px = (vw - pw) / 2;
    const py = (vh - ph) / 2;
    const p = this.panel;
    p.clear();
    p.roundRect(px, py, pw, ph, 20).fill(CREAM).stroke({ color: GOLD, width: 5 });
    p.roundRect(px + 10, py + 70, pw - 20, ph - 150, 14).fill(PANEL_BLUE).stroke({ color: PANEL_BLUE_SH, width: 3 });

    this.title.position.set(vw / 2, py - 2);
    this.avatar.position.set(vw / 2, py + 36);
    this.avatar.scale.set((Math.min(pw, 360) / 360) * 0.9);
    this.rivalName.position.set(vw / 2, py + 78);
    this.bankText.position.set(vw / 2, py + 100);
    this.shieldRow.position.set(px + 28, py + 96);

    // Vault grid inside the blue panel.
    const cy = py + 70 + (ph - 150) / 2 + 20;
    const rects = vaultLayout(NUM_VAULTS, px + 14, pw - 28, cy, NUM_VAULTS, 12);
    this.buildVaults(rects);

    this.continueText.position.set(vw / 2, py + ph - 26);
  }

  private buildVaults(rects: VaultRect[]): void {
    this.vaultLayer.removeChildren();
    this.vaults = [];
    for (const rect of rects) {
      const container = new Container();
      container.position.set(rect.x, rect.y);
      const faceDown = new Graphics();
      const hw = rect.w / 2;
      const hh = rect.h / 2;
      faceDown.roundRect(-hw, -hh + 3, rect.w, rect.h, 10).fill({ color: 0x000000, alpha: 0.2 });
      faceDown.roundRect(-hw, -hh, rect.w, rect.h, 10).fill(CREAM).stroke({ color: GOLD, width: 3 });
      // Gold "?" emblem (our glyph).
      faceDown.poly([-hw * 0.28, -hh * 0.2, 0, -hh * 0.42, hw * 0.28, -hh * 0.2, hw * 0.12, 0, 0, hh * 0.05])
        .stroke({ color: GOLD, width: 4 });
      faceDown.circle(0, hh * 0.3, 3.5).fill(GOLD);
      const faceUp = new Container();
      faceUp.visible = false;
      container.addChild(faceDown, faceUp);
      this.vaultLayer.addChild(container);
      this.vaults.push({ rect, container, faceDown, faceUp, flip: 0, revealed: false });
    }
  }

  private buildShields(rivalShields: number, _playerShields: number): void {
    this.shieldRow.removeChildren();
    const n = Math.max(0, Math.min(3, rivalShields));
    for (let i = 0; i < n; i++) {
      const s = new Graphics();
      s.poly([0, -8, 9, -4, 8, 8, 0, 12, -8, 8, -9, -4])
        .fill(0x3fa9c9)
        .stroke({ color: CREAM, width: 1.5 });
      s.x = i * 24;
      this.shieldRow.addChild(s);
    }
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
