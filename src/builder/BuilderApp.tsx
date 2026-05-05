import { useState, useEffect, useCallback } from 'react';
import { Chat } from './components/Chat';
import { Preview } from './components/Preview';
import { ByokModal } from './components/ByokModal';
import { buildTemplateFileMap, buildGameFileMap, type SandpackFileMap } from './lib/sandpack/file-map';

const BUILDER_CSS = `
  .builder-root {
    position: relative;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    background: #FEF0E4;
    font-family: system-ui, -apple-system, sans-serif;
  }
  .builder-preview-full {
    position: absolute;
    inset: 0;
  }
  .builder-fab {
    position: fixed;
    bottom: 24px;
    left: 24px;
    z-index: 100;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    border: none;
    background: #8B5E83;
    color: #fff;
    font-size: 22px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(61, 43, 53, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  .builder-fab:hover {
    transform: scale(1.08);
    box-shadow: 0 6px 20px rgba(61, 43, 53, 0.4);
  }
  .builder-fab-badge {
    position: absolute;
    top: -2px;
    right: -2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #E85D75;
    border: 2px solid #fff;
  }
  .builder-chat-overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    visibility: hidden;
    opacity: 0;
    transition: visibility 0s 0.3s, opacity 0.3s ease;
  }
  .builder-chat-overlay.open {
    visibility: visible;
    opacity: 1;
    transition: visibility 0s, opacity 0.3s ease;
  }
  .builder-chat-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(61, 43, 53, 0.35);
  }
  .builder-chat-drawer {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: 400px;
    max-width: 85vw;
    background: #FEF0E4;
    box-shadow: 4px 0 24px rgba(61, 43, 53, 0.15);
    transform: translateX(-100%);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .builder-chat-overlay.open .builder-chat-drawer {
    transform: translateX(0);
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
    .builder-chat-drawer {
      width: 100vw;
      max-width: 100vw;
    }
    .builder-fab {
      bottom: 16px;
      left: 16px;
      width: 48px;
      height: 48px;
      font-size: 20px;
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
  const [chatOpen, setChatOpen] = useState(true);
  const [hasNewMessage, setHasNewMessage] = useState(false);
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
    const sandpackPath = path.startsWith('src/games/')
      ? `/src/game/${path.slice('src/games/'.length)}`
      : `/${path}`;
    setFileMap((prev) => ({ ...prev, [sandpackPath]: content }));
    setHasNewMessage(true);
  }, []);

  const handleByokKeyChange = useCallback((key: string | null) => {
    setByokKey(key);
    if (key) {
      sessionStorage.setItem('nofi-byok-key', key);
    } else {
      sessionStorage.removeItem('nofi-byok-key');
    }
  }, []);

  const toggleChat = useCallback(() => {
    setChatOpen((prev) => !prev);
    setHasNewMessage(false);
  }, []);

  if (loading) {
    return (
      <div className="builder-loading">
        <div className="builder-spinner" />
        <p style={{ color: '#8B5E83', fontSize: '16px' }}>
          Setting up your session...
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
      <div className="builder-preview-full">
        <Preview
          fileMap={fileMap}
          sessionId={sessionId}
          branch={branch}
        />
      </div>

      {!chatOpen && (
        <button className="builder-fab" onClick={toggleChat} title="Open chat">
          SV
          {hasNewMessage && <span className="builder-fab-badge" />}
        </button>
      )}

      <div className={`builder-chat-overlay ${chatOpen ? 'open' : ''}`}>
        <div className="builder-chat-backdrop" onClick={toggleChat} />
        <div className="builder-chat-drawer">
          <Chat
            sessionId={sessionId}
            branch={branch}
            byokKey={byokKey}
            onToolResult={handleToolResult}
            onOpenByokModal={() => setShowByokModal(true)}
            onClose={toggleChat}
          />
        </div>
      </div>

      <ByokModal
        isOpen={showByokModal}
        onClose={() => setShowByokModal(false)}
        onKeyChange={handleByokKeyChange}
      />
    </div>
  );
}
