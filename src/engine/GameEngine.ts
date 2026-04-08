import { sound } from '../utils/audio';
import { hapticLight, hapticMedium, hapticHeavy } from '../utils/haptics';
import { mulberry32 } from '../utils/rng';

export type GameSnapshot = Record<string, unknown>;

export interface ResumeData {
  state: GameSnapshot;
  score: number;
  won?: boolean;
}

/**
 * A single recorded input event during a game session. The engine logs these
 * automatically via its input wrappers — individual games don't need to know
 * they exist. Used for replay, debugging, and future "rewind time" features.
 */
export interface GameEvent {
  /** Milliseconds since the game's start() call. */
  t: number;
  kind: 'key-down' | 'key-up' | 'pointer-down' | 'pointer-move' | 'pointer-up';
  payload: Record<string, unknown>;
}

/** Full replay record — everything needed to reproduce a game session. */
export interface ReplayLog {
  /** Seed the game was started with (undefined = Math.random was used). Determinism
   *  requires a seeded rng: a replay with seed=undefined is only approximate. */
  seed: number | undefined;
  difficulty: number;
  events: GameEvent[];
  finalScore?: number;
  durationMs?: number;
  /** ISO timestamp of when the log was captured — for sorting/debugging. */
  capturedAt: string;
}

export interface GameConfig {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  difficulty?: number; // 0=easy, 1=medium, 2=hard, 3=extra hard
  /** Optional seed for deterministic puzzle generation. When set, the game's
   *  `this.rng()` is a seeded PRNG; otherwise it falls back to Math.random.
   *  Used by Daily Mode so every player gets the same puzzle for the day. */
  seed?: number;
  onScore?: (score: number) => void;
  onGameOver?: (finalScore: number) => void;
  onWin?: (finalScore: number) => void;
  onUpdate?: (data: Record<string, unknown>) => void;
}

export abstract class GameEngine {
  protected canvas: HTMLCanvasElement;
  protected ctx: CanvasRenderingContext2D;
  protected width: number;
  protected height: number;
  protected dpr: number;
  protected difficulty: number;
  protected running = false;
  protected paused = false;
  protected won = false;
  protected score = 0;
  protected animFrameId = 0;
  protected lastTime = 0;

  protected onScore: (score: number) => void;
  protected onGameOver: (finalScore: number) => void;
  protected onWin: (finalScore: number) => void;
  protected onUpdate: (data: Record<string, unknown>) => void;

  /** Seed used to construct rng (undefined = unseeded / Math.random). Stored
   *  so games can re-seed during restart while preserving daily determinism. */
  protected seed: number | undefined;
  /** RNG callable. Either a seeded mulberry32 (when config.seed was set) or
   *  Math.random. Always use this in games to stay daily-mode compatible. */
  protected rng: () => number;

  // Input state
  protected keys: Set<string> = new Set();
  protected pointer: { x: number; y: number; down: boolean } = { x: 0, y: 0, down: false };

  // Event log — append-only record of every input during this session.
  // Capped at MAX_EVENTS to bound memory on very long sessions.
  private eventLog: GameEvent[] = [];
  private logStartTime = 0;
  private static readonly MAX_EVENTS = 10000;
  /** Replay mode: when true, raw browser input listeners skip recording
   *  because events are being re-dispatched from a ReplayLog instead. */
  private replayActive = false;

  private boundHandlers: Array<[string, EventListener, EventTarget]> = [];

  constructor(config: GameConfig) {
    this.canvas = config.canvas;
    this.ctx = config.canvas.getContext('2d')!;
    this.width = config.width;
    this.height = config.height;
    this.difficulty = config.difficulty ?? 0;
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.onScore = config.onScore || (() => {});
    this.onGameOver = config.onGameOver || (() => {});
    this.onWin = config.onWin || (() => {});
    this.onUpdate = config.onUpdate || (() => {});

    this.seed = config.seed;
    this.rng = config.seed != null ? mulberry32(config.seed) : Math.random;

    this.setupCanvas();
    this.setupInput();
  }

  private setupCanvas(): void {
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.scale(this.dpr, this.dpr);
  }

  private addListener(target: EventTarget, event: string, handler: EventListener, options?: AddEventListenerOptions): void {
    target.addEventListener(event, handler, options);
    this.boundHandlers.push([event, handler, target]);
  }

