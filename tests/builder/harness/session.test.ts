import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  createSession,
  markDirty,
  markClean,
  addBuildLogEntry,
  getSessionContext,
  getChangedFiles,
  type BuilderSession,
} from '../../../src/builder/lib/harness/session';

describe('session', () => {
  describe('createSession', () => {
    it('returns correct initial state', () => {
      const session = createSession('feature/my-game');
      expect(session).toEqual({
        branch: 'feature/my-game',
        files: {},
        dependencies: {},
        buildLog: [],
        turnCount: 0,
        pendingCommit: null,
        dirty: false,
      });
    });

    it('uses the provided branch name', () => {
      const session = createSession('main');
      expect(session.branch).toBe('main');
    });
  });

  describe('markDirty / markClean', () => {
    it('markDirty sets dirty to true', () => {
      const session = createSession('test');
      expect(session.dirty).toBe(false);
      markDirty(session);
      expect(session.dirty).toBe(true);
    });

    it('markClean sets dirty to false', () => {
      const session = createSession('test');
      markDirty(session);
      expect(session.dirty).toBe(true);
      markClean(session);
      expect(session.dirty).toBe(false);
    });

    it('markDirty is idempotent', () => {
      const session = createSession('test');
      markDirty(session);
      markDirty(session);
      expect(session.dirty).toBe(true);
    });

    it('markClean is idempotent', () => {
      const session = createSession('test');
      markClean(session);
      markClean(session);
      expect(session.dirty).toBe(false);
    });
  });

  describe('addBuildLogEntry', () => {
    it('auto-increments turn count', () => {
      const session = createSession('test');
      addBuildLogEntry(session, {
        contributor: 'user',
        prompt: 'add physics',
        filesChanged: ['index.ts'],
      });
      expect(session.turnCount).toBe(1);
      expect(session.buildLog[0].turn).toBe(1);

      addBuildLogEntry(session, {
        contributor: 'ai',
        prompt: 'add rendering',
        filesChanged: ['render.ts'],
      });
      expect(session.turnCount).toBe(2);
      expect(session.buildLog[1].turn).toBe(2);
    });

    it('sets a valid ISO timestamp', () => {
      const session = createSession('test');
      addBuildLogEntry(session, {
        contributor: 'user',
        prompt: 'init',
        filesChanged: [],
      });
      const ts = new Date(session.buildLog[0].timestamp);
      expect(ts.getTime()).toBeGreaterThan(0);
      expect(session.buildLog[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('preserves contributor and prompt', () => {
      const session = createSession('test');
      addBuildLogEntry(session, {
        contributor: 'alice',
        prompt: 'make it blue',
        filesChanged: ['style.ts'],
      });
      expect(session.buildLog[0].contributor).toBe('alice');
      expect(session.buildLog[0].prompt).toBe('make it blue');
      expect(session.buildLog[0].filesChanged).toEqual(['style.ts']);
    });

    it('preserves optional error field', () => {
      const session = createSession('test');
      addBuildLogEntry(session, {
        contributor: 'ai',
        prompt: 'fix bug',
        filesChanged: [],
        error: 'type error',
      });
      expect(session.buildLog[0].error).toBe('type error');
    });

    it('entry without error has no error field', () => {
      const session = createSession('test');
      addBuildLogEntry(session, {
        contributor: 'ai',
        prompt: 'do stuff',
        filesChanged: ['a.ts'],
      });
      expect(session.buildLog[0].error).toBeUndefined();
    });
  });

  describe('getSessionContext', () => {
    it('returns empty string for fresh session', () => {
      const session = createSession('test');
      expect(getSessionContext(session)).toBe('');
    });

    it('formats build log correctly', () => {
      const session = createSession('test');
      session.buildLog.push({
        turn: 1,
        contributor: 'user',
        prompt: 'add gravity',
        filesChanged: ['physics.ts'],
        timestamp: '2024-01-01T00:00:00.000Z',
      });
      const ctx = getSessionContext(session);
      expect(ctx).toContain('## Build log');
      expect(ctx).toContain('Turn 1 [user]: "add gravity" → files: physics.ts');
    });

    it('formats build log entry with error', () => {
      const session = createSession('test');
      session.buildLog.push({
        turn: 1,
        contributor: 'ai',
        prompt: 'fix rendering',
        filesChanged: ['render.ts'],
        timestamp: '2024-01-01T00:00:00.000Z',
        error: 'type mismatch',
      });
      const ctx = getSessionContext(session);
      expect(ctx).toContain('(error: type mismatch)');
    });

    it('formats build log entry with empty contributor', () => {
      const session = createSession('test');
      session.buildLog.push({
        turn: 1,
        contributor: '',
        prompt: 'init',
        filesChanged: [],
        timestamp: '2024-01-01T00:00:00.000Z',
      });
      const ctx = getSessionContext(session);
      expect(ctx).toContain('Turn 1: "init"');
      expect(ctx).not.toContain('[]');
    });

    it('formats files correctly', () => {
      const session = createSession('test');
      session.files['src/games/foo/index.ts'] = 'const x = 1;';
      const ctx = getSessionContext(session);
      expect(ctx).toContain('## Current game files');
      expect(ctx).toContain('### src/games/foo/index.ts');
      expect(ctx).toContain('```typescript\nconst x = 1;\n```');
    });

    it('formats multiple files', () => {
      const session = createSession('test');
      session.files['src/games/foo/a.ts'] = 'const a = 1;';
      session.files['src/games/foo/b.ts'] = 'const b = 2;';
      const ctx = getSessionContext(session);
      expect(ctx).toContain('### src/games/foo/a.ts');
      expect(ctx).toContain('### src/games/foo/b.ts');
    });

    it('formats dependencies correctly', () => {
      const session = createSession('test');
      session.dependencies['matter-js'] = '^0.19.0';
      session.dependencies['howler'] = 'latest';
      const ctx = getSessionContext(session);
      expect(ctx).toContain('## Dependencies: matter-js@^0.19.0, howler@latest');
    });

    it('includes all sections when session has data', () => {
      const session = createSession('test');
      session.buildLog.push({
        turn: 1,
        contributor: 'user',
        prompt: 'init',
        filesChanged: ['index.ts'],
        timestamp: '2024-01-01T00:00:00.000Z',
      });
      session.files['src/games/foo/index.ts'] = 'code';
      session.dependencies['pixi.js'] = '^7.0.0';

      const ctx = getSessionContext(session);
      expect(ctx).toContain('## Build log');
      expect(ctx).toContain('## Current game files');
      expect(ctx).toContain('## Dependencies');
    });
  });

  describe('getChangedFiles', () => {
    it('returns only modified files', () => {
      const session = createSession('test');
      session.files['a.ts'] = 'modified';
      session.files['b.ts'] = 'unchanged';
      const originals = { 'a.ts': 'original', 'b.ts': 'unchanged' };
      const changed = getChangedFiles(session, originals);
      expect(changed).toEqual({ 'a.ts': 'modified' });
    });

    it('returns new files not in originals', () => {
      const session = createSession('test');
      session.files['a.ts'] = 'existing';
      session.files['new.ts'] = 'brand new';
      const originals = { 'a.ts': 'existing' };
      const changed = getChangedFiles(session, originals);
      expect(changed).toEqual({ 'new.ts': 'brand new' });
    });

    it('returns empty when nothing changed', () => {
      const session = createSession('test');
      session.files['a.ts'] = 'same';
      const originals = { 'a.ts': 'same' };
      const changed = getChangedFiles(session, originals);
      expect(changed).toEqual({});
    });

    it('returns empty for empty session', () => {
      const session = createSession('test');
      const changed = getChangedFiles(session, {});
      expect(changed).toEqual({});
    });

    it('does not include files only in originals (deleted)', () => {
      const session = createSession('test');
      const originals = { 'deleted.ts': 'gone' };
      const changed = getChangedFiles(session, originals);
      expect(changed).toEqual({});
    });

    it('returns all files when originals is empty', () => {
      const session = createSession('test');
      session.files['a.ts'] = 'new';
      session.files['b.ts'] = 'also new';
      const changed = getChangedFiles(session, {});
      expect(changed).toEqual({ 'a.ts': 'new', 'b.ts': 'also new' });
    });
  });
});
