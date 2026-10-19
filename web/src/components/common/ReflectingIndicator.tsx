import React, { useEffect, useState } from 'react';
import { useReflectingStore, isReflecting } from '@/stores/reflectingStore';
import { useHeaderAtBottom } from '@/hooks/useDisplaySettings';

/** A gap shorter than this is not worth saying — a fast line never sees it. */
const SHOW_AFTER_MS = 500;
const DOT_MS = 400;

/**
 * "reflecting." "reflecting.." "reflecting..." and round again, while a change
 * the server has taken is still on its way back to the board (reflectingStore);
 * null when there is nothing to say. Whoever draws it — the corner here, or the
 * board beside the character — draws these same words.
 */
export function useReflectingText(): string | null {
  const reflecting = useReflectingStore(s => isReflecting(s.sentAt));
  const [shown, setShown] = useState(false);
  const [dots, setDots] = useState(1);

  useEffect(() => {
    if (!reflecting) { setShown(false); return; }
    const t = setTimeout(() => setShown(true), SHOW_AFTER_MS);
    return () => clearTimeout(t);
  }, [reflecting]);

  useEffect(() => {
    if (!shown) return;
    setDots(1);
    const t = setInterval(() => setDots(d => (d % 3) + 1), DOT_MS);
    return () => clearInterval(t);
  }, [shown]);

  return shown ? `reflecting${'.'.repeat(dots)}` : null;
}

/**
 * The words in the bottom-right corner — unless somewhere better placed has
 * taken the job (claimReflecting): on the board, beside the character.
 */
export const ReflectingIndicator: React.FC = () => {
  const claimed = useReflectingStore(s => s.claims > 0);
  if (claimed) return null;
  return <CornerReflecting />;
};

const CornerReflecting: React.FC = () => {
  const text = useReflectingText();
  const headerAtBottom = useHeaderAtBottom();
  if (!text) return null;
  const edge = 'calc(env(safe-area-inset-bottom, 0px) + var(--host-inset-bottom, 0px) + 12px)';
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-3 z-[9000] pointer-events-none px-3 py-1 rounded-full bg-gray-900/75 text-white text-xs font-mono dark:bg-gray-100/80 dark:text-gray-900"
      style={{ bottom: headerAtBottom ? `calc(${edge} + var(--header-height, 0px))` : edge }}
    >
      {/* The dots in a box of their own width, so the word does not shift. */}
      {text.replace(/\.+$/, '')}<span className="inline-block w-[3ch] text-left">{text.match(/\.+$/)?.[0]}</span>
    </div>
  );
};
