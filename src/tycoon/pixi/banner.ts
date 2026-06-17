/**
 * Dice Tycoon — Pixi PX3 red ribbon event banner.
 *
 * A bold red ribbon with white outlined text that eases in / holds / eases out
 * for big moments (BUILD! / WIN! / STEAL! / ATTACK!). Modelled on the ribbon in
 * /tmp/mgo2.png, /tmp/mgo3.png, /tmp/mgo4.png. Procedural ONLY.
 *
 * Timing is driven by the unit-tested pure `bannerPhase()` in chromeMath.
 */

import { Container, Graphics, Text } from 'pixi.js';
import { bannerPhase } from './chromeMath';

const RIBBON_RED = 0xe23b2e;
const RIBBON_RED_SH = 0xb0231a;
const RIBBON_GOLD = 0xffd24a;

export class RibbonBanner {
  readonly root = new Container();
  private ribbon = new Graphics();
  private label: Text;
  private elapsed = 0;
  private active = false;
  private baseY = 0;
  private w = 0;

  constructor() {
    this.label = new Text({
      text: '',
      style: {
        fill: 0xffffff,
        fontSize: 34,
        fontWeight: '900',
        fontFamily: 'system-ui, sans-serif',
        align: 'center',
        stroke: { color: RIBBON_RED_SH, width: 6 },
        letterSpacing: 1,
      },
    });
    this.label.anchor.set(0.5);
    this.root.addChild(this.ribbon, this.label);
    this.root.visible = false;
  }

  /** Position the ribbon for a viewport (top-center, below the cash pill). */
  layout(vw: number, vh: number): void {
    this.w = vw;
    this.baseY = Math.max(70, vh * 0.13);
    this.root.x = vw / 2;
  }

  /** Trigger a banner with a message (e.g. 'BUILD!'). Restarts the envelope. */
  show(message: string): void {
    if (!message) return;
    this.label.text = message;
    this.elapsed = 0;
    this.active = true;
    this.root.visible = true;
    this.redraw();
  }

  /** Advance the ease-in/hold/ease-out envelope. */
  update(dt: number): void {
    if (!this.active) return;
    this.elapsed += dt;
    const ph = bannerPhase(this.elapsed);
    if (ph.done) {
      this.active = false;
      this.root.visible = false;
      return;
    }
    const v = ph.vis;
    this.root.alpha = Math.min(1, v);
    // Slide down into place + overshoot pop.
    this.root.y = this.baseY - (1 - v) * 40;
    this.root.scale.set(0.85 + v * 0.18);
  }

  private redraw(): void {
    const g = this.ribbon;
    g.clear();
    // Auto-size the ribbon to the label.
    const tw = Math.max(180, this.label.width + 90);
    const hw = tw / 2;
    const hh = 30;
    const notch = 26;
    // Tail flags (left/right) behind the main banner.
    g.poly([-hw - notch, -hh + 8, -hw, -hh + 8, -hw, hh + 8, -hw - notch, hh + 18]).fill(RIBBON_RED_SH);
    g.poly([hw + notch, -hh + 8, hw, -hh + 8, hw, hh + 8, hw + notch, hh + 18]).fill(RIBBON_RED_SH);
    // Main ribbon body with notched ends.
    g.poly([
      -hw, -hh,
      hw, -hh,
      hw + notch * 0.6, 0,
      hw, hh,
      -hw, hh,
      -hw - notch * 0.6, 0,
    ]).fill(RIBBON_RED).stroke({ color: RIBBON_GOLD, width: 3 });
    // Glossy top highlight.
    g.roundRect(-hw + 6, -hh + 4, tw - 12, hh * 0.5, 8).fill({ color: 0xffffff, alpha: 0.16 });
  }
}
