import { useEffect, useState } from 'react';
import { isOwed, subscribeOutbox } from '@/api/outbox';

/**
 * Whether a particular change is still owed to the server.
 *
 * For a control that would rather say "not saved yet" than say nothing. It
 * will read false almost always and almost immediately — which is the point:
 * the mark appears only when something is actually held up.
 */
export function useOwed(key: string | null): boolean {
  const [owed, setOwed] = useState(false);
  useEffect(() => {
    if (!key) { setOwed(false); return; }
    return subscribeOutbox(() => setOwed(isOwed(key)));
  }, [key]);
  return owed;
}
