/**
 * Tiny local cache for the user's display name so the greeting renders
 * instantly instead of waiting on a network round-trip. Cleared on sign-out.
 */
const NAME_KEY = 'nourish-display-name';

export function getCachedName(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(NAME_KEY);
  } catch {
    return null;
  }
}

export function setCachedName(name: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (name) localStorage.setItem(NAME_KEY, name);
    else localStorage.removeItem(NAME_KEY);
  } catch {
    /* storage unavailable — app still works, just not cached */
  }
}
