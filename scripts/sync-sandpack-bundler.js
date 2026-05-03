import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');

const clientSource = readFileSync(
  resolve(root, 'node_modules/@codesandbox/sandpack-client/dist/clients/runtime/index.mjs'),
  'utf-8',
);

const match = clientSource.match(/var BUNDLER_URL\s*=\s*"https:\/\/".concat\(\(?_a\s*=\s*"([^"]+)"\)/);
if (!match) {
  console.error('Could not extract Sandpack bundler version from @codesandbox/sandpack-client');
  process.exit(1);
}

const version = match[1];
const dashed = version.replace(/\./g, '-');
const bundlerHost = `https://${dashed}-sandpack.codesandbox.io`;

const vercelPath = resolve(root, 'vercel.json');
const vercelJson = readFileSync(vercelPath, 'utf-8');

const updated = vercelJson.replace(
  /"destination":\s*"https:\/\/[0-9]+-[0-9]+-[0-9]+-sandpack\.codesandbox\.io\/:path\*"/,
  `"destination": "${bundlerHost}/:path*"`,
);

if (updated === vercelJson) {
  console.log(`Sandpack bundler already at v${version} (${bundlerHost})`);
} else {
  writeFileSync(vercelPath, updated);
  console.log(`Updated vercel.json Sandpack proxy to v${version} (${bundlerHost})`);
}
