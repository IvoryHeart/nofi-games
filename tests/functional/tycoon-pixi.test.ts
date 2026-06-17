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

  it('app.ts loads the Pixi VIEW only via a dynamic import (never a static pixi.js import)', () => {
    const app = read('app.ts');
    // The shell must NOT statically import the pixi.js runtime — that would pull
    // the heavy WebGL chunk into the synchronous app-shell path.
    expect(app).not.toMatch(/^\s*import\s+[^;]*from\s+['"]pixi\.js['"]/m);
    // The Pixi view itself is loaded lazily via dynamic import() at play time.
    expect(app).toMatch(/import\(['"]\.\/pixi\/TycoonPixiGame['"]\)/);
    // A type-only import of the view (+ its event type) is fine (erased at
    // build time — no runtime pixi.js pulled in).
    expect(app).toMatch(/import\s+type\s+\{\s*TycoonPixiGame\s*,?[^}]*\}\s+from\s+['"]\.\/pixi\/TycoonPixiGame['"]/);
  });

  it('the flag is an exact opt-in (=== "1"), so the normal path is unchanged', () => {
    const main = read('main.ts');
    expect(main).toMatch(/get\(['"]pixidemo['"]\)\s*===\s*['"]1['"]/);
  });
});

describe('PX2 — Pixi 2.5D view wiring', () => {
  it('the TycoonPixiGame module statically imports pixi.js (it IS the WebGL view)', () => {
    // The VIEW module owns the Pixi runtime; isolation is preserved because the
    // shell only reaches it via dynamic import (asserted above), so pixi.js lands
    // in a lazy tycoon-only chunk — never the nofi main bundle.
    const view = readFileSync(resolve(SRC, 'pixi/TycoonPixiGame.ts'), 'utf8');
    expect(view).toMatch(/from\s+['"]pixi\.js['"]/);
  });

  it('the view drives the SHARED TycoonCore (no rules reimplemented)', () => {
    const view = readFileSync(resolve(SRC, 'pixi/TycoonPixiGame.ts'), 'utf8');
    expect(view).toMatch(/TycoonCore/);
    // Lifecycle hooks the shell relies on.
    for (const m of ['start', 'destroy', 'serialize', 'deserialize', 'getScore']) {
      expect(view).toMatch(new RegExp(`\\b${m}\\b`));
    }
  });

  it('the pure layout helpers are importable in jsdom (no WebGL)', async () => {
    const mod = await import('../../src/tycoon/pixi/layout');
    expect(typeof mod.ringLayout).toBe('function');
    expect(typeof mod.cameraTarget).toBe('function');
    expect(mod.ringLayout().length).toBe(20);
  });

  it('the app shell persists/restores via gameState (save/resume cross-compatible)', () => {
    const app = read('app.ts');
    expect(app).toMatch(/saveGameState/);
    expect(app).toMatch(/loadGameState/);
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
