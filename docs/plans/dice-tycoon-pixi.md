# Dice Tycoon — Pixi.js WebGL renderer (Tycoon app only)

**Decided 2026-06-17.** Give the standalone Tycoon app (`tycoon.nofi.games`) a GPU 2.5D
renderer (Pixi.js v8) for MGO-grade slickness (filters/glow, particles, buttery
transforms). nofi.games and the other 23 games stay pure canvas-2D/offline/tiny.

## Principles preserved
- **Bundle isolation:** Pixi is imported ONLY by `src/tycoon/**`. Vite MPA keeps it out of
  the nofi `main` entry. (Spike must VERIFY the nofi bundle is unchanged.)
- **Still offline, still no image assets:** render procedurally in Pixi (Graphics +
  RenderTexture + filters). Pixi JS is bundled + SW-precached → Tycoon app stays a PWA
  (bigger first load, then cached). NO external/CDN assets.
- **nofi grid card unchanged:** the existing canvas `DiceTycoon.ts` stays as the
  nofi.games/dice-tycoon card (tiny/offline). Only the Tycoon *app* uses Pixi.

## Architecture
- **Renderer-agnostic core** (`src/games/dice-tycoon/core/`): extract the game RULES/STATE
  from `DiceTycoon.ts` — roll→move→resolve→build→raid→regen→score state machine + serialize/
  deserialize — depending only on the pure modules (economy/board/rivals/stickers). NO
  canvas/Pixi. **This is headlessly testable in jsdom** (keeps our coverage).
- **Two thin views** consume the core:
  - Canvas view = current `DiceTycoon.ts` (for the nofi grid card).
  - **Pixi view** (`src/tycoon/pixi/`) = the slick standalone renderer (scene graph,
    sprites/Graphics, filters, particle systems, a token-following camera, spring easing).
- **Testing:** core logic tested in jsdom as today. Pixi view (WebGL) can't render in
  jsdom → keep it thin; test what's testable (mount/teardown with a mocked/`forceCanvas`
  Pixi or guarded), validate visuals by deploying increments.

## Spike (de-risk first — additive, no deploy, live app untouched)
Add `pixi.js`, render a self-contained procedural "slickness demo" in the Tycoon app
(reachable behind a flag/route, e.g. `?pixidemo=1`): a glossy beveled die with a drop-shadow/
glow filter, a coin-burst particle system, a tile with lighting, smooth spring tween.
MEASURE & report: nofi `main` bundle size (must be UNCHANGED), tycoon bundle + Pixi gzip
delta, PWA precache + offline still works, and a subjective read on whether filters/particles
deliver the MGO feel. Keep the full test suite green (gate Pixi out of jsdom paths).

## Build plan (after spike, if numbers are acceptable)
1. Extract renderer-agnostic core from DiceTycoon.ts (+ headless tests). Canvas view refactors
   to use it (nofi card keeps working).
2. Build the Pixi view in `src/tycoon/pixi/`: board (2.5D, depth-sorted, camera-follow),
   rising buildings, Penny token, glossy dice/GO!/cash chrome, particle VFX, spring physics.
3. Wire the Tycoon app to use the Pixi view; keep save/resume via the shared core; responsive.
4. Deploy increments to `tycoon.nofi.games` (Tycoon-only; nofi grid untouched).

## Open risks
- Pixi v8 bundle (~150KB gzip) — acceptable for a standalone retention game, verify offline.
- "Slick like MGO" is still gated by an ART/ANIMATION budget, not just the renderer —
  procedural Pixi raises the ceiling but bespoke assets (e.g. Rive for Penny) would be a
  further, separate step.
- Logic extraction must not regress the canvas DiceTycoon (keep its tests green).
