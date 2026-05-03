import { useEffect, useRef } from 'react';
import {
  SandpackProvider,
  SandpackPreview,
  useSandpack,
} from '@codesandbox/sandpack-react';
import type { SandpackFileMap } from '../lib/sandpack/file-map';

interface PreviewProps {
  fileMap: SandpackFileMap;
  sessionId: string;
  branch: string;
}

interface CompileReporterProps {
  sessionId: string;
  branch: string;
  fileMap: SandpackFileMap;
}

function CompileReporter({ sessionId, branch, fileMap }: CompileReporterProps) {
  const { sandpack } = useSandpack();
  const prevStatusRef = useRef(sandpack.status);
  const prevFileMapRef = useRef(fileMap);

  useEffect(() => {
    const wasRunning = prevStatusRef.current === 'running';
    const isIdle = sandpack.status === 'idle' || sandpack.status === 'done';
    prevStatusRef.current = sandpack.status;

    if (!wasRunning || !isIdle) return;

    const changedFiles: Record<string, string> = {};
    for (const [path, content] of Object.entries(fileMap)) {
      if (prevFileMapRef.current[path] !== content) {
        changedFiles[path] = content;
      }
    }
    prevFileMapRef.current = fileMap;

    if (Object.keys(changedFiles).length === 0) return;

    const hasError = sandpack.error != null;

    fetch('/api/compile-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        branch,
        hasErrors: hasError,
        errors: hasError ? [sandpack.error?.message] : undefined,
        pendingFiles: hasError ? undefined : changedFiles,
      }),
    }).catch(() => {
      // Silently ignore compile-status reporting failures
    });
  }, [sandpack.status, sandpack.error, sessionId, branch, fileMap]);

  return null;
}

function FileUpdater({ fileMap }: { fileMap: SandpackFileMap }) {
  const { sandpack } = useSandpack();
  const initializedRef = useRef(false);

  useEffect(() => {
    // Skip the very first render -- SandpackProvider already has the initial files
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }

    for (const [path, content] of Object.entries(fileMap)) {
      const existing = sandpack.files[path];
      if (!existing || existing.code !== content) {
        sandpack.updateFile(path, content);
      }
    }
  }, [fileMap, sandpack]);

  return null;
}

export function Preview({ fileMap, sessionId, branch }: PreviewProps) {
  const sandpackFiles = Object.fromEntries(
    Object.entries(fileMap).map(([path, code]) => [path, { code }]),
  );

  const bundlerURL = `${window.location.origin}/_sandpack`;

  return (
    <div style={styles.container}>
      <SandpackProvider
        template="vanilla-ts"
        files={sandpackFiles}
        customSetup={{ entry: '/src/main.ts' }}
        options={{
          recompileMode: 'delayed',
          recompileDelay: 300,
          autorun: true,
          bundlerURL,
        }}
      >
        <div style={styles.previewWrapper}>
          <SandpackPreview
            showNavigator={false}
            showRefreshButton={true}
            showOpenInCodeSandbox={false}
            style={{ height: '100%', width: '100%' }}
          />
        </div>
        <FileUpdater fileMap={fileMap} />
        <CompileReporter
          sessionId={sessionId}
          branch={branch}
          fileMap={fileMap}
        />
      </SandpackProvider>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  previewWrapper: {
    flex: 1,
    overflow: 'hidden',
  },
};
