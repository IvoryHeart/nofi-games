import { describe, it, expect, beforeEach } from 'vitest';

import { createTools } from '../../../src/builder/lib/harness/tools';
import type { BuilderSession } from '../../../src/builder/lib/harness/session';
import type { BuilderConfig } from '../../../src/builder/lib/harness/config';

function makeConfig(overrides: Partial<BuilderConfig> = {}): BuilderConfig {
  return {
    allowedPaths: 'src/games/[slug]/**',
    allowedDependencies: ['matter-js', 'howler', 'pixi.js'],
    maxFiles: 20,
    maxFileSize: 50000,
    maxTurns: 50,
    modelAllowlist: ['anthropic/claude-sonnet-4-20250514'],
    systemPromptPath: './prompts/game-builder.md',
    ...overrides,
  };
}

function makeSession(overrides: Partial<BuilderSession> = {}): BuilderSession {
  return {
    branch: 'test-branch',
    files: {},
    dependencies: {},
    buildLog: [],
    turnCount: 0,
    pendingCommit: null,
    dirty: false,
    ...overrides,
  };
}

describe('createTools', () => {
  let session: BuilderSession;
  let config: BuilderConfig;

  beforeEach(() => {
    session = makeSession();
    config = makeConfig();
  });

  describe('writeFile', () => {
    it('creates a file in the session and returns content', async () => {
      const { writeFile } = createTools(session, config);
      const result = await writeFile.execute(
        { path: 'src/games/my-game/index.ts', content: 'const x = 42;' },
        { toolCallId: 't1', messages: [], abortSignal: undefined as any },
      );
      expect(result).toEqual({
        success: true,
        path: 'src/games/my-game/index.ts',
        content: 'const x = 42;',
        size: 13,
      });
      expect(session.files['src/games/my-game/index.ts']).toBe('const x = 42;');
    });

    it('blocks bad paths (traversal)', async () => {
      const { writeFile } = createTools(session, config);
      const result = await writeFile.execute(
        { path: '../../../etc/passwd', content: 'root:x:0:0' },
        { toolCallId: 't1', messages: [], abortSignal: undefined as any },
      );
      expect(result.success).toBe(false);
      expect((result as any).error).toMatch(/directory traversal/);
    });

    it('blocks absolute paths', async () => {
      const { writeFile } = createTools(session, config);
      const result = await writeFile.execute(
        { path: '/etc/passwd', content: 'root:x:0:0' },
        { toolCallId: 't1', messages: [], abortSignal: undefined as any },
      );
      expect(result.success).toBe(false);
      expect((result as any).error).toMatch(/absolute paths/);
    });

    it('blocks paths outside src/games/', async () => {
      const { writeFile } = createTools(session, config);
      const result = await writeFile.execute(
        { path: 'src/engine/hack.ts', content: 'hacked' },
        { toolCallId: 't1', messages: [], abortSignal: undefined as any },
      );
      expect(result.success).toBe(false);
      expect((result as any).error).toMatch(/must be under src\/games/);
    });

    it('blocks oversized files', async () => {
      config.maxFileSize = 100;
      const { writeFile } = createTools(session, config);
      const result = await writeFile.execute(
        { path: 'src/games/my-game/big.ts', content: 'x'.repeat(101) },
        { toolCallId: 't1', messages: [], abortSignal: undefined as any },
      );
      expect(result.success).toBe(false);
      expect((result as any).error).toMatch(/File too large/);
    });

    it('blocks network patterns in content', async () => {
      const { writeFile } = createTools(session, config);
      const result = await writeFile.execute(
        { path: 'src/games/my-game/index.ts', content: `await fetch('https://evil.com');` },
        { toolCallId: 't1', messages: [], abortSignal: undefined as any },
      );
      expect(result.success).toBe(false);
      expect((result as any).error).toMatch(/network call/);
    });

    it('blocks eval in content', async () => {
      const { writeFile } = createTools(session, config);
      const result = await writeFile.execute(
        { path: 'src/games/my-game/index.ts', content: `eval('1+1');` },
        { toolCallId: 't1', messages: [], abortSignal: undefined as any },
      );
      expect(result.success).toBe(false);
      expect((result as any).error).toMatch(/dynamic code execution/);
    });

    it('blocks storage patterns in content', async () => {
      const { writeFile } = createTools(session, config);
      const result = await writeFile.execute(
        { path: 'src/games/my-game/index.ts', content: `localStorage.setItem('x','y');` },
        { toolCallId: 't1', messages: [], abortSignal: undefined as any },
      );
      expect(result.success).toBe(false);
      expect((result as any).error).toMatch(/browser storage/);
    });

    it('blocks when maxFiles limit reached for new file', async () => {
      config.maxFiles = 2;
      session.files['src/games/my-game/a.ts'] = 'a';
      session.files['src/games/my-game/b.ts'] = 'b';
      const { writeFile } = createTools(session, config);
      const result = await writeFile.execute(
        { path: 'src/games/my-game/c.ts', content: 'c' },
        { toolCallId: 't1', messages: [], abortSignal: undefined as any },
      );
      expect(result.success).toBe(false);
      expect((result as any).error).toMatch(/File limit reached/);
    });

    it('allows overwriting existing file even at maxFiles limit', async () => {
      config.maxFiles = 2;
      session.files['src/games/my-game/a.ts'] = 'a';
      session.files['src/games/my-game/b.ts'] = 'b';
      const { writeFile } = createTools(session, config);
      const result = await writeFile.execute(
        { path: 'src/games/my-game/a.ts', content: 'updated a' },
        { toolCallId: 't1', messages: [], abortSignal: undefined as any },
      );
      expect(result.success).toBe(true);
      expect(session.files['src/games/my-game/a.ts']).toBe('updated a');
    });
  });

  describe('patchFile', () => {
    it('replaces text and returns full patched content', async () => {
      session.files['src/games/my-game/index.ts'] = `const x = 42;\nconst y = 99;`;
      const { patchFile } = createTools(session, config);
      const result = await patchFile.execute(
        {
          path: 'src/games/my-game/index.ts',
          old_text: 'const y = 99;',
          new_text: 'const y = 100;',
        },
        { toolCallId: 't1', messages: [], abortSignal: undefined as any },
      );
      expect(result.success).toBe(true);
      expect((result as any).content).toBe('const x = 42;\nconst y = 100;');
      expect(session.files['src/games/my-game/index.ts']).toBe('const x = 42;\nconst y = 100;');
    });

    it('fails on missing file', async () => {
      const { patchFile } = createTools(session, config);
      const result = await patchFile.execute(
        {
          path: 'src/games/my-game/index.ts',
          old_text: 'const x = 42;',
          new_text: 'const x = 99;',
        },
        { toolCallId: 't1', messages: [], abortSignal: undefined as any },
      );
      expect(result.success).toBe(false);
      expect((result as any).error).toMatch(/File not found/);
    });

    it('fails on 0 matches', async () => {
      session.files['src/games/my-game/index.ts'] = 'const x = 42;';
      const { patchFile } = createTools(session, config);
      const result = await patchFile.execute(
        {
          path: 'src/games/my-game/index.ts',
          old_text: 'const y = 99;',
          new_text: 'const y = 100;',
        },
        { toolCallId: 't1', messages: [], abortSignal: undefined as any },
      );
      expect(result.success).toBe(false);
      expect((result as any).error).toMatch(/old_text not found/);
    });

    it('fails on 2+ matches', async () => {
      session.files['src/games/my-game/index.ts'] = 'const x = 42;\nconst x = 42;';
      const { patchFile } = createTools(session, config);
      const result = await patchFile.execute(
        {
          path: 'src/games/my-game/index.ts',
          old_text: 'const x = 42;',
          new_text: 'const x = 99;',
        },
        { toolCallId: 't1', messages: [], abortSignal: undefined as any },
      );
      expect(result.success).toBe(false);
      expect((result as any).error).toMatch(/matches 2 times/);
    });

    it('blocks patterns in patched result (import())', async () => {
      session.files['src/games/my-game/index.ts'] = 'const x = 42;\nconst y = 99;';
      const { patchFile } = createTools(session, config);
      const result = await patchFile.execute(
        {
          path: 'src/games/my-game/index.ts',
          old_text: 'const y = 99;',
          new_text: `const y = await import('./evil.ts');`,
        },
        { toolCallId: 't1', messages: [], abortSignal: undefined as any },
      );
      expect(result.success).toBe(false);
      expect((result as any).error).toMatch(/import\(/);
    });

    it('blocks patterns in patched result (eval)', async () => {
      session.files['src/games/my-game/index.ts'] = 'const x = 42;\nconst y = 99;';
      const { patchFile } = createTools(session, config);
      const result = await patchFile.execute(
        {
          path: 'src/games/my-game/index.ts',
          old_text: 'const y = 99;',
          new_text: `const y = eval('1+1');`,
        },
        { toolCallId: 't1', messages: [], abortSignal: undefined as any },
      );
      expect(result.success).toBe(false);
      expect((result as any).error).toMatch(/eval\(/);
    });

    it('blocks oversized patched result', async () => {
      config.maxFileSize = 50;
      session.files['src/games/my-game/index.ts'] = 'const x = 42;';
      const { patchFile } = createTools(session, config);
      const result = await patchFile.execute(
        {
          path: 'src/games/my-game/index.ts',
          old_text: 'const x = 42;',
          new_text: 'x'.repeat(60),
        },
        { toolCallId: 't1', messages: [], abortSignal: undefined as any },
      );
      expect(result.success).toBe(false);
      expect((result as any).error).toMatch(/File too large/);
    });

    it('blocks bad path on patch', async () => {
      const { patchFile } = createTools(session, config);
      const result = await patchFile.execute(
        {
          path: '../etc/passwd',
          old_text: 'x',
          new_text: 'y',
        },
        { toolCallId: 't1', messages: [], abortSignal: undefined as any },
      );
      expect(result.success).toBe(false);
      expect((result as any).error).toMatch(/directory traversal/);
    });

    it('allows a legitimate edit', async () => {
      session.files['src/games/my-game/index.ts'] = `this.clear('#FEF0E4');`;
      const { patchFile } = createTools(session, config);
      const result = await patchFile.execute(
        {
          path: 'src/games/my-game/index.ts',
          old_text: `this.clear('#FEF0E4');`,
          new_text: `this.clear('#1a1a2e');`,
        },
        { toolCallId: 't1', messages: [], abortSignal: undefined as any },
      );
      expect(result.success).toBe(true);
      expect((result as any).content).toBe(`this.clear('#1a1a2e');`);
    });
  });

  describe('addDependency', () => {
    it('adds an allowed dependency', async () => {
      const { addDependency } = createTools(session, config);
      const result = await addDependency.execute(
        { name: 'matter-js', version: '^0.19.0' },
        { toolCallId: 't1', messages: [], abortSignal: undefined as any },
      );
      expect(result).toEqual({ success: true, name: 'matter-js', version: '^0.19.0' });
      expect(session.dependencies['matter-js']).toBe('^0.19.0');
    });

    it('defaults version to "latest" if not provided', async () => {
      const { addDependency } = createTools(session, config);
      const result = await addDependency.execute(
        { name: 'howler' },
        { toolCallId: 't1', messages: [], abortSignal: undefined as any },
      );
      expect(result).toEqual({ success: true, name: 'howler', version: 'latest' });
      expect(session.dependencies['howler']).toBe('latest');
    });

    it('blocks a disallowed dependency', async () => {
      const { addDependency } = createTools(session, config);
      const result = await addDependency.execute(
        { name: 'axios', version: '^1.0.0' },
        { toolCallId: 't1', messages: [], abortSignal: undefined as any },
      );
      expect(result.success).toBe(false);
      expect((result as any).error).toMatch(/not allowed/);
      expect(session.dependencies['axios']).toBeUndefined();
    });
  });
});
