/**
 * The want types (and recipes) this person last picked to add a want with,
 * newest first — for the Add Want picker's "Recent" order. Kept in this
 * browser (a person's convenience, not the board's): a private window, or
 * storage turned off, simply has none.
 */
const KEY = 'mywant.recentWantTypes';
const KEPT = 50;

export function recentWantTypes(): Record<string, number> {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed as Record<string, number> : {};
  } catch {
    return {};
  }
}

/** This one picked now. */
export function noteWantTypePicked(id: string): void {
  try {
    const all = { ...recentWantTypes(), [id]: Date.now() };
    const kept = Object.entries(all).sort((a, b) => b[1] - a[1]).slice(0, KEPT);
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(kept)));
  } catch {
    // Storage off: nothing remembered.
  }
}

const SORT_KEY = 'mywant.wantPickerSort';

/** The picker's order as this person last left it. */
export function pickerSortMode<T extends string>(allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(SORT_KEY) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

export function notePickerSortMode(mode: string): void {
  try { localStorage.setItem(SORT_KEY, mode); } catch { /* storage off */ }
}
