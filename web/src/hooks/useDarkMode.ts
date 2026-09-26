/**
 * useDarkMode — returns true when Tailwind's dark class is on <html>.
 *
 * Uses a single shared MutationObserver so all callers (e.g. every WantCard)
 * share one DOM observation rather than creating one per component instance.
 */
import { useState, useEffect } from 'react';

type Setter = (dark: boolean) => void;

const listeners = new Set<Setter>();
let sharedObserver: MutationObserver | null = null;

function currentIsDark(): boolean {
  return typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark');
}

function ensureObserver(): void {
  if (sharedObserver) return;
  sharedObserver = new MutationObserver(() => {
    const dark = currentIsDark();
    listeners.forEach(fn => fn(dark));
  });
  sharedObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
}

export function useDarkMode(): boolean {
  const [isDark, setIsDark] = useState(currentIsDark);

  useEffect(() => {
    ensureObserver();
    listeners.add(setIsDark);
    return () => { listeners.delete(setIsDark); };
  }, []);

  return isDark;
}
