import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { CoreMessage } from 'ai';

export interface PromptContext {
  systemPrompt: string;
  engineApiDocs: string;
  sessionContext: string;
}

export function loadStaticPrompts(): {
  systemPrompt: string;
  engineApiDocs: string;
} {
  const root = process.cwd();
  const systemPrompt = readFileSync(
    resolve(root, 'prompts/game-builder.md'),
    'utf-8',
  );
  const engineApiDocs = readFileSync(
    resolve(root, 'prompts/engine-api.md'),
    'utf-8',
  );
  return { systemPrompt, engineApiDocs };
}

const CACHE_BREAKPOINT = {
  anthropic: { cacheControl: { type: 'ephemeral' as const } },
};

export function buildMessages(opts: {
  systemPrompt: string;
  engineApiDocs: string;
  sessionContext: string;
  chatHistory: CoreMessage[];
}): CoreMessage[] {
  const { systemPrompt, engineApiDocs, sessionContext, chatHistory } = opts;

  const messages: CoreMessage[] = [];

  const systemContent = sessionContext
    ? `${systemPrompt}\n\n${engineApiDocs}\n\n${sessionContext}`
    : `${systemPrompt}\n\n${engineApiDocs}`;

  messages.push({
    role: 'system',
    content: systemContent,
    experimental_providerMetadata: CACHE_BREAKPOINT,
  } as CoreMessage);

  messages.push(...chatHistory);

  return messages;
}
