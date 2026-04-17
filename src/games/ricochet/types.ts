export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Target {
  x: number;
  y: number;
  radius: number;
  destroyed: boolean;
}

export interface Obstacle extends Rect {}

export interface RicochetLevel {
  /** Arena bounding box in logical units. */
  arena: Rect;
  /** Fixed starting position for the ball (relative to arena). */
  startX: number;
  startY: number;
  targets: Target[];
  obstacles: Obstacle[];
  /** Number of darts the player has to clear the level. */
  darts: number;
}

export interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  active: boolean;
  /** Bounce count so far — used to cap pathological cases and add flavor. */
  bounces: number;
}