  private setupInput(): void {
    this.addListener(window, 'keydown', ((e: KeyboardEvent) => {
      this.keys.add(e.key);
      this.recordEvent('key-down', { key: e.key });
      this.handleKeyDown(e.key, e);
    }) as EventListener);

    this.addListener(window, 'keyup', ((e: KeyboardEvent) => {
      this.keys.delete(e.key);
      this.recordEvent('key-up', { key: e.key });
      this.handleKeyUp(e.key, e);
    }) as EventListener);

    this.addListener(this.canvas, 'mousedown', ((e: MouseEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.x = (e.clientX - rect.left) * (this.width / rect.width);
      this.pointer.y = (e.clientY - rect.top) * (this.height / rect.height);
      this.pointer.down = true;
      this.recordEvent('pointer-down', { x: this.pointer.x, y: this.pointer.y });
      this.handlePointerDown(this.pointer.x, this.pointer.y);
    }) as EventListener);

    this.addListener(this.canvas, 'mousemove', ((e: MouseEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.x = (e.clientX - rect.left) * (this.width / rect.width);
      this.pointer.y = (e.clientY - rect.top) * (this.height / rect.height);
      this.recordEvent('pointer-move', { x: this.pointer.x, y: this.pointer.y });
      this.handlePointerMove(this.pointer.x, this.pointer.y);
    }) as EventListener);

    this.addListener(window, 'mouseup', (() => {
      if (this.pointer.down) {
        this.pointer.down = false;
        this.recordEvent('pointer-up', { x: this.pointer.x, y: this.pointer.y });
        this.handlePointerUp(this.pointer.x, this.pointer.y);
      }
    }) as EventListener);

    this.addListener(this.canvas, 'touchstart', ((e: TouchEvent) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const touch = e.touches[0];
      this.pointer.x = (touch.clientX - rect.left) * (this.width / rect.width);
      this.pointer.y = (touch.clientY - rect.top) * (this.height / rect.height);
      this.pointer.down = true;
      this.recordEvent('pointer-down', { x: this.pointer.x, y: this.pointer.y });
      this.handlePointerDown(this.pointer.x, this.pointer.y);
    }) as EventListener, { passive: false });

