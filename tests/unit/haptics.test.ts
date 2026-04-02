import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock idb-keyval for initHaptics
const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(store.get(key))),
  set: vi.fn((key: string, value: unknown) => { store.set(key, value); return Promise.resolve(); }),
  keys: vi.fn(() => Promise.resolve(Array.from(store.keys()))),
}));

import {
  initHaptics,
  setHapticsEnabled,
  hapticLight,
  hapticMedium,
  hapticHeavy,
  hapticError,
} from '../../src/utils/haptics';

describe('Haptics', () => {
  let vibrateSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    store.clear();
    // Enable haptics before each test
    setHapticsEnabled(true);
    // Mock navigator.vibrate
    vibrateSpy = vi.fn();
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrateSpy,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('hapticLight()', () => {
    it('should call navigator.vibrate with 10ms', () => {
      hapticLight();
      expect(vibrateSpy).toHaveBeenCalledWith(10);
    });

    it('should not vibrate when disabled', () => {
      setHapticsEnabled(false);
      hapticLight();
      expect(vibrateSpy).not.toHaveBeenCalled();
    });
  });

  describe('hapticMedium()', () => {
    it('should call navigator.vibrate with 25ms', () => {
      hapticMedium();
      expect(vibrateSpy).toHaveBeenCalledWith(25);
    });

    it('should not vibrate when disabled', () => {
      setHapticsEnabled(false);
      hapticMedium();
      expect(vibrateSpy).not.toHaveBeenCalled();
    });
  });

  describe('hapticHeavy()', () => {
    it('should call navigator.vibrate with pattern [30, 20, 40]', () => {
      hapticHeavy();
      expect(vibrateSpy).toHaveBeenCalledWith([30, 20, 40]);
    });

    it('should not vibrate when disabled', () => {
      setHapticsEnabled(false);
      hapticHeavy();
      expect(vibrateSpy).not.toHaveBeenCalled();
    });
  });

  describe('hapticError()', () => {
    it('should call navigator.vibrate with pattern [50, 30, 50]', () => {
      hapticError();
      expect(vibrateSpy).toHaveBeenCalledWith([50, 30, 50]);
    });

    it('should not vibrate when disabled', () => {
      setHapticsEnabled(false);
      hapticError();
      expect(vibrateSpy).not.toHaveBeenCalled();
    });
  });

  describe('when navigator.vibrate is not in navigator (property absent)', () => {
    beforeEach(() => {
      // Delete the vibrate property entirely so 'vibrate' in navigator === false
      delete (navigator as any).vibrate;
    });

    it('hapticLight should not throw and not vibrate', () => {
      expect(() => hapticLight()).not.toThrow();
    });

    it('hapticMedium should not throw and not vibrate', () => {
      expect(() => hapticMedium()).not.toThrow();
    });

    it('hapticHeavy should not throw and not vibrate', () => {
      expect(() => hapticHeavy()).not.toThrow();
    });

    it('hapticError should not throw and not vibrate', () => {
      expect(() => hapticError()).not.toThrow();
    });
  });

  describe('when navigator.vibrate throws', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'vibrate', {
        value: () => { throw new Error('vibrate error'); },
        writable: true,
        configurable: true,
      });
    });

    it('hapticLight should not throw', () => {
      expect(() => hapticLight()).not.toThrow();
    });

    it('hapticMedium should not throw', () => {
      expect(() => hapticMedium()).not.toThrow();
    });

    it('hapticHeavy should not throw', () => {
      expect(() => hapticHeavy()).not.toThrow();
    });

    it('hapticError should not throw', () => {
      expect(() => hapticError()).not.toThrow();
    });
  });

  describe('setHapticsEnabled()', () => {
    it('should enable haptics', () => {
      setHapticsEnabled(false);
      hapticLight();
      expect(vibrateSpy).not.toHaveBeenCalled();
      setHapticsEnabled(true);
      hapticLight();
      expect(vibrateSpy).toHaveBeenCalled();
    });

    it('should disable haptics', () => {
      setHapticsEnabled(true);
      hapticLight();
      expect(vibrateSpy).toHaveBeenCalledTimes(1);
      setHapticsEnabled(false);
      hapticLight();
      expect(vibrateSpy).toHaveBeenCalledTimes(1); // not called again
    });
  });

  describe('initHaptics()', () => {
    it('should read vibrationEnabled from stored settings', async () => {
      store.set('app_settings', {
        soundEnabled: true,
        musicEnabled: true,
        vibrationEnabled: false,
        volume: 80,
        maxFps: 60,
        theme: 'light',
      });
      await initHaptics();
      hapticLight();
      expect(vibrateSpy).not.toHaveBeenCalled();
    });

    it('should default to enabled when no settings stored', async () => {
      await initHaptics();
      hapticLight();
      expect(vibrateSpy).toHaveBeenCalled();
    });

    it('should enable haptics when settings say vibration is enabled', async () => {
      store.set('app_settings', {
        soundEnabled: true,
        musicEnabled: true,
        vibrationEnabled: true,
        volume: 80,
        maxFps: 60,
        theme: 'light',
      });
      await initHaptics();
      hapticLight();
      expect(vibrateSpy).toHaveBeenCalled();
    });
  });
});
