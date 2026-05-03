import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';

// ── Types ───────────────────────────────────────────────────────────────────────

export interface FileToCommit {
  path: string;
  content: string;
}

export interface CommitResult {
  sha: string;
  apiCalls: number;
}

// ── Retry helper ────────────────────────────────────────────────────────────────

async function retry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 1000): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      const isTransient =
        e.status === 500 ||
        e.message?.includes('ECONNRESET') ||
        e.message?.includes('ETIMEDOUT') ||
        e.message?.includes('fetch failed');
      if (!isTransient || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** i));
    }
  }
  throw new Error('unreachable');
}

// ── Env helpers ─────────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function defaultOwnerRepo(opts: { owner?: string; repo?: string }): { owner: string; repo: string } {
  return {
    owner: opts.owner ?? requireEnv('GITHUB_OWNER'),
    repo: opts.repo ?? requireEnv('GITHUB_REPO'),
  };
}

// ── Client ──────────────────────────────────────────────────────────────────────

export function createGitHubClient(): Octokit {
  const appId = Number(requireEnv('GITHUB_APP_ID'));
  const privateKeyBase64 = requireEnv('GITHUB_APP_PRIVATE_KEY_BASE64');
  const installationId = Number(requireEnv('GITHUB_APP_INSTALLATION_ID'));
  const privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf8');

  return new Octokit({
    authStrategy: createAppAuth,
    auth: { appId, privateKey, installationId },
  });
}

// ── Branch operations ───────────────────────────────────────────────────────────

