import { useEffect, useRef, useState } from 'react';
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

function BundlerBlockedBanner() {
  const { sandpack } = useSandpack();
  const [blocked, setBlocked] = useState(false);
  const statusRef = useRef(sandpack.status);
  statusRef.current = sandpack.status;

  useEffect(() => {
    // Only start the timer once on mount. If after 8 seconds the bundler
    // never left 'initial', the iframe was likely blocked by the browser's
    // tracking protection (e.g. Brave Shields blocking codesandbox.io).
    const timer = setTimeout(() => {
      if (statusRef.current === 'initial') {
        setBlocked(true);
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!blocked) return null;

  return (
    <div style={styles.blockedBanner}>
      <strong>Preview blocked</strong>
      <p style={{ margin: '6px 0 0' }}>
        Your browser is blocking the Sandpack preview (codesandbox.io).
        If you use Brave, click the Shields icon in the URL bar and turn Shields
        off for this site, then reload.
      </p>
    </div>
  );
}

export function Preview({ fileMap, sessionId, branch }: PreviewProps) {
  const sandpackFiles = Object.fromEntries(
    Object.entries(fileMap).map(([path, code]) => [path, { code }]),
  );

  return (
    <div style={styles.container}>
      <style>{SANDPACK_OVERRIDES}</style>
      <SandpackProvider
        template="vanilla-ts"
        files={sandpackFiles}
        customSetup={{ entry: '/src/main.ts' }}
        options={{
          recompileMode: 'delayed',
          recompileDelay: 300,
          autorun: true,
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
        <BundlerBlockedBanner />
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

// Strip Sandpack's default chrome so the game preview fills the viewport edge-to-edge.
// Key fix: SandpackProvider renders a .sp-wrapper div that doesn't inherit height,
// collapsing the preview to ~160px. Force it to fill its flex parent.
const SANDPACK_OVERRIDES = `
  .sp-wrapper { flex: 1 !important; display: flex !important; flex-direction: column !important; min-height: 0 !important; }
  .sp-preview { border: none !important; border-radius: 0 !important; background: transparent !important; flex: 1 !important; }
  .sp-preview-container { flex: 1 !important; }
  .sp-preview-container iframe { width: 100% !important; height: 100% !important; }
  .sp-preview-actions { opacity: 0; transition: opacity 0.2s; }
  .sp-preview:hover .sp-preview-actions { opacity: 1; }
`;

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
    position: 'relative',
  },
  blockedBanner: {
    position: 'absolute',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#FFF3E0',
    border: '1px solid #FFB74D',
    borderRadius: 12,
    padding: '12px 20px',
    maxWidth: 420,
    fontSize: 13,
    color: '#3D2B35',
    zIndex: 10,
    textAlign: 'center' as const,
    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
  },
};
