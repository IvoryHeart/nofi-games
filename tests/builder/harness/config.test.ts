import { describe, it, expect } from 'vitest';

import { DEFAULT_CONFIG } from '../../../src/builder/lib/harness/config';
import type { BuilderConfig } from '../../../src/builder/lib/harness/config';

describe('config', () => {
  describe('DEFAULT_CONFIG', () => {
    it('has allowed paths under src/games/', () => {
      expect(DEFAULT_CONFIG.allowedPaths).toContain('src/games/');
    });

    it('allows matter-js, howler, and pixi.js as dependencies', () => {
      expect(DEFAULT_CONFIG.allowedDependencies).toEqual(['matter-js', 'howler', 'pixi.js']);
    });

    it('has reasonable file limits', () => {
      expect(DEFAULT_CONFIG.maxFiles).toBe(20);
      expect(DEFAULT_CONFIG.maxFileSize).toBe(50000);
    });

    it('has a turn limit', () => {
      expect(DEFAULT_CONFIG.maxTurns).toBe(50);
    });

    it('has model allowlist with at least one model', () => {
      expect(DEFAULT_CONFIG.modelAllowlist.length).toBeGreaterThanOrEqual(1);
    });

    it('has a system prompt path', () => {
      expect(DEFAULT_CONFIG.systemPromptPath).toBe('./prompts/game-builder.md');
    });

    it('conforms to BuilderConfig interface', () => {
      const config: BuilderConfig = DEFAULT_CONFIG;
      expect(config).toBeDefined();
      expect(typeof config.allowedPaths).toBe('string');
      expect(Array.isArray(config.allowedDependencies)).toBe(true);
      expect(typeof config.maxFiles).toBe('number');
      expect(typeof config.maxFileSize).toBe('number');
      expect(typeof config.maxTurns).toBe('number');
      expect(Array.isArray(config.modelAllowlist)).toBe(true);
      expect(typeof config.systemPromptPath).toBe('string');
    });
  });
});
