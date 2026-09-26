import React, { useEffect, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { classNames, formatRelativeTime } from '@/utils/helpers';
import { DisplayCard } from '@/components/forms/CardPrimitives';
import { MarkBadges, useMarkJump, type Mark } from '@/components/common/MarkButton';
import { WantIcon } from '@/components/dashboard/WantIcon';
import { useWantTypeStore } from '@/stores/wantTypeStore';
import { useIconFont } from '@/hooks/useDisplaySettings';
import { iconEmbossFilter, wantTypeIconStyle } from '@/components/dashboard/WantCardFace';
import { useDarkMode } from '@/hooks/useDarkMode';
import type { IconFamily } from '@/components/dashboard/WantTypeVisuals';

/**
 * One line of history, wherever the history is.
 *
 * A thing's provenance and a want's own past were two different-looking lists
 * before this — a bordered chip on one side, a `#3 · 2 lines` header strip on
 * the other — saying the same kind of thing: at this time, something happened,
 * and here is what. LogCard is that line, in the field cards' own visual
 * language: the want type it is about wears its icon in a small badge, the
 * headline sits in the card's ink colour, the time is said the way the want
 * log says it ("3分前"), and the body — a source note, a block of log text, an
 * itemised state snapshot — is whatever the caller hands as children.
 *
 * `mark` is where the line points, drawn as the same corner badge the field
 * cards wear and followed by Y while this card is the focused one in its list.
 * A thing's history points at the want that named the value; a want's own
 * history points nowhere — the want is the panel you are already on — so that
 * side passes no mark.
 */
export interface LogCardProps {
  /** The want type this entry concerns — its icon fills the badge and its
   *  category colour tints the badge and the headline. */
  wantType?: string;
  /** Badge glyph when there is no want type (a thing named from a card, say). */
  fallbackIcon?: LucideIcon;
  /** Badge / ink colour when there is no want type or its category has none. */
  fallbackColor?: string;
  /** The headline — what happened. */
  title: React.ReactNode;
  /** RFC3339 string or epoch-ms number; rendered as a relative time. */
  timestamp?: string | number | null;
  /** A quieter line under the headline — source, want type, character. */
  meta?: React.ReactNode;
  /** Where the line points. Omitted for a want's own history (the want is the
   *  page). Followed by Y when this card is focused. */
  mark?: Mark | null;
  /** The body: log text, a NestedCard, an itemised snapshot. */
  children?: React.ReactNode;
  isFocused?: boolean;
  onFocusRequest?: () => void;
  /** Y / follow, routed in from the list's grid nav; consumed on arrival. */
  followRequest?: boolean;
  onFollowRequestConsumed?: () => void;
}

export const LogCard: React.FC<LogCardProps> = ({
  wantType, fallbackIcon: FallbackIcon, fallbackColor,
  title, timestamp, meta, mark,
  children, isFocused, onFocusRequest,
  followRequest, onFollowRequestConsumed,
}) => {
  const wantTypes = useWantTypeStore((s) => s.wantTypes);
  const iconFont = useIconFont() as IconFamily;
  const isDark = useDarkMode();
  const jumpToMark = useMarkJump();

  const wt = wantType ? wantTypes.find((w) => w.name === wantType) : undefined;
  const category = wt?.category ?? '';
  const color = wantType
    ? (wantTypeIconStyle(wantType, category, isDark).color as string)
    : (fallbackColor ?? '#9ca3af');

  // Y on the focused card follows the mark — the same journey the badge's own
  // press makes (see useMarkJump), so the two never drift.
  useEffect(() => {
    if (!followRequest) return;
    onFollowRequestConsumed?.();
    if (mark) jumpToMark(mark);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followRequest]);

  const iso = timestamp == null
    ? undefined
    : typeof timestamp === 'number' ? new Date(timestamp).toISOString() : timestamp;

  // The list scrolls, so walking the arrows onto a card past the fold has to
  // bring it back into view — the ring alone is no help off-screen. The first
  // card is exempt: it is already at the top, and "scrolling it into view"
  // only drags its overhanging ring and mark badge up under whatever sits
  // pinned above the list.
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isFocused) return;
    const el = wrapRef.current;
    if (!el || el === el.parentElement?.firstElementChild) return;
    el.scrollIntoView({ block: 'nearest' });
  }, [isFocused]);

  return (
    <div ref={wrapRef} className="relative">
      <DisplayCard
        className={classNames(
          'relative w-full rounded-lg sm:rounded-xl p-2 shadow-sm',
          'bg-gray-50/80 dark:bg-gray-800/50',
          isFocused ? 'mw-card-focus bg-white dark:bg-gray-800' : '',
        )}
        onClick={onFocusRequest}
        showFocusBar={isFocused}
        inkColor={color}
        headerLeft={
          <>
            <span
              className="flex items-center justify-center w-6 h-6 rounded-md flex-shrink-0"
              style={{ backgroundColor: `${color}22`, boxShadow: `inset 0 0 0 1.5px ${color}55` }}
            >
              {wantType ? (
                <WantIcon
                  typeName={wantType} category={category} iconFont={iconFont} size={14}
                  iconStyle={{ color, filter: iconEmbossFilter(!isDark) }}
                />
              ) : FallbackIcon ? (
                <FallbackIcon className="w-3.5 h-3.5" style={{ color }} />
              ) : null}
            </span>
            <span className="text-[11px] font-semibold card-ink truncate leading-none min-w-0">{title}</span>
          </>
        }
        headerRight={
          iso ? <time className="text-[10px] text-gray-400 whitespace-nowrap">{formatRelativeTime(iso)}</time> : undefined
        }
      >
        {(meta || children) && (
          <div className="space-y-1">
            {meta && (
              <div className="text-[10px] text-gray-500 dark:text-gray-400">{meta}</div>
            )}
            {children}
          </div>
        )}
      </DisplayCard>

      {mark && <MarkBadges marks={[mark]} />}
    </div>
  );
};

LogCard.displayName = 'LogCard';
