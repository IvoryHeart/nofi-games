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

let changed = false;

const vercelPath = resolve(root, 'vercel.json');
let vercelJson = readFileSync(vercelPath, 'utf-8');
const updatedVercel = vercelJson.replace(
  /"destination":\s*"https:\/\/[0-9]+-[0-9]+-[0-9]+-sandpack\.codesandbox\.io\/static\/\$1"/,
  `"destination": "${bundlerHost}/static/$1"`,
);
if (updatedVercel !== vercelJson) {
  writeFileSync(vercelPath, updatedVercel);
  changed = true;
}

const proxyPath = resolve(root, 'api/sandpack-proxy.ts');
let proxySource = readFileSync(proxyPath, 'utf-8');
const updatedProxy = proxySource.replace(
  /const BUNDLER_ORIGIN\s*=\s*'https:\/\/[0-9]+-[0-9]+-[0-9]+-sandpack\.codesandbox\.io'/,
  `const BUNDLER_ORIGIN = '${bundlerHost}'`,
);
if (updatedProxy !== proxySource) {
  writeFileSync(proxyPath, updatedProxy);
  changed = true;
}

if (changed) {
  console.log(`Updated Sandpack bundler proxy to v${version} (${bundlerHost})`);
} else {
  console.log(`Sandpack bundler already at v${version} (${bundlerHost})`);
}
