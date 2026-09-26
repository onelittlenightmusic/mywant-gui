import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useWantStore } from '@/stores/wantStore';
import { useWantTypeStore } from '@/stores/wantTypeStore';
import { WantCardContent } from '@/components/dashboard/WantCardContent';
import { useWantHomeIcon } from '@/hooks/useWantHomeIcon';
import { useIconFont } from '@/hooks/useDisplaySettings';
import { renderWantHomeIconPng, uploadWantHomeIcon } from '@/lib/wantHomeIcon';
import { useNotificationStore } from '@/stores/notificationStore';
import { WantPushToggle } from '@/components/dashboard/WantPushToggle';

/**
 * One want, on its own — the page a home-screen icon points at (`/w/:id`).
 *
 * Deliberately outside the app's Layout: no nav header, no sidebar, no card
 * frame. Just the want's own content, full-bleed, so that once it is added to
 * the home screen it launches like a single-purpose app. The store's 5-second
 * poll keeps it live; useWantHomeIcon swaps the page's title / icon / manifest
 * to this want's while it is open.
 */
export const WantAppPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const want = useWantStore((s) => s.wants.find((w) => (w.metadata?.id || w.id) === id));
  const fetchWants = useWantStore((s) => s.fetchWants);
  const loading = useWantStore((s) => s.loading);

  const wantType = want?.metadata?.type;
  const fetchWantTypes = useWantTypeStore((s) => s.fetchWantTypes);
  const category = useWantTypeStore((s) =>
    wantType ? s.wantTypes.find((wt) => wt.name === wantType)?.category : undefined,
  );
  const iconFont = useIconFont();
  const isRecipeBased = want?.metadata?.labels?.['recipe-based'] === 'true';
  const [runtimeIconReady, setRuntimeIconReady] = useState(false);

  useEffect(() => { void fetchWants().catch(() => {}); }, [id, fetchWants]);
  useEffect(() => { void fetchWantTypes().catch(() => {}); }, [fetchWantTypes]);

  // Render the want's real tile icon and upload it, so the apple-touch-icon can
  // point at the exact glyph the board shows (build-time /want-icons/ is only a
  // per-category fallback).
  useEffect(() => {
    if (!id || !wantType || !category) return;
    let cancelled = false;
    (async () => {
      try {
        for (const size of [180, 192, 512] as const) {
          const blob = await renderWantHomeIconPng({
            typeName: wantType,
            category,
            isRecipeBased,
            iconFont,
            size,
          });
          if (cancelled) return;
          await uploadWantHomeIcon(id, size, blob);
        }
        if (!cancelled) setRuntimeIconReady(true);
      } catch {
        /* keep the build-time per-category fallback */
      }
    })();
    return () => { cancelled = true; };
  }, [id, wantType, category, isRecipeBased, iconFont]);

  useWantHomeIcon(id, want?.metadata?.name, category, runtimeIconReady);

  // Opening the want-as-app is "I've seen it": clear its alerts, and mirror the
  // remaining unread total onto the home-screen icon badge where the platform
  // supports it (iOS 16.4+ installed web apps, Chrome). While the page is open
  // this keeps the badge live; while it is closed the service worker's push
  // handler (public/sw.js) does the same from the message payload.
  const unreadTotal = useNotificationStore((s) => s.total);
  const markRead = useNotificationStore((s) => s.markRead);
  useEffect(() => {
    if (id) void markRead(id);
  }, [id, markRead]);
  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (unreadTotal > 0) nav.setAppBadge?.(unreadTotal).catch(() => {});
    else nav.clearAppBadge?.().catch(() => {});
  }, [unreadTotal]);

  return (
    <div
      className="fixed inset-0 flex flex-col bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {id && <WantPushToggle wantId={id} />}
      {want ? (
        <div className="flex-1 min-h-0 overflow-auto">
          <WantCardContent
            want={want}
            isExpanded
            isFocused
            onView={() => {}}
          />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-gray-500 dark:text-gray-400">
          {loading ? '読み込み中…' : 'この want は見つかりませんでした'}
        </div>
      )}
    </div>
  );
};