    this.addListener(this.canvas, 'touchmove', ((e: TouchEvent) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const touch = e.touches[0];
      this.pointer.x = (touch.clientX - rect.left) * (this.width / rect.width);
      this.pointer.y = (touch.clientY - rect.top) * (this.height / rect.height);
      this.recordEvent('pointer-move', { x: this.pointer.x, y: this.pointer.y });
      this.handlePointerMove(this.pointer.x, this.pointer.y);
    }) as EventListener, { passive: false });

    this.addListener(this.canvas, 'touchend', ((e: TouchEvent) => {
      e.preventDefault();
      this.pointer.down = false;
      this.recordEvent('pointer-up', { x: this.pointer.x, y: this.pointer.y });
      this.handlePointerUp(this.pointer.x, this.pointer.y);
    }) as EventListener, { passive: false });
  }

  /** Append an event to the session log. No-op during replay (the
   *  events being re-dispatched must not be re-recorded) and after MAX_EVENTS. */
  private recordEvent(kind: GameEvent['kind'], payload: Record<string, unknown>): void {
    if (this.replayActive) return;
    if (this.eventLog.length >= GameEngine.MAX_EVENTS) return;
    this.eventLog.push({
      t: performance.now() - this.logStartTime,
      kind,
      payload,
    });
  }

  /** Get a snapshot of the current session's event log. Returned object
   *  is a structured clone of the internal state — safe to store. */
  getEventLog(): ReplayLog {
    return {
      seed: this.seed,
      difficulty: this.difficulty,
      events: this.eventLog.slice(),
      finalScore: this.score,
      durationMs: this.logStartTime > 0 ? performance.now() - this.logStartTime : 0,
      capturedAt: new Date().toISOString(),
    };
  }

  /** Re-dispatch a previously recorded log against this engine, in event order.
   *  Must be called after init() — typically on a fresh engine created with the
   *  same seed and difficulty. Fires the same game lifecycle methods the original
   *  session did, so deterministic games reach the same final state.
   *
   *  This is a best-effort implementation: it plays events sequentially without
   *  inter-frame delays. A time-accurate scrubbing replay UI can build on top of
   *  this by dispatching only events whose t <= currentPlaybackTime. */
  replay(log: ReplayLog): void {
    this.replayActive = true;
    try {
      for (const ev of log.events) {
        switch (ev.kind) {
          case 'key-down': {
            const key = ev.payload.key as string;
            this.keys.add(key);
            // Synthesize a minimal KeyboardEvent-like object for handlers that
            // only read .key — games rarely inspect other fields.
            this.handleKeyDown(key, { key, preventDefault: () => {} } as KeyboardEvent);
            break;
          }
          case 'key-up': {
            const key = ev.payload.key as string;
            this.keys.delete(key);
            this.handleKeyUp(key, { key, preventDefault: () => {} } as KeyboardEvent);
            break;
          }
          case 'pointer-down': {
            const x = ev.payload.x as number;
            const y = ev.payload.y as number;
            this.pointer.x = x;
            this.pointer.y = y;
            this.pointer.down = true;
            this.handlePointerDown(x, y);
            break;
          }
          case 'pointer-move': {
            const x = ev.payload.x as number;
            const y = ev.payload.y as number;
            this.pointer.x = x;
            this.pointer.y = y;
            this.handlePointerMove(x, y);
            break;
          }
          case 'pointer-up': {
            const x = ev.payload.x as number;
            const y = ev.payload.y as number;
            this.pointer.down = false;
            this.handlePointerUp(x, y);
            break;
          }
        }
      }
    } finally {
      this.replayActive = false;
    }
  }

  /** Number of recorded events. Useful for tests and the future replay UI. */
  getEventCount(): number {
    return this.eventLog.length;
  }

  protected handleKeyDown(_key: string, _e: KeyboardEvent): void {}
  protected handleKeyUp(_key: string, _e: KeyboardEvent): void {}
  protected handlePointerDown(_x: number, _y: number): void {}
  protected handlePointerMove(_x: number, _y: number): void {}
  protected handlePointerUp(_x: number, _y: number): void {}

  abstract init(): void;
  abstract update(dt: number): void;
  abstract render(): void;

  protected setScore(score: number): void {
    this.score = score;
    this.onScore(score);
  }

  protected addScore(points: number): void {
    this.setScore(this.score + points);
    sound.play('score');
  }

  protected gameOver(): void {
    this.running = false;
    cancelAnimationFrame(this.animFrameId);
    sound.play('gameOver');
    this.onGameOver(this.score);
  }

  /** Trigger win celebration. Idempotent within a session. Does NOT stop the game loop —
   *  call gameOver() afterwards if the game should also end. */
  protected gameWin(): void {
    if (this.won) return;
    this.won = true;
    sound.play('win');
    this.onWin(this.score);
  }

  // ── Save / Resume hooks (games override these) ──

  /** Return a serializable snapshot of the game's state, or null if state can't be captured.
   *  Default implementation returns null (game doesn't support save/resume). */
  serialize(): GameSnapshot | null { return null; }

  /** Restore game state from a snapshot produced by serialize().
   *  Called after init() if a saved state exists. */
  deserialize(_state: GameSnapshot): void { /* no-op default */ }

  /** Whether the game is currently in a state safe to save (e.g., no animations in flight).
   *  Default: true. Override to return false during transient/unstable moments. */
  canSave(): boolean { return true; }

  // ── Public state accessors ──
  isPaused(): boolean { return this.paused; }
  isRunning(): boolean { return this.running; }
  isWon(): boolean { return this.won; }
  getScore(): number { return this.score; }

  protected playSound(name: string): void {
    sound.play(name as Parameters<typeof sound.play>[0]);
  }

  protected haptic(intensity: 'light' | 'medium' | 'heavy' = 'light'): void {
    if (intensity === 'heavy') hapticHeavy();
    else if (intensity === 'medium') hapticMedium();
    else hapticLight();
  }

  private loop = (time: number): void => {
    if (!this.running) return;
    const dt = Math.min((time - this.lastTime) / 1000, 0.05); // cap at 50ms for smoother feel
    this.lastTime = time;

    if (!this.paused) {
      this.update(dt);
      this.render();
    }

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  start(resume?: ResumeData | null): void {
    this.running = true;
    this.paused = false;
    this.won = false;
    this.score = 0;
    // Fresh event log for each session. Replay() on a previously-recorded
    // log can still read it because replayActive guards recordEvent.
    this.eventLog = [];
    this.logStartTime = performance.now();
    this.init();
    if (resume) {
      try {
        this.deserialize(resume.state);
        this.score = resume.score;
        if (resume.won) this.won = true;
      } catch {
        // Corrupt snapshot — fall through to fresh init() state.
        this.score = 0;
        this.won = false;
      }
    }
    this.onScore(this.score);
    this.lastTime = performance.now();
    this.animFrameId = requestAnimationFrame(this.loop);
  }

  pause(): void { this.paused = true; }

  resume(): void {
    if (this.paused) {
      this.paused = false;
      this.lastTime = performance.now();
    }
  }

  destroy(): void {
    this.running = false;
    cancelAnimationFrame(this.animFrameId);
    for (const [event, handler, target] of this.boundHandlers) {
      target.removeEventListener(event, handler);
    }
    this.boundHandlers = [];
  }

  // Drawing helpers
  protected clear(color = '#FEF0E4'): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  protected drawRoundRect(x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string): void {
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, w, h, r);
    if (fill) {
      this.ctx.fillStyle = fill;
      this.ctx.fill();
    }
    if (stroke) {
      this.ctx.strokeStyle = stroke;
      this.ctx.lineWidth = 1;
      this.ctx.stroke();
    }
  }

  protected drawText(text: string, x: number, y: number, opts: {
    size?: number;
    color?: string;
    align?: CanvasTextAlign;
    baseline?: CanvasTextBaseline;
    weight?: string;
    font?: string;
  } = {}): void {
    const { size = 16, color = '#3D2B35', align = 'center', baseline = 'middle', weight = '600', font } = opts;
    this.ctx.font = `${weight} ${size}px ${font || "'Inter', system-ui, sans-serif"}`;
    this.ctx.fillStyle = color;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = baseline;
    this.ctx.fillText(text, x, y);
  }

  protected drawCircle(x: number, y: number, r: number, fill: string, stroke?: string, lineWidth = 1): void {
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) {
      this.ctx.fillStyle = fill;
      this.ctx.fill();
    }
    if (stroke) {
      this.ctx.strokeStyle = stroke;
      this.ctx.lineWidth = lineWidth;
      this.ctx.stroke();
    }
  }

  // Smooth lerp helper for animations
  protected lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  // Ease out cubic for smooth deceleration
  protected easeOut(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }
}
