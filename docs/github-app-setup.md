# GitHub App Setup Runbook — Social Vibing

This runbook covers creating and configuring the **Social Vibing** GitHub App used by the builder. The app authenticates server-to-server (no user OAuth flow) to create branches, commit files, and open PRs on builder sessions.

## What the app does

The builder's API routes (`api/chat.ts`, `api/compile-status.ts`, `api/session/create.ts`) use `@octokit/auth-app` to authenticate as a GitHub App installation. It performs:

- **Create branches** — `socialvibing/{repo}-{sessionId}` branches for each session
- **Read branch files** — load game files from a branch (for remix)
- **Commit files** — batch-commit AI-generated code to the session branch
- **Create submit branches** — clean branch without `.build-log.json` for PRs
- **Open pull requests** — submit finished games

## Step 1: Create the GitHub App

1. Go to **GitHub Settings > Developer settings > GitHub Apps > New GitHub App**
   - If org: `https://github.com/organizations/{ORG}/settings/apps/new`
   - If personal: `https://github.com/settings/apps/new`

2. Fill in the form:

| Field | Value |
|---|---|
| **GitHub App name** | `Social Vibing` |
| **Homepage URL** | `https://nofi.games` (or your domain) |
| **Callback URL** | Leave blank — no OAuth user flow needed |
| **Setup URL** | Leave blank |
| **Webhook** | **Uncheck "Active"** — not needed yet (see note below) |
| **Webhook URL** | Leave blank |
| **Webhook secret** | Leave blank |

> **Why no webhooks?** The builder is purely request-driven — it calls GitHub when needed. Webhooks would be useful for detecting external pushes to builder branches or PR merges, but those features aren't built yet. When they are, you can enable webhooks with a single checkbox and point to an `/api/github/webhook` endpoint.

3. Set **Repository permissions**:

| Permission | Access |
|---|---|
| **Contents** | Read & Write |
| **Pull requests** | Read & Write |
| **Metadata** | Read-only (auto-selected) |

All other permissions: **No access**.

4. Under **"Where can this GitHub App be installed?"**:
   - Select **"Any account"** — allows others to install the app on their own repos

5. Click **Create GitHub App**.

## Step 2: Note the App ID

After creation, the **App ID** is displayed near the top of the settings page (a number like `123456`).

This becomes the `GITHUB_APP_ID` env var.

## Step 3: Generate a private key

1. On the app settings page, scroll to **"Private keys"**
2. Click **Generate a private key**
3. A `.pem` file downloads

Base64-encode it:

```bash
# macOS
base64 -i social-vibing.*.private-key.pem | tr -d '\n'

# Linux
base64 -w0 social-vibing.*.private-key.pem
```

This becomes `GITHUB_APP_PRIVATE_KEY_BASE64`.

**Keep the .pem file secure. Do not commit it.**

## Step 4: Install the app on the repository

1. From the app settings page, click **"Install App"** in the left sidebar
2. Select the account/org that owns your repo
3. Choose **"Only select repositories"** and pick your game repo
4. Click **Install**

Note the **Installation ID** from the URL after installing:
```
https://github.com/settings/installations/12345678
                                           ^^^^^^^^
                                           This number
```

This becomes `GITHUB_APP_INSTALLATION_ID`.

## Step 5: Set environment variables in Vercel

Go to the Vercel project: **Settings > Environment Variables**

### Required (3 variables)

| Variable | Example | Notes |
|---|---|---|
| `GITHUB_APP_ID` | `123456` | From Step 2 |
| `GITHUB_APP_PRIVATE_KEY_BASE64` | `LS0tLS1CRUdJTi...` | From Step 3 |
| `GITHUB_APP_INSTALLATION_ID` | `12345678` | From Step 4 |

### Optional (auto-discovered)

| Variable | Example | Notes |
|---|---|---|
| `GITHUB_OWNER` | `IvoryHeart` | Auto-discovered from installation if not set |
| `GITHUB_REPO` | `nofi-games` | Auto-discovered from installation if not set |

The app auto-discovers the repo from the installation — if the app is installed on exactly one repo, `GITHUB_OWNER` and `GITHUB_REPO` are not needed. Set them only if the app is installed on multiple repos and you need to pin a specific one.

### AI provider

| Variable | Notes |
|---|---|
| `ANTHROPIC_API_KEY` | For AI generation (not needed if all users use BYOK) |

## Step 6: Verify

After deploying with these env vars:

1. Navigate to `https://<preview-url>/build`
2. Session creation should succeed — check browser devtools for `POST /api/session/create` returning 200
3. Verify a `socialvibing/{repo}-{timestamp}-{id}` branch appears in GitHub
4. Send a chat message — the AI should respond and the Sandpack preview should update
5. Check the branch for committed game files

## Branch naming

All builder branches follow the pattern:
```
socialvibing/{repo-name}-{timestamp}-{random}
```

Examples:
- `socialvibing/nofi-games-1717000000000-abc12`
- `socialvibing/my-game-repo-1717000005000-xyz99`

The repo name is included so branches are self-documenting when the app spans multiple repos.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `POST /api/session/create` returns 500 | Missing or incorrect GitHub App env vars |
| `Missing required env var: GITHUB_APP_ID` | Env var not set or set for wrong environment scope |
| `AppTokenCreationError` or `401` | Private key mismatch — regenerate and re-encode |
| `Resource not accessible by integration` / `403` | App not installed on repo, or missing Contents permission |
| `GitHub App installation has no accessible repositories` | App installed but no repos selected |
| `POST /api/chat` returns 500 | Missing `ANTHROPIC_API_KEY` (and no BYOK key provided) |
| Branch created but no commits | Check compile-status endpoint in devtools |

## Security notes

- The private key grants write access to repo contents. Treat it like a deploy key.
- Branch mutations are restricted to the `socialvibing/` prefix at the application level (defense-in-depth beyond GitHub's own permission model).
- If the key is compromised, revoke it from the app settings page and generate a new one.
- Vercel encrypts env vars at rest.
