import React, { useEffect, useState } from 'react';
import { useNoticeStore } from '@/stores/noticeStore';

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
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9000] max-w-[90vw] px-4 py-2 rounded-lg shadow-lg bg-gray-900/90 text-white text-sm dark:bg-gray-100/90 dark:text-gray-900"
    >
      {message}
    </div>
  );
};
