/**
 * Unified input abstraction for games.
 *
 * This sits above the raw DOM events and exposes a single cross-platform
 * pointer model plus high-level gestures (swipe, long-press) and wheel
 * accumulation for trackpad two-finger scrolls.
 *
 * Why this exists: games were handling mouse/touch/trackpad/wheel separately
 * and the result was inconsistent UX — paddle games requiring click-drag on
 * trackpad, swipes not firing at the same threshold across platforms, no
 * right-click-to-flag fallback. Centralizing these concerns here means every
 * game automatically gets parity across devices when it subscribes to the
 * right layer.
 *
 * Games subscribe by passing an `InputConfig` to `GameEngine` (via a future
 * refactor) or by attaching handlers directly via `InputManager`.
 */

export type SwipeDirection = 'up' | 'down' | 'left' | 'right';

export interface PointerState {
  x: number;
  y: number;
  down: boolean;
}

export interface InputEvents {
  /** Fires for mouse-down, touch-start, OR when the pointer enters hover in pointer-follow mode. */
  onPointerDown?: (x: number, y: number) => void;
  onPointerMove?: (x: number, y: number) => void;
  onPointerUp?: (x: number, y: number) => void;
  /** Fires on release after a short tap (no drag, no long-press). */
  onTap?: (x: number, y: number) => void;
  /** Fires after `longPressMs` of sustained pointer-down without movement. */
  onLongPress?: (x: number, y: number) => void;
  /** Fires on release after a drag exceeding `swipeMinDistance` (px), with the
   *  cardinal direction AND the drag velocity in px/ms so games can distinguish
   *  soft-swipe from fast-swipe (e.g. soft-drop vs hard-drop in Tetris). */
  onSwipe?: (dir: SwipeDirection, velocity: number, dx: number, dy: number) => void;
  /** Fires for right-click (desktop) or two-finger tap (trackpad). Suppresses
   *  the browser context menu. Use for "alternate action" like flagging a mine. */
  onAltAction?: (x: number, y: number) => void;
  /** Normalized wheel delta in "ticks" (~1 per line scroll), with direction.
   *  deltaMode is normalized away. Use for trackpad two-finger swipes as
   *  directional input in grid/tile games. */
  onWheel?: (dx: number, dy: number) => void;
  /** Fires when the pointer moves while NOT pressed — used by paddle games for
   *  pointer-follow mode (no click-drag required). */
  onHover?: (x: number, y: number) => void;
  onKeyDown?: (key: string, e: KeyboardEvent) => void;
  onKeyUp?: (key: string, e: KeyboardEvent) => void;
}

export interface InputConfig extends InputEvents {
  /** Minimum pointer travel in logical pixels before a tap upgrades to a swipe/drag. */
  swipeMinDistance?: number;
  /** Maximum ms from pointer-down to pointer-up to count as a tap (if within dist). */
  tapMaxDurationMs?: number;
  /** Long-press trigger delay in ms. 0 disables long-press. */
  longPressMs?: number;
  /** Max pointer drift in px before a long-press is cancelled. */
  longPressMaxDrift?: number;
  /** Suppress the browser context menu on right-click. Default true. */
  suppressContextMenu?: boolean;
  /** Enable hover tracking (pointermove while !down). Default false — only
   *  paddle-style games need it and enabling it everywhere wastes cycles. */
  trackHover?: boolean;
  /** Enable wheel event handling. Default false — only tile/scroll games need it. */
  trackWheel?: boolean;
}

const DEFAULTS: Required<Omit<InputConfig, keyof InputEvents>> = {
  swipeMinDistance: 24,
  tapMaxDurationMs: 280,
  longPressMs: 450,
  longPressMaxDrift: 12,
  suppressContextMenu: true,
  trackHover: false,
  trackWheel: false,
};

/**
 * Manages all DOM listeners for a game and dispatches unified InputEvents.
 *
 * Construct with the canvas + logical dimensions; it converts raw screen
 * coordinates to logical game coordinates on every event. Call `destroy()`
 * to remove all listeners when the game ends.
 */
