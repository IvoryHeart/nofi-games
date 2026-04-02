import { sound } from '../utils/audio';
import { hapticLight, hapticMedium, hapticHeavy } from '../utils/haptics';

export interface GameConfig {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  difficulty?: number; // 0=easy, 1=medium, 2=hard, 3=extra hard
  onScore?: (score: number) => void;
  onGameOver?: (finalScore: number) => void;
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
  protected score = 0;
  protected animFrameId = 0;
  protected lastTime = 0;

  protected onScore: (score: number) => void;
  protected onGameOver: (finalScore: number) => void;
  protected onUpdate: (data: Record<string, unknown>) => void;

  // Input state
  protected keys: Set<string> = new Set();
  protected pointer: { x: number; y: number; down: boolean } = { x: 0, y: 0, down: false };

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
    this.onUpdate = config.onUpdate || (() => {});

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
      this.handleKeyDown(e.key, e);
    }) as EventListener);

    this.addListener(window, 'keyup', ((e: KeyboardEvent) => {
      this.keys.delete(e.key);
      this.handleKeyUp(e.key, e);
    }) as EventListener);

    this.addListener(this.canvas, 'mousedown', ((e: MouseEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.x = (e.clientX - rect.left) * (this.width / rect.width);
      this.pointer.y = (e.clientY - rect.top) * (this.height / rect.height);
      this.pointer.down = true;
      this.handlePointerDown(this.pointer.x, this.pointer.y);
    }) as EventListener);

    this.addListener(this.canvas, 'mousemove', ((e: MouseEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.x = (e.clientX - rect.left) * (this.width / rect.width);
      this.pointer.y = (e.clientY - rect.top) * (this.height / rect.height);
      this.handlePointerMove(this.pointer.x, this.pointer.y);
    }) as EventListener);

    this.addListener(window, 'mouseup', (() => {
      if (this.pointer.down) {
        this.pointer.down = false;
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
      this.handlePointerDown(this.pointer.x, this.pointer.y);
    }) as EventListener, { passive: false });

    this.addListener(this.canvas, 'touchmove', ((e: TouchEvent) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const touch = e.touches[0];
      this.pointer.x = (touch.clientX - rect.left) * (this.width / rect.width);
      this.pointer.y = (touch.clientY - rect.top) * (this.height / rect.height);
      this.handlePointerMove(this.pointer.x, this.pointer.y);
    }) as EventListener, { passive: false });

    this.addListener(this.canvas, 'touchend', ((e: TouchEvent) => {
      e.preventDefault();
      this.pointer.down = false;
      this.handlePointerUp(this.pointer.x, this.pointer.y);
    }) as EventListener, { passive: false });
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

  start(): void {
    this.running = true;
    this.paused = false;
    this.score = 0;
    this.init();
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
