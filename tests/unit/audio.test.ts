import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock idb-keyval for the getSettings call in initSound
const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(store.get(key))),
  set: vi.fn((key: string, value: unknown) => { store.set(key, value); return Promise.resolve(); }),
  del: vi.fn((key: string) => { store.delete(key); return Promise.resolve(); }),
  keys: vi.fn(() => Promise.resolve(Array.from(store.keys()))),
}));

// Track created mock objects per test
let createdOscillators: any[] = [];
let createdGainNodes: any[] = [];
let createdBufferSources: any[] = [];
let createdFilters: any[] = [];

function createMockOscillator() {
  const osc = {
    type: 'sine' as string,
    frequency: {
      value: 440,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  createdOscillators.push(osc);
  return osc;
}

function createMockGainNode() {
  const gain = {
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  };
  createdGainNodes.push(gain);
  return gain;
}

function createMockBufferSource() {
  const src = {
    buffer: null as any,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  createdBufferSources.push(src);
  return src;
}

function createMockBiquadFilter() {
  const filter = {
    type: 'lowpass' as string,
    frequency: {
      value: 350,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    Q: { value: 1 },
    connect: vi.fn(),
  };
  createdFilters.push(filter);
  return filter;
}

// The mock AudioContext needs to be a proper class/constructor for `new AudioContext()` to work
const mockResume = vi.fn();
const mockCreateOscillator = vi.fn(() => createMockOscillator());
const mockCreateGain = vi.fn(() => createMockGainNode());
const mockCreateBufferSource = vi.fn(() => createMockBufferSource());
const mockCreateBuffer = vi.fn((_c: number, len: number, _sr: number) => ({
  getChannelData: () => new Float32Array(len),
}));
const mockCreateBiquadFilter = vi.fn(() => createMockBiquadFilter());

// Shared mutable state so tests can control the AudioContext state
const sharedState = { value: 'running' };

class MockAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  get state() { return sharedState.value; }
  set state(v: string) { sharedState.value = v; }
  destination = {};
  resume = mockResume;
  createOscillator = mockCreateOscillator;
  createGain = mockCreateGain;
  createBufferSource = mockCreateBufferSource;
  createBuffer = mockCreateBuffer;
  createBiquadFilter = mockCreateBiquadFilter;
}

// Install the mock globally before module import
(globalThis as any).AudioContext = MockAudioContext;

import { sound, initSound } from '../../src/utils/audio';

describe('SoundManager', () => {
  beforeEach(() => {
    store.clear();
    sound.enabled = true;
    sound.volume = 0.8;

    // Clear per-test tracking arrays
    createdOscillators = [];
    createdGainNodes = [];
    createdBufferSources = [];
    createdFilters = [];

    // Clear call counts on the shared mock functions
    mockCreateOscillator.mockClear();
    mockCreateGain.mockClear();
    mockCreateBufferSource.mockClear();
    mockCreateBuffer.mockClear();
    mockCreateBiquadFilter.mockClear();
    mockResume.mockClear();
    sharedState.value = 'running';
  });

  describe('play()', () => {
    it('should not throw when calling play with all valid sound names', () => {
      const soundNames = [
        'tap', 'move', 'rotate', 'drop', 'clear', 'match',
        'score', 'gameOver', 'win', 'select', 'error', 'pop',
        'flip', 'eat',
      ] as const;
      for (const name of soundNames) {
        expect(() => sound.play(name)).not.toThrow();
      }
    });

    it('should not play when disabled', () => {
      sound.enabled = false;
      sound.play('tap');
      expect(mockCreateOscillator).not.toHaveBeenCalled();
    });

    it('should not play when volume is 0', () => {
      sound.volume = 0;
      sound.play('tap');
      expect(mockCreateOscillator).not.toHaveBeenCalled();
    });

    it('should not play when volume is negative', () => {
      sound.volume = -1;
      sound.play('tap');
      expect(mockCreateOscillator).not.toHaveBeenCalled();
    });

    it('should create oscillator for tap sound', () => {
      sound.play('tap');
      expect(mockCreateOscillator).toHaveBeenCalled();
      expect(createdOscillators.length).toBeGreaterThan(0);
      expect(createdOscillators[0].type).toBe('sine');
    });

    it('should create oscillator for move sound', () => {
      sound.play('move');
      expect(mockCreateOscillator).toHaveBeenCalled();
    });

    it('should create oscillator for rotate sound', () => {
      sound.play('rotate');
      expect(mockCreateOscillator).toHaveBeenCalled();
    });

    it('should create noise buffer for drop sound', () => {
      sound.play('drop');
      expect(mockCreateBufferSource).toHaveBeenCalled();
      expect(mockCreateBuffer).toHaveBeenCalled();
      // drop also creates an oscillator for the low thud
      expect(mockCreateOscillator).toHaveBeenCalled();
    });

    it('should create oscillator for clear sound', () => {
      sound.play('clear');
      expect(mockCreateOscillator).toHaveBeenCalled();
    });

    it('should create oscillator for match sound', () => {
      sound.play('match');
      expect(mockCreateOscillator).toHaveBeenCalled();
    });

    it('should create two oscillators for score sound (two notes)', () => {
      sound.play('score');
      expect(mockCreateOscillator).toHaveBeenCalledTimes(2);
    });

    it('should create oscillator for gameOver sound', () => {
      sound.play('gameOver');
      expect(mockCreateOscillator).toHaveBeenCalled();
    });

    it('should create multiple oscillators for win sound (4 notes)', () => {
      sound.play('win');
      expect(mockCreateOscillator).toHaveBeenCalledTimes(4);
    });

    it('should create oscillator for select sound', () => {
      sound.play('select');
      expect(mockCreateOscillator).toHaveBeenCalled();
    });

    it('should create two oscillators for error sound (two buzzes)', () => {
      sound.play('error');
      expect(mockCreateOscillator).toHaveBeenCalledTimes(2);
    });

    it('should create noise + biquad filter for pop sound', () => {
      sound.play('pop');
      expect(mockCreateBufferSource).toHaveBeenCalled();
      expect(mockCreateBiquadFilter).toHaveBeenCalled();
    });

    it('should create noise + biquad filter for flip sound', () => {
      sound.play('flip');
      expect(mockCreateBufferSource).toHaveBeenCalled();
      expect(mockCreateBiquadFilter).toHaveBeenCalled();
    });

    it('should create oscillator for eat sound', () => {
      sound.play('eat');
      expect(mockCreateOscillator).toHaveBeenCalled();
    });

    it('should create gain node and connect to destination', () => {
      sound.play('tap');
      expect(mockCreateGain).toHaveBeenCalled();
      expect(createdGainNodes.length).toBeGreaterThan(0);
      expect(createdGainNodes[0].connect).toHaveBeenCalled();
    });

    it('should resume AudioContext if suspended', () => {
      sharedState.value = 'suspended';
      sound.play('tap');
      expect(mockResume).toHaveBeenCalled();
    });

    it('should not resume if AudioContext is running', () => {
      sharedState.value = 'running';
      sound.play('tap');
      expect(mockResume).not.toHaveBeenCalled();
    });

    it('should handle unknown sound name gracefully (no matching fn)', () => {
      // Force an invalid sound name through type assertion
      expect(() => sound.play('nonexistent' as any)).not.toThrow();
    });

    it('should silently ignore audio errors during playback', () => {
      const origImpl = mockCreateOscillator.getMockImplementation();
      mockCreateOscillator.mockImplementation(() => { throw new Error('audio error'); });
      expect(() => sound.play('tap')).not.toThrow();
      mockCreateOscillator.mockImplementation(origImpl!);
    });
  });

  describe('enabled property', () => {
    it('should be settable to false', () => {
      sound.enabled = false;
      expect(sound.enabled).toBe(false);
    });

    it('should be settable to true', () => {
      sound.enabled = false;
      sound.enabled = true;
      expect(sound.enabled).toBe(true);
    });
  });

  describe('volume property', () => {
    it('should be 0.8 as set in beforeEach', () => {
      expect(sound.volume).toBe(0.8);
    });

    it('should be settable', () => {
      sound.volume = 0.5;
      expect(sound.volume).toBe(0.5);
    });
  });
});

describe('initSound()', () => {
  beforeEach(() => {
    store.clear();
  });

  it('should set enabled and volume from stored settings', async () => {
    store.set('app_settings', {
      soundEnabled: false,
      musicEnabled: true,
      vibrationEnabled: true,
      volume: 40,
      maxFps: 60,
      theme: 'light',
    });
    await initSound();
    expect(sound.enabled).toBe(false);
    expect(sound.volume).toBeCloseTo(0.4);
  });

  it('should use defaults when no settings stored', async () => {
    await initSound();
    expect(sound.enabled).toBe(true);
    expect(sound.volume).toBeCloseTo(0.8);
  });
});
