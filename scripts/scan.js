import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const NETWORK_PATTERNS = [
  'fetch(',
  'fetch (',
  'XMLHttpRequest',
  'new WebSocket',
  'navigator.sendBeacon',
  'importScripts',
  'window.fetch',
  'globalThis.fetch',
  'import(',
];

const STORAGE_PATTERNS = [
  'localStorage',
  'sessionStorage',
  'document.cookie',
  'indexedDB',
];

const CODE_EXEC_PATTERNS = [
  'eval(',
  'eval (',
  'new Function(',
  'new Function (',
];

const DOM_DANGER_PATTERNS = [
  'document.write(',
  'document.writeln(',
  'new Worker(',
  'new SharedWorker(',
  'navigator.serviceWorker',
];

const ALL_PATTERNS = [
  ...NETWORK_PATTERNS,
  ...STORAGE_PATTERNS,
  ...CODE_EXEC_PATTERNS,
  ...DOM_DANGER_PATTERNS,
];

const SKIP_NAMES = new Set(['node_modules', '.build-log.json']);

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const gamesDir = join(__dirname, '..', 'src', 'games');

function collectFiles(dir) {
  const files = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (SKIP_NAMES.has(entry)) continue;
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath, { throwIfNoEntry: false });
    if (!stat) continue;
    if (stat.isDirectory()) {
      files.push(...collectFiles(fullPath));
    } else if (stat.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function scanFile(filePath) {
  const violations = [];
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of ALL_PATTERNS) {
      if (line.includes(pattern)) {
        violations.push({
          file: filePath,
          line: i + 1,
          pattern,
        });
      }
    }
  }
  return violations;
}

function main() {
  const subdirs = readdirSync(gamesDir).filter((entry) => {
    const fullPath = join(gamesDir, entry);
    return statSync(fullPath).isDirectory() && !SKIP_NAMES.has(entry);
  });

  const allViolations = [];

  for (const subdir of subdirs) {
    const files = collectFiles(join(gamesDir, subdir));
    for (const file of files) {
      allViolations.push(...scanFile(file));
    }
  }

  if (allViolations.length === 0) {
    console.log('Security scan passed: no blocked patterns found.');
    process.exit(0);
  }

  console.error(`Found ${allViolations.length} violation(s):\n`);
  for (const v of allViolations) {
    const rel = relative(join(__dirname, '..'), v.file);
    console.error(`  ${rel}:${v.line}  blocked pattern: ${v.pattern}`);
  }
  console.error('');
  process.exit(1);
}

main();
