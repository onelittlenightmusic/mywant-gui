import React from 'react';
import { useNotificationStore } from '@/stores/notificationStore';
import { CountBadge } from '@/components/common/CountBadge';
import { useMyCursorColor } from '@/hooks/useMyCursorColor';
import { useDarkMode } from '@/hooks/useDarkMode';
import { characterBadgeColor } from '@/design/characterColor';
import { useWantAllowsNotification } from '@/utils/wantNotifications';

/**
 * Count badge for a want's unread alerts (see notificationStore). Renders
 * nothing when the count is zero — or when the want is scenery that has opted
 * out with `notification: "false"` (see useWantAllowsNotification) — so callers
 * can drop it in unconditionally and every surface that draws a want's badge
 * obeys the label without knowing about it.
 *
 * The look is CountBadge's — this is now only the store subscription and the
 * colour. See that component for why the four hand-rolled badges this used to
 * be one of were collapsed into it.
 *
 * Painted in the viewer's own character colour at notification-badge weight
 * (characterBadgeColor — brighter and more saturated than a frame, still off
 * the raw cursor). Every "this is yours" mark on the board carries the
 * character's hue; an unread alert is one of those.
 */
export const WantNotifyBadge: React.FC<{
  wantId: string;
  /** absolute-position (and z-index) supplied by the caller */
  style?: React.CSSProperties;
  size?: number;
}> = ({ wantId, style, size = 18 }) => {
  const count = useNotificationStore((s) => s.counts[wantId] ?? 0);
  const allowed = useWantAllowsNotification(wantId);
  const cursor = useMyCursorColor();
  const isDark = useDarkMode();
  if (count <= 0 || !allowed) return null;
  return (
    <CountBadge
      count={count}
      color={characterBadgeColor(cursor, isDark)}
      surface="board"
      size={size}
      ariaLabel={`${count} 件の未読通知`}
      style={style}
    />
  );
};
