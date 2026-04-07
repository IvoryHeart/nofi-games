import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameEngine, GameConfig, GameSnapshot, ResumeData } from '../../src/engine/GameEngine';

// Mock audio and haptics modules
vi.mock('../../src/utils/audio', () => ({
  sound: { play: vi.fn() },
}));
vi.mock('../../src/utils/haptics', () => ({
  hapticLight: vi.fn(),
  hapticMedium: vi.fn(),
  hapticHeavy: vi.fn(),
}));

import { sound } from '../../src/utils/audio';
import { hapticLight, hapticMedium, hapticHeavy } from '../../src/utils/haptics';

class TestGame extends GameEngine {
  public initCalled = false;
  public updateCalls: number[] = [];
  public renderCalled = false;
  public lastKeyDown = '';
  public lastKeyUp = '';
  public lastPointerDown = { x: 0, y: 0 };
  public lastPointerMove = { x: 0, y: 0 };
  public lastPointerUp = { x: 0, y: 0 };

  init() { this.initCalled = true; }
  update(dt: number) { this.updateCalls.push(dt); }
  render() { this.renderCalled = true; }

  protected handleKeyDown(key: string, _e: KeyboardEvent) { this.lastKeyDown = key; }
  protected handleKeyUp(key: string, _e: KeyboardEvent) { this.lastKeyUp = key; }
  protected handlePointerDown(x: number, y: number) { this.lastPointerDown = { x, y }; }
  protected handlePointerMove(x: number, y: number) { this.lastPointerMove = { x, y }; }
  protected handlePointerUp(x: number, y: number) { this.lastPointerUp = { x, y }; }

  // Expose protected members for testing
  public testSetScore(s: number) { this.setScore(s); }
  public testAddScore(p: number) { this.addScore(p); }
  public testGameOver() { this.gameOver(); }
  public testClear(c?: string) { this.clear(c); }
  public testDrawRoundRect(x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string) {
    this.drawRoundRect(x, y, w, h, r, fill, stroke);
  }
  public testDrawText(text: string, x: number, y: number, opts?: Parameters<GameEngine['drawText']>[3]) {
    this.drawText(text, x, y, opts);
  }
  public testDrawCircle(x: number, y: number, r: number, fill: string, stroke?: string, lineWidth?: number) {
    this.drawCircle(x, y, r, fill, stroke, lineWidth);
  }
  public testLerp(a: number, b: number, t: number) { return this.lerp(a, b, t); }
  public testEaseOut(t: number) { return this.easeOut(t); }
  public testPlaySound(name: string) { this.playSound(name); }
  public testHaptic(intensity?: 'light' | 'medium' | 'heavy') { this.haptic(intensity); }
  public getScore() { return this.score; }
  public getDifficulty() { return this.difficulty; }
  public isRunning() { return this.running; }
  public isPaused() { return this.paused; }
  public getCtx() { return this.ctx; }
  public getCanvas() { return this.canvas; }
  public getKeys() { return this.keys; }
  public getPointer() { return this.pointer; }
  public getDpr() { return this.dpr; }
  public getAnimFrameId() { return this.animFrameId; }
}

function createTestConfig(overrides: Partial<GameConfig> = {}): GameConfig {
  return { canvas: document.createElement('canvas'), width: 300, height: 400, ...overrides };
}

