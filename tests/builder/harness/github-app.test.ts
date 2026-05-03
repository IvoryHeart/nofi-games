import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@octokit/rest', () => {
  return {
    Octokit: vi.fn(),
  };
});

vi.mock('@octokit/auth-app', () => {
  return {
    createAppAuth: vi.fn(),
  };
});

import {
  createGitHubClient,
  createBranch,
  batchCommit,
  createSubmitBranch,
  loadBranchFiles,
} from '../../../src/builder/lib/harness/github-app';
import { Octokit } from '@octokit/rest';

function mockOctokit(overrides: Record<string, any> = {}) {
  return {
    rest: {
      git: {
        getRef: vi.fn(),
        createRef: vi.fn(),
        deleteRef: vi.fn(),
        getCommit: vi.fn(),
        createBlob: vi.fn(),
        createTree: vi.fn(),
        createCommit: vi.fn(),
        updateRef: vi.fn(),
        getTree: vi.fn(),
        getBlob: vi.fn(),
      },
      pulls: {
        create: vi.fn(),
      },
      ...overrides,
    },
  } as unknown as Octokit;
}

describe('github-app', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('createGitHubClient', () => {
    it('reads env vars correctly', () => {
      process.env.GITHUB_APP_ID = '12345';
      process.env.GITHUB_APP_PRIVATE_KEY_BASE64 = Buffer.from('fake-key').toString('base64');
      process.env.GITHUB_APP_INSTALLATION_ID = '67890';

      const client = createGitHubClient();
      expect(Octokit).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: expect.objectContaining({
            appId: 12345,
            installationId: 67890,
          }),
        }),
      );
    });

    it('throws on missing GITHUB_APP_ID', () => {
      delete process.env.GITHUB_APP_ID;
      process.env.GITHUB_APP_PRIVATE_KEY_BASE64 = Buffer.from('key').toString('base64');
      process.env.GITHUB_APP_INSTALLATION_ID = '1';
      expect(() => createGitHubClient()).toThrow(/Missing required env var: GITHUB_APP_ID/);
    });

    it('throws on missing GITHUB_APP_PRIVATE_KEY_BASE64', () => {
      process.env.GITHUB_APP_ID = '1';
      delete process.env.GITHUB_APP_PRIVATE_KEY_BASE64;
      process.env.GITHUB_APP_INSTALLATION_ID = '1';
      expect(() => createGitHubClient()).toThrow(/Missing required env var: GITHUB_APP_PRIVATE_KEY_BASE64/);
    });

    it('throws on missing GITHUB_APP_INSTALLATION_ID', () => {
      process.env.GITHUB_APP_ID = '1';
      process.env.GITHUB_APP_PRIVATE_KEY_BASE64 = Buffer.from('key').toString('base64');
      delete process.env.GITHUB_APP_INSTALLATION_ID;
      expect(() => createGitHubClient()).toThrow(/Missing required env var: GITHUB_APP_INSTALLATION_ID/);
    });
  });

  describe('createBranch', () => {
    it('gets base SHA and creates ref', async () => {
      process.env.GITHUB_OWNER = 'owner';
      process.env.GITHUB_REPO = 'repo';

      const octokit = mockOctokit();
      (octokit.rest.git.getRef as any).mockResolvedValue({
        data: { object: { sha: 'base-sha-123' } },
      });
      (octokit.rest.git.createRef as any).mockResolvedValue({ data: {} });

      const sha = await createBranch(octokit, { branchName: 'feature/new' });

      expect(sha).toBe('base-sha-123');
      expect(octokit.rest.git.getRef).toHaveBeenCalledWith(
        expect.objectContaining({ ref: 'heads/main' }),
      );
      expect(octokit.rest.git.createRef).toHaveBeenCalledWith(
        expect.objectContaining({
          ref: 'refs/heads/feature/new',
          sha: 'base-sha-123',
        }),
      );
    });

    it('uses custom base branch', async () => {
      process.env.GITHUB_OWNER = 'owner';
      process.env.GITHUB_REPO = 'repo';

      const octokit = mockOctokit();
      (octokit.rest.git.getRef as any).mockResolvedValue({
        data: { object: { sha: 'dev-sha' } },
      });
      (octokit.rest.git.createRef as any).mockResolvedValue({ data: {} });

      await createBranch(octokit, { branchName: 'feature/x', baseBranch: 'develop' });

      expect(octokit.rest.git.getRef).toHaveBeenCalledWith(
        expect.objectContaining({ ref: 'heads/develop' }),
      );
    });
  });

  describe('batchCommit', () => {
    function setupBatchCommitMocks(octokit: Octokit) {
      (octokit.rest.git.getRef as any).mockResolvedValue({
        data: { object: { sha: 'current-sha' } },
      });
      (octokit.rest.git.getCommit as any).mockResolvedValue({
        data: { tree: { sha: 'tree-sha' } },
      });
      (octokit.rest.git.createBlob as any).mockResolvedValue({
        data: { sha: 'blob-sha' },
      });
      (octokit.rest.git.createTree as any).mockResolvedValue({
        data: { sha: 'new-tree-sha' },
      });
      (octokit.rest.git.createCommit as any).mockResolvedValue({
        data: { sha: 'new-commit-sha' },
      });
      (octokit.rest.git.updateRef as any).mockResolvedValue({ data: {} });
    }

    it('creates blobs in parallel, creates tree, commit, and updates ref', async () => {
      process.env.GITHUB_OWNER = 'owner';
      process.env.GITHUB_REPO = 'repo';

      const octokit = mockOctokit();
      setupBatchCommitMocks(octokit);

      const result = await batchCommit(octokit, {
        branch: 'feature/game',
        files: [
          { path: 'index.ts', content: 'code1' },
          { path: 'utils.ts', content: 'code2' },
        ],
        message: 'Add game files',
      });

      expect(result.sha).toBe('new-commit-sha');
      expect(result.apiCalls).toBe(7); // getRef + getCommit + 2 blobs + createTree + createCommit + updateRef
      expect(octokit.rest.git.createBlob).toHaveBeenCalledTimes(2);
      expect(octokit.rest.git.createTree).toHaveBeenCalledWith(
        expect.objectContaining({ base_tree: 'tree-sha' }),
      );
      expect(octokit.rest.git.createCommit).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Add game files',
          parents: ['current-sha'],
        }),
      );
      expect(octokit.rest.git.updateRef).toHaveBeenCalledWith(
        expect.objectContaining({
          sha: 'new-commit-sha',
          force: false,
        }),
      );
    });

    it('adds co-author to commit message', async () => {
      process.env.GITHUB_OWNER = 'owner';
      process.env.GITHUB_REPO = 'repo';

      const octokit = mockOctokit();
      setupBatchCommitMocks(octokit);

      await batchCommit(octokit, {
        branch: 'feature/game',
        files: [{ path: 'index.ts', content: 'code' }],
        message: 'Add game',
        coAuthor: 'AI Bot <ai@bot.com>',
      });

      expect(octokit.rest.git.createCommit).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Add game\n\nCo-authored-by: AI Bot <ai@bot.com>',
        }),
      );
    });

    it('does not add co-author when null', async () => {
      process.env.GITHUB_OWNER = 'owner';
      process.env.GITHUB_REPO = 'repo';

      const octokit = mockOctokit();
      setupBatchCommitMocks(octokit);

      await batchCommit(octokit, {
        branch: 'feature/game',
        files: [{ path: 'index.ts', content: 'code' }],
        message: 'No co-author',
        coAuthor: null,
      });

      expect(octokit.rest.git.createCommit).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'No co-author',
        }),
      );
    });

    it('retries on 422 (stale SHA)', async () => {
      process.env.GITHUB_OWNER = 'owner';
      process.env.GITHUB_REPO = 'repo';

      const octokit = mockOctokit();
      let callCount = 0;

      (octokit.rest.git.getRef as any).mockResolvedValue({
        data: { object: { sha: 'current-sha' } },
      });
      (octokit.rest.git.getCommit as any).mockResolvedValue({
        data: { tree: { sha: 'tree-sha' } },
      });
      (octokit.rest.git.createBlob as any).mockResolvedValue({
        data: { sha: 'blob-sha' },
      });
      (octokit.rest.git.createTree as any).mockResolvedValue({
        data: { sha: 'new-tree-sha' },
      });
      (octokit.rest.git.createCommit as any).mockResolvedValue({
        data: { sha: 'new-commit-sha' },
      });
      (octokit.rest.git.updateRef as any).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          const err = new Error('Reference update failed') as any;
          err.status = 422;
          throw err;
        }
        return { data: {} };
      });

      const result = await batchCommit(octokit, {
        branch: 'feature/game',
        files: [{ path: 'index.ts', content: 'code' }],
        message: 'Retry test',
      });

      expect(result.sha).toBe('new-commit-sha');
      // updateRef called once in first attempt (fails), once in retry
      expect(octokit.rest.git.updateRef).toHaveBeenCalledTimes(2);
    });

    it('throws non-422 errors without retry', async () => {
      process.env.GITHUB_OWNER = 'owner';
      process.env.GITHUB_REPO = 'repo';

      const octokit = mockOctokit();
      const error = new Error('Server error') as any;
      error.status = 500;

      (octokit.rest.git.getRef as any).mockRejectedValue(error);

      await expect(
        batchCommit(octokit, {
          branch: 'feature/game',
          files: [{ path: 'index.ts', content: 'code' }],
          message: 'Should throw',
        }),
      ).rejects.toThrow('Server error');
    });
  });

  describe('createSubmitBranch', () => {
    it('filters out .build-log.json', async () => {
      process.env.GITHUB_OWNER = 'owner';
      process.env.GITHUB_REPO = 'repo';

      const octokit = mockOctokit();

      (octokit.rest.git.getRef as any).mockResolvedValue({
        data: { object: { sha: 'tip-sha' } },
      });
      (octokit.rest.git.createRef as any).mockResolvedValue({ data: {} });
      (octokit.rest.git.getCommit as any).mockResolvedValue({
        data: { tree: { sha: 'tree-sha' } },
      });
      (octokit.rest.git.getTree as any).mockResolvedValue({
        data: {
          tree: [
            { path: 'index.ts', type: 'blob', mode: '100644', sha: 'blob1' },
            { path: '.build-log.json', type: 'blob', mode: '100644', sha: 'blob2' },
            { path: 'src/games/foo/.build-log.json', type: 'blob', mode: '100644', sha: 'blob3' },
            { path: 'utils.ts', type: 'blob', mode: '100644', sha: 'blob4' },
            { path: 'lib', type: 'tree', mode: '040000', sha: 'tree1' },
          ],
        },
      });
      (octokit.rest.git.createTree as any).mockResolvedValue({
        data: { sha: 'clean-tree-sha' },
      });
      (octokit.rest.git.createCommit as any).mockResolvedValue({
        data: { sha: 'submit-commit-sha' },
      });
      (octokit.rest.git.updateRef as any).mockResolvedValue({ data: {} });

      const sha = await createSubmitBranch(octokit, {
        sourceBranch: 'feature/game',
        submitBranch: 'submit/game',
      });

      expect(sha).toBe('submit-commit-sha');

      const treeCall = (octokit.rest.git.createTree as any).mock.calls[0][0];
      const paths = treeCall.tree.map((item: any) => item.path);
      expect(paths).toContain('index.ts');
      expect(paths).toContain('utils.ts');
      expect(paths).not.toContain('.build-log.json');
      expect(paths).not.toContain('src/games/foo/.build-log.json');
      expect(paths).not.toContain('lib'); // tree type filtered out
      expect(treeCall.base_tree).toBeUndefined(); // full replacement, no base_tree
    });
  });

  describe('loadBranchFiles', () => {
    it('fetches blobs and decodes base64 content', async () => {
      process.env.GITHUB_OWNER = 'owner';
      process.env.GITHUB_REPO = 'repo';

      const octokit = mockOctokit();

      (octokit.rest.git.getRef as any).mockResolvedValue({
        data: { object: { sha: 'branch-sha' } },
      });
      (octokit.rest.git.getCommit as any).mockResolvedValue({
        data: { tree: { sha: 'root-tree-sha' } },
      });
      (octokit.rest.git.getTree as any).mockResolvedValue({
        data: {
          tree: [
            { path: 'index.ts', type: 'blob', sha: 'blob-a' },
            { path: 'utils.ts', type: 'blob', sha: 'blob-b' },
            { path: 'lib', type: 'tree', sha: 'tree-1' },
          ],
        },
      });
      (octokit.rest.git.getBlob as any)
        .mockResolvedValueOnce({
          data: {
            encoding: 'base64',
            content: Buffer.from('const x = 1;').toString('base64'),
          },
        })
        .mockResolvedValueOnce({
          data: {
            encoding: 'base64',
            content: Buffer.from('const y = 2;').toString('base64'),
          },
        });

      const files = await loadBranchFiles(octokit, { branch: 'feature/game' });

      expect(files).toEqual({
        'index.ts': 'const x = 1;',
        'utils.ts': 'const y = 2;',
      });
      expect(octokit.rest.git.getBlob).toHaveBeenCalledTimes(2);
    });

    it('handles non-base64 encoding', async () => {
      process.env.GITHUB_OWNER = 'owner';
      process.env.GITHUB_REPO = 'repo';

      const octokit = mockOctokit();

      (octokit.rest.git.getRef as any).mockResolvedValue({
        data: { object: { sha: 'sha' } },
      });
      (octokit.rest.git.getCommit as any).mockResolvedValue({
        data: { tree: { sha: 'tree-sha' } },
      });
      (octokit.rest.git.getTree as any).mockResolvedValue({
        data: {
          tree: [{ path: 'raw.ts', type: 'blob', sha: 'blob-raw' }],
        },
      });
      (octokit.rest.git.getBlob as any).mockResolvedValue({
        data: { encoding: 'utf-8', content: 'raw content' },
      });

      const files = await loadBranchFiles(octokit, { branch: 'main' });
      expect(files['raw.ts']).toBe('raw content');
    });

    it('filters by pathPrefix', async () => {
      process.env.GITHUB_OWNER = 'owner';
      process.env.GITHUB_REPO = 'repo';

      const octokit = mockOctokit();

      (octokit.rest.git.getRef as any).mockResolvedValue({
        data: { object: { sha: 'sha' } },
      });
      (octokit.rest.git.getCommit as any).mockResolvedValue({
        data: { tree: { sha: 'tree-sha' } },
      });
      (octokit.rest.git.getTree as any).mockResolvedValue({
        data: {
          tree: [
            { path: 'src/games/foo/index.ts', type: 'blob', sha: 'blob1' },
            { path: 'src/engine/base.ts', type: 'blob', sha: 'blob2' },
            { path: 'package.json', type: 'blob', sha: 'blob3' },
          ],
        },
      });
      (octokit.rest.git.getBlob as any).mockResolvedValue({
        data: {
          encoding: 'base64',
          content: Buffer.from('game code').toString('base64'),
        },
      });

      const files = await loadBranchFiles(octokit, {
        branch: 'feature/game',
        pathPrefix: 'src/games/',
      });

      expect(Object.keys(files)).toEqual(['src/games/foo/index.ts']);
      expect(octokit.rest.git.getBlob).toHaveBeenCalledTimes(1);
    });

    it('returns empty object for branch with no blobs', async () => {
      process.env.GITHUB_OWNER = 'owner';
      process.env.GITHUB_REPO = 'repo';

      const octokit = mockOctokit();

      (octokit.rest.git.getRef as any).mockResolvedValue({
        data: { object: { sha: 'sha' } },
      });
      (octokit.rest.git.getCommit as any).mockResolvedValue({
        data: { tree: { sha: 'tree-sha' } },
      });
      (octokit.rest.git.getTree as any).mockResolvedValue({
        data: { tree: [] },
      });

      const files = await loadBranchFiles(octokit, { branch: 'empty-branch' });
      expect(files).toEqual({});
    });
  });
});
