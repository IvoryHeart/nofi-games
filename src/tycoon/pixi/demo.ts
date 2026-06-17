/**
 * Pixi.js v8 procedural "slickness demo" — DE-RISKING SPIKE.
 *
 * Self-contained. NO image assets. Renders entirely via Pixi Graphics + filters
 * + procedural particles to judge whether Pixi v8 can deliver MGO-grade slick
 * 2.5D for the standalone Dice Tycoon app.
 *
 * Reachable ONLY behind `?pixidemo=1` via a dynamic import in main.ts, so:
 *   - Pixi never loads on the normal app path (offline-first, bundle isolation).
 *   - The jsdom test suite never instantiates WebGL (this module is never
 *     statically imported on a path the tests exercise).
 *
 * Exercises: BlurFilter glow/drop-shadow, a coin-burst particle pool (gravity +
 * fade), a glossy beveled die with gradient highlight, a lit 2.5D tile, and a
 * spring/overshoot tween on the die. Cleans up the Application + ticker on
 * destroy.
 */
import {
  Application,
  Container,
  Graphics,
  BlurFilter,
  Text,
  Ticker,
} from 'pixi.js';

export interface PixiDemoHandle {
  destroy(): void;
}

const WARM_BG = 0xfef0e4;
const GOLD = 0xc9883f;
const GOLD_HI = 0xe8b85c;

/** A single coin particle in the burst pool. */
interface Coin {
  gfx: Graphics;
  vx: number;
  vy: number;
  life: number; // seconds remaining
  maxLife: number;
}

/** Simple spring toward a target with overshoot (exponential velocity damping). */
class Spring {
  value: number;
  target: number;
  private vel = 0;
  private stiffness: number;
  private damping: number;
  constructor(value: number, stiffness = 180, damping = 12) {
    this.value = value;
    this.target = value;
    this.stiffness = stiffness;
    this.damping = damping;
  }
  step(dt: number): number {
    const force = (this.target - this.value) * this.stiffness;
    this.vel += force * dt;
    this.vel *= Math.exp(-this.damping * dt);
    this.value += this.vel * dt;
    return this.value;
  }
}

/**
 * Mount the procedural Pixi demo into `el`. Returns a handle whose destroy()
 * tears down the Pixi Application, ticker and DOM canvas.
 *
 * Async because Pixi v8's Application.init() is async (it negotiates the GPU).
 */
