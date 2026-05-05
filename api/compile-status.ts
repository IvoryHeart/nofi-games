import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createGitHubClient, batchCommit } from '../src/builder/lib/harness/github-app.js';
import type { FileToCommit } from '../src/builder/lib/harness/github-app.js';
import { assertPathAllowed } from '../src/builder/lib/harness/validators.js';
import { DEFAULT_CONFIG } from '../src/builder/lib/harness/config.js';

interface CompileStatusBody {
  sessionId: string;
  branch: string;
  hasErrors: boolean;
  errors?: string[];
  pendingFiles?: Record<string, string>;
  commitMessage?: string;
  coAuthor?: string;
}

function isSocialVibingBranch(branch: string): boolean {
  return branch.startsWith('socialvibing/');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      sessionId,
      branch,
      hasErrors,
      errors,
      pendingFiles,
      commitMessage,
      coAuthor,
    } = req.body as CompileStatusBody;

    if (!sessionId || !branch) {
      return res.status(400).json({ error: 'Missing required fields: sessionId, branch' });
    }

    if (!isSocialVibingBranch(branch)) {
      return res.status(403).json({ error: 'Commits only allowed to socialvibing branches' });
    }

    if (hasErrors) {
      return res.status(200).json({
        committed: false,
        reason: 'compile_errors',
        errors: errors || [],
      });
    }

    if (!pendingFiles || Object.keys(pendingFiles).length === 0) {
      return res.status(200).json({
        committed: false,
        reason: 'no_changes',
      });
    }

    for (const path of Object.keys(pendingFiles)) {
      if (path !== '.build-log.json') {
        try {
          assertPathAllowed(path, DEFAULT_CONFIG.allowedPaths);
        } catch {
          return res.status(403).json({ error: `Path not allowed: ${path}` });
        }
      }
    }

    const octokit = createGitHubClient();

    const files: FileToCommit[] = Object.entries(pendingFiles).map(([path, content]) => ({
      path,
      content,
    }));

    const result = await batchCommit(octokit, {
      branch,
      files,
      message: commitMessage || `Build update from ${sessionId}`,
      coAuthor: coAuthor || null,
    });

    return res.status(200).json({
      committed: true,
      sha: result.sha,
      filesCommitted: files.length,
    });
  } catch (err) {
    const status = (err as { status?: number }).status || 500;
    return res.status(status).json({ error: 'Internal server error' });
  }
}
