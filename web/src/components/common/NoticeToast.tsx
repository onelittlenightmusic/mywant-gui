import React, { useEffect, useState } from 'react';
import { useNoticeStore } from '@/stores/noticeStore';
import { FIELD_CARD_SURFACE } from '@/design/cards';
import { classNames } from '@/utils/helpers';

/** How long a notice stays up. */
const SHOW_MS = 4000;

/**
 * Where a notice appears when nobody else has taken the job (see
 * stores/noticeStore). Bottom centre, for a few seconds.
 */
export const NoticeToast: React.FC = () => {
  const { message, seq } = useNoticeStore();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (seq === 0) return;
    setShown(true);
    const t = setTimeout(() => setShown(false), SHOW_MS);
    return () => clearTimeout(t);
  }, [seq]);
  if (!shown || !message) return null;
  return (
    <div
      role="status"
      // A card like the panels' fields, lifted a little higher than they are.
      className={classNames(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-[9000] max-w-[90vw] px-4 py-2 rounded-xl text-sm text-slate-700 dark:text-slate-200',
        FIELD_CARD_SURFACE, '!shadow-[4px_6px_16px_rgba(15,23,42,0.22)]',
      )}
    >
      {message}
    </div>
  );
};
