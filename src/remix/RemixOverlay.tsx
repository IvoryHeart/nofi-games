import { useState, useEffect, useCallback } from 'react';
import { Chat } from '../builder/components/Chat';
import { Preview } from '../builder/components/Preview';
import { ByokModal } from '../builder/components/ByokModal';
import { buildRemixFileMap, type SandpackFileMap } from '../builder/lib/sandpack/file-map';

interface RemixOverlayProps {
  gameId: string;
  gameName: string;
  onExit: () => void;
}

interface SessionData {
  sessionId: string;
  branch: string;
  gameFiles?: Record<string, string>;
  mainFileName?: string;
}

const OVERLAY_CSS = `
  .remix-overlay {
    position: fixed;
    inset: 0;
    z-index: 500;
    background: #FEF0E4;
    font-family: system-ui, -apple-system, sans-serif;
  }
  .remix-preview {
    position: absolute;
    inset: 0;
  }
  .remix-topbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 510;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: rgba(254, 240, 228, 0.9);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid #E8D5D0;
  }
  .remix-topbar-title {
    font-size: 14px;
    font-weight: 700;
    color: #8B5E83;
  }
  .remix-topbar-btn {
    padding: 6px 14px;
    font-size: 12px;
    font-weight: 600;
    border: 1px solid #E8D5D0;
    border-radius: 16px;
    background: transparent;
    color: #3D2B35;
    cursor: pointer;
    font-family: inherit;
  }
  .remix-topbar-btn:hover { background: #F5E6DC; }
  .remix-fab {
    position: fixed;
    bottom: 24px;
    left: 24px;
    z-index: 510;
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
  .remix-fab:hover {
    transform: scale(1.08);
    box-shadow: 0 6px 20px rgba(61, 43, 53, 0.4);
  }
  .remix-chat-overlay {
    position: fixed;
    inset: 0;
    z-index: 600;
    visibility: hidden;
    opacity: 0;
    transition: visibility 0s 0.3s, opacity 0.3s ease;
  }
  .remix-chat-overlay.open {
    visibility: visible;
    opacity: 1;
    transition: visibility 0s, opacity 0.3s ease;
  }
  .remix-chat-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(61, 43, 53, 0.35);
  }
  .remix-chat-drawer {
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
  .remix-chat-overlay.open .remix-chat-drawer {
    transform: translateX(0);
  }
  .remix-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background: #FEF0E4;
    gap: 16px;
  }
  .remix-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #E8D5D0;
    border-top-color: #8B5E83;
    border-radius: 50%;
    animation: remix-spin 0.8s linear infinite;
  }
  @keyframes remix-spin {
    to { transform: rotate(360deg); }
  }
  @media (max-width: 767px) {
    .remix-chat-drawer {
      width: 100vw;
      max-width: 100vw;
    }
    .remix-fab {
      bottom: 16px;
      left: 16px;
      width: 48px;
      height: 48px;
      font-size: 20px;
    }
  }
`;

function injectStyles() {
  if (document.getElementById('remix-styles')) return;
  const style = document.createElement('style');
  style.id = 'remix-styles';
  style.textContent = OVERLAY_CSS;
  document.head.appendChild(style);
}

export function RemixOverlay({ gameId, gameName, onExit }: RemixOverlayProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [branch, setBranch] = useState<string | null>(null);
  const [fileMap, setFileMap] = useState<SandpackFileMap | null>(null);
  const [byokKey, setByokKey] = useState<string | null>(
    () => sessionStorage.getItem('nofi-byok-key'),
  );
  const [showByokModal, setShowByokModal] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    injectStyles();
  }, []);

  useEffect(() => {
    fetch('/api/session/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Session creation failed: ${res.status}`);
        return res.json() as Promise<SessionData>;
      })
      .then((data) => {
        setSessionId(data.sessionId);
        setBranch(data.branch);

        if (data.gameFiles && data.mainFileName) {
          setFileMap(buildRemixFileMap(data.gameFiles, data.mainFileName));
        } else {
          setError('Could not load game source files.');
        }
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [gameId]);

  const handleToolResult = useCallback((path: string, content: string) => {
    const sandpackPath = path.startsWith('src/games/')
      ? `/src/game/${path.slice('src/games/'.length)}`
      : `/${path}`;
    setFileMap((prev) => prev ? { ...prev, [sandpackPath]: content } : prev);
  }, []);

  const handleByokKeyChange = useCallback((key: string | null) => {
    setByokKey(key);
    if (key) sessionStorage.setItem('nofi-byok-key', key);
    else sessionStorage.removeItem('nofi-byok-key');
  }, []);

  const toggleChat = useCallback(() => setChatOpen((prev) => !prev), []);

  if (loading) {
    return (
      <div className="remix-overlay">
        <div className="remix-loading">
          <div className="remix-spinner" />
          <p style={{ color: '#8B5E83', fontSize: '16px' }}>
            Loading {gameName} source...
          </p>
        </div>
      </div>
    );
  }

  if (error || !sessionId || !branch || !fileMap) {
    return (
      <div className="remix-overlay">
        <div className="remix-loading">
          <p style={{ color: '#B33A3A', fontSize: '16px', textAlign: 'center', padding: '0 24px' }}>
            {error ?? 'Failed to create remix session.'}
          </p>
          <button className="remix-topbar-btn" onClick={onExit} style={{ marginTop: 8 }}>
            Back to game
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="remix-overlay">
      <div className="remix-topbar">
        <span className="remix-topbar-title">Remixing: {gameName}</span>
        <button className="remix-topbar-btn" onClick={onExit}>
          Exit Remix
        </button>
      </div>

      <div className="remix-preview" style={{ top: 45 }}>
        <Preview fileMap={fileMap} sessionId={sessionId} branch={branch} />
      </div>

      {!chatOpen && (
        <button className="remix-fab" onClick={toggleChat} title="Open chat">
          SV
        </button>
      )}

      <div className={`remix-chat-overlay ${chatOpen ? 'open' : ''}`}>
        <div className="remix-chat-backdrop" onClick={toggleChat} />
        <div className="remix-chat-drawer">
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