export class InputManager {
  private canvas: HTMLCanvasElement;
  private width: number;
  private height: number;
  private config: Required<Omit<InputConfig, keyof InputEvents>>;
  private events: InputEvents;

  public readonly pointer: PointerState = { x: 0, y: 0, down: false };
  public readonly keys: Set<string> = new Set();

  // Tap / long-press / swipe tracking
  private pressX = 0;
  private pressY = 0;
  private pressTime = 0;
  private maxDrift = 0;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private longPressFired = false;

  private bound: Array<[EventTarget, string, EventListener, AddEventListenerOptions | undefined]> = [];

  constructor(canvas: HTMLCanvasElement, width: number, height: number, config: InputConfig = {}) {
    this.canvas = canvas;
    this.width = width;
    this.height = height;
    this.events = config;
    this.config = {
      swipeMinDistance: config.swipeMinDistance ?? DEFAULTS.swipeMinDistance,
      tapMaxDurationMs: config.tapMaxDurationMs ?? DEFAULTS.tapMaxDurationMs,
      longPressMs: config.longPressMs ?? DEFAULTS.longPressMs,
      longPressMaxDrift: config.longPressMaxDrift ?? DEFAULTS.longPressMaxDrift,
      suppressContextMenu: config.suppressContextMenu ?? DEFAULTS.suppressContextMenu,
      trackHover: config.trackHover ?? DEFAULTS.trackHover,
      trackWheel: config.trackWheel ?? DEFAULTS.trackWheel,
    };

    this.attach();
  }

  /** Update the logical width/height if the canvas is resized. */
  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  /** Rewire to a different set of event handlers without tearing down listeners. */
  setEvents(events: InputEvents): void {
    this.events = events;
  }

  /** Convert raw clientX/Y to logical game coordinates. */
  private toLogical(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const sx = rect.width > 0 ? this.width / rect.width : 1;
    const sy = rect.height > 0 ? this.height / rect.height : 1;
    return {
      x: (clientX - rect.left) * sx,
      y: (clientY - rect.top) * sy,
    };
  }

  private addL<T extends EventTarget>(
    target: T,
    event: string,
    handler: EventListener,
    opts?: AddEventListenerOptions,
  ): void {
    target.addEventListener(event, handler, opts);
    this.bound.push([target, event, handler, opts]);
  }

