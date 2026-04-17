import { mulberry32 } from '../../utils/rng';
import { RicochetLevel, Target, Obstacle } from './types';

export type RicochetBucket = 'easy' | 'medium' | 'hard' | 'expert';

interface BucketSpec {
  targets: number;
  obstacles: number;
  darts: number;
  /** Minimum separation between target centers, as a fraction of arena width. */
  minSeparation: number;
}

const SPECS: Record<RicochetBucket, BucketSpec> = {
  easy:   { targets: 5,  obstacles: 0, darts: 6, minSeparation: 0.16 },
  medium: { targets: 7,  obstacles: 1, darts: 6, minSeparation: 0.14 },
  hard:   { targets: 9,  obstacles: 2, darts: 7, minSeparation: 0.12 },
  expert: { targets: 12, obstacles: 3, darts: 8, minSeparation: 0.10 },
};

const ARENA_W = 320;
const ARENA_H = 400;
const START_MARGIN = 40;
const TARGET_RADIUS = 14;

export interface GenerateOptions {
  seed: number;
  bucket: RicochetBucket;
}

export function generateLevel(opts: GenerateOptions): RicochetLevel {
  const rng = mulberry32(opts.seed);
  const spec = SPECS[opts.bucket];
  const arena = { x: 0, y: 0, w: ARENA_W, h: ARENA_H };

  // Ball start — bottom center
  const startX = arena.w / 2;
  const startY = arena.h - START_MARGIN;

  // Obstacles first so targets can avoid them
  const obstacles: Obstacle[] = [];
  const topZone = { minY: 40, maxY: arena.h - START_MARGIN - 60 };
  for (let i = 0; i < spec.obstacles; i++) {
    // Each obstacle is a rectangle of random but sensible size
    let placed = false;
    for (let attempt = 0; attempt < 30 && !placed; attempt++) {
      const w = 40 + rng() * 60;
      const h = 14 + rng() * 28;
      const x = 20 + rng() * (arena.w - w - 40);
      const y = topZone.minY + rng() * (topZone.maxY - topZone.minY - h);
      const candidate: Obstacle = { x, y, w, h };
      // Don't place too close to start position
      if (y + h > startY - 60) continue;
      // Don't overlap existing obstacles
      let overlap = false;
      for (const o of obstacles) {
        if (rectsOverlap(candidate, o, 14)) { overlap = true; break; }
      }
      if (overlap) continue;
      obstacles.push(candidate);
      placed = true;
    }
  }

  // Targets — keep away from start zone and obstacles
  const targets: Target[] = [];
  const minDist = Math.max(spec.minSeparation * arena.w, TARGET_RADIUS * 2 + 4);
  for (let i = 0; i < spec.targets; i++) {
    let placed = false;
    for (let attempt = 0; attempt < 80 && !placed; attempt++) {
      const x = TARGET_RADIUS + 10 + rng() * (arena.w - TARGET_RADIUS * 2 - 20);
      const y = TARGET_RADIUS + 20 + rng() * (arena.h - TARGET_RADIUS - 60 - START_MARGIN);
      // Must not overlap other targets
      let tooClose = false;
      for (const t of targets) {
        const dx = t.x - x;
        const dy = t.y - y;
        if (dx * dx + dy * dy < minDist * minDist) { tooClose = true; break; }
      }
      if (tooClose) continue;
      // Must not overlap obstacles
      let inObstacle = false;
      for (const o of obstacles) {
        if (
          x + TARGET_RADIUS > o.x && x - TARGET_RADIUS < o.x + o.w &&
          y + TARGET_RADIUS > o.y && y - TARGET_RADIUS < o.y + o.h
        ) { inObstacle = true; break; }
      }
      if (inObstacle) continue;
      // Don't cover the start zone
      const dxs = x - startX;
      const dys = y - startY;
      if (dxs * dxs + dys * dys < 70 * 70) continue;
      targets.push({ x, y, radius: TARGET_RADIUS, destroyed: false });
      placed = true;
    }
  }

  return {
    arena,
    startX,
    startY,
    targets,
    obstacles,
    darts: spec.darts,
  };
}

function rectsOverlap(a: Obstacle, b: Obstacle, pad = 0): boolean {
  return !(
    a.x + a.w + pad <= b.x ||
    b.x + b.w + pad <= a.x ||
    a.y + a.h + pad <= b.y ||
    b.y + b.h + pad <= a.y
  );
}
