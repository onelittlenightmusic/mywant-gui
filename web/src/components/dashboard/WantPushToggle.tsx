import React, { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import {
  getPushState,
  subscribeToPush,
  unsubscribeFromPush,
  type PushState,
} from '@/lib/push';

/**
 * Bell toggle for the /w/<id> app — turns Web Push on for this want. The
 * permission prompt needs a real tap, so this lives on the page rather than
 * firing on load. Hidden where push is unsupported.
 */
export const WantPushToggle: React.FC<{ wantId: string }> = ({ wantId }) => {
  const [state, setState] = useState<PushState>('default');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getPushState().then(setState);
  }, []);

  if (state === 'unsupported') return null;

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (state === 'subscribed') {
        await unsubscribeFromPush();
        setState('default');
      } else {
        setState(await subscribeToPush(wantId));
      }
    } catch {
      setState(await getPushState());
    } finally {
      setBusy(false);
    }
  };

  const { Icon, label, tone } =
    state === 'subscribed'
      ? { Icon: BellRing, label: '通知オン', tone: 'text-sky-600 dark:text-sky-400' }
      : state === 'denied'
        ? { Icon: BellOff, label: 'ブラウザで通知が拒否されています', tone: 'text-gray-400' }
        : { Icon: Bell, label: '通知をオン', tone: 'text-gray-500 dark:text-gray-400' };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || state === 'denied'}
      title={label}
      aria-label={label}
      className={`fixed z-50 rounded-full bg-white/85 dark:bg-gray-800/85 backdrop-blur
        p-2 shadow-md active:scale-95 disabled:opacity-60 ${tone}`}
      style={{
        top: 'calc(env(safe-area-inset-top, 0px) + 8px)',
        right: 'calc(env(safe-area-inset-right, 0px) + 8px)',
      }}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
};
