import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createGitHubClient, createBranch, loadBranchFiles, resolveOwnerRepo } from '../../src/builder/lib/harness/github-app.js';
import type { BuildLogEntry } from '../../src/builder/lib/harness/session.js';

const BRANCH_PREFIX = 'socialvibing/';

const REQUIRED_ENV = ['GITHUB_APP_ID', 'GITHUB_APP_PRIVATE_KEY_BASE64', 'GITHUB_APP_INSTALLATION_ID'];

function isSocialVibingBranch(branch: string): boolean {
  return branch.startsWith(BRANCH_PREFIX);
}

function filterGameFiles(allFiles: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [path, content] of Object.entries(allFiles)) {
    if (path.startsWith('src/games/') || path === '.build-log.json') {
      result[path] = content;
    }
  }
  return result;
}

function parseBuildLog(files: Record<string, string>): BuildLogEntry[] | undefined {
  const raw = files['.build-log.json'];
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as BuildLogEntry[];
  } catch {
    return undefined;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    return res.status(503).json({
      error: `Builder not configured. Missing env: ${missing.join(', ')}`,
    });
  }

  try {
    const { branch: resumeBranch, remixBranch } = (req.body || {}) as {
      branch?: string;
      remixBranch?: string;
    };

    if (remixBranch && !isSocialVibingBranch(remixBranch)) {
      return res.status(403).json({ error: 'Can only remix from socialvibing branches' });
    }

    const octokit = createGitHubClient();

    // Resume an existing session
    if (resumeBranch && isSocialVibingBranch(resumeBranch)) {
      try {
        const allFiles = await loadBranchFiles(octokit, { branch: resumeBranch });
        const files = filterGameFiles(allFiles);
        const buildLog = parseBuildLog(files);
        const sessionId = resumeBranch.split('-').slice(-2).join('-') || `${Date.now()}`;
        return res.status(200).json({
          sessionId,
          branch: resumeBranch,
          files: Object.keys(files).length > 0 ? files : undefined,
          buildLog,
        });
      } catch {
        // Branch doesn't exist or was deleted — fall through to create a new one
      }
    }

    const { repo: repoName } = await resolveOwnerRepo(octokit);

    const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const branchName = `${BRANCH_PREFIX}${repoName}-${sessionId}`;

    const baseBranch = remixBranch || 'main';
    await createBranch(octokit, { branchName, baseBranch });

    let files: Record<string, string> | undefined;
    let buildLog: BuildLogEntry[] | undefined;

    if (remixBranch) {
      const allFiles = await loadBranchFiles(octokit, { branch: remixBranch });
      files = filterGameFiles(allFiles);
      buildLog = parseBuildLog(allFiles);
    }

    return res.status(200).json({
      sessionId,
      branch: branchName,
      files: files && Object.keys(files).length > 0 ? files : undefined,
      buildLog,
    });
  } catch (err) {
    const message = (err as Error).message || 'Internal server error';
    const status = (err as { status?: number }).status || 500;
    return res.status(status).json({ error: message });
  }
}