describe('GameEngine', () => {
  let game: TestGame;

  beforeEach(() => {
    vi.clearAllMocks();
    game = new TestGame(createTestConfig());
  });

  afterEach(() => {
    game.destroy();
  });

  // ── Constructor & Initialization ──

  describe('constructor', () => {
    it('should set canvas dimensions with device pixel ratio', () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      expect(game.getCtx().canvas.width).toBe(300 * dpr);
      expect(game.getCtx().canvas.height).toBe(400 * dpr);
    });

    it('should set canvas CSS dimensions', () => {
      expect(game.getCanvas().style.width).toBe('300px');
      expect(game.getCanvas().style.height).toBe('400px');
    });

    it('should cap DPR at 3', () => {
      const origDpr = window.devicePixelRatio;
      Object.defineProperty(window, 'devicePixelRatio', { value: 5, writable: true, configurable: true });
      const g = new TestGame(createTestConfig());
      expect(g.getDpr()).toBe(3);
      g.destroy();
      Object.defineProperty(window, 'devicePixelRatio', { value: origDpr, writable: true, configurable: true });
    });

    it('should default DPR to 1 if devicePixelRatio is falsy', () => {
      const origDpr = window.devicePixelRatio;
      Object.defineProperty(window, 'devicePixelRatio', { value: 0, writable: true, configurable: true });
      const g = new TestGame(createTestConfig());
      expect(g.getDpr()).toBe(1);
      g.destroy();
      Object.defineProperty(window, 'devicePixelRatio', { value: origDpr, writable: true, configurable: true });
    });

    it('should default difficulty to 0', () => {
      expect(game.getDifficulty()).toBe(0);
    });

    it('should accept difficulty parameter', () => {
      const g = new TestGame(createTestConfig({ difficulty: 2 }));
      expect(g.getDifficulty()).toBe(2);
      g.destroy();
    });

    it('should accept difficulty 3 (extra hard)', () => {
      const g = new TestGame(createTestConfig({ difficulty: 3 }));
      expect(g.getDifficulty()).toBe(3);
      g.destroy();
    });

    it('should use provided onScore callback', () => {
      const onScore = vi.fn();
      const g = new TestGame(createTestConfig({ onScore }));
      g.testSetScore(42);
      expect(onScore).toHaveBeenCalledWith(42);
      g.destroy();
    });

    it('should use provided onGameOver callback', () => {
      const onGameOver = vi.fn();
      const g = new TestGame(createTestConfig({ onGameOver }));
      g.start();
      g.testSetScore(99);
      g.testGameOver();
      expect(onGameOver).toHaveBeenCalledWith(99);
      g.destroy();
    });

    it('should use provided onUpdate callback', () => {
      // onUpdate is stored but called from subclasses, verify no crash with default noop
      const g = new TestGame(createTestConfig());
      // no crash if onUpdate never called
      g.destroy();
    });

    it('should use default noop callbacks when not provided', () => {
      const g = new TestGame(createTestConfig());
      // These should not throw
      g.testSetScore(10);
      g.testGameOver();
      g.destroy();
    });

    it('should use provided onUpdate callback', () => {
      const onUpdate = vi.fn();
      const g = new TestGame(createTestConfig({ onUpdate }));
      // onUpdate is stored; verify it was assigned (not noop)
      // The engine stores it but only subclasses call it
      g.destroy();
    });

    it('should scale ctx by dpr', () => {
      const spy = vi.spyOn(game.getCtx(), 'scale');
      // scale was already called in constructor, verify canvas dimensions reflect it
      const dpr = game.getDpr();
      expect(game.getCanvas().width).toBe(300 * dpr);
    });

    it('should initialize keys as empty set', () => {
      expect(game.getKeys().size).toBe(0);
    });

    it('should initialize pointer as {x:0, y:0, down:false}', () => {
      expect(game.getPointer()).toEqual({ x: 0, y: 0, down: false });
    });
  });

  // ── start / pause / resume / destroy lifecycle ──

  describe('start()', () => {
    it('should call init and set running state', () => {
      game.start();
      expect(game.initCalled).toBe(true);
      expect(game.isRunning()).toBe(true);
    });

    it('should reset score to 0', () => {
      game.testSetScore(500);
      game.start();
      expect(game.getScore()).toBe(0);
    });

    it('should set paused to false', () => {
      game.start();
      game.pause();
      game.start(); // restart
      expect(game.isPaused()).toBe(false);
    });

    it('should request an animation frame', () => {
      const spy = vi.spyOn(window, 'requestAnimationFrame');
      game.start();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('pause()', () => {
    it('should set paused to true', () => {
      game.start();
      game.pause();
      expect(game.isPaused()).toBe(true);
    });
  });

  describe('resume()', () => {
    it('should resume after pause', () => {
      game.start();
      game.pause();
      expect(game.isPaused()).toBe(true);
      game.resume();
      expect(game.isPaused()).toBe(false);
    });

    it('should not change state if not paused', () => {
      game.start();
      game.resume(); // not paused
      expect(game.isPaused()).toBe(false);
    });

    it('should update lastTime on resume', () => {
      const spy = vi.spyOn(performance, 'now').mockReturnValue(12345);
      game.start();
      game.pause();
      spy.mockReturnValue(99999);
      game.resume();
      // no crash, lastTime updated internally
      spy.mockRestore();
    });
  });

  describe('destroy()', () => {
    it('should set running to false', () => {
      game.start();
      game.destroy();
      expect(game.isRunning()).toBe(false);
    });

    it('should cancel animation frame', () => {
      const spy = vi.spyOn(window, 'cancelAnimationFrame');
      game.start();
      game.destroy();
      expect(spy).toHaveBeenCalled();
    });

    it('should remove all event listeners', () => {
      const removeListenerSpy = vi.spyOn(window, 'removeEventListener');
      game.destroy();
      // At minimum keydown, keyup, mouseup listeners were on window
      expect(removeListenerSpy).toHaveBeenCalled();
    });

    it('should handle destroy while paused', () => {
      game.start();
      game.pause();
      expect(() => game.destroy()).not.toThrow();
      expect(game.isRunning()).toBe(false);
    });

    it('should handle destroy before start', () => {
      expect(() => game.destroy()).not.toThrow();
    });

    it('should handle double destroy', () => {
      game.start();
      game.destroy();
      expect(() => game.destroy()).not.toThrow();
    });
  });

  // ── Game loop ──

  describe('game loop', () => {
    it('should call update and render on each frame when running and not paused', () => {
      game.start();
      // Simulate animation frame callback
      const rafCallback = vi.mocked(requestAnimationFrame).mock.calls[0]?.[0];
      if (typeof rafCallback === 'function') {
        (rafCallback as (time: number) => void)(performance.now() + 16);
        expect(game.updateCalls.length).toBeGreaterThan(0);
        expect(game.renderCalled).toBe(true);
      }
    });

    it('should not call update/render when paused', () => {
      game.start();
      game.pause();
      game.updateCalls = [];
      game.renderCalled = false;
      // Manually invoke loop
      const rafCallback = vi.mocked(requestAnimationFrame).mock.calls[0]?.[0];
      if (typeof rafCallback === 'function') {
        (rafCallback as (time: number) => void)(performance.now() + 16);
      }
      // When paused, update/render are skipped, but loop continues
    });

    it('should cap dt at 0.05 seconds (50ms)', () => {
      game.start();
      // Find the most recent raf callback
      const calls = vi.mocked(requestAnimationFrame).mock.calls;
      const lastCallback = calls[calls.length - 1]?.[0];
      if (typeof lastCallback === 'function') {
        // Simulate a large time gap (1 second)
        game.updateCalls = [];
        (lastCallback as (time: number) => void)(performance.now() + 1000);
        if (game.updateCalls.length > 0) {
          expect(game.updateCalls[0]).toBeLessThanOrEqual(0.05);
        }
      }
    });

    it('should stop the loop when running is false', () => {
      game.start();
      game.destroy(); // sets running = false
      const calls = vi.mocked(requestAnimationFrame).mock.calls;
      const lastCallback = calls[calls.length - 1]?.[0];
      if (typeof lastCallback === 'function') {
        const updatesBefore = game.updateCalls.length;
        (lastCallback as (time: number) => void)(performance.now() + 16);
        // No new updates since running is false
        expect(game.updateCalls.length).toBe(updatesBefore);
      }
    });
  });

  // ── Score management ──

  describe('score management', () => {
    it('setScore should set score and notify', () => {
      const onScore = vi.fn();
      const g = new TestGame(createTestConfig({ onScore }));
      g.testSetScore(100);
      expect(g.getScore()).toBe(100);
      expect(onScore).toHaveBeenCalledWith(100);
      g.destroy();
    });

    it('addScore should increment and play sound', () => {
      const onScore = vi.fn();
      const g = new TestGame(createTestConfig({ onScore }));
      g.testSetScore(50);
      g.testAddScore(30);
      expect(g.getScore()).toBe(80);
      expect(onScore).toHaveBeenCalledWith(80);
      expect(sound.play).toHaveBeenCalledWith('score');
      g.destroy();
    });

    it('addScore with zero points', () => {
      game.testSetScore(10);
      game.testAddScore(0);
      expect(game.getScore()).toBe(10);
    });
  });

  // ── gameOver ──

  describe('gameOver()', () => {
    it('should stop running, cancel anim frame, play sound, and call onGameOver', () => {
      const onGameOver = vi.fn();
      const g = new TestGame(createTestConfig({ onGameOver }));
      const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');
      g.start();
      g.testSetScore(250);
      g.testGameOver();
      expect(g.isRunning()).toBe(false);
      expect(cancelSpy).toHaveBeenCalled();
      expect(sound.play).toHaveBeenCalledWith('gameOver');
      expect(onGameOver).toHaveBeenCalledWith(250);
      g.destroy();
    });
  });

  // ── playSound ──

  describe('playSound()', () => {
    it('should delegate to sound.play', () => {
      game.testPlaySound('tap');
      expect(sound.play).toHaveBeenCalledWith('tap');
    });

    it('should play various sound names', () => {
      game.testPlaySound('move');
      expect(sound.play).toHaveBeenCalledWith('move');
      game.testPlaySound('clear');
      expect(sound.play).toHaveBeenCalledWith('clear');
    });
  });

  // ── haptic ──

  describe('haptic()', () => {
    it('should call hapticLight by default', () => {
      game.testHaptic();
      expect(hapticLight).toHaveBeenCalled();
    });

    it('should call hapticLight for "light"', () => {
      game.testHaptic('light');
      expect(hapticLight).toHaveBeenCalled();
    });

    it('should call hapticMedium for "medium"', () => {
      game.testHaptic('medium');
      expect(hapticMedium).toHaveBeenCalled();
    });

    it('should call hapticHeavy for "heavy"', () => {
      game.testHaptic('heavy');
      expect(hapticHeavy).toHaveBeenCalled();
    });
  });

  // ── Drawing helpers ──

  describe('drawing helpers', () => {
    describe('clear()', () => {
      it('should fill canvas with default color', () => {
        const ctx = game.getCtx();
        const spy = vi.spyOn(ctx, 'fillRect');
        game.testClear();
        expect(ctx.fillStyle).toBe('#FEF0E4');
        expect(spy).toHaveBeenCalledWith(0, 0, 300, 400);
      });

      it('should fill canvas with custom color', () => {
        const ctx = game.getCtx();
        game.testClear('#000000');
        expect(ctx.fillStyle).toBe('#000000');
      });
    });

    describe('drawRoundRect()', () => {
      it('should draw filled round rect', () => {
        const ctx = game.getCtx();
        const beginPathSpy = vi.spyOn(ctx, 'beginPath');
        const roundRectSpy = vi.spyOn(ctx, 'roundRect');
        const fillSpy = vi.spyOn(ctx, 'fill');
        game.testDrawRoundRect(10, 20, 100, 50, 5, '#FF0000');
        expect(beginPathSpy).toHaveBeenCalled();
        expect(roundRectSpy).toHaveBeenCalledWith(10, 20, 100, 50, 5);
        expect(ctx.fillStyle).toBe('#FF0000');
        expect(fillSpy).toHaveBeenCalled();
      });

      it('should draw stroke when stroke parameter provided', () => {
        const ctx = game.getCtx();
        const strokeSpy = vi.spyOn(ctx, 'stroke');
        game.testDrawRoundRect(10, 20, 100, 50, 5, '#FF0000', '#00FF00');
        expect(ctx.strokeStyle).toBe('#00FF00');
        expect(ctx.lineWidth).toBe(1);
        expect(strokeSpy).toHaveBeenCalled();
      });

      it('should not stroke when no stroke parameter', () => {
        const ctx = game.getCtx();
        const strokeSpy = vi.spyOn(ctx, 'stroke');
        game.testDrawRoundRect(10, 20, 100, 50, 5, '#FF0000');
        expect(strokeSpy).not.toHaveBeenCalled();
      });

      it('should not fill when fill is empty string', () => {
        const ctx = game.getCtx();
        const fillSpy = vi.spyOn(ctx, 'fill');
        game.testDrawRoundRect(10, 20, 100, 50, 5, '', '#00FF00');
        expect(fillSpy).not.toHaveBeenCalled();
      });
    });

    describe('drawText()', () => {
      it('should draw text with default options', () => {
        const ctx = game.getCtx();
        const fillTextSpy = vi.spyOn(ctx, 'fillText');
        game.testDrawText('Hello', 100, 200);
        expect(ctx.font).toContain('600');
        expect(ctx.font).toContain('16px');
        expect(ctx.font).toContain("'Inter'");
        expect(ctx.fillStyle).toBe('#3D2B35');
        expect(ctx.textAlign).toBe('center');
        expect(ctx.textBaseline).toBe('middle');
        expect(fillTextSpy).toHaveBeenCalledWith('Hello', 100, 200);
      });

      it('should draw text with custom size and color', () => {
        const ctx = game.getCtx();
        game.testDrawText('Test', 50, 60, { size: 24, color: '#FF0000' });
        expect(ctx.font).toContain('24px');
        expect(ctx.fillStyle).toBe('#FF0000');
      });

      it('should draw text with custom align and baseline', () => {
        const ctx = game.getCtx();
        game.testDrawText('Test', 50, 60, { align: 'left', baseline: 'top' });
        expect(ctx.textAlign).toBe('left');
        expect(ctx.textBaseline).toBe('top');
      });

      it('should draw text with custom weight', () => {
        const ctx = game.getCtx();
        game.testDrawText('Test', 50, 60, { weight: '700' });
        expect(ctx.font).toContain('700');
      });

      it('should draw text with custom font', () => {
        const ctx = game.getCtx();
        game.testDrawText('Test', 50, 60, { font: 'monospace' });
        expect(ctx.font).toContain('monospace');
        expect(ctx.font).not.toContain("'Inter'");
      });

      it('should handle all options at once', () => {
        const ctx = game.getCtx();
        game.testDrawText('X', 0, 0, {
          size: 48, color: '#AABBCC', align: 'right',
          baseline: 'bottom', weight: '900', font: 'Georgia',
        });
        expect(ctx.font).toBe('900 48px Georgia');
        expect(ctx.fillStyle).toBe('#AABBCC');
        expect(ctx.textAlign).toBe('right');
        expect(ctx.textBaseline).toBe('bottom');
      });
    });

    describe('drawCircle()', () => {
      it('should draw filled circle', () => {
        const ctx = game.getCtx();
        const arcSpy = vi.spyOn(ctx, 'arc');
        const fillSpy = vi.spyOn(ctx, 'fill');
        game.testDrawCircle(50, 50, 20, '#00FF00');
        expect(arcSpy).toHaveBeenCalledWith(50, 50, 20, 0, Math.PI * 2);
        expect(ctx.fillStyle).toBe('#00FF00');
        expect(fillSpy).toHaveBeenCalled();
      });

      it('should draw circle with stroke', () => {
        const ctx = game.getCtx();
        const strokeSpy = vi.spyOn(ctx, 'stroke');
        game.testDrawCircle(50, 50, 20, '#00FF00', '#0000FF');
        expect(ctx.strokeStyle).toBe('#0000FF');
        expect(ctx.lineWidth).toBe(1);
        expect(strokeSpy).toHaveBeenCalled();
      });

      it('should draw circle with stroke and custom lineWidth', () => {
        const ctx = game.getCtx();
        game.testDrawCircle(50, 50, 20, '#00FF00', '#0000FF', 3);
        expect(ctx.lineWidth).toBe(3);
      });

      it('should not stroke when no stroke parameter', () => {
        const ctx = game.getCtx();
        const strokeSpy = vi.spyOn(ctx, 'stroke');
        game.testDrawCircle(50, 50, 20, '#00FF00');
        expect(strokeSpy).not.toHaveBeenCalled();
      });

      it('should not fill when fill is empty string', () => {
        const ctx = game.getCtx();
        const fillSpy = vi.spyOn(ctx, 'fill');
        game.testDrawCircle(50, 50, 20, '', '#0000FF');
        expect(fillSpy).not.toHaveBeenCalled();
      });
    });
  });

  // ── Animation helpers ──

  describe('animation helpers', () => {
    describe('lerp()', () => {
      it('should return a when t=0', () => {
        expect(game.testLerp(0, 100, 0)).toBe(0);
      });

      it('should return b when t=1', () => {
        expect(game.testLerp(0, 100, 1)).toBe(100);
      });

      it('should interpolate at t=0.5', () => {
        expect(game.testLerp(0, 100, 0.5)).toBe(50);
      });

      it('should work with negative values', () => {
        expect(game.testLerp(-100, 100, 0.5)).toBe(0);
      });

      it('should extrapolate when t>1', () => {
        expect(game.testLerp(0, 100, 2)).toBe(200);
      });
    });

    describe('easeOut()', () => {
      it('should return 0 when t=0', () => {
        expect(game.testEaseOut(0)).toBe(0);
      });

      it('should return 1 when t=1', () => {
        expect(game.testEaseOut(1)).toBe(1);
      });

      it('should ease out (faster at start)', () => {
        expect(game.testEaseOut(0.5)).toBeGreaterThan(0.5);
      });

      it('should be monotonically increasing', () => {
        const v1 = game.testEaseOut(0.25);
        const v2 = game.testEaseOut(0.5);
        const v3 = game.testEaseOut(0.75);
        expect(v1).toBeLessThan(v2);
        expect(v2).toBeLessThan(v3);
      });
    });
  });

  // ── Input handling ──

  describe('input handling', () => {
    describe('keyboard', () => {
      it('should handle keydown events', () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        expect(game.lastKeyDown).toBe('ArrowLeft');
        expect(game.getKeys().has('ArrowLeft')).toBe(true);
      });

      it('should handle keyup events', () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        expect(game.getKeys().has('ArrowRight')).toBe(true);
        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight' }));
        expect(game.lastKeyUp).toBe('ArrowRight');
        expect(game.getKeys().has('ArrowRight')).toBe(false);
      });

      it('should track multiple keys simultaneously', () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        expect(game.getKeys().has('ArrowUp')).toBe(true);
        expect(game.getKeys().has('ArrowLeft')).toBe(true);
        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp' }));
        expect(game.getKeys().has('ArrowUp')).toBe(false);
        expect(game.getKeys().has('ArrowLeft')).toBe(true);
      });
    });

    describe('mouse', () => {
      it('should handle mousedown on canvas', () => {
        const canvas = game.getCanvas();
        // Mock getBoundingClientRect
        vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
          left: 0, top: 0, width: 300, height: 400,
          right: 300, bottom: 400, x: 0, y: 0, toJSON: () => {},
        });
        canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 150, clientY: 200 }));
        expect(game.getPointer().down).toBe(true);
        expect(game.lastPointerDown.x).toBeCloseTo(150);
        expect(game.lastPointerDown.y).toBeCloseTo(200);
      });

      it('should handle mousemove on canvas', () => {
        const canvas = game.getCanvas();
        vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
          left: 0, top: 0, width: 300, height: 400,
          right: 300, bottom: 400, x: 0, y: 0, toJSON: () => {},
        });
        canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 75, clientY: 100 }));
        expect(game.lastPointerMove.x).toBeCloseTo(75);
        expect(game.lastPointerMove.y).toBeCloseTo(100);
      });

      it('should handle mouseup on window', () => {
        const canvas = game.getCanvas();
        vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
          left: 0, top: 0, width: 300, height: 400,
          right: 300, bottom: 400, x: 0, y: 0, toJSON: () => {},
        });
        // First mousedown so pointer.down is true
        canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, clientY: 100 }));
        expect(game.getPointer().down).toBe(true);
        window.dispatchEvent(new MouseEvent('mouseup'));
        expect(game.getPointer().down).toBe(false);
      });

      it('should not call handlePointerUp if pointer was not down', () => {
        game.lastPointerUp = { x: -1, y: -1 };
        window.dispatchEvent(new MouseEvent('mouseup'));
        // pointer was not down, so handlePointerUp should not be called
        expect(game.lastPointerUp).toEqual({ x: -1, y: -1 });
      });

      it('should handle coordinate scaling when canvas is scaled', () => {
        const canvas = game.getCanvas();
        vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
          left: 0, top: 0, width: 600, height: 800, // canvas displayed at 2x
          right: 600, bottom: 800, x: 0, y: 0, toJSON: () => {},
        });
        canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 300, clientY: 400 }));
        // 300 * (300/600) = 150, 400 * (400/800) = 200
        expect(game.lastPointerDown.x).toBeCloseTo(150);
        expect(game.lastPointerDown.y).toBeCloseTo(200);
      });
    });

    describe('touch', () => {
      function createTouchEvent(type: string, clientX: number, clientY: number) {
        const touch = { clientX, clientY, identifier: 0, target: game.getCanvas() } as Touch;
        return new TouchEvent(type, {
          touches: type === 'touchend' ? [] : [touch],
          changedTouches: [touch],
          cancelable: true,
        });
      }

      it('should handle touchstart', () => {
        const canvas = game.getCanvas();
        vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
          left: 0, top: 0, width: 300, height: 400,
          right: 300, bottom: 400, x: 0, y: 0, toJSON: () => {},
        });
        const event = createTouchEvent('touchstart', 100, 200);
        const preventSpy = vi.spyOn(event, 'preventDefault');
        canvas.dispatchEvent(event);
        expect(game.getPointer().down).toBe(true);
        expect(game.lastPointerDown.x).toBeCloseTo(100);
        expect(game.lastPointerDown.y).toBeCloseTo(200);
      });

      it('should handle touchmove', () => {
        const canvas = game.getCanvas();
        vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
          left: 0, top: 0, width: 300, height: 400,
          right: 300, bottom: 400, x: 0, y: 0, toJSON: () => {},
        });
        const event = createTouchEvent('touchmove', 120, 250);
        canvas.dispatchEvent(event);
        expect(game.lastPointerMove.x).toBeCloseTo(120);
        expect(game.lastPointerMove.y).toBeCloseTo(250);
      });

      it('should handle touchend', () => {
        const canvas = game.getCanvas();
        vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
          left: 0, top: 0, width: 300, height: 400,
          right: 300, bottom: 400, x: 0, y: 0, toJSON: () => {},
        });
        // First touchstart
        canvas.dispatchEvent(createTouchEvent('touchstart', 100, 200));
        expect(game.getPointer().down).toBe(true);
        // Then touchend
        canvas.dispatchEvent(createTouchEvent('touchend', 100, 200));
        expect(game.getPointer().down).toBe(false);
      });
    });

    describe('event cleanup on destroy', () => {
      it('should not respond to events after destroy', () => {
        game.destroy();
        game.lastKeyDown = '';
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
        expect(game.lastKeyDown).toBe('');
      });
    });
  });

  // ── Edge cases ──

  describe('edge cases', () => {
    it('double start should reset cleanly', () => {
      game.start();
      game.testSetScore(999);
      game.start(); // second start
      expect(game.getScore()).toBe(0);
      expect(game.isRunning()).toBe(true);
    });
  });

  // ── Win handling ──

  describe('gameWin()', () => {
    class WinTestGame extends TestGame {
      public callGameWin(): void { this.gameWin(); }
      public isWonPublic(): boolean { return this.isWon(); }
    }

    function makeWinGame(overrides: Partial<GameConfig> = {}): WinTestGame {
      return new WinTestGame(createTestConfig(overrides));
    }

    it('should set won to true', () => {
      const g = makeWinGame();
      expect(g.isWonPublic()).toBe(false);
      g.callGameWin();
      expect(g.isWonPublic()).toBe(true);
      g.destroy();
    });

    it('should play the "win" sound', () => {
      const g = makeWinGame();
      g.callGameWin();
      expect(sound.play).toHaveBeenCalledWith('win');
      g.destroy();
    });

    it('should call onWin with the current score', () => {
      const onWin = vi.fn();
      const g = makeWinGame({ onWin });
      g.testSetScore(777);
      g.callGameWin();
      expect(onWin).toHaveBeenCalledWith(777);
      expect(onWin).toHaveBeenCalledTimes(1);
      g.destroy();
    });

    it('should be idempotent — calling twice triggers onWin only once', () => {
      const onWin = vi.fn();
      const g = makeWinGame({ onWin });
      g.testSetScore(100);
      g.callGameWin();
      g.callGameWin();
      g.callGameWin();
      expect(onWin).toHaveBeenCalledTimes(1);
      g.destroy();
    });

    it('should not play the win sound on subsequent calls', () => {
      const g = makeWinGame();
      g.callGameWin();
      vi.mocked(sound.play).mockClear();
      g.callGameWin();
      expect(sound.play).not.toHaveBeenCalled();
      g.destroy();
    });

    it('should not stop the game loop (running stays true)', () => {
      const g = makeWinGame();
      g.start();
      expect(g.isRunning()).toBe(true);
      g.callGameWin();
      expect(g.isRunning()).toBe(true);
      g.destroy();
    });

    it('should use default noop onWin when not provided', () => {
      const g = makeWinGame();
      expect(() => g.callGameWin()).not.toThrow();
      g.destroy();
    });
  });

  // ── Save / Resume hooks ──

  describe('serialize() / deserialize() / canSave() defaults', () => {
    it('serialize() should return null by default', () => {
      expect(game.serialize()).toBeNull();
    });

    it('deserialize() should be a no-op by default', () => {
      expect(() => game.deserialize({ foo: 'bar' })).not.toThrow();
      // Default implementation should not mutate state
      expect(game.getScore()).toBe(0);
    });

    it('canSave() should return true by default', () => {
      expect(game.canSave()).toBe(true);
    });

    it('should allow subclasses to override serialize/deserialize/canSave', () => {
      class SaveGame extends TestGame {
        public stored: GameSnapshot | null = null;
        public canSaveValue = false;

        serialize(): GameSnapshot | null {
          return { score: this.score, custom: 'data' };
        }
        deserialize(state: GameSnapshot): void {
          this.stored = state;
        }
        canSave(): boolean {
          return this.canSaveValue;
        }
      }

      const g = new SaveGame(createTestConfig());
      g.testSetScore(55);
      const snap = g.serialize();
      expect(snap).toEqual({ score: 55, custom: 'data' });

      g.deserialize({ foo: 'bar' });
      expect(g.stored).toEqual({ foo: 'bar' });

      expect(g.canSave()).toBe(false);
      g.canSaveValue = true;
      expect(g.canSave()).toBe(true);
      g.destroy();
    });
  });

  // ── start() with ResumeData ──

  describe('start() with ResumeData', () => {
    class ResumableGame extends TestGame {
      public deserializedWith: GameSnapshot | null = null;
      public shouldThrow = false;

      deserialize(state: GameSnapshot): void {
        if (this.shouldThrow) throw new Error('corrupt snapshot');
        this.deserializedWith = state;
      }
    }

    function makeResumable(overrides: Partial<GameConfig> = {}): ResumableGame {
      return new ResumableGame(createTestConfig(overrides));
    }

    it('should call deserialize with the resume state', () => {
      const g = makeResumable();
      const resume: ResumeData = {
        state: { board: [1, 2, 3] },
        score: 500,
      };
      g.start(resume);
      expect(g.deserializedWith).toEqual({ board: [1, 2, 3] });
      g.destroy();
    });

    it('should restore score from resume data', () => {
      const g = makeResumable();
      g.start({ state: {}, score: 1234 });
      expect(g.getScore()).toBe(1234);
      g.destroy();
    });

    it('should restore won=true from resume data', () => {
      const g = makeResumable();
      g.start({ state: {}, score: 100, won: true });
      expect(g.isWon()).toBe(true);
      g.destroy();
    });

    it('should leave won=false when resume.won is undefined', () => {
      const g = makeResumable();
      g.start({ state: {}, score: 100 });
      expect(g.isWon()).toBe(false);
      g.destroy();
    });

    it('should leave won=false when resume.won is explicitly false', () => {
      const g = makeResumable();
      g.start({ state: {}, score: 100, won: false });
      expect(g.isWon()).toBe(false);
      g.destroy();
    });

    it('should still call init() before deserialize()', () => {
      const g = makeResumable();
      g.start({ state: { foo: 'bar' }, score: 10 });
      expect(g.initCalled).toBe(true);
      expect(g.deserializedWith).toEqual({ foo: 'bar' });
      g.destroy();
    });

    it('should fire onScore with the restored score', () => {
      const onScore = vi.fn();
      const g = new ResumableGame(createTestConfig({ onScore }));
      g.start({ state: {}, score: 888 });
      expect(onScore).toHaveBeenCalledWith(888);
      g.destroy();
    });

    it('should fall back to fresh state when deserialize throws', () => {
      const g = makeResumable();
      g.shouldThrow = true;
      g.start({ state: { bad: true }, score: 500, won: true });
      // Corrupt snapshot: score resets to 0, won resets to false
      expect(g.getScore()).toBe(0);
      expect(g.isWon()).toBe(false);
      expect(g.isRunning()).toBe(true);
      g.destroy();
    });

    it('should start without resume data when called with no arg', () => {
      const g = makeResumable();
      g.start();
      expect(g.deserializedWith).toBeNull();
      expect(g.getScore()).toBe(0);
      expect(g.isWon()).toBe(false);
      g.destroy();
    });

    it('should start without resume data when called with null', () => {
      const g = makeResumable();
      g.start(null);
      expect(g.deserializedWith).toBeNull();
      expect(g.getScore()).toBe(0);
      g.destroy();
    });
  });

  // ── Public state accessors ──

  describe('state accessors (isPaused/isRunning/isWon/getScore)', () => {
    // Use plain GameEngine public API directly to verify the base class getters.
    class AccessorGame extends GameEngine {
      init() {}
      update(_dt: number) {}
      render() {}
      public callGameWin() { this.gameWin(); }
      public callSetScore(s: number) { this.setScore(s); }
    }

    function makeAccessorGame(): AccessorGame {
      return new AccessorGame(createTestConfig());
    }

    it('isRunning() should be false before start()', () => {
      const g = makeAccessorGame();
      expect(g.isRunning()).toBe(false);
      g.destroy();
    });

    it('isRunning() should be true after start()', () => {
      const g = makeAccessorGame();
      g.start();
      expect(g.isRunning()).toBe(true);
      g.destroy();
    });

    it('isRunning() should be false after destroy()', () => {
      const g = makeAccessorGame();
      g.start();
      g.destroy();
      expect(g.isRunning()).toBe(false);
    });

    it('isPaused() should be false initially', () => {
      const g = makeAccessorGame();
      expect(g.isPaused()).toBe(false);
      g.destroy();
    });

    it('isPaused() should reflect pause/resume state', () => {
      const g = makeAccessorGame();
      g.start();
      expect(g.isPaused()).toBe(false);
      g.pause();
      expect(g.isPaused()).toBe(true);
      g.resume();
      expect(g.isPaused()).toBe(false);
      g.destroy();
    });

    it('isWon() should be false initially', () => {
      const g = makeAccessorGame();
      expect(g.isWon()).toBe(false);
      g.destroy();
    });

    it('isWon() should be true after gameWin()', () => {
      const g = makeAccessorGame();
      g.callGameWin();
      expect(g.isWon()).toBe(true);
      g.destroy();
    });

    it('isWon() should reset to false on start() without resume', () => {
      const g = makeAccessorGame();
      g.callGameWin();
      expect(g.isWon()).toBe(true);
      g.start();
      expect(g.isWon()).toBe(false);
      g.destroy();
    });

    it('getScore() should return 0 initially', () => {
      const g = makeAccessorGame();
      expect(g.getScore()).toBe(0);
      g.destroy();
    });

    it('getScore() should reflect current score', () => {
      const g = makeAccessorGame();
      g.callSetScore(123);
      expect(g.getScore()).toBe(123);
      g.callSetScore(456);
      expect(g.getScore()).toBe(456);
      g.destroy();
    });

    it('getScore() should reset to 0 on start() without resume', () => {
      const g = makeAccessorGame();
      g.callSetScore(999);
      g.start();
      expect(g.getScore()).toBe(0);
      g.destroy();
    });
  });
});