export async function mountPixiDemo(el: HTMLElement): Promise<PixiDemoHandle> {
  const app = new Application();

  const w = el.clientWidth || 480;
  const h = el.clientHeight || 800;

  await app.init({
    width: w,
    height: h,
    background: WARM_BG,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
    preference: 'webgl', // keep deterministic for the spike; WebGPU optional
  });

  el.appendChild(app.canvas);

  // ── Scene root, centered ──────────────────────────────────────────────────
  const scene = new Container();
  app.stage.addChild(scene);

  const cx = w / 2;
  const cy = h / 2;

  // ── 2.5D lit tile (isometric diamond with a lit top + shadowed sides) ─────
  const tile = new Container();
  const tileSide = new Graphics();
  const tileTop = new Graphics();
  const tw = Math.min(w, h) * 0.42;
  const th = tw * 0.5;
  const depth = th * 0.45;
  // Side faces (darker — in shadow).
  tileSide
    .poly([-tw / 2, 0, 0, th / 2, 0, th / 2 + depth, -tw / 2, depth])
    .fill(0x6b4566)
    .poly([tw / 2, 0, 0, th / 2, 0, th / 2 + depth, tw / 2, depth])
    .fill(0x573753);
  // Top face (lit — brighter, plus a soft highlight band toward the light).
  tileTop
    .poly([0, -th / 2, tw / 2, 0, 0, th / 2, -tw / 2, 0])
    .fill(0x8b5e83)
    .poly([0, -th / 2, (tw / 2) * 0.5, -th / 4, 0, 0, (-tw / 2) * 0.5, -th / 4])
    .fill({ color: 0xb98cb0, alpha: 0.55 });
  tile.addChild(tileSide, tileTop);
  tile.x = cx;
  tile.y = cy + th * 0.9;
  scene.addChild(tile);

  // ── Glossy beveled die ────────────────────────────────────────────────────
  const dieSize = Math.min(w, h) * 0.26;
  const r = dieSize * 0.22;

  // Drop-shadow / glow: a blurred dark copy behind the die.
  const glow = new Graphics()
    .roundRect(-dieSize / 2, -dieSize / 2, dieSize, dieSize, r)
    .fill({ color: 0x000000, alpha: 0.4 });
  glow.filters = [new BlurFilter({ strength: 14, quality: 4 })];

  const die = new Container();
  const dieBody = new Graphics();
  // Base body + a vertical "gradient" faked via stacked alpha bands.
  dieBody.roundRect(-dieSize / 2, -dieSize / 2, dieSize, dieSize, r).fill(GOLD_HI);
  for (let i = 0; i < 8; i++) {
    const tt = i / 8;
    dieBody
      .roundRect(-dieSize / 2, -dieSize / 2 + dieSize * tt, dieSize, dieSize / 8 + 1, 0)
      .fill({ color: GOLD, alpha: tt * 0.5 });
  }
  // Beveled glossy sheen (top-left).
  dieBody
    .roundRect(-dieSize / 2 + 4, -dieSize / 2 + 4, dieSize - 8, dieSize * 0.4, r * 0.7)
    .fill({ color: 0xffffff, alpha: 0.28 });
  // Inner border bevel.
  dieBody
    .roundRect(-dieSize / 2, -dieSize / 2, dieSize, dieSize, r)
    .stroke({ color: 0xfff3df, width: 2, alpha: 0.6 });
  // Pips (5) with tiny specular dots.
  const pip = dieSize * 0.09;
  const off = dieSize * 0.26;
  for (const [px, py] of [
    [-off, -off],
    [off, -off],
    [0, 0],
    [-off, off],
    [off, off],
  ] as [number, number][]) {
    dieBody.circle(px, py, pip).fill(0x4a2f44);
    dieBody.circle(px - pip * 0.3, py - pip * 0.3, pip * 0.4).fill({ color: 0xffffff, alpha: 0.3 });
  }
  die.addChild(dieBody);

  const dieBaseY = cy - dieSize * 0.3;
  die.x = cx;
  die.y = dieBaseY;
  glow.x = cx;
  glow.y = dieBaseY + 12;
  scene.addChild(glow, die);

  // ── Coin-burst particle system (procedural Graphics pool) ─────────────────
  const coinLayer = new Container();
  scene.addChild(coinLayer);
  const coins: Coin[] = [];
  const COIN_POOL = 80;
  for (let i = 0; i < COIN_POOL; i++) {
    const cr = 6 + (i % 3) * 2;
    const g = new Graphics();
    g.circle(0, 0, cr).fill(GOLD_HI).stroke({ color: GOLD, width: 2 });
    g.circle(0, 0, cr * 0.5).fill({ color: 0xfff3df, alpha: 0.5 });
    g.visible = false;
    coinLayer.addChild(g);
    coins.push({ gfx: g, vx: 0, vy: 0, life: 0, maxLife: 1 });
  }

  function emitCoins(): void {
    let emitted = 0;
    for (const c of coins) {
      if (c.life > 0) continue;
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
      const speed = 220 + Math.random() * 220;
      c.vx = Math.cos(ang) * speed;
      c.vy = Math.sin(ang) * speed;
      c.maxLife = 0.9 + Math.random() * 0.6;
      c.life = c.maxLife;
      c.gfx.x = cx;
      c.gfx.y = dieBaseY;
      c.gfx.visible = true;
      c.gfx.alpha = 1;
      if (++emitted >= 24) break;
    }
  }

  // ── Caption ───────────────────────────────────────────────────────────────
  const caption = new Text({
    text: 'Pixi v8 spike — glow • particles • spring • 2.5D tile',
    style: { fill: 0x6b4566, fontSize: 14, fontWeight: '700', fontFamily: 'system-ui' },
  });
  caption.anchor.set(0.5, 0);
  caption.x = cx;
  caption.y = 16;
  scene.addChild(caption);

  // ── Animation: spring scale-pop + idle float + periodic coin bursts ───────
  const scaleSpring = new Spring(1, 220, 9);
  let burstTimer = 0;
  let t = 0;

  const onTick = (ticker: Ticker): void => {
    const dt = Math.min(ticker.deltaMS / 1000, 1 / 30);
    t += dt;

    // Idle float + shimmer.
    die.y = dieBaseY + Math.sin(t * 1.6) * 8;
    die.rotation = Math.sin(t * 0.8) * 0.06;
    glow.y = die.y + 12;
    glow.rotation = die.rotation;

    // Spring scale pop.
    const s = scaleSpring.step(dt);
    die.scale.set(s);
    glow.scale.set(s);

    // Periodic coin burst (drives the spring + particles).
    burstTimer -= dt;
    if (burstTimer <= 0) {
      burstTimer = 1.6;
      scaleSpring.value = 1.18;
      scaleSpring.target = 1;
      emitCoins();
    }

    // Integrate coins (gravity + fade).
    for (const c of coins) {
      if (c.life <= 0) continue;
      c.life -= dt;
      c.vy += 720 * dt; // gravity
      c.gfx.x += c.vx * dt;
      c.gfx.y += c.vy * dt;
      c.gfx.rotation += dt * 6;
      c.gfx.alpha = Math.max(0, c.life / c.maxLife);
      if (c.life <= 0) c.gfx.visible = false;
    }
  };

  app.ticker.add(onTick);

  // ── Teardown ──────────────────────────────────────────────────────────────
  return {
    destroy(): void {
      app.ticker.remove(onTick);
      // removeView:true detaches & releases the canvas DOM node too.
      app.destroy({ removeView: true }, { children: true });
    },
  };
}
