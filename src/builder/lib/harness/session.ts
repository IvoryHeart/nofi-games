export interface BuildLogEntry {
  turn: number;
  contributor: string;
  prompt: string;
  filesChanged: string[];
  timestamp: string;
  error?: string;
}

export interface PendingCommit {
  files: Record<string, string>;
  buildLog: BuildLogEntry[];
  message: string;
  coAuthor: string | null;
}

export interface BuilderSession {
  branch: string;
  files: Record<string, string>;
  dependencies: Record<string, string>;
  buildLog: BuildLogEntry[];
  turnCount: number;
  pendingCommit: PendingCommit | null;
  dirty: boolean;
}

export function createSession(branch: string): BuilderSession {
  return {
    branch,
    files: {},
    dependencies: {},
    buildLog: [],
    turnCount: 0,
    pendingCommit: null,
    dirty: false,
  };
}

export function markDirty(session: BuilderSession): void {
  session.dirty = true;
}

export function markClean(session: BuilderSession): void {
  session.dirty = false;
}

export function addBuildLogEntry(
  session: BuilderSession,
  entry: Omit<BuildLogEntry, 'turn' | 'timestamp'>,
): void {
  session.turnCount++;
  session.buildLog.push({
    ...entry,
    turn: session.turnCount,
    timestamp: new Date().toISOString(),
  });
}

export function getSessionContext(session: BuilderSession): string {
  const parts: string[] = [];

  if (session.buildLog.length > 0) {
    parts.push('## Build log\n');
    for (const entry of session.buildLog) {
      const contributor = entry.contributor ? ` [${entry.contributor}]` : '';
      const error = entry.error ? ` (error: ${entry.error})` : '';
      parts.push(
        `Turn ${entry.turn}${contributor}: "${entry.prompt}" → files: ${entry.filesChanged.join(', ')}${error}`,
      );
    }
    parts.push('');
  }

  if (Object.keys(session.files).length > 0) {
    parts.push('## Current game files\n');
    for (const [path, content] of Object.entries(session.files)) {
      parts.push(`### ${path}\n\`\`\`typescript\n${content}\n\`\`\`\n`);
    }
  }

  if (Object.keys(session.dependencies).length > 0) {
    parts.push(
      `## Dependencies: ${Object.entries(session.dependencies).map(([n, v]) => `${n}@${v}`).join(', ')}\n`,
    );
  }

  return parts.join('\n');
}

export function getChangedFiles(
  session: BuilderSession,
  originalFiles: Record<string, string>,
): Record<string, string> {
  const changed: Record<string, string> = {};
  for (const [path, content] of Object.entries(session.files)) {
    if (originalFiles[path] !== content) {
      changed[path] = content;
    }
  }
  return changed;
}