export async function createBranch(
  octokit: Octokit,
  opts: { owner?: string; repo?: string; branchName: string; baseBranch?: string },
): Promise<string> {
  const { owner, repo } = defaultOwnerRepo(opts);
  const base = opts.baseBranch ?? 'main';

  const { data: ref } = await retry(() =>
    octokit.rest.git.getRef({ owner, repo, ref: `heads/${base}` }),
  );
  const baseSha = ref.object.sha;

  await retry(() =>
    octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${opts.branchName}`,
      sha: baseSha,
    }),
  );

  return baseSha;
}

export async function deleteBranch(
  octokit: Octokit,
  opts: { owner?: string; repo?: string; branchName: string },
): Promise<void> {
  const { owner, repo } = defaultOwnerRepo(opts);
  await retry(() =>
    octokit.rest.git.deleteRef({ owner, repo, ref: `heads/${opts.branchName}` }),
  );
}

// ── Batch commit ────────────────────────────────────────────────────────────────

export async function batchCommit(
  octokit: Octokit,
  opts: {
    owner?: string;
    repo?: string;
    branch: string;
    files: FileToCommit[];
    message: string;
    coAuthor?: string | null;
  },
): Promise<CommitResult> {
  const { owner, repo } = defaultOwnerRepo(opts);

  const doCommit = async (): Promise<CommitResult> => {
    let apiCalls = 0;

    // 1. Get current ref
    const { data: ref } = await retry(() =>
      octokit.rest.git.getRef({ owner, repo, ref: `heads/${opts.branch}` }),
    );
    apiCalls++;
    const currentSha = ref.object.sha;

    // 2. Get base tree
    const { data: commit } = await retry(() =>
      octokit.rest.git.getCommit({ owner, repo, commit_sha: currentSha }),
    );
    apiCalls++;

    // 3. Create blobs in parallel
    const treeItems = await Promise.all(
      opts.files.map(async (file) => {
        const { data: blob } = await retry(() =>
          octokit.rest.git.createBlob({ owner, repo, content: file.content, encoding: 'utf-8' }),
        );
        apiCalls++;
        return {
          path: file.path,
          mode: '100644' as const,
          type: 'blob' as const,
          sha: blob.sha,
        };
      }),
    );

    // 4. Create tree
    const { data: newTree } = await retry(() =>
      octokit.rest.git.createTree({ owner, repo, base_tree: commit.tree.sha, tree: treeItems }),
    );
    apiCalls++;

    // 5. Create commit
    const message = opts.coAuthor
      ? `${opts.message}\n\nCo-authored-by: ${opts.coAuthor}`
      : opts.message;

    const { data: newCommit } = await retry(() =>
      octokit.rest.git.createCommit({
        owner,
        repo,
        message,
        tree: newTree.sha,
        parents: [currentSha],
      }),
    );
    apiCalls++;

    // 6. Update ref (compare-and-swap)
    await octokit.rest.git.updateRef({
      owner,
      repo,
      ref: `heads/${opts.branch}`,
      sha: newCommit.sha,
      force: false,
    });
    apiCalls++;

    return { sha: newCommit.sha, apiCalls };
  };

  // Retry once on 422 (stale SHA)
  try {
    return await doCommit();
  } catch (err: unknown) {
    const e = err as { status?: number };
    if (e.status === 422) {
      return await doCommit();
    }
    throw err;
  }
}

// ── Submit branch ───────────────────────────────────────────────────────────────

export async function createSubmitBranch(
  octokit: Octokit,
  opts: { owner?: string; repo?: string; sourceBranch: string; submitBranch: string },
): Promise<string> {
  const { owner, repo } = defaultOwnerRepo(opts);

  // Get source branch tip
  const { data: ref } = await retry(() =>
    octokit.rest.git.getRef({ owner, repo, ref: `heads/${opts.sourceBranch}` }),
  );
  const tipSha = ref.object.sha;

  // Create the submit branch at the same point
  await retry(() =>
    octokit.rest.git.createRef({ owner, repo, ref: `refs/heads/${opts.submitBranch}`, sha: tipSha }),
  );

  // Get full tree recursively
  const { data: tipCommit } = await retry(() =>
    octokit.rest.git.getCommit({ owner, repo, commit_sha: tipSha }),
  );

  const { data: fullTree } = await retry(() =>
    octokit.rest.git.getTree({ owner, repo, tree_sha: tipCommit.tree.sha, recursive: 'true' }),
  );

  // Filter out .build-log.json, keep only blobs
  const filteredTree = fullTree.tree
    .filter((item) => item.type === 'blob' && !item.path!.endsWith('.build-log.json'))
    .map((item) => ({
      path: item.path!,
      mode: item.mode as '100644',
      type: 'blob' as const,
      sha: item.sha!,
    }));

  // Create clean tree (no base_tree — full replacement)
  const { data: newTree } = await retry(() =>
    octokit.rest.git.createTree({ owner, repo, tree: filteredTree }),
  );

  // Create commit on the submit branch
  const { data: newCommit } = await retry(() =>
    octokit.rest.git.createCommit({
      owner,
      repo,
      message: 'Remove .build-log.json for submission',
      tree: newTree.sha,
      parents: [tipSha],
    }),
  );

  // Advance the submit branch
  await retry(() =>
    octokit.rest.git.updateRef({
      owner,
      repo,
      ref: `heads/${opts.submitBranch}`,
      sha: newCommit.sha,
      force: false,
    }),
  );

  return newCommit.sha;
}

// ── Pull request ────────────────────────────────────────────────────────────────

export async function openPR(
  octokit: Octokit,
  opts: {
    owner?: string;
    repo?: string;
    head: string;
    base: string;
    title: string;
    body: string;
  },
): Promise<{ number: number; url: string }> {
  const { owner, repo } = defaultOwnerRepo(opts);

  const { data } = await retry(() =>
    octokit.rest.pulls.create({
      owner,
      repo,
      title: opts.title,
      head: opts.head,
      base: opts.base,
      body: opts.body,
    }),
  );

  return { number: data.number, url: data.html_url };
}

// ── Load branch files ───────────────────────────────────────────────────────────

export async function loadBranchFiles(
  octokit: Octokit,
  opts: { owner?: string; repo?: string; branch: string; pathPrefix?: string },
): Promise<Record<string, string>> {
  const { owner, repo } = defaultOwnerRepo(opts);

  const { data: ref } = await retry(() =>
    octokit.rest.git.getRef({ owner, repo, ref: `heads/${opts.branch}` }),
  );

  const { data: commit } = await retry(() =>
    octokit.rest.git.getCommit({ owner, repo, commit_sha: ref.object.sha }),
  );

  const { data: tree } = await retry(() =>
    octokit.rest.git.getTree({ owner, repo, tree_sha: commit.tree.sha, recursive: 'true' }),
  );

  const blobs = tree.tree.filter((item) => {
    if (item.type !== 'blob') return false;
    if (opts.pathPrefix && !item.path!.startsWith(opts.pathPrefix)) return false;
    return true;
  });

  const files: Record<string, string> = {};

  const results = await Promise.all(
    blobs.map(async (item) => {
      const { data: blob } = await retry(() =>
        octokit.rest.git.getBlob({ owner, repo, file_sha: item.sha! }),
      );
      const content =
        blob.encoding === 'base64'
          ? Buffer.from(blob.content, 'base64').toString('utf8')
          : blob.content;
      return { path: item.path!, content };
    }),
  );

  for (const { path, content } of results) {
    files[path] = content;
  }

  return files;
}
