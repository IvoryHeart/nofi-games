import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { CoreMessage } from 'ai';

export interface PromptContext {
  systemPrompt: string;
  engineApiDocs: string;
  sessionContext: string;
}

// Use import.meta.url so Vercel's @vercel/nft traces the prompt files
// into the serverless function bundle. process.cwd() is not traced.
const _dir = typeof __dirname !== 'undefined'
  ? __dirname
  : dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = resolve(_dir, '../../../../prompts');

export function loadStaticPrompts(): {
  systemPrompt: string;
  engineApiDocs: string;
} {
  const systemPrompt = readFileSync(
    resolve(PROMPTS_DIR, 'game-builder.md'),
    'utf-8',
  );
  const engineApiDocs = readFileSync(
    resolve(PROMPTS_DIR, 'engine-api.md'),
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
