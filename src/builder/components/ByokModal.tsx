import { useState, useEffect, useRef } from 'react';

interface ByokModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeyChange: (key: string | null) => void;
}

export function ByokModal({ isOpen, onClose, onKeyChange }: ByokModalProps) {
  const [keyInput, setKeyInput] = useState('');
  const [hasKey, setHasKey] = useState(
    () => sessionStorage.getItem('nofi-byok-key') != null,
  );
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setHasKey(sessionStorage.getItem('nofi-byok-key') != null);
      setKeyInput('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    onKeyChange(trimmed);
    setHasKey(true);
    setKeyInput('');
    onClose();
  };

  const handleClear = () => {
    onKeyChange(null);
    setHasKey(false);
    setKeyInput('');
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) {
      onClose();
    }
  };

  return (
    <div ref={backdropRef} onClick={handleBackdropClick} style={styles.backdrop}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>Bring Your Own Key</h2>
          <button onClick={onClose} style={styles.closeButton} aria-label="Close">
            &times;
          </button>
        </div>

        <p style={styles.description}>
          Enter your OpenRouter API key to use your own account for AI generation.
          Your key is sent to our server only to forward requests to the AI provider and is not stored or logged.
        </p>

        {hasKey && (
          <div style={styles.statusBanner}>
            <span style={styles.statusDot} />
            API key is set
          </div>
        )}

        <div style={styles.inputRow}>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="sk-or-v1-..."
            style={styles.input}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
          />
        </div>

        <div style={styles.actions}>
          <button
            onClick={handleSave}
            disabled={!keyInput.trim()}
            style={{
              ...styles.saveButton,
              ...(!keyInput.trim() ? styles.buttonDisabled : {}),
            }}
          >
            Save
          </button>
          {hasKey && (
            <button onClick={handleClear} style={styles.clearButton}>
              Clear Key
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(61, 43, 53, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#FEF0E4',
    borderRadius: '16px',
    padding: '24px',
    width: '100%',
    maxWidth: '420px',
    margin: '0 16px',
    boxShadow: '0 8px 32px rgba(61, 43, 53, 0.2)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },
  title: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#8B5E83',
    margin: 0,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    color: '#9B8A94',
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
  },
  description: {
    fontSize: '13px',
    color: '#6B5A63',
    lineHeight: '1.5',
    margin: '0 0 16px',
  },
  statusBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: '#E8F5E9',
    color: '#2E7D32',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '13px',
    fontWeight: 600,
    marginBottom: '16px',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#4CAF50',
    flexShrink: 0,
  },
  inputRow: {
    marginBottom: '16px',
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    fontSize: '14px',
    border: '1px solid #E8D5D0',
    borderRadius: '8px',
    outline: 'none',
    background: '#fff',
    color: '#3D2B35',
    fontFamily: 'monospace',
    boxSizing: 'border-box' as const,
  },
  actions: {
    display: 'flex',
    gap: '8px',
  },
  saveButton: {
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: 600,
    border: 'none',
    borderRadius: '8px',
    background: '#8B5E83',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  clearButton: {
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: 600,
    border: '1px solid #E8D5D0',
    borderRadius: '8px',
    background: 'transparent',
    color: '#B33A3A',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};
