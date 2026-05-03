import type { VercelRequest, VercelResponse } from '@vercel/node';

const BUNDLER_ORIGIN = 'https://2-19-8-sandpack.codesandbox.io';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const subPath = ((req.query.p as string) || '').replace(/^\/+/, '');

  try {
    const targetUrl = subPath
      ? `${BUNDLER_ORIGIN}/${subPath}`
      : `${BUNDLER_ORIGIN}/`;

    const upstream = await fetch(targetUrl);
    if (!upstream.ok) {
      return res.status(upstream.status).end();
    }

    if (!subPath) {
      let html = await upstream.text();
      html = html.replace(/["']\/static\//g, (m) => m[0] + '/_sandpack/static/');
      html = html.replace(/"\/manifest\.json/g, '"/_sandpack/manifest.json');
      html = html.replace(/"\/csb-ios\.svg/g, '"/_sandpack/csb-ios.svg');

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.status(200).send(html);
    }

    const ct = upstream.headers.get('content-type') || 'application/octet-stream';
    const body = Buffer.from(await upstream.arrayBuffer());

    res.setHeader('Content-Type', ct);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    const immutable = /[a-f0-9]{7,}/.test(subPath);
    res.setHeader(
      'Cache-Control',
      immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=86400',
    );
    return res.status(200).send(body);
  } catch {
    return res.status(502).json({ error: 'Failed to fetch Sandpack bundler' });
  }
}
