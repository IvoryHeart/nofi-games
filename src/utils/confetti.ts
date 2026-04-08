/**
 * Lightweight canvas confetti burst. No dependencies, ~2 KB.
 *
 * Usage:
 *   const stop = burst(container, { particles: 80 });
 *   // ...later (optional — particles fall off-screen on their own):
 *   stop();
 *
 * Creates its own absolutely-positioned canvas inside the container, runs a
 * physics sim for ~2 seconds, removes itself. Respects prefers-reduced-motion.
 */

export interface ConfettiOptions {
  /** Number of particles. Default 80. */
  particles?: number;
  /** Palette — particles pick from this array. Defaults to warm brand colors + brights. */
  colors?: string[];
  /** How long the burst lasts (ms). Particles fade out in the last 500ms. Default 2200. */
  duration?: number;
  /** Initial velocity multiplier. Default 1. */
  power?: number;
}

const DEFAULT_COLORS = [
  '#E06040', // warm red
  '#F2B179', // peach
  '#F5D06B', // yellow
  '#6BAA75', // green
  '#5B8FB9', // blue
  '#8B5E83', // mauve
  '#E89040', // orange
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vrot: number;
  color: string;
  shape: 'rect' | 'circle';
}

/**
 * Fire a confetti burst into `container`. Returns a stop() function that
 * removes the canvas early if called.
 */
export function burst(container: HTMLElement, opts: ConfettiOptions = {}): () => void {
  // Respect the user's motion preference — skip the animation entirely.
  const mq = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
  if (mq && mq.matches) {
    return () => {};
  }

  const {
    particles: count = 80,
    colors = DEFAULT_COLORS,
    duration = 2200,
    power = 1,
  } = opts;

  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-canvas';
  canvas.style.cssText = [
    'position:absolute',
    'inset:0',
    'width:100%',
    'height:100%',
    'pointer-events:none',
    'z-index:25',
  ].join(';');
  container.appendChild(canvas);

  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const resize = (): void => {
    const rect = container.getBoundingClientRect();
    const w = Math.max(rect.width, 1);
    const h = Math.max(rect.height, 1);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  };
  resize();
  window.addEventListener('resize', resize);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    window.removeEventListener('resize', resize);
    return () => {};
  }
  ctx.scale(dpr, dpr);

  const rect = container.getBoundingClientRect();
  const originX = rect.width / 2;
  const originY = rect.height * 0.35;

  const parts: Particle[] = [];
  for (let i = 0; i < count; i++) {
    // Fan outward, biased slightly upward for a celebratory arc
    const angle = Math.random() * Math.PI * 2;
    const speed = (180 + Math.random() * 280) * power;
    parts.push({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 220, // kick upward
      size: 6 + Math.random() * 6,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 10,
      color: colors[Math.floor(Math.random() * colors.length)],
      shape: Math.random() < 0.6 ? 'rect' : 'circle',
    });
  }

  const GRAVITY = 900;
  const DRAG = 0.98;
  const start = performance.now();
  let rafId = 0;
  let stopped = false;

  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', resize);
    canvas.remove();
  };

  const frame = (now: number): void => {
    if (stopped) return;
    const elapsed = now - start;
    if (elapsed > duration) {
      stop();
      return;
    }
    // Fade particles out in the last 500ms
    const fade = elapsed > duration - 500 ? Math.max(0, (duration - elapsed) / 500) : 1;

    const rect2 = container.getBoundingClientRect();
    const w = rect2.width;
    const h = rect2.height;
    ctx.clearRect(0, 0, w, h);

    const dt = 1 / 60;
    for (const p of parts) {
      p.vy += GRAVITY * dt;
      p.vx *= DRAG;
      p.vy *= DRAG;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;

      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    rafId = requestAnimationFrame(frame);
  };
  rafId = requestAnimationFrame(frame);

  return stop;
}

/**
 * Pool of celebratory messages — handleWin rotates through these.
 * Different lengths/tones so repeat wins feel varied.
 */
export const WIN_MESSAGES = [
  'Congratulations!',
  'Brilliant!',
  'Fantastic job!',
  'You did it!',
  'Amazing!',
  'Well played!',
  'Magnificent!',
  'Outstanding!',
  'Unstoppable!',
  'Nailed it!',
  'Superb!',
  'Incredible!',
] as const;

/** Pick a random celebratory message (or the next one in a cycle if a counter is supplied). */
export function pickWinMessage(index?: number): string {
  if (typeof index === 'number') {
    return WIN_MESSAGES[index % WIN_MESSAGES.length];
  }
  return WIN_MESSAGES[Math.floor(Math.random() * WIN_MESSAGES.length)];
}
