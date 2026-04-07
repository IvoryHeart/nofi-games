import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { bindKeys, type KeyMap } from '../../src/utils/keyboardNav';

describe('keyboardNav', () => {
  let unbindFns: Array<() => void> = [];

  beforeEach(() => {
    unbindFns = [];
  });

  afterEach(() => {
    for (const unbind of unbindFns) unbind();
    unbindFns = [];
    // Clean up any stray DOM elements left over
    document.body.innerHTML = '';
  });

  function bind(map: KeyMap): () => void {
    const unbind = bindKeys(map);
    unbindFns.push(unbind);
    return unbind;
  }

  // ── bind / unbind ──

  describe('bindKeys()', () => {
    it('should call the handler when its key is pressed', () => {
      const handler = vi.fn();
      bind({ Enter: handler });

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should pass the KeyboardEvent to the handler', () => {
      const handler = vi.fn();
      bind({ Escape: handler });

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(handler).toHaveBeenCalledWith(expect.any(KeyboardEvent));
      const receivedEvent = handler.mock.calls[0][0] as KeyboardEvent;
      expect(receivedEvent.key).toBe('Escape');
    });

    it('should not call the handler for unmatched keys', () => {
      const handler = vi.fn();
      bind({ Enter: handler });

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
      expect(handler).not.toHaveBeenCalled();
    });

    it('should return an unbind function that stops the handler from firing', () => {
      const handler = vi.fn();
      const unbind = bindKeys({ Enter: handler });

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(handler).toHaveBeenCalledTimes(1);

      unbind();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(handler).toHaveBeenCalledTimes(1); // no additional calls
    });

    it('should support multiple unbinds being idempotent from the caller perspective', () => {
      const handler = vi.fn();
      const unbind = bindKeys({ Enter: handler });
      unbind();
      // Calling unbind twice shouldn't throw
      expect(() => unbind()).not.toThrow();
    });

    it('should handle multiple independent bindings', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      bind({ Enter: h1 });
      bind({ Escape: h2 });

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(h1).toHaveBeenCalledTimes(1);
      expect(h2).not.toHaveBeenCalled();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(h1).toHaveBeenCalledTimes(1);
      expect(h2).toHaveBeenCalledTimes(1);
    });

    it('should support multiple keys within a single map', () => {
      const enterHandler = vi.fn();
      const escapeHandler = vi.fn();
      const arrowHandler = vi.fn();

      bind({
        Enter: enterHandler,
        Escape: escapeHandler,
        ArrowLeft: arrowHandler,
      });

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));

      expect(enterHandler).toHaveBeenCalledTimes(1);
      expect(escapeHandler).toHaveBeenCalledTimes(1);
      expect(arrowHandler).toHaveBeenCalledTimes(1);
    });
  });

  // ── preventDefault ──

  describe('preventDefault', () => {
    it('should call preventDefault on matched keys', () => {
      bind({ Enter: vi.fn() });

      const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
      const preventSpy = vi.spyOn(event, 'preventDefault');
      document.dispatchEvent(event);

      expect(preventSpy).toHaveBeenCalled();
    });

    it('should NOT call preventDefault on unmatched keys', () => {
      bind({ Enter: vi.fn() });

      const event = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
      const preventSpy = vi.spyOn(event, 'preventDefault');
      document.dispatchEvent(event);

      expect(preventSpy).not.toHaveBeenCalled();
    });
  });

  // ── Input focus behaviour ──

  describe('input focus handling', () => {
    it('should ignore keys when target is a text input', () => {
      const input = document.createElement('input');
      input.type = 'text';
      document.body.appendChild(input);

      const handler = vi.fn();
      bind({ Enter: handler });

      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      input.dispatchEvent(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should ignore keys when target is an email/password input', () => {
      const email = document.createElement('input');
      email.type = 'email';
      document.body.appendChild(email);

      const password = document.createElement('input');
      password.type = 'password';
      document.body.appendChild(password);

      const handler = vi.fn();
      bind({ Enter: handler });

      email.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      password.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(handler).not.toHaveBeenCalled();
    });

    it('should ignore keys when target is a textarea', () => {
      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);

      const handler = vi.fn();
      bind({ Enter: handler });

      textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(handler).not.toHaveBeenCalled();
    });

    it('should fire when target is a range slider input', () => {
      const range = document.createElement('input');
      range.type = 'range';
      document.body.appendChild(range);

      const handler = vi.fn();
      bind({ ArrowRight: handler });

      range.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should fire when target is a checkbox input', () => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      document.body.appendChild(checkbox);

      const handler = vi.fn();
      bind({ Enter: handler });

      checkbox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should fire when target is a button input', () => {
      const button = document.createElement('input');
      button.type = 'button';
      document.body.appendChild(button);

      const handler = vi.fn();
      bind({ Enter: handler });

      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should fire when target is a regular element (div)', () => {
      const div = document.createElement('div');
      document.body.appendChild(div);

      const handler = vi.fn();
      bind({ Enter: handler });

      div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should fire when there is no target (document-level event)', () => {
      const handler = vi.fn();
      bind({ Enter: handler });

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});
