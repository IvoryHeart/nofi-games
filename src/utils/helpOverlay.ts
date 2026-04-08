/**
 * Reusable help / keymap overlay.
 *
 * One modal that any screen can open to show the current device's controls.
 * The overlay lists both **universal bindings** (every game honors these) and
 * optional **game-specific** controls passed in by the caller.
 *
 * Dismisses on: Escape key, tap outside the panel, or the "Got it" button.
 *
 * Device class is auto-detected (touch vs fine-pointer) so we only highlight
 * the section that's relevant to the user's current device, but both sections
 * stay visible so players switching platforms still see every control.
 */

export interface HelpSection {
  /** Input channel this section describes. */
  kind: 'keyboard' | 'touch' | 'mouse' | 'trackpad';
  /** Each row is `[key / gesture, description]`. */
  rows: ReadonlyArray<readonly [string, string]>;
}

export interface HelpContent {
  /** Shown at the top of the overlay. */
  title: string;
  /** Optional sub-header like "Block Drop" or "Home". */
  subtitle?: string;
  /** Per-input-channel tables. The overlay shows every provided kind. */
  sections: readonly HelpSection[];
}

export interface HelpOverlayHandle {
  /** Close the overlay and remove all listeners. Idempotent. */
  close(): void;
  /** The root element, so callers can tweak it if needed. */
  root: HTMLElement;
}

/** Universal bindings shared by every game and screen. Shown first so
 *  players build the habit of recognizing them across the app. */
export const UNIVERSAL_BINDINGS: HelpContent['sections'] = [
  {
    kind: 'keyboard',
    rows: [
      ['Enter / Space', 'Primary action'],
      ['Escape', 'Back / close'],
      ['P', 'Pause'],
      ['?', 'Open this help'],
      ['Arrows / WASD', 'Navigate'],
    ],
  },
  {
    kind: 'touch',
    rows: [
      ['Tap', 'Primary action'],
      ['Long press', 'Secondary action'],
      ['Swipe', 'Directional / gesture'],
    ],
  },
  {
    kind: 'mouse',
    rows: [
      ['Left click', 'Primary action'],
      ['Right click', 'Secondary action'],
      ['Drag', 'Directional / gesture'],
    ],
  },
  {
    kind: 'trackpad',
    rows: [
      ['Click', 'Primary action'],
      ['Two-finger scroll', 'Swipe / scroll gesture'],
      ['Two-finger click', 'Secondary action'],
    ],
  },
];

/** Returns 'touch' when the browser reports a coarse primary pointer, else 'pointer'. */
export function detectDeviceClass(): 'touch' | 'pointer' {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'pointer';
  }
  try {
    return window.matchMedia('(pointer: coarse)').matches ? 'touch' : 'pointer';
  } catch {
    return 'pointer';
  }
}

const KIND_LABELS: Record<HelpSection['kind'], string> = {
  keyboard: 'Keyboard',
  touch: 'Touch',
  mouse: 'Mouse',
  trackpad: 'Trackpad',
};

/** Open the help overlay inside `container`. Returns a handle with a `close()` method. */
export function showHelpOverlay(container: HTMLElement, content: HelpContent): HelpOverlayHandle {
  const device = detectDeviceClass();
  // On touch devices we highlight the Touch section; on desktop, Keyboard.
  const highlightKind: HelpSection['kind'] = device === 'touch' ? 'touch' : 'keyboard';

  const root = document.createElement('div');
  root.className = 'help-overlay';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Controls help');

  const panel = document.createElement('div');
  panel.className = 'help-panel';

  const header = document.createElement('div');
  header.className = 'help-header';
  const titleEl = document.createElement('h3');
  titleEl.className = 'help-title';
  titleEl.textContent = content.title;
  header.appendChild(titleEl);
  if (content.subtitle) {
    const sub = document.createElement('div');
    sub.className = 'help-subtitle';
    sub.textContent = content.subtitle;
    header.appendChild(sub);
  }
  panel.appendChild(header);

  const body = document.createElement('div');
  body.className = 'help-body';

  for (const section of content.sections) {
    if (section.rows.length === 0) continue;
    const sectionEl = document.createElement('div');
    sectionEl.className = 'help-section';
    if (section.kind === highlightKind) sectionEl.classList.add('highlight');

    const heading = document.createElement('div');
    heading.className = 'help-section-heading';
    heading.textContent = KIND_LABELS[section.kind];
    sectionEl.appendChild(heading);

    const table = document.createElement('div');
    table.className = 'help-table';
    for (const [key, desc] of section.rows) {
      const row = document.createElement('div');
      row.className = 'help-row';
      const kbd = document.createElement('span');
      kbd.className = 'help-key';
      kbd.textContent = key;
      const descEl = document.createElement('span');
      descEl.className = 'help-desc';
      descEl.textContent = desc;
      row.appendChild(kbd);
      row.appendChild(descEl);
      table.appendChild(row);
    }
    sectionEl.appendChild(table);
    body.appendChild(sectionEl);
  }
  panel.appendChild(body);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn btn-primary help-close';
  closeBtn.textContent = 'Got it';
  closeBtn.type = 'button';
  panel.appendChild(closeBtn);

  root.appendChild(panel);
  container.appendChild(root);

  let closed = false;
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };
  const onBackdropClick = (e: MouseEvent): void => {
    if (e.target === root) close();
  };
  closeBtn.addEventListener('click', () => close());
  root.addEventListener('click', onBackdropClick);
  document.addEventListener('keydown', onKey, true);

  function close(): void {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey, true);
    root.remove();
  }

  // Focus the close button so keyboard users can dismiss with Enter/Space
  // without hunting for a target.
  setTimeout(() => closeBtn.focus(), 0);

  return { close, root };
}

/** Build a HelpContent for a game screen from a game's controls spec plus
 *  the universal bindings. Game-specific rows go above the universal ones. */
export function buildGameHelp(
  gameName: string,
  gameControls: readonly HelpSection[] = [],
): HelpContent {
  return {
    title: 'How to play',
    subtitle: gameName,
    sections: [...gameControls, ...UNIVERSAL_BINDINGS],
  };
}

/** Build a HelpContent for a non-game screen (home, settings, etc). */
export function buildScreenHelp(screenName: string): HelpContent {
  return {
    title: 'Controls',
    subtitle: screenName,
    sections: UNIVERSAL_BINDINGS,
  };
}
