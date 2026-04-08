import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  showHelpOverlay,
  buildGameHelp,
  buildScreenHelp,
  detectDeviceClass,
  UNIVERSAL_BINDINGS,
  type HelpContent,
} from '../../src/utils/helpOverlay';

describe('helpOverlay', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe('detectDeviceClass', () => {
    it('returns "pointer" when matchMedia reports fine pointer', () => {
      const orig = window.matchMedia;
      (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (q: string) => ({
        matches: !q.includes('coarse'),
        media: q,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      } as unknown as MediaQueryList);
      try {
        expect(detectDeviceClass()).toBe('pointer');
      } finally {
        (window as unknown as { matchMedia: typeof orig }).matchMedia = orig;
      }
    });

    it('returns "touch" when matchMedia reports coarse pointer', () => {
      const orig = window.matchMedia;
      (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (q: string) => ({
        matches: q.includes('coarse'),
        media: q,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      } as unknown as MediaQueryList);
      try {
        expect(detectDeviceClass()).toBe('touch');
      } finally {
        (window as unknown as { matchMedia: typeof orig }).matchMedia = orig;
      }
    });
  });

  describe('UNIVERSAL_BINDINGS', () => {
    it('includes keyboard, touch, mouse, and trackpad sections', () => {
      const kinds = UNIVERSAL_BINDINGS.map((s) => s.kind);
      expect(kinds).toContain('keyboard');
      expect(kinds).toContain('touch');
      expect(kinds).toContain('mouse');
      expect(kinds).toContain('trackpad');
    });

    it('keyboard section lists Enter, Escape, P, ?, arrows', () => {
      const kbd = UNIVERSAL_BINDINGS.find((s) => s.kind === 'keyboard')!;
      const keys = kbd.rows.map((r) => r[0]).join('|');
      expect(keys).toMatch(/Enter/);
      expect(keys).toMatch(/Escape/);
      expect(keys).toMatch(/P/);
      expect(keys).toMatch(/\?/);
      expect(keys).toMatch(/Arrows/);
    });
  });

  describe('builders', () => {
    it('buildGameHelp puts game controls BEFORE universal bindings', () => {
      const help = buildGameHelp('Wordle', [
        { kind: 'keyboard', rows: [['A-Z', 'Type a letter']] },
      ]);
      expect(help.title).toBe('How to play');
      expect(help.subtitle).toBe('Wordle');
      expect(help.sections[0].rows[0][0]).toBe('A-Z');
    });

    it('buildGameHelp works with no game-specific controls', () => {
      const help = buildGameHelp('Sudoku');
      expect(help.sections.length).toBe(UNIVERSAL_BINDINGS.length);
    });

    it('buildScreenHelp uses just the universal bindings', () => {
      const help = buildScreenHelp('Home');
      expect(help.title).toBe('Controls');
      expect(help.subtitle).toBe('Home');
      expect(help.sections).toBe(UNIVERSAL_BINDINGS);
    });
  });

  describe('showHelpOverlay', () => {
    function makeContent(): HelpContent {
      return {
        title: 'Test',
        subtitle: 'Test screen',
        sections: [
          { kind: 'keyboard', rows: [['X', 'Do X']] },
          { kind: 'touch', rows: [['Tap', 'Do something']] },
        ],
      };
    }

    it('appends an overlay element to the container', () => {
      const handle = showHelpOverlay(container, makeContent());
      expect(container.querySelector('.help-overlay')).toBeTruthy();
      handle.close();
    });

    it('renders the title and subtitle', () => {
      const handle = showHelpOverlay(container, makeContent());
      expect(container.querySelector('.help-title')?.textContent).toBe('Test');
      expect(container.querySelector('.help-subtitle')?.textContent).toBe('Test screen');
      handle.close();
    });

    it('renders every non-empty section with a heading', () => {
      const handle = showHelpOverlay(container, makeContent());
      const headings = Array.from(container.querySelectorAll('.help-section-heading'))
        .map((el) => el.textContent);
      expect(headings).toContain('Keyboard');
      expect(headings).toContain('Touch');
      handle.close();
    });

    it('skips sections with no rows', () => {
      const handle = showHelpOverlay(container, {
        title: 'Empty',
        sections: [
          { kind: 'keyboard', rows: [['A', 'test']] },
          { kind: 'touch', rows: [] },
        ],
      });
      const sections = container.querySelectorAll('.help-section');
      expect(sections.length).toBe(1);
      handle.close();
    });

    it('close() removes the overlay from the DOM', () => {
      const handle = showHelpOverlay(container, makeContent());
      expect(container.querySelector('.help-overlay')).toBeTruthy();
      handle.close();
      expect(container.querySelector('.help-overlay')).toBeFalsy();
    });

    it('close() is idempotent', () => {
      const handle = showHelpOverlay(container, makeContent());
      handle.close();
      expect(() => handle.close()).not.toThrow();
    });

    it('clicking the "Got it" button closes the overlay', () => {
      const handle = showHelpOverlay(container, makeContent());
      const btn = container.querySelector('.help-close') as HTMLButtonElement;
      expect(btn).toBeTruthy();
      btn.click();
      expect(container.querySelector('.help-overlay')).toBeFalsy();
      handle.close();
    });

    it('clicking the backdrop closes the overlay', () => {
      const handle = showHelpOverlay(container, makeContent());
      const root = container.querySelector('.help-overlay') as HTMLElement;
      const evt = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(evt, 'target', { value: root, writable: false });
      root.dispatchEvent(evt);
      expect(container.querySelector('.help-overlay')).toBeFalsy();
      handle.close();
    });

    it('pressing Escape closes the overlay', () => {
      const handle = showHelpOverlay(container, makeContent());
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(container.querySelector('.help-overlay')).toBeFalsy();
      handle.close();
    });

    it('detaches the keydown listener after close', () => {
      const handle = showHelpOverlay(container, makeContent());
      handle.close();
      expect(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))).not.toThrow();
    });

    it('applies role=dialog and aria-modal for accessibility', () => {
      const handle = showHelpOverlay(container, makeContent());
      const root = container.querySelector('.help-overlay') as HTMLElement;
      expect(root.getAttribute('role')).toBe('dialog');
      expect(root.getAttribute('aria-modal')).toBe('true');
      handle.close();
    });
  });
});
