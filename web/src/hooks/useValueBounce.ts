import { useEffect, useRef, useState } from 'react';

// Returns a bounce key that increments each time `value` changes to a *new*
// value — the initial mount is deliberately skipped so a freshly-opened card
// does not animate. Field cards use this to flash when their value updates live
// off the SSE `want_changed` stream: mount the value node with `key={bounceKey}`
// and apply the bounce animation only while `bounceKey > 0`, so remounting
// restarts the CSS animation on every subsequent change.
export function useValueBounce(value: unknown): number {
  const [bounceKey, setBounceKey] = useState(0);
  const prev = useRef<string | undefined>(undefined);
  const initialized = useRef(false);

  useEffect(() => {
    let key: string;
    try {
      key = value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value);
    } catch {
      key = String(value);
    }

    // First render for this card: remember the value, don't animate.
    if (!initialized.current) {
      initialized.current = true;
      prev.current = key;
      return;
    }

    if (prev.current !== key) {
      prev.current = key;
      setBounceKey((k) => k + 1);
    }
  }, [value]);

  return bounceKey;
}
