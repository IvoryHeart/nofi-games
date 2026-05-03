import { describe, it, expect } from 'vitest';
import { loadStaticPrompts, buildMessages } from '../../../src/builder/lib/harness/prompt-cache';
import type { CoreMessage } from 'ai';

describe('prompt-cache', () => {
  describe('loadStaticPrompts', () => {
    it('reads both prompt files and returns non-empty strings', () => {
      const result = loadStaticPrompts();
      expect(typeof result.systemPrompt).toBe('string');
      expect(result.systemPrompt.length).toBeGreaterThan(100);
      expect(typeof result.engineApiDocs).toBe('string');
      expect(result.engineApiDocs.length).toBeGreaterThan(100);
    });

    it('system prompt contains game builder instructions', () => {
      const { systemPrompt } = loadStaticPrompts();
      expect(systemPrompt).toContain('GameEngine');
    });

    it('engine API docs contain method documentation', () => {
      const { engineApiDocs } = loadStaticPrompts();
      expect(engineApiDocs).toContain('GameEngine');
    });
  });

  describe('buildMessages', () => {
    it('creates system message with cache breakpoint', () => {
      const messages = buildMessages({
        systemPrompt: 'You are a game builder.',
        engineApiDocs: 'API docs here.',
        sessionContext: '',
        chatHistory: [],
      });

      const systemMsg = messages[0];
      expect(systemMsg.role).toBe('system');
      expect((systemMsg as any).content).toBe('You are a game builder.\n\nAPI docs here.');
      expect((systemMsg as any).experimental_providerMetadata).toEqual({
        anthropic: { cacheControl: { type: 'ephemeral' } },
      });
    });

    it('includes session context in system message', () => {
      const messages = buildMessages({
        systemPrompt: 'sys',
        engineApiDocs: 'api',
        sessionContext: 'Build log and files',
        chatHistory: [],
      });

      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('system');
      expect((messages[0] as any).content).toBe('sys\n\napi\n\nBuild log and files');
    });

    it('appends chat history after system message', () => {
      const chatHistory: CoreMessage[] = [
        { role: 'user', content: 'Add a snake game' },
        { role: 'assistant', content: 'Sure, creating it now.' },
      ];

      const messages = buildMessages({
        systemPrompt: 'sys',
        engineApiDocs: 'api',
        sessionContext: 'ctx',
        chatHistory,
      });

      expect(messages).toHaveLength(3);
      expect(messages[1]).toEqual({ role: 'user', content: 'Add a snake game' });
      expect(messages[2]).toEqual({ role: 'assistant', content: 'Sure, creating it now.' });
    });

    it('no consecutive user messages when session context and user-first chat history', () => {
      const messages = buildMessages({
        systemPrompt: 'sys',
        engineApiDocs: 'api',
        sessionContext: 'session data',
        chatHistory: [{ role: 'user', content: 'hello' }],
      });

      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');
      expect((messages[1] as any).content).toBe('hello');
    });

    it('works with empty chat history and session context', () => {
      const messages = buildMessages({
        systemPrompt: 'sys',
        engineApiDocs: 'api',
        sessionContext: 'ctx',
        chatHistory: [],
      });

      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('system');
    });

    it('works with empty session context and empty chat history', () => {
      const messages = buildMessages({
        systemPrompt: 'sys',
        engineApiDocs: 'api',
        sessionContext: '',
        chatHistory: [],
      });

      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('system');
      expect((messages[0] as any).content).toBe('sys\n\napi');
    });

    it('preserves chat history message order', () => {
      const chatHistory: CoreMessage[] = [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'second' },
        { role: 'user', content: 'third' },
      ];

      const messages = buildMessages({
        systemPrompt: 'sys',
        engineApiDocs: 'api',
        sessionContext: '',
        chatHistory,
      });

      expect(messages[1].role).toBe('user');
      expect((messages[1] as any).content).toBe('first');
      expect(messages[2].role).toBe('assistant');
      expect((messages[2] as any).content).toBe('second');
      expect(messages[3].role).toBe('user');
      expect((messages[3] as any).content).toBe('third');
    });
  });
});
