import type { VercelRequest, VercelResponse } from '@vercel/node';
import { streamText, StreamData, type JSONValue } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { CoreMessage } from 'ai';
import { createTools } from '../src/builder/lib/harness/tools.js';
import {
  createSession,
  getSessionContext,
  getChangedFiles,
  addBuildLogEntry,
} from '../src/builder/lib/harness/session.js';
import type { PendingCommit, BuildLogEntry } from '../src/builder/lib/harness/session.js';
import { DEFAULT_CONFIG } from '../src/builder/lib/harness/config.js';
import { loadStaticPrompts, buildMessages } from '../src/builder/lib/harness/prompt-cache.js';
import { createGitHubClient, loadBranchFiles } from '../src/builder/lib/harness/github-app.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, sessionId, branch, byokKey } = req.body as {
      messages: CoreMessage[];
      sessionId: string;
      branch: string;
      byokKey?: string;
    };

    if (!messages || !sessionId || !branch) {
      return res.status(400).json({
        error: 'Missing required fields: messages, sessionId, branch',
      });
    }

    const provider = byokKey
      ? createOpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: byokKey })
      : anthropic;

    const modelId = byokKey
      ? 'anthropic/claude-sonnet-4-20250514'
      : 'claude-sonnet-4-20250514';

    const model = provider(modelId);

    const octokit = createGitHubClient();
    const branchFiles = await loadBranchFiles(octokit, { branch });

    const session = createSession(branch);
    for (const [path, content] of Object.entries(branchFiles)) {
      if (path.startsWith('src/games/') || path === '.build-log.json') {
        session.files[path] = content;
      }
    }

    const buildLogContent = branchFiles['.build-log.json'];
    if (buildLogContent) {
      try {
        const parsed = JSON.parse(buildLogContent) as BuildLogEntry[];
        session.buildLog = parsed;
        session.turnCount = parsed.length;
      } catch {
        // Malformed build log — start fresh
      }
    }

    if (session.turnCount >= DEFAULT_CONFIG.maxTurns) {
      return res.status(429).json({ error: 'Session turn limit reached' });
    }

    const originalFiles = { ...session.files };

    const config = { ...DEFAULT_CONFIG };
    const tools = createTools(session, config);
    const { systemPrompt, engineApiDocs } = loadStaticPrompts();
    const sessionContext = getSessionContext(session);

    const allMessages = buildMessages({
      systemPrompt,
      engineApiDocs,
      sessionContext,
      chatHistory: messages,
    });

    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    const promptSummary =
      typeof lastUserMessage?.content === 'string'
        ? lastUserMessage.content.slice(0, 200)
        : 'user message';

    const streamData = new StreamData();

    const result = streamText({
      model,
      messages: allMessages,
      tools,
      maxSteps: 10,
      maxRetries: 5,
      onFinish: async () => {
        try {
          const changedFiles = getChangedFiles(session, originalFiles);
          const filesChanged = Object.keys(changedFiles);

          if (filesChanged.length > 0) {
            addBuildLogEntry(session, {
              contributor: sessionId,
              prompt: promptSummary,
              filesChanged,
            });

            const updatedBuildLog = [...session.buildLog];
            changedFiles['.build-log.json'] = JSON.stringify(updatedBuildLog, null, 2);

            const commitMessage = `Build turn ${session.turnCount}: ${promptSummary.slice(0, 72)}`;

            const pendingCommit: PendingCommit = {
              files: changedFiles,
              buildLog: updatedBuildLog,
              message: commitMessage,
              coAuthor: sessionId,
            };

            streamData.appendMessageAnnotation({
              type: 'pending_commit',
              pendingCommit: pendingCommit as unknown as JSONValue,
            } as unknown as JSONValue);
          }
        } finally {
          await streamData.close();
        }
      },
    });

    result.pipeDataStreamToResponse(res, { data: streamData });
  } catch (err) {
    const status = (err as { status?: number }).status || 500;
    if (!res.headersSent) {
      res.status(status).json({ error: 'Internal server error' });
    }
  }
}
