import { useState, useEffect, useCallback } from 'react';
import { Chat } from './components/Chat';
import { Preview } from './components/Preview';
import { ByokModal } from './components/ByokModal';
import { buildTemplateFileMap, buildGameFileMap, type SandpackFileMap } from './lib/sandpack/file-map';

const STORAGE_KEY_SESSION = 'nofi-builder-session';

const BUILDER_CSS = `
  .builder-root {
    display: flex;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    background: #FEF0E4;
    flex-direction: row;
    font-family: system-ui, -apple-system, sans-serif;
  }
  .builder-chat-panel {
    width: 400px;
    min-width: 320px;
    max-width: 480px;
    height: 100%;
    border-right: 1px solid #E8D5D0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .builder-preview-panel {
    flex: 1;
    height: 100%;
    overflow: hidden;
  }
  .builder-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background: #FEF0E4;
    gap: 16px;
    font-family: system-ui, -apple-system, sans-serif;
  }
  .builder-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #E8D5D0;
    border-top-color: #8B5E83;
    border-radius: 50%;
    animation: builder-spin 0.8s linear infinite;
  }
  @keyframes builder-spin {
    to { transform: rotate(360deg); }
  }
  @media (max-width: 767px) {
    .builder-root {
      flex-direction: column-reverse;
    }
    .builder-chat-panel {
      width: 100%;
      min-width: unset;
      max-width: unset;
      height: 40vh;
      border-right: none;
      border-top: 1px solid #E8D5D0;
    }
    .builder-preview-panel {
      height: 60vh;
    }
  }
`;

interface SessionData {
  sessionId: string;
  branch: string;
  files?: Record<string, string>;
}

function injectStyles() {
  if (document.getElementById('builder-styles')) return;
  const style = document.createElement('style');
  style.id = 'builder-styles';
  style.textContent = BUILDER_CSS;
  document.head.appendChild(style);
}

export function BuilderApp() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [branch, setBranch] = useState<string | null>(null);
  const [fileMap, setFileMap] = useState<SandpackFileMap>(buildTemplateFileMap);
  const [byokKey, setByokKey] = useState<string | null>(
    () => sessionStorage.getItem('nofi-byok-key'),
  );
  const [showByokModal, setShowByokModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    injectStyles();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlBranch = params.get('branch');
    const remixBranch = params.get('remix-branch');

    const body: Record<string, string> = {};
    if (urlBranch) body.branch = urlBranch;
    else if (remixBranch) body.remixBranch = remixBranch;

    fetch('/api/session/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Session creation failed: ${res.status}`);
        return res.json() as Promise<SessionData>;
      })
      .then((data) => {
        setSessionId(data.sessionId);
        setBranch(data.branch);

        localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify({
          sessionId: data.sessionId,
          branch: data.branch,
        }));

        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('branch', data.branch);
        newUrl.searchParams.delete('remix-branch');
        window.history.replaceState({}, '', newUrl.toString());

        if (data.files && Object.keys(data.files).length > 0) {
          setFileMap(buildGameFileMap(data.files));
        }
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleToolResult = useCallback((path: string, content: string) => {
    // Tool paths are like "src/games/slug/file.ts"; Sandpack uses "/src/game/slug/file.ts"
    const sandpackPath = path.startsWith('src/games/')
      ? `/src/game/${path.slice('src/games/'.length)}`
      : `/${path}`;
    setFileMap((prev) => ({ ...prev, [sandpackPath]: content }));
  }, []);

  const handleByokKeyChange = useCallback((key: string | null) => {
    setByokKey(key);
    if (key) {
      sessionStorage.setItem('nofi-byok-key', key);
    } else {
      sessionStorage.removeItem('nofi-byok-key');
    }
  }, []);

  if (loading) {
    return (
      <div className="builder-loading">
        <div className="builder-spinner" />
        <p style={{ color: '#8B5E83', fontSize: '16px' }}>
          Setting up your builder session...
        </p>
      </div>
    );
  }

  if (error || !sessionId || !branch) {
    return (
      <div className="builder-loading">
        <p style={{ color: '#B33A3A', fontSize: '16px', textAlign: 'center', padding: '0 24px' }}>
          {error ?? 'Failed to create session. Please refresh and try again.'}
        </p>
      </div>
    );
  }

  return (
    <div className="builder-root">
      <div className="builder-chat-panel">
        <Chat
          sessionId={sessionId}
          branch={branch}
          byokKey={byokKey}
          onToolResult={handleToolResult}
          onOpenByokModal={() => setShowByokModal(true)}
        />
      </div>
      <div className="builder-preview-panel">
        <Preview
          fileMap={fileMap}
          sessionId={sessionId}
          branch={branch}
        />
      </div>
      <ByokModal
        isOpen={showByokModal}
        onClose={() => setShowByokModal(false)}
        onKeyChange={handleByokKeyChange}
      />
    </div>
  );
}
