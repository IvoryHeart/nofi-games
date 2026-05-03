# GameEngine API Reference

## Overview

`GameEngine` is the abstract base class for all NoFi.Games. Your game must extend it, implement three methods (`init`, `update`, `render`), and register itself.

## Constants

```typescript
HUD_CLEARANCE = 72  // Reserved pixels at top for the app shell HUD (back button, score, etc.)
                    // Keep ALL game content below this Y coordinate.
```

## Constructor

Games receive a `GameConfig` object (handled by the framework — you don't construct it yourself):

```typescript
interface GameConfig {
  canvas: HTMLCanvasElement;
  width: number;              // Logical canvas width (typically 360)
  height: number;             // Logical canvas height (typically 640)
  difficulty?: number;        // 0=easy, 1=medium, 2=hard, 3=extra hard
  seed?: number;              // For daily mode determinism
  onScore?: (score: number) => void;
  onGameOver?: (finalScore: number) => void;
  onWin?: (finalScore: number) => void;
}
```

## Required Methods (must implement)

```typescript
abstract init(): void;
// Set up initial game state: grids, positions, timers, etc.
// Called once on game start. Also called on reset().

abstract update(dt: number): void;
// Game logic. dt = delta time in SECONDS (capped at 0.05).
// Called every frame while running and not paused.

abstract render(): void;
// Draw the current frame. Called every frame after update().
// Always start with this.clear() to avoid ghosting.
```

## Protected State (read/write in your game)

```typescript
this.width: number          // Logical canvas width
this.height: number         // Logical canvas height
this.ctx: CanvasRenderingContext2D  // Direct canvas context (for advanced drawing)
this.score: number          // Current score
this.won: boolean           // Whether player has won
this.running: boolean       // Whether game loop is active
this.paused: boolean        // Whether game is paused
this.difficulty: number     // 0-3 difficulty level
this.dpr: number            // Device pixel ratio (for retina awareness)

// Input state (updated automatically by the engine)
this.keys: Set<string>      // Currently pressed keyboard keys (e.g., 'ArrowUp', 'a')
this.pointer: { x: number; y: number; down: boolean }  // Pointer/touch position in logical coords

// Random number generator
this.rng: () => number      // Returns [0, 1). Seeded when seed is provided.
                            // ALWAYS use this instead of Math.random().
```

## Score & Game State Methods

```typescript
this.setScore(score: number): void
// Set the score to an absolute value.

this.addScore(points: number): void
// Add points to the score. Also plays the 'score' sound.

this.gameOver(): void
// End the game. Stops the game loop, plays 'gameOver' sound.

this.gameWin(): void
// Trigger win celebration. Idempotent (safe to call multiple times).
// Does NOT stop the game loop — call gameOver() after if the game should end.
// For terminal wins: this.gameWin(); setTimeout(() => this.gameOver(), 1500);
// For continuable wins (like 2048): just this.gameWin(); and keep running.
```

## Drawing Helpers

```typescript
this.clear(color?: string): void
// Fill the entire canvas. Default: '#FEF0E4' (warm cream).

this.drawRoundRect(x: number, y: number, w: number, h: number, radius: number, fill: string, stroke?: string): void
// Draw a rounded rectangle.

this.drawText(text: string, x: number, y: number, opts?: {
  size?: number;        // Default: 16
  color?: string;       // Default: '#3D2B35'
  align?: CanvasTextAlign;    // Default: 'center'
  baseline?: CanvasTextBaseline;  // Default: 'middle'
  weight?: string;      // Default: '600'
  font?: string;        // Default: "'Inter', system-ui, sans-serif"
}): void

this.drawCircle(x: number, y: number, radius: number, fill: string, stroke?: string, lineWidth?: number): void
// Draw a circle. lineWidth defaults to 1.

this.lerp(a: number, b: number, t: number): number
// Linear interpolation: a + (b - a) * t

this.easeOut(t: number): number
// Cubic ease-out: 1 - (1 - t)^3. Use for smooth deceleration.
```

## Input Handlers (override to handle input)

```typescript
protected handleKeyDown(key: string, event: KeyboardEvent): void
// Called when a key is pressed. key = event.key (e.g., 'ArrowUp', 'a', ' ').

protected handleKeyUp(key: string, event: KeyboardEvent): void
// Called when a key is released.

protected handlePointerDown(x: number, y: number): void
// Called on mouse click or touch start. Coordinates are in logical canvas space.

protected handlePointerMove(x: number, y: number): void
// Called on mouse move or touch move (while pointer is down or hovering on canvas).

protected handlePointerUp(x: number, y: number): void
// Called on mouse release or touch end.
```

## Audio

```typescript
this.playSound(name: string): void
// Available sounds: 'tap', 'move', 'rotate', 'drop', 'clear', 'match',
//                   'score', 'gameOver', 'win', 'select', 'error', 'pop', 'flip', 'eat'
```

## Haptics

```typescript
this.haptic(intensity?: 'light' | 'medium' | 'heavy'): void
// Trigger vibration feedback. Default: 'light'.
```

## Save / Resume (optional overrides)

```typescript
serialize(): GameSnapshot | null
// Return a JSON-serializable snapshot of game state, or null.
// Default: null (no save support). The engine handles score and won separately.

deserialize(state: GameSnapshot): void
// Restore state from a snapshot. Runs AFTER init(), so it overwrites init state.
// Deep-clone all arrays/objects. Reset transient animation state.

canSave(): boolean
// Whether the game is safe to save right now. Default: true.
// Return false during animations or unstable states.
```

## Other Overridable Methods

```typescript
getRevealMessage(): string | null
// Message to show on game-over (e.g., the hidden word on loss). Default: null.

getHudStats(): Array<{ label: string; value: string }>
// Stats for the app shell HUD (e.g., timer, moves). Default: [].

reset(): void
// Reset to initial state. Re-seeds RNG, clears score, re-runs init().
// Rarely needs overriding — the engine handles this.

destroy(): void
// Clean up listeners. Override ONLY if you added extra listeners,
// and always call super.destroy().
```

## Game Registration

After your class definition, register it at module level:

```typescript
registerGame({
  id: 'my-game',              // URL-safe slug (used in routes)
  name: 'My Game',            // Display name
  description: 'Short desc',  // One-line description
  icon: '●',                  // Unicode icon character
  color: '--game-default',    // CSS custom property name
  bgGradient: ['#E8928A', '#F0B090'],  // Two gradient colors for the card
  category: 'arcade',         // 'arcade' | 'puzzle' | 'word' | 'match-3'
  createGame: (config) => new MyGame(config),
  canvasWidth: 360,           // Logical width (360 is standard)
  canvasHeight: 640,          // Logical height (640 is standard)
  controls: 'Tap or arrow keys',  // Control hint text
  dailyMode?: boolean,        // true if game supports deterministic seeded puzzles
  continuableAfterWin?: boolean,  // true if play continues past win (e.g. 2048)
});
```
