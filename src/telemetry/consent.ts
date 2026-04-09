/**
 * Telemetry consent management.
 *
 * Off by default. The user must explicitly opt in via either:
 *   1. A first-launch prompt (shown once, on the first app visit)
 *   2. The Settings screen toggle
 *
 * When off, zero data leaves the device. GDPR-compliant: no pre-checked
 * box, clear disclosure, easy to revoke.
 */

const CONSENT_KEY = 'nofi_telemetry_consent';
const PROMPTED_KEY = 'nofi_telemetry_prompted';

/** Check if the user has opted in to telemetry. */
export function hasConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Set the telemetry consent flag. */
export function setConsent(enabled: boolean): void {
  try {
    localStorage.setItem(CONSENT_KEY, String(enabled));
  } catch {
    // Silently fail if localStorage is unavailable.
  }
}

/** Check if the first-launch consent prompt has been shown. */
export function wasPrompted(): boolean {
  try {
    return localStorage.getItem(PROMPTED_KEY) === 'true';
  } catch {
    return true; // If we can't check, assume prompted to avoid nagging.
  }
}

/** Mark the first-launch prompt as shown. */
export function markPrompted(): void {
  try {
    localStorage.setItem(PROMPTED_KEY, 'true');
  } catch {
    // Silently fail.
  }
}

/**
 * Show a first-launch consent prompt. Returns a Promise that resolves
 * when the user makes a choice. Non-blocking if they've already been
 * prompted.
 */
export function showConsentPrompt(container: HTMLElement): Promise<boolean> {
  return new Promise((resolve) => {
    if (wasPrompted()) {
      resolve(hasConsent());
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'game-settings-overlay';
    overlay.innerHTML = `
      <div class="game-settings-card" style="max-width:360px;">
        <h3 style="font-size:16px;margin-bottom:8px;">Help us improve</h3>
        <p style="font-size:13px;line-height:1.5;color:var(--text-secondary);margin-bottom:16px;">
          Can we collect anonymous play statistics to make the games better?
          <strong>No personal information</strong> is collected — just how games
          are played (scores, timing, difficulty). You can change this anytime
          in Settings.
        </p>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary" style="flex:1;padding:12px;" id="consent-no">No thanks</button>
          <button class="btn btn-primary" style="flex:1;padding:12px;" id="consent-yes">Sure, help out</button>
        </div>
        <a href="/privacy.html" target="_blank" rel="noopener"
           style="display:block;text-align:center;font-size:11px;color:var(--text-muted);margin-top:10px;text-decoration:underline;">
          Privacy policy
        </a>
      </div>
    `;
    container.appendChild(overlay);

    const cleanup = (choice: boolean): void => {
      setConsent(choice);
      markPrompted();
      overlay.remove();
      resolve(choice);
    };

    overlay.querySelector('#consent-yes')!.addEventListener('click', () => cleanup(true));
    overlay.querySelector('#consent-no')!.addEventListener('click', () => cleanup(false));
  });
}
