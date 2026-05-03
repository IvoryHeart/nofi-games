import { useEffect, useRef } from 'react';
import { useChat } from '@ai-sdk/react';

interface ChatProps {
  sessionId: string;
  branch: string;
  byokKey: string | null;
  onToolResult: (path: string, content: string) => void;
  onOpenByokModal: () => void;
  onClose: () => void;
}

export function Chat({ sessionId, branch, byokKey, onToolResult, onOpenByokModal, onClose }: ChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const processedToolCalls = useRef<Set<string>>(new Set());

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    status,
    error,
  } = useChat({
    api: '/api/chat',
    body: { sessionId, branch, byokKey },
    maxSteps: 10,
  });

  useEffect(() => {
    for (const msg of messages) {
      if (msg.role !== 'assistant' || !msg.parts) continue;
      for (const part of msg.parts) {
        if (part.type !== 'tool-invocation') continue;
        const inv = part.toolInvocation;
        if (inv.state !== 'result') continue;
        const callId = inv.toolCallId;
        if (processedToolCalls.current.has(callId)) continue;
        processedToolCalls.current.add(callId);
        const result = inv.result;
        if (result?.success && result?.path && result?.content) {
          onToolResult(result.path, result.content);
        }
      }
    }
  }, [messages, onToolResult]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const isWaiting = status === 'submitted' || status === 'streaming';

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Social Vibing</h1>
        <div style={styles.headerActions}>
          <button
            onClick={onOpenByokModal}
            style={{
              ...styles.byokButton,
              ...(byokKey ? styles.byokButtonActive : {}),
            }}
            title={byokKey ? 'API key set' : 'Set your own API key'}
          >
            {byokKey ? 'Key Set' : 'BYOK'}
          </button>
          <button onClick={onClose} style={styles.closeButton} aria-label="Close chat">
            &times;
          </button>
        </div>
      </div>

      <div style={styles.messageList}>
        {messages.length === 0 && (
          <div style={styles.emptyState}>
            <p style={styles.emptyTitle}>Describe the game you want to build</p>
            <p style={styles.emptyHint}>
              Try: "Make a simple clicker game" or "Build a platformer with gravity"
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            style={msg.role === 'user' ? styles.userMessage : styles.assistantMessage}
          >
            <div style={styles.messageRole}>
              {msg.role === 'user' ? 'You' : 'AI'}
            </div>
            <div style={styles.messageContent}>
              {msg.parts.map((part, i) => {
                if (part.type === 'text') {
                  return <span key={i}>{part.text}</span>;
                }
                if (part.type === 'tool-invocation') {
                  const inv = part.toolInvocation;
                  return (
                    <div key={i} style={styles.toolCall}>
                      <span style={styles.toolName}>
                        {inv.toolName}
                      </span>
                      {inv.state === 'result' && (
                        <span style={inv.result?.success ? styles.toolSuccess : styles.toolError}>
                          {inv.result?.success ? ' done' : ' failed'}
                        </span>
                      )}
                      {inv.state !== 'result' && (
                        <span style={styles.toolPending}> running...</span>
                      )}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        ))}

        {isWaiting && messages[messages.length - 1]?.role === 'user' && (
          <div style={styles.assistantMessage}>
            <div style={styles.messageRole}>AI</div>
            <div style={styles.thinking}>Thinking...</div>
          </div>
        )}

        {error && (
          <div style={styles.errorBanner}>
            {error.message || 'Something went wrong. Please try again.'}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} style={styles.inputForm}>
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Describe your game..."
          style={styles.input}
          disabled={isWaiting}
        />
        <button
          type="submit"
          disabled={isWaiting || !input.trim()}
          style={{
            ...styles.sendButton,
            ...(isWaiting || !input.trim() ? styles.sendButtonDisabled : {}),
          }}
        >
          {isWaiting ? '...' : 'Send'}
        </button>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#FEF0E4',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid #E8D5D0',
    flexShrink: 0,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '22px',
    color: '#9B8A94',
    cursor: 'pointer',
    padding: '0 2px',
    lineHeight: 1,
  },
  title: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#8B5E83',
    margin: 0,
  },
  byokButton: {
    padding: '4px 12px',
    fontSize: '12px',
    fontWeight: 600,
    border: '1px solid #8B5E83',
    borderRadius: '12px',
    background: 'transparent',
    color: '#8B5E83',
    cursor: 'pointer',
  },
  byokButtonActive: {
    background: '#8B5E83',
    color: '#fff',
  },
  messageList: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: '8px',
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#8B5E83',
    margin: 0,
  },
  emptyHint: {
    fontSize: '13px',
    color: '#9B8A94',
    margin: 0,
    maxWidth: '280px',
  },
  userMessage: {
    alignSelf: 'flex-end',
    background: '#8B5E83',
    color: '#fff',
    borderRadius: '16px 16px 4px 16px',
    padding: '8px 14px',
    maxWidth: '85%',
    wordBreak: 'break-word' as const,
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    background: '#fff',
    color: '#3D2B35',
    borderRadius: '16px 16px 16px 4px',
    padding: '8px 14px',
    maxWidth: '85%',
    wordBreak: 'break-word' as const,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  messageRole: {
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    opacity: 0.6,
    marginBottom: '4px',
  },
  messageContent: {
    fontSize: '14px',
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap' as const,
  },
  toolCall: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    background: '#F5EDE8',
    borderRadius: '6px',
    padding: '2px 8px',
    margin: '4px 0',
    fontSize: '12px',
  },
  toolName: {
    fontFamily: 'monospace',
    fontWeight: 600,
    color: '#8B5E83',
  },
  toolSuccess: {
    color: '#3A7D44',
    fontSize: '11px',
  },
  toolError: {
    color: '#B33A3A',
    fontSize: '11px',
  },
  toolPending: {
    color: '#9B8A94',
    fontSize: '11px',
    fontStyle: 'italic',
  },
  thinking: {
    fontSize: '14px',
    color: '#9B8A94',
    fontStyle: 'italic',
  },
  errorBanner: {
    background: '#FDEAEA',
    color: '#B33A3A',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '13px',
  },
  inputForm: {
    display: 'flex',
    gap: '8px',
    padding: '12px 16px',
    borderTop: '1px solid #E8D5D0',
    flexShrink: 0,
  },
  input: {
    flex: 1,
    padding: '10px 14px',
    fontSize: '14px',
    border: '1px solid #E8D5D0',
    borderRadius: '20px',
    outline: 'none',
    background: '#fff',
    color: '#3D2B35',
    fontFamily: 'inherit',
  },
  sendButton: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 600,
    border: 'none',
    borderRadius: '20px',
    background: '#8B5E83',
    color: '#fff',
    cursor: 'pointer',
    flexShrink: 0,
    fontFamily: 'inherit',
  },
  sendButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};
