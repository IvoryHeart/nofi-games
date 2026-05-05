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
    const { branch: resumeBranch, remixBranch, gameId } = (req.body || {}) as {
      branch?: string;
      remixBranch?: string;
      gameId?: string;
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

        // Only return game files if the builder actually wrote something.
        // Without this check, a branch freshly created from main would return
        // ALL 17 inherited games — none of which have the entry point the
        // Sandpack bootstrap expects.
        const hasBuilderChanges = buildLog && buildLog.length > 0;

        return res.status(200).json({
          sessionId,
          branch: resumeBranch,
          files: hasBuilderChanges ? files : undefined,
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

    // Remix a specific game: load its source files from main
    if (gameId) {
      const gamePrefix = `src/games/${gameId}/`;
      const gameBranchFiles = await loadBranchFiles(octokit, {
        branch: 'main',
        pathPrefix: gamePrefix,
      });

      const gameFiles: Record<string, string> = {};
      let mainFileName: string | undefined;

      for (const [fullPath, content] of Object.entries(gameBranchFiles)) {
        const fileName = fullPath.slice(gamePrefix.length);
        gameFiles[fileName] = content;
        if (!mainFileName && content.includes('registerGame(')) {
          mainFileName = fileName;
        }
      }

      if (!mainFileName) {
        mainFileName = Object.keys(gameFiles)[0];
      }

      return res.status(200).json({
        sessionId,
        branch: branchName,
        gameFiles,
        mainFileName,
      });
    }

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
