import { tool } from 'ai';
import { z } from 'zod';
import type { BuilderSession } from './session.js';
import type { BuilderConfig } from './config.js';
import {
  assertPathAllowed,
  assertFileSize,
  assertNoBlockedPatterns,
  assertFileExists,
  assertExactlyOneMatch,
  assertDependencyAllowed,
} from './validators.js';

export function createTools(session: BuilderSession, config: BuilderConfig) {
  const writeFile = tool({
    description:
      'Write or replace an entire game file. Use for new files or full rewrites. For small changes to existing files, prefer patchFile.',
    parameters: z.object({
      path: z.string().describe('File path relative to the game folder (e.g., "src/games/my-game/index.ts")'),
      content: z.string().describe('Complete file content (TypeScript)'),
    }),
    execute: async ({ path, content }) => {
      try {
        assertPathAllowed(path, config.allowedPaths);
        assertFileSize(content, config.maxFileSize);
        assertNoBlockedPatterns(content);
        if (!(path in session.files) && Object.keys(session.files).length >= config.maxFiles) {
          throw new Error(`File limit reached (max ${config.maxFiles}). Delete or reuse existing files.`);
        }
        session.files[path] = content;
        return { success: true as const, path, content, size: content.length };
      } catch (err) {
        return { success: false as const, error: (err as Error).message };
      }
    },
  });

  const patchFile = tool({
    description:
      'Make a targeted edit to an existing game file. Finds old_text and replaces it with new_text. The old_text must appear exactly once in the file.',
    parameters: z.object({
      path: z.string().describe('File path relative to the game folder (must already exist)'),
      old_text: z.string().describe('Exact text to find in the file (must match exactly once)'),
      new_text: z.string().describe('Replacement text'),
    }),
    execute: async ({ path, old_text, new_text }) => {
      try {
        assertPathAllowed(path, config.allowedPaths);
        assertFileExists(path, session.files);
        assertExactlyOneMatch(session.files[path], old_text);

        const patched = session.files[path].replace(old_text, new_text);

        assertFileSize(patched, config.maxFileSize);
        assertNoBlockedPatterns(patched);

        session.files[path] = patched;
        return { success: true as const, path, content: patched, size: patched.length };
      } catch (err) {
        return { success: false as const, error: (err as Error).message };
      }
    },
  });

  const addDependency = tool({
    description: `Add an npm dependency. Only allowed: ${config.allowedDependencies.join(', ')}.`,
    parameters: z.object({
      name: z.string().describe('Package name (e.g., "matter-js")'),
      version: z.string().optional().describe('Semver version (e.g., "^0.19.0"). Defaults to "latest".'),
    }),
    execute: async ({ name, version }) => {
      try {
        assertDependencyAllowed(name, config.allowedDependencies);
        const resolvedVersion = version || 'latest';
        session.dependencies[name] = resolvedVersion;
        return { success: true as const, name, version: resolvedVersion };
      } catch (err) {
        return { success: false as const, error: (err as Error).message };
      }
    },
  });

  return { writeFile, patchFile, addDependency };
}
