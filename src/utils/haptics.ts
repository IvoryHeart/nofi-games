import { getSettings } from '../storage/scores';

let enabled = true;

export async function initHaptics(): Promise<void> {
  const settings = await getSettings();
  enabled = settings.vibrationEnabled;
}

export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

export function hapticLight(): void {
  if (!enabled) return;
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  } catch { /* ignore */ }
}

export function hapticMedium(): void {
  if (!enabled) return;
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate(25);
    }
  } catch { /* ignore */ }
}

export function hapticHeavy(): void {
  if (!enabled) return;
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate([30, 20, 40]);
    }
  } catch { /* ignore */ }
}

export function hapticError(): void {
  if (!enabled) return;
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 30, 50]);
    }
  } catch { /* ignore */ }
}
