/**
 * Lightweight keyboard navigation helper.
 *
 * Binds a map of `key → handler` at the document level. Used by app screens
 * to wire up Enter/Escape/Arrow shortcuts without pulling in a hotkey library.
 *
 * - Ignores keystrokes when the user is typing in a text input or textarea
 *   (range sliders are explicitly allowed since they have no text editing).
 * - Calls `preventDefault()` on matched keys so the browser doesn't scroll/etc.
 * - Returns an unbind function — call it on screen exit.
 */
export type KeyHandler = (e: KeyboardEvent) => void;
export type KeyMap = Record<string, KeyHandler>;

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA']);

export function bindKeys(map: KeyMap): () => void {
  const handler = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement | null;
    if (target && TYPING_TAGS.has(target.tagName)) {
      const isRange = (target as HTMLInputElement).type === 'range';
      const isCheckbox = (target as HTMLInputElement).type === 'checkbox';
      const isButton = (target as HTMLInputElement).type === 'button';
      // Only allow shortcuts to fire from form controls that don't capture text
      if (!isRange && !isCheckbox && !isButton) return;
    }
    const fn = map[e.key];
    if (fn) {
      e.preventDefault();
      fn(e);
    }
  };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}
