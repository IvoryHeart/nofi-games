import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createGitHubClient, createBranch, loadBranchFiles, resolveOwnerRepo } from '../../src/builder/lib/harness/github-app.js';
import type { BuildLogEntry } from '../../src/builder/lib/harness/session.js';

const BRANCH_PREFIX = 'socialvibing/';

function isSocialVibingBranch(branch: string): boolean {
  return branch.startsWith(BRANCH_PREFIX);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { remixBranch } = (req.body || {}) as { remixBranch?: string };

    if (remixBranch && !isSocialVibingBranch(remixBranch)) {
      return res.status(403).json({ error: 'Can only remix from socialvibing branches' });
    }

    const octokit = createGitHubClient();
    const { repo: repoName } = await resolveOwnerRepo(octokit);

    const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const branchName = `${BRANCH_PREFIX}${repoName}-${sessionId}`;

    const baseBranch = remixBranch || 'main';
    await createBranch(octokit, { branchName, baseBranch });

    let files: Record<string, string> | undefined;
    let buildLog: BuildLogEntry[] | undefined;

    if (remixBranch) {
      files = await loadBranchFiles(octokit, { branch: remixBranch });

      const buildLogContent = files['.build-log.json'];
      if (buildLogContent) {
        try {
          buildLog = JSON.parse(buildLogContent) as BuildLogEntry[];
        } catch {
          // Malformed build log — ignore
        }
      }
    }

    return res.status(200).json({
      sessionId,
      branch: branchName,
      files: files || undefined,
      buildLog: buildLog || undefined,
    });
  } catch (err) {
    const status = (err as { status?: number }).status || 500;
    return res.status(status).json({ error: 'Internal server error' });
  }
}
