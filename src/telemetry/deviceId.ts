/**
 * Anonymous device identifier.
 *
 * Generates a random UUID on first visit and stores it in localStorage.
 * This is NOT a fingerprint — it's a simple persistent random ID that:
 * - Is unique per browser (not per person)
 * - Persists across sessions (localStorage)
 * - Is resettable by clearing site data
 * - Contains zero PII
 *
 * Later, when we add OAuth, the device ID can be linked to a user account
 * to merge anonymous history with authenticated identity.
 */

const STORAGE_KEY = 'nofi_device_id';

function generateUUID(): string {
  // crypto.randomUUID is available in all modern browsers + Node 19+.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: Math.random-based v4 UUID (good enough for an anonymous ID).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Get (or create) the persistent anonymous device ID. */
export function getDeviceId(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
    const id = generateUUID();
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    // localStorage unavailable (private browsing in some browsers).
    // Return a session-scoped ID — won't persist but at least groups
    // events within this session.
    return generateUUID();
  }
}

/** Detect the broad platform class from the user agent and screen size. */
export function detectPlatform(): 'mobile' | 'tablet' | 'desktop' {
  const w = window.innerWidth || screen.width;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

/** Collect non-PII device characteristics for player segmentation. */
export function getDeviceInfo(): {
  platform: string;
  screenW: number;
  screenH: number;
  timezone: string;
  language: string;
} {
  return {
    platform: detectPlatform(),
    screenW: screen.width,
    screenH: screen.height,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
  };
}
