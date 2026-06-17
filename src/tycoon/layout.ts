/**
 * Dice Tycoon — responsive layout logic (V1 real-estate fix).
 *
 * Pure, DOM-free computation of the play-view layout from the viewport size.
 * The OLD `computeSize()` clamped the Pixi board to a centered MAX_W=480
 * "device card" on every screen — the root cause of the "board too small /
 * wasted space" feedback. This replaces that with a viewport-driven LAYOUT MODE
 * and a CENTER-STAGE rect that GROWS with the viewport (no 480 cap):
 *
 *  - phone   (<700px):  board edge-to-edge — full width × (height − top HUD −
 *                       bottom control). Framing defaults to token-FOLLOW.
 *  - compact (700–1023): one rail (left). Board fills the rest — much bigger
 *                       than the old card. Framing WHOLE-board.
 *  - cockpit (≥1024px): three zones — top bar, left rail, BIG center stage,
 *                       right rail. Framing WHOLE-board.
 *
 * Exported pure so the shell's measuring/plumbing is unit-testable without a
 * real DOM or WebGL (Pixi can't render in jsdom).
 */

export type LayoutMode = 'phone' | 'compact' | 'cockpit';
export type Framing = 'whole' | 'follow';

/** Breakpoints (px). `compact` is [PHONE_MAX, COCKPIT_MIN). */
export const PHONE_MAX = 700;
export const COCKPIT_MIN = 1024;

/** Chrome band sizes (CSS px). */
export const TOP_BAR_H = 60; // cockpit/compact top bar
export const PHONE_TOP_HUD_H = 52; // translucent minimal phone HUD
export const PHONE_BOTTOM_H = 96; // control-bar reserve + safe-area cushion
export const RAIL_W = 312; // each desktop rail
export const COMPACT_RAIL_W = 280; // single rail in compact

/** A rect for the Pixi center stage, in CSS px. */
export interface StageRect {
  w: number;
  h: number;
}

export interface LayoutResult {
  mode: LayoutMode;
  /** The Pixi host / center-stage size (NOT clamped to 480). */
  stageRect: StageRect;
  /** Default camera framing for this mode. */
  framing: Framing;
  /** Which rails are visible. */
  leftRail: boolean;
  rightRail: boolean;
  /** Top bar height for this mode (0 on phone — it uses the overlay HUD). */
  topBarH: number;
}

/** Classify the viewport width into a layout mode. */
export function layoutMode(vw: number): LayoutMode {
  if (vw < PHONE_MAX) return 'phone';
  if (vw < COCKPIT_MIN) return 'compact';
  return 'cockpit';
}

/**
 * Compute the full play-view layout for a viewport. Pure — the shell measures
 * the live viewport and feeds (vw, vh) in; tests call it directly.
 *
 * The center-stage rect is the SPACE THE BOARD GETS, derived by subtracting the
 * top bar + rails from the viewport. It grows monotonically with width (no 480
 * cap), so the board scales up to fill desktops.
 */
export function computeLayout(vw: number, vh: number): LayoutResult {
  const w = Math.max(1, Math.floor(vw));
  const h = Math.max(1, Math.floor(vh));
  const mode = layoutMode(w);

  if (mode === 'phone') {
    // Edge-to-edge: full width, height minus the minimal top HUD + bottom
    // control reserve. The board fills the whole stage at follow zoom.
    const stageW = w;
    const stageH = Math.max(1, h - PHONE_TOP_HUD_H - PHONE_BOTTOM_H);
    return {
      mode,
      stageRect: { w: stageW, h: stageH },
      framing: 'follow',
      leftRail: false,
      rightRail: false,
      topBarH: 0,
    };
  }

  if (mode === 'compact') {
    // One rail (left). Board fills the remaining width × (height − top bar).
    const stageW = Math.max(1, w - COMPACT_RAIL_W);
    const stageH = Math.max(1, h - TOP_BAR_H);
    return {
      mode,
      stageRect: { w: stageW, h: stageH },
      framing: 'whole',
      leftRail: true,
      rightRail: false,
      topBarH: TOP_BAR_H,
    };
  }

  // cockpit: top bar + two rails frame a BIG center stage.
  const stageW = Math.max(1, w - RAIL_W * 2);
  const stageH = Math.max(1, h - TOP_BAR_H);
  return {
    mode,
    stageRect: { w: stageW, h: stageH },
    framing: 'whole',
    leftRail: true,
    rightRail: true,
    topBarH: TOP_BAR_H,
  };
}
