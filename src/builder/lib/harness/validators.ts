export const NETWORK_PATTERNS = [
  'fetch(', 'fetch (', 'XMLHttpRequest', 'new WebSocket',
  'navigator.sendBeacon', 'importScripts',
  'window.fetch', 'globalThis.fetch',
  'import(',
];

export const STORAGE_PATTERNS = [
  'localStorage', 'sessionStorage', 'document.cookie', 'indexedDB',
];

export const CODE_EXEC_PATTERNS = [
  'eval(', 'eval (',
  'new Function(', 'new Function (',
];

export const DOM_DANGER_PATTERNS = [
  'document.write(', 'document.writeln(',
  'new Worker(', 'new SharedWorker(',
  'navigator.serviceWorker',
];

export function assertPathAllowed(path: string, _allowedPattern: string): void {
  if (path.includes('..')) {
    throw new Error(`Invalid path "${path}": directory traversal ("..") is not allowed`);
  }
  if (path.startsWith('/')) {
    throw new Error(`Invalid path "${path}": absolute paths are not allowed`);
  }
  if (!path.startsWith('src/games/')) {
    throw new Error(`Invalid path "${path}": must be under src/games/`);
  }
}

export function assertFileSize(content: string, maxSize: number): void {
  if (content.length > maxSize) {
    throw new Error(`File too large: ${content.length} chars (max ${maxSize})`);
  }
}

export function assertNoBlockedPatterns(content: string): void {
  for (const pattern of NETWORK_PATTERNS) {
    if (content.includes(pattern)) {
      throw new Error(`Blocked: contains network call "${pattern}"`);
    }
  }
  for (const pattern of STORAGE_PATTERNS) {
    if (content.includes(pattern)) {
      throw new Error(`Blocked: contains browser storage access "${pattern}"`);
    }
  }
  for (const pattern of CODE_EXEC_PATTERNS) {
    if (content.includes(pattern)) {
      throw new Error(`Blocked: contains dynamic code execution "${pattern}"`);
    }
  }
  for (const pattern of DOM_DANGER_PATTERNS) {
    if (content.includes(pattern)) {
      throw new Error(`Blocked: contains dangerous DOM/worker API "${pattern}"`);
    }
  }
}

export function assertFileExists(path: string, files: Record<string, string>): void {
  if (!(path in files)) {
    throw new Error(`File not found: "${path}". Use writeFile to create it first.`);
  }
}

export function assertExactlyOneMatch(content: string, searchText: string): void {
  const occurrences = content.split(searchText).length - 1;
  if (occurrences === 0) {
    throw new Error('old_text not found in file');
  }
  if (occurrences > 1) {
    throw new Error(
      `old_text matches ${occurrences} times (must match exactly once). Include more surrounding context to make it unique.`,
    );
  }
}

export function assertDependencyAllowed(name: string, allowedDeps: string[]): void {
  if (!allowedDeps.includes(name)) {
    throw new Error(`Dependency "${name}" not allowed. Allowed: ${allowedDeps.join(', ')}`);
  }
}
