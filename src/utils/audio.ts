import { getSettings } from '../storage/scores';

type SoundName =
  | 'tap' | 'move' | 'rotate' | 'drop' | 'clear' | 'match'
  | 'score' | 'gameOver' | 'win' | 'select' | 'error' | 'pop'
  | 'flip' | 'eat';

class SoundManager {
  private ctx: AudioContext | null = null;
  enabled = true;
  volume = 0.8;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private createGain(ctx: AudioContext, vol: number): GainNode {
    const gain = ctx.createGain();
    gain.gain.value = vol * this.volume;
    gain.connect(ctx.destination);
    return gain;
  }

  private createNoise(ctx: AudioContext, duration: number): AudioBufferSourceNode {
    const len = Math.ceil(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    return src;
  }

  play(name: SoundName): void {
    if (!this.enabled || this.volume <= 0) return;
    try {
      const fn = this.sounds[name];
      if (fn) fn();
    } catch {
      // Silently ignore audio errors
    }
  }

  private sounds: Record<SoundName, () => void> = {
    tap: () => {
      const ctx = this.getCtx();
      const t = ctx.currentTime;
      const gain = this.createGain(ctx, 0.3);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 1200;
      osc.connect(gain);
      gain.gain.setValueAtTime(0.3 * this.volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      osc.start(t);
      osc.stop(t + 0.05);
    },

    move: () => {
      const ctx = this.getCtx();
      const t = ctx.currentTime;
      const gain = this.createGain(ctx, 0.25);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.exponentialRampToValueAtTime(400, t + 0.06);
      osc.connect(gain);
      gain.gain.setValueAtTime(0.25 * this.volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.start(t);
      osc.stop(t + 0.06);
    },

    rotate: () => {
      const ctx = this.getCtx();
      const t = ctx.currentTime;
      const gain = this.createGain(ctx, 0.2);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 600;
      osc.connect(gain);
      gain.gain.setValueAtTime(0.2 * this.volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      osc.start(t);
      osc.stop(t + 0.04);
    },

    drop: () => {
      const ctx = this.getCtx();
      const t = ctx.currentTime;
      // Low thud
      const gain1 = this.createGain(ctx, 0.4);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 150;
      osc.connect(gain1);
      gain1.gain.setValueAtTime(0.4 * this.volume, t);
      gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.start(t);
      osc.stop(t + 0.1);
      // Noise burst
      const gain2 = this.createGain(ctx, 0.15);
      const noise = this.createNoise(ctx, 0.1);
      noise.connect(gain2);
      gain2.gain.setValueAtTime(0.15 * this.volume, t);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      noise.start(t);
      noise.stop(t + 0.1);
    },

    clear: () => {
      const ctx = this.getCtx();
      const t = ctx.currentTime;
      const gain = this.createGain(ctx, 0.35);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, t);
      osc.frequency.exponentialRampToValueAtTime(1200, t + 0.2);
      osc.connect(gain);
      gain.gain.setValueAtTime(0.35 * this.volume, t);
      gain.gain.setValueAtTime(0.35 * this.volume, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.start(t);
      osc.stop(t + 0.2);
    },

    match: () => {
      const ctx = this.getCtx();
      const t = ctx.currentTime;
      const gain = this.createGain(ctx, 0.3);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.exponentialRampToValueAtTime(1400, t + 0.08);
      osc.connect(gain);
      gain.gain.setValueAtTime(0.3 * this.volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc.start(t);
      osc.stop(t + 0.08);
    },

    score: () => {
      const ctx = this.getCtx();
      const t = ctx.currentTime;
      const gain = this.createGain(ctx, 0.25);
      // First note
      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.value = 800;
      osc1.connect(gain);
      osc1.start(t);
      osc1.stop(t + 0.05);
      // Second note
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = 1000;
      osc2.connect(gain);
      osc2.start(t + 0.06);
      osc2.stop(t + 0.11);
      gain.gain.setValueAtTime(0.25 * this.volume, t);
      gain.gain.setValueAtTime(0.25 * this.volume, t + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    },

    gameOver: () => {
      const ctx = this.getCtx();
      const t = ctx.currentTime;
      const gain = this.createGain(ctx, 0.35);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, t);
      osc.frequency.exponentialRampToValueAtTime(200, t + 0.4);
      osc.connect(gain);
      gain.gain.setValueAtTime(0.35 * this.volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.start(t);
      osc.stop(t + 0.4);
    },

    win: () => {
      const ctx = this.getCtx();
      const t = ctx.currentTime;
      const notes = [523, 659, 784, 1047];
      const step = 0.125;
      const gain = this.createGain(ctx, 0.3);
      gain.gain.setValueAtTime(0.3 * this.volume, t);
      gain.gain.setValueAtTime(0.3 * this.volume, t + step * 3);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      for (let i = 0; i < notes.length; i++) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = notes[i];
        osc.connect(gain);
        osc.start(t + i * step);
        osc.stop(t + i * step + step);
      }
    },

    select: () => {
      const ctx = this.getCtx();
      const t = ctx.currentTime;
      const gain = this.createGain(ctx, 0.2);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 1000;
      osc.connect(gain);
      gain.gain.setValueAtTime(0.2 * this.volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      osc.start(t);
      osc.stop(t + 0.03);
    },

    error: () => {
      const ctx = this.getCtx();
      const t = ctx.currentTime;
      const gain = this.createGain(ctx, 0.3);
      // First buzz
      const osc1 = ctx.createOscillator();
      osc1.type = 'square';
      osc1.frequency.value = 200;
      osc1.connect(gain);
      osc1.start(t);
      osc1.stop(t + 0.07);
      // Second buzz
      const osc2 = ctx.createOscillator();
      osc2.type = 'square';
      osc2.frequency.value = 200;
      osc2.connect(gain);
      osc2.start(t + 0.08);
      osc2.stop(t + 0.15);
      gain.gain.setValueAtTime(0.3 * this.volume, t);
      gain.gain.setValueAtTime(0.3 * this.volume, t + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    },

    pop: () => {
      const ctx = this.getCtx();
      const t = ctx.currentTime;
      const gain = this.createGain(ctx, 0.25);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2000;
      filter.Q.value = 2;
      const noise = this.createNoise(ctx, 0.06);
      noise.connect(filter);
      filter.connect(gain);
      gain.gain.setValueAtTime(0.25 * this.volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      noise.start(t);
      noise.stop(t + 0.06);
    },

    flip: () => {
      const ctx = this.getCtx();
      const t = ctx.currentTime;
      const gain = this.createGain(ctx, 0.2);
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(2000, t);
      filter.frequency.exponentialRampToValueAtTime(500, t + 0.08);
      const noise = this.createNoise(ctx, 0.08);
      noise.connect(filter);
      filter.connect(gain);
      gain.gain.setValueAtTime(0.2 * this.volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      noise.start(t);
      noise.stop(t + 0.08);
    },

    eat: () => {
      const ctx = this.getCtx();
      const t = ctx.currentTime;
      const gain = this.createGain(ctx, 0.3);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, t);
      osc.frequency.exponentialRampToValueAtTime(800, t + 0.06);
      osc.connect(gain);
      gain.gain.setValueAtTime(0.3 * this.volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.start(t);
      osc.stop(t + 0.06);
    },
  };
}

export const sound = new SoundManager();

export async function initSound(): Promise<void> {
  const settings = await getSettings();
  sound.enabled = settings.soundEnabled;
  sound.volume = settings.volume / 100;
}
