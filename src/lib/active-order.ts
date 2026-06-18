// Remembers the customer's most recent order code on the device so they can
// jump back to live tracking after locking the phone, switching tabs, or
// leaving and reopening the app. Persisted in localStorage (survives reloads);
// cleared automatically once the order reaches a terminal state.

const KEY = 'colibri_active_order';

export function setActiveOrderCode(code: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, code);
    // Let any mounted ActiveOrderButton in this tab react immediately
    // (the native `storage` event only fires in *other* tabs).
    window.dispatchEvent(new Event('colibri:active-order'));
  } catch {
    /* storage unavailable (private mode / quota) — non-fatal */
  }
}

export function getActiveOrderCode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearActiveOrderCode(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event('colibri:active-order'));
  } catch {
    /* non-fatal */
  }
}
