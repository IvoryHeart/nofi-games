import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Pixi.js v8 spike guard tests.
 *
 * The Pixi demo is WebGL — it CANNOT render in jsdom. These tests therefore
 * never instantiate a Pixi Application. Instead they assert the two properties
 * the spike must preserve:
 *
 *  1. The normal Tycoon app path (main.ts → app.ts) does NOT statically import
 *     Pixi or the demo module, so the normal boot needs no WebGL and the test
 *     suite stays green. Pixi is reachable ONLY via a dynamic import() guarded
 *     by the ?pixidemo=1 flag.
 *  2. The demo module is dynamically importable and exposes mountPixiDemo
 *     (without calling it — that would touch WebGL).
 */

const SRC = resolve(__dirname, '../../src/tycoon');
const read = (p: string) => readFileSync(resolve(SRC, p), 'utf8');

describe('Pixi spike — bundle/path isolation', () => {
  it('main.ts does not STATICALLY import Pixi or the demo (only dynamic, flag-gated)', () => {
    const main = read('main.ts');
    // No top-level/static import of pixi or the demo module.
    expect(main).not.toMatch(/^\s*import\s+[^;]*from\s+['"]pixi\.js['"]/m);
    expect(main).not.toMatch(/^\s*import\s+[^;]*from\s+['"]\.\/pixi\/demo['"]/m);
    // It IS reachable via a dynamic import behind the flag.
    expect(main).toMatch(/import\(['"]\.\/pixi\/demo['"]\)/);
    expect(main).toMatch(/pixidemo/);
  });

  it('app.ts (normal shell) does not reference Pixi at all', () => {
    const app = read('app.ts');
    expect(app).not.toMatch(/pixi/i);
  });

  it('the flag is an exact opt-in (=== "1"), so the normal path is unchanged', () => {
    const main = read('main.ts');
    expect(main).toMatch(/get\(['"]pixidemo['"]\)\s*===\s*['"]1['"]/);
  });
});

describe('Pixi spike — demo module is dynamically importable', () => {
  it('exposes mountPixiDemo without instantiating WebGL on import', async () => {
    // Importing the module only defines functions/classes; it must NOT create a
    // Pixi Application at module scope. Safe in jsdom.
    const mod = await import('../../src/tycoon/pixi/demo');
    expect(typeof mod.mountPixiDemo).toBe('function');
  });
});
