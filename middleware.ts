import { rewrite, next } from '@vercel/edge';

/**
 * Vercel Edge Middleware — runs BEFORE the filesystem, so it can route the
 * `tycoon.nofi.games` host to the standalone Tycoon app (`/tycoon.html`).
 *
 * Why this is needed: `vercel.json` `rewrites` are applied AFTER the filesystem,
 * so a request for `/` resolves to the real `index.html` (the nofi.games grid app)
 * before any host-based rewrite can fire. Middleware intercepts first.
 *
 * The matcher skips `/api`, `/assets`, `/icons`, and any path containing a `.`
 * (real files like `/sw.js`, `/favicon.svg`, `/tycoon.html`), so only page
 * navigations are rewritten. Any host other than the tycoon subdomain passes
 * through untouched — nofi.games behavior is unchanged.
 */
export const config = {
  matcher: ['/((?!api/|assets/|icons/|.*\\.).*)'],
};

export default function middleware(request: Request): Response {
  const url = new URL(request.url);
  if (url.hostname === 'tycoon.nofi.games') {
    return rewrite(new URL('/tycoon.html', request.url));
  }
  return next();
}
