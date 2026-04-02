import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameEngine, GameConfig } from '../../src/engine/GameEngine';

class TestGame extends GameEngine {
  public initCalled = false;
  public updateCalls: number[] = [];
  public renderCalled = false;
  public lastKeyDown = '';
  public lastPointerDown = { x: 0, y: 0 };

  init() { this.initCalled = true; }
  update(dt: number) { this.updateCalls.push(dt); }
  render() { this.renderCalled = true; }
  protected handleKeyDown(key: string) { this.lastKeyDown = key; }
  protected handlePointerDown(x: number, y: number) { this.lastPointerDown = { x, y }; }

  public testSetScore(s: number) { this.setScore(s); }
  public testAddScore(p: number) { this.addScore(p); }
  public testGameOver() { this.gameOver(); }
  public testClear(c?: string) { this.clear(c); }
  public testDrawRoundRect(x: number, y: number, w: number, h: number, r: number, fill: string) {
    this.drawRoundRect(x, y, w, h, r, fill);
  }
  public testDrawText(text: string, x: number, y: number) { this.drawText(text, x, y); }
  public testDrawCircle(x: number, y: number, r: number, fill: string) { this.drawCircle(x, y, r, fill); }
  public testLerp(a: number, b: number, t: number) { return this.lerp(a, b, t); }
  public testEaseOut(t: number) { return this.easeOut(t); }
  public getScore() { return this.score; }
  public getDifficulty() { return this.difficulty; }
  public isRunning() { return this.running; }
  public isPaused() { return this.paused; }
  public getCtx() { return this.ctx; }
}

function createTestConfig(overrides: Partial<GameConfig> = {}): GameConfig {
  return { canvas: document.createElement('canvas'), width: 300, height: 400, ...overrides };
}

describe('GameEngine', () => {
  let game: TestGame;

  beforeEach(() => { game = new TestGame(createTestConfig()); });

  describe('initialization', () => {
    it('should set canvas dimensions with device pixel ratio', () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      expect(game.getCtx().canvas.width).toBe(300 * dpr);
    });

    it('should default difficulty to 0', () => {
      expect(game.getDifficulty()).toBe(0);
    });

    it('should accept difficulty parameter', () => {
      const g = new TestGame(createTestConfig({ difficulty: 2 }));
      expect(g.getDifficulty()).toBe(2);
      g.destroy();
    });
  });

  describe('start()', () => {
    it('should call init and set running state', () => {
      game.start();
      expect(game.initCalled).toBe(true);
      expect(game.isRunning()).toBe(true);
      game.destroy();
    });

    it('should reset score to 0', () => {
      game.testSetScore(500);
      game.start();
      expect(game.getScore()).toBe(0);
      game.destroy();
    });
  });

  describe('pause/resume', () => {
    it('should pause and resume', () => {
      game.start();
      game.pause();
      expect(game.isPaused()).toBe(true);
      game.resume();
      expect(game.isPaused()).toBe(false);
      game.destroy();
    });
  });

  describe('score management', () => {
    it('setScore should notify', () => {
      const onScore = vi.fn();
      const g = new TestGame(createTestConfig({ onScore }));
      g.testSetScore(100);
      expect(g.getScore()).toBe(100);
      expect(onScore).toHaveBeenCalledWith(100);
      g.destroy();
    });

    it('addScore should increment', () => {
      const onScore = vi.fn();
      const g = new TestGame(createTestConfig({ onScore }));
      g.testSetScore(50);
      g.testAddScore(30);
      expect(g.getScore()).toBe(80);
      g.destroy();
    });
  });

  describe('gameOver()', () => {
    it('should stop and call onGameOver', () => {
      const onGameOver = vi.fn();
      const g = new TestGame(createTestConfig({ onGameOver }));
      g.start();
      g.testSetScore(250);
      g.testGameOver();
      expect(g.isRunning()).toBe(false);
      expect(onGameOver).toHaveBeenCalledWith(250);
      g.destroy();
    });
  });

  describe('drawing helpers', () => {
    it('clear() should fill the canvas', () => {
      const spy = vi.spyOn(game.getCtx(), 'fillRect');
      game.testClear('#FEF0E4');
      expect(spy).toHaveBeenCalledWith(0, 0, 300, 400);
    });

    it('drawText() should draw text', () => {
      const spy = vi.spyOn(game.getCtx(), 'fillText');
      game.testDrawText('Hello', 100, 200);
      expect(spy).toHaveBeenCalledWith('Hello', 100, 200);
    });

    it('drawCircle() should draw an arc', () => {
      const spy = vi.spyOn(game.getCtx(), 'arc');
      game.testDrawCircle(50, 50, 20, '#00FF00');
      expect(spy).toHaveBeenCalledWith(50, 50, 20, 0, Math.PI * 2);
    });
  });

  describe('animation helpers', () => {
    it('lerp should interpolate correctly', () => {
      expect(game.testLerp(0, 100, 0)).toBe(0);
      expect(game.testLerp(0, 100, 1)).toBe(100);
      expect(game.testLerp(0, 100, 0.5)).toBe(50);
    });

    it('easeOut should ease correctly', () => {
      expect(game.testEaseOut(0)).toBe(0);
      expect(game.testEaseOut(1)).toBe(1);
      expect(game.testEaseOut(0.5)).toBeGreaterThan(0.5); // ease out is faster at start
    });
  });

  describe('input handling', () => {
    it('should handle keydown events', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      expect(game.lastKeyDown).toBe('ArrowLeft');
      game.destroy();
    });
  });
});
