import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { burst, pickWinMessage, WIN_MESSAGES } from '../../src/utils/confetti';

describe('pickWinMessage', () => {
  it('returns one of the WIN_MESSAGES', () => {
    for (let i = 0; i < 50; i++) {
      expect(WIN_MESSAGES).toContain(pickWinMessage());
    }
  });

  it('cycles deterministically when given an index', () => {
    expect(pickWinMessage(0)).toBe(WIN_MESSAGES[0]);
    expect(pickWinMessage(1)).toBe(WIN_MESSAGES[1]);
    expect(pickWinMessage(WIN_MESSAGES.length)).toBe(WIN_MESSAGES[0]); // wraps
    expect(pickWinMessage(WIN_MESSAGES.length + 3)).toBe(WIN_MESSAGES[3]);
  });

  it('has a pool of at least 10 messages', () => {
    expect(WIN_MESSAGES.length).toBeGreaterThanOrEqual(10);
  });

  it('has no duplicate messages', () => {
    const seen = new Set(WIN_MESSAGES);
    expect(seen.size).toBe(WIN_MESSAGES.length);
  });
});

describe('confetti burst', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => ({ width: 360, height: 640, left: 0, top: 0, right: 360, bottom: 640, x: 0, y: 0, toJSON: () => ({}) }),
      configurable: true,
    });
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('returns a stop function', () => {
    const stop = burst(container);
    expect(typeof stop).toBe('function');
    stop();
  });

  it('appends a canvas element to the container', () => {
    const stop = burst(container, { particles: 10 });
    const canvas = container.querySelector('.confetti-canvas');
    expect(canvas).toBeTruthy();
    expect(canvas?.tagName).toBe('CANVAS');
    stop();
  });

  it('stop() removes the canvas from the container', () => {
    const stop = burst(container, { particles: 10 });
    expect(container.querySelector('.confetti-canvas')).toBeTruthy();
    stop();
    expect(container.querySelector('.confetti-canvas')).toBeFalsy();
  });

  it('stop() is idempotent (calling twice is safe)', () => {
    const stop = burst(container, { particles: 5 });
    stop();
    expect(() => stop()).not.toThrow();
  });

  it('respects prefers-reduced-motion by becoming a no-op', () => {
    const originalMatchMedia = window.matchMedia;
    (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList);

    try {
      const stop = burst(container, { particles: 10 });
      expect(container.querySelector('.confetti-canvas')).toBeFalsy();
      stop();
    } finally {
      (window as unknown as { matchMedia: typeof originalMatchMedia }).matchMedia = originalMatchMedia;
    }
  });

  it('accepts custom particle count, colors, duration, and power options', () => {
    // Options are forwarded to internal arrays — we just verify it doesn't throw
    // and produces a stop function as usual.
    const stop = burst(container, {
      particles: 20,
      colors: ['#ff0000', '#00ff00'],
      duration: 1000,
      power: 1.5,
    });
    expect(container.querySelector('.confetti-canvas')).toBeTruthy();
    stop();
  });
});
