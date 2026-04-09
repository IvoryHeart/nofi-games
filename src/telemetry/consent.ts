/**
 * Telemetry consent management.
 *
 * Off by default. The user must explicitly opt in via the Settings screen.
 * When off, zero data leaves the device.
 */

const CONSENT_KEY = 'nofi_telemetry_consent';

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
