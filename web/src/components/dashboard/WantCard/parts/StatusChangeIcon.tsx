import React, { useEffect, useRef, useState } from 'react';
import {
  Check, Hand, X, Pause, Square, Trash2, Ban, Loader, Circle, AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { getStatusHexColor } from './StatusColor';
import type { WantExecutionStatus, WantPhase } from '@/types/want';

// Icon shape per status. Colour comes from getStatusHexColor so it stays in sync
// with the status dots used elsewhere (minimap, children dots). Anything not
// listed falls back to a plain circle — the same "just a coloured mark" the dot
// used to be.
const STATUS_ICON: Record<string, LucideIcon> = {
  achieved:              Check,
  achieved_with_warning: Check,
  reaching:              Loader,
  reaching_with_warning: AlertTriangle,
  initializing:          Loader,
  waiting_user_action:   Hand,
  suspended:             Pause,
  stopped:               Square,
  failed:                X,
  module_error:          X,
  config_error:          AlertTriangle,
  deleting:              Trash2,
  terminated:            Ban,
  cancelled:             Ban,
  created:               Circle,
  pending:               Circle,
};

const SIZE_CLASS = {
  xs: 'h-3 w-3 sm:h-3.5 sm:w-3.5',
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
} as const;

interface StatusChangeIconProps {
  status?: string;
  /** xs for compact cards, sm for headers, md for modals. */
  size?: 'xs' | 'sm' | 'md';
  /** Show the status text next to the icon (sidebar header). */
  showLabel?: boolean;
  className?: string;
}

/**
 * The status of a want, drawn as an icon in the slot the status dot / battery
 * used to hold. It bounces big (animate-status-bounce) whenever the status
 * transitions to a new value — but stays still if the card mounts already in
 * that status (e.g. page reload), so a screen full of cards doesn't all jump at
 * once.
 */
export const StatusChangeIcon: React.FC<StatusChangeIconProps> = ({
  status,
  size = 'xs',
  showLabel = false,
  className,
}) => {
  const [bounceKey, setBounceKey] = useState(0);
  const prevStatus = useRef<string | null | undefined>(null);

  useEffect(() => {
    // Skip the very first observation so an already-settled card mounts quietly.
    if (prevStatus.current === null) {
      prevStatus.current = status;
      return;
    }
    if (status !== prevStatus.current) {
      setBounceKey((k) => k + 1);
    }
    prevStatus.current = status;
  }, [status]);

  if (!status) return null;

  const Icon = STATUS_ICON[status] ?? Circle;
  const color = getStatusHexColor(status as WantExecutionStatus | WantPhase);

  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ''}`} title={status}>
      <Icon
        // Remounting on each change (key) restarts the CSS bounce; the animation
        // only applies once a real status transition has occurred.
        key={bounceKey}
        className={`${SIZE_CLASS[size]} flex-shrink-0 ${bounceKey > 0 ? 'animate-status-bounce' : ''}`}
        style={{ color }}
        strokeWidth={2.5}
      />
      {showLabel && (
        <span className="font-medium capitalize text-gray-700 dark:text-gray-300 text-xs">
          {status}
        </span>
      )}
    </span>
  );
};