  private attach(): void {
    // ── Keyboard ──
    this.addL(window, 'keydown', ((e: KeyboardEvent) => {
      this.keys.add(e.key);
      this.events.onKeyDown?.(e.key, e);
    }) as EventListener);

    this.addL(window, 'keyup', ((e: KeyboardEvent) => {
      this.keys.delete(e.key);
      this.events.onKeyUp?.(e.key, e);
    }) as EventListener);

    // ── Mouse ──
    this.addL(this.canvas, 'mousedown', ((e: MouseEvent) => {
      if (e.button === 2) return; // right-click handled via contextmenu
      const { x, y } = this.toLogical(e.clientX, e.clientY);
      this.beginPress(x, y);
      this.events.onPointerDown?.(x, y);
    }) as EventListener);

    this.addL(this.canvas, 'mousemove', ((e: MouseEvent) => {
      const { x, y } = this.toLogical(e.clientX, e.clientY);
      this.pointer.x = x;
      this.pointer.y = y;
      if (this.pointer.down) {
        this.trackDrift(x, y);
        this.events.onPointerMove?.(x, y);
      } else if (this.config.trackHover) {
        this.events.onHover?.(x, y);
      }
    }) as EventListener);

    this.addL(window, 'mouseup', ((e: MouseEvent) => {
      if (!this.pointer.down) return;
      const { x, y } = this.toLogical(e.clientX, e.clientY);
      this.endPress(x, y);
      this.events.onPointerUp?.(x, y);
    }) as EventListener);

    // ── Context menu / right-click for alt action ──
    this.addL(this.canvas, 'contextmenu', ((e: MouseEvent) => {
      if (this.config.suppressContextMenu) e.preventDefault();
      const { x, y } = this.toLogical(e.clientX, e.clientY);
      this.events.onAltAction?.(x, y);
    }) as EventListener);

    // ── Touch ──
    this.addL(this.canvas, 'touchstart', ((e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      if (!t) return;
      const { x, y } = this.toLogical(t.clientX, t.clientY);
      this.beginPress(x, y);
      this.events.onPointerDown?.(x, y);
    }) as EventListener, { passive: false });

    this.addL(this.canvas, 'touchmove', ((e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      if (!t) return;
      const { x, y } = this.toLogical(t.clientX, t.clientY);
      this.pointer.x = x;
      this.pointer.y = y;
      if (this.pointer.down) {
        this.trackDrift(x, y);
        this.events.onPointerMove?.(x, y);
      }
    }) as EventListener, { passive: false });

    this.addL(this.canvas, 'touchend', ((e: TouchEvent) => {
      e.preventDefault();
      // touchend has no touches[0]; use the last move position
      this.endPress(this.pointer.x, this.pointer.y);
      this.events.onPointerUp?.(this.pointer.x, this.pointer.y);
    }) as EventListener, { passive: false });

    this.addL(this.canvas, 'touchcancel', ((_e: TouchEvent) => {
      this.cancelPress();
    }) as EventListener, { passive: false });

    // ── Wheel (trackpad two-finger scroll) ──
    if (this.config.trackWheel) {
      this.addL(this.canvas, 'wheel', ((e: WheelEvent) => {
        e.preventDefault();
        // Normalize deltaMode to pixels. 0=pixel, 1=line (~16px), 2=page (~100px).
        const mult = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
        this.events.onWheel?.(e.deltaX * mult, e.deltaY * mult);
      }) as EventListener, { passive: false });
    }
  }

  private beginPress(x: number, y: number): void {
    this.pointer.x = x;
    this.pointer.y = y;
    this.pointer.down = true;
    this.pressX = x;
    this.pressY = y;
    this.pressTime = performance.now();
    this.maxDrift = 0;
    this.longPressFired = false;

    if (this.config.longPressMs > 0 && this.events.onLongPress) {
      this.longPressTimer = setTimeout(() => {
        this.longPressTimer = null;
        if (this.pointer.down && this.maxDrift <= this.config.longPressMaxDrift) {
          this.longPressFired = true;
          this.events.onLongPress?.(this.pointer.x, this.pointer.y);
        }
      }, this.config.longPressMs);
    }
  }

  private trackDrift(x: number, y: number): void {
    const dx = x - this.pressX;
    const dy = y - this.pressY;
    const dist = Math.hypot(dx, dy);
    if (dist > this.maxDrift) this.maxDrift = dist;

    // Cancel long-press once we exceed the drift tolerance
    if (this.longPressTimer !== null && this.maxDrift > this.config.longPressMaxDrift) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  private endPress(x: number, y: number): void {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.pointer.down = false;

    // If long-press already fired, skip tap/swipe classification
    if (this.longPressFired) return;

    const dx = x - this.pressX;
    const dy = y - this.pressY;
    const dist = Math.hypot(dx, dy);
    const duration = performance.now() - this.pressTime;

    if (dist >= this.config.swipeMinDistance) {
      // Swipe — classify direction by dominant axis
      const dir: SwipeDirection =
        Math.abs(dx) > Math.abs(dy)
          ? dx > 0 ? 'right' : 'left'
          : dy > 0 ? 'down' : 'up';
      const velocity = duration > 0 ? dist / duration : 0;
      this.events.onSwipe?.(dir, velocity, dx, dy);
    } else if (duration <= this.config.tapMaxDurationMs) {
      this.events.onTap?.(x, y);
    }
  }

  private cancelPress(): void {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.pointer.down = false;
    this.longPressFired = false;
  }

  /** Remove every listener. Idempotent — safe to call multiple times. */
  destroy(): void {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    for (const [target, event, handler, opts] of this.bound) {
      target.removeEventListener(event, handler, opts);
    }
    this.bound = [];
  }
}
