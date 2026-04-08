import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InputManager, InputConfig, InputEvents } from '../../src/engine/input';

/**
 * Helper: make a canvas with a known bounding rect so logical-coordinate
 * conversion is predictable across tests.
 */
function makeCanvas(width = 200, height = 200): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  Object.defineProperty(canvas, 'getBoundingClientRect', {
    value: () => ({
      left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0,
      toJSON: () => ({}),
    }),
    configurable: true,
  });
  document.body.appendChild(canvas);
  return canvas;
}

describe('InputManager', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = makeCanvas(200, 200);
  });

  afterEach(() => {
    canvas.remove();
  });

  // ── lifecycle ──

  it('attaches and cleanly detaches listeners', () => {
    const mgr = new InputManager(canvas, 200, 200, {});
    expect(() => mgr.destroy()).not.toThrow();
    // Second destroy is a no-op
    expect(() => mgr.destroy()).not.toThrow();
  });

  // ── pointer down / move / up ──

  it('dispatches pointerDown with logical coordinates for mouse', () => {
    const onPointerDown = vi.fn();
    const mgr = new InputManager(canvas, 200, 200, { onPointerDown });
    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 50, clientY: 80, bubbles: true }));
    expect(onPointerDown).toHaveBeenCalledWith(50, 80);
    mgr.destroy();
  });

  it('scales raw coords to logical dimensions when canvas is displayed at a different size', () => {
    // Canvas logically 200x200 but displayed at 100x100 (downscaled rect)
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => ({}) }),
      configurable: true,
    });
    const onPointerDown = vi.fn();
    const mgr = new InputManager(canvas, 200, 200, { onPointerDown });
    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 50, clientY: 25, bubbles: true }));
    // Displayed click at (50, 25) → logical (100, 50)
    expect(onPointerDown).toHaveBeenCalledWith(100, 50);
    mgr.destroy();
  });

  it('tracks pointer.down state across press/release', () => {
    const mgr = new InputManager(canvas, 200, 200, {});
    expect(mgr.pointer.down).toBe(false);
    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 10, clientY: 10, bubbles: true }));
    expect(mgr.pointer.down).toBe(true);
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 10, clientY: 10 }));
    expect(mgr.pointer.down).toBe(false);
    mgr.destroy();
  });

  it('dispatches pointerMove only while pressed by default', () => {
    const onPointerMove = vi.fn();
    const onHover = vi.fn();
    const mgr = new InputManager(canvas, 200, 200, { onPointerMove, onHover });
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 20, clientY: 20, bubbles: true }));
    expect(onPointerMove).not.toHaveBeenCalled();
    expect(onHover).not.toHaveBeenCalled(); // trackHover default false
    mgr.destroy();
  });

  it('dispatches onHover when trackHover is enabled', () => {
    const onHover = vi.fn();
    const mgr = new InputManager(canvas, 200, 200, { onHover, trackHover: true });
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 30, clientY: 40, bubbles: true }));
    expect(onHover).toHaveBeenCalledWith(30, 40);
    mgr.destroy();
  });

  // ── tap vs swipe classification ──

  it('classifies a quick press-release within distance threshold as a tap', () => {
    const onTap = vi.fn();
    const onSwipe = vi.fn();
    const mgr = new InputManager(canvas, 200, 200, { onTap, onSwipe });
    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 50, clientY: 50, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 52, clientY: 51 }));
    expect(onTap).toHaveBeenCalledWith(52, 51);
    expect(onSwipe).not.toHaveBeenCalled();
    mgr.destroy();
  });

  it('classifies a drag exceeding the distance threshold as a swipe', () => {
    const onTap = vi.fn();
    const onSwipe = vi.fn();
    const mgr = new InputManager(canvas, 200, 200, { onTap, onSwipe, swipeMinDistance: 20 });
    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 50, clientY: 50, bubbles: true }));
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 55, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 100, clientY: 55 }));
    expect(onTap).not.toHaveBeenCalled();
    expect(onSwipe).toHaveBeenCalled();
    const [dir] = onSwipe.mock.calls[0];
    expect(dir).toBe('right');
    mgr.destroy();
  });

  it('classifies swipe direction by dominant axis', () => {
    const onSwipe = vi.fn();
    const mgr = new InputManager(canvas, 200, 200, { onSwipe, swipeMinDistance: 20 });
    const cases: Array<{ dx: number; dy: number; dir: string }> = [
      { dx: 50, dy: 5, dir: 'right' },
      { dx: -50, dy: -5, dir: 'left' },
      { dx: 5, dy: 50, dir: 'down' },
      { dx: -5, dy: -50, dir: 'up' },
    ];
    for (const { dx, dy, dir } of cases) {
      onSwipe.mockClear();
      canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, clientY: 100, bubbles: true }));
      canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 100 + dx, clientY: 100 + dy, bubbles: true }));
      window.dispatchEvent(new MouseEvent('mouseup', { clientX: 100 + dx, clientY: 100 + dy }));
      expect(onSwipe.mock.calls[0][0]).toBe(dir);
    }
    mgr.destroy();
  });

  it('reports swipe velocity in px/ms', () => {
    const onSwipe = vi.fn();
    const mgr = new InputManager(canvas, 200, 200, { onSwipe, swipeMinDistance: 20 });
    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 0, clientY: 0, bubbles: true }));
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 0, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 100, clientY: 0 }));
    const [, velocity] = onSwipe.mock.calls[0];
    expect(velocity).toBeGreaterThan(0);
    mgr.destroy();
  });

  // ── long-press ──

  it('fires onLongPress after the configured delay on a still press', async () => {
    const onLongPress = vi.fn();
    const mgr = new InputManager(canvas, 200, 200, { onLongPress, longPressMs: 50 });
    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 50, clientY: 50, bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));
    expect(onLongPress).toHaveBeenCalledWith(50, 50);
    // Cleanup — release so subsequent state is clean
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 50, clientY: 50 }));
    mgr.destroy();
  });

  it('cancels long-press if pointer drifts beyond threshold', async () => {
    const onLongPress = vi.fn();
    const mgr = new InputManager(canvas, 200, 200, {
      onLongPress,
      longPressMs: 50,
      longPressMaxDrift: 5,
    });
    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 50, clientY: 50, bubbles: true }));
    // Drift 20 pixels
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 70, clientY: 50, bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));
    expect(onLongPress).not.toHaveBeenCalled();
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 70, clientY: 50 }));
    mgr.destroy();
  });

  it('cancels long-press if pointer is released before the delay', async () => {
    const onLongPress = vi.fn();
    const mgr = new InputManager(canvas, 200, 200, { onLongPress, longPressMs: 100 });
    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 50, clientY: 50, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 50, clientY: 50 }));
    await new Promise((r) => setTimeout(r, 150));
    expect(onLongPress).not.toHaveBeenCalled();
    mgr.destroy();
  });

  it('long-press suppresses the subsequent tap classification', async () => {
    const onLongPress = vi.fn();
    const onTap = vi.fn();
    const mgr = new InputManager(canvas, 200, 200, { onLongPress, onTap, longPressMs: 50 });
    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 50, clientY: 50, bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 50, clientY: 50 }));
    expect(onLongPress).toHaveBeenCalled();
    expect(onTap).not.toHaveBeenCalled();
    mgr.destroy();
  });

  // ── right-click / alt action ──

  it('fires onAltAction on contextmenu and suppresses the default', () => {
    const onAltAction = vi.fn();
    const mgr = new InputManager(canvas, 200, 200, { onAltAction });
    const evt = new MouseEvent('contextmenu', { clientX: 40, clientY: 60, bubbles: true, cancelable: true });
    canvas.dispatchEvent(evt);
    expect(onAltAction).toHaveBeenCalledWith(40, 60);
    expect(evt.defaultPrevented).toBe(true);
    mgr.destroy();
  });

  it('does not suppress context menu when suppressContextMenu=false', () => {
    const mgr = new InputManager(canvas, 200, 200, { suppressContextMenu: false });
    const evt = new MouseEvent('contextmenu', { clientX: 10, clientY: 10, bubbles: true, cancelable: true });
    canvas.dispatchEvent(evt);
    expect(evt.defaultPrevented).toBe(false);
    mgr.destroy();
  });

  // ── wheel ──

  it('does NOT dispatch wheel events by default', () => {
    const onWheel = vi.fn();
    const mgr = new InputManager(canvas, 200, 200, { onWheel });
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaX: 0, deltaY: 100, bubbles: true, cancelable: true }));
    expect(onWheel).not.toHaveBeenCalled();
    mgr.destroy();
  });

  it('dispatches wheel events when trackWheel=true', () => {
    const onWheel = vi.fn();
    const mgr = new InputManager(canvas, 200, 200, { onWheel, trackWheel: true });
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaX: 5, deltaY: 100, bubbles: true, cancelable: true }));
    expect(onWheel).toHaveBeenCalledWith(5, 100);
    mgr.destroy();
  });

  it('normalizes wheel deltaMode=1 (line) to pixels', () => {
    const onWheel = vi.fn();
    const mgr = new InputManager(canvas, 200, 200, { onWheel, trackWheel: true });
    // Simulate a line-based wheel event (Firefox default)
    const evt = new WheelEvent('wheel', { deltaY: 3, deltaMode: 1, bubbles: true, cancelable: true });
    canvas.dispatchEvent(evt);
    // 3 lines × 16 px/line = 48
    expect(onWheel).toHaveBeenCalledWith(0, 48);
    mgr.destroy();
  });

  // ── touch ──

  it('dispatches pointerDown for touch events', () => {
    const onPointerDown = vi.fn();
    const mgr = new InputManager(canvas, 200, 200, { onPointerDown });
    const touch = { clientX: 42, clientY: 77 } as Touch;
    const evt = new TouchEvent('touchstart', {
      touches: [touch],
      changedTouches: [touch],
      bubbles: true,
      cancelable: true,
    });
    canvas.dispatchEvent(evt);
    expect(onPointerDown).toHaveBeenCalledWith(42, 77);
    mgr.destroy();
  });

  // ── keyboard ──

  it('dispatches onKeyDown with the key name', () => {
    const onKeyDown = vi.fn();
    const mgr = new InputManager(canvas, 200, 200, { onKeyDown });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(onKeyDown).toHaveBeenCalled();
    expect(onKeyDown.mock.calls[0][0]).toBe('ArrowLeft');
    mgr.destroy();
  });

  it('tracks currently-held keys in the keys set', () => {
    const mgr = new InputManager(canvas, 200, 200, {});
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Space' }));
    expect(mgr.keys.has('Space')).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Space' }));
    expect(mgr.keys.has('Space')).toBe(false);
    mgr.destroy();
  });

  // ── setEvents and setSize ──

  it('setEvents swaps the active handler set without re-attaching listeners', () => {
    const firstTap = vi.fn();
    const secondTap = vi.fn();
    const mgr = new InputManager(canvas, 200, 200, { onTap: firstTap });
    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 50, clientY: 50, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 50, clientY: 50 }));
    expect(firstTap).toHaveBeenCalledTimes(1);

    mgr.setEvents({ onTap: secondTap });
    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 60, clientY: 60, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 60, clientY: 60 }));
    expect(firstTap).toHaveBeenCalledTimes(1);
    expect(secondTap).toHaveBeenCalledTimes(1);
    mgr.destroy();
  });

  it('setSize updates logical coordinate scaling for subsequent events', () => {
    const onPointerDown = vi.fn();
    const mgr = new InputManager(canvas, 200, 200, { onPointerDown });
    mgr.setSize(400, 400);
    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 50, clientY: 50, bubbles: true }));
    // Canvas is 200x200 rect, but logical is now 400x400 — click at (50, 50) → (100, 100)
    expect(onPointerDown).toHaveBeenCalledWith(100, 100);
    mgr.destroy();
  });
});
