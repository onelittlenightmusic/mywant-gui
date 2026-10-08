import React from 'react';
import { Clock, Heart } from 'lucide-react';
import { useListOrderStore, type ListOrder, type OrderedList } from '@/stores/listOrderStore';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useMyCursorColor } from '@/hooks/useMyCursorColor';
import {
  CARD_BORDER_BASE, CARD_FOCUS_BASE, CARD_HOVER_RING, CARD_SHELL_BASE, focusGlowVars, hoverRingVars,
} from '@/components/dashboard/WantCard/hooks/cardStyles';
import { classNames } from '@/utils/helpers';

/**
 * Each order is a face of its own: what the card is, while that order holds.
 * Warm for the order the user made, cool for the clock's.
 */
const FACES: Record<ListOrder, { label: string; caption: string; Icon: typeof Clock; light: string; dark: string }> = {
  favorite: {
    label: 'お気に入り',
    caption: '自分で並べた順',
    Icon: Heart,
    light: 'linear-gradient(135deg, #fbbf24 0%, #f472b6 100%)',
    dark: 'linear-gradient(135deg, #b45309 0%, #be185d 100%)',
  },
  recent: {
    label: '最近',
    caption: '最後に更新された順',
    Icon: Clock,
    light: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)',
    dark: 'linear-gradient(135deg, #0369a1 0%, #4338ca 100%)',
  },
};
const ORDERS: ListOrder[] = ['favorite', 'recent'];

/**
 * The first card of the want list and the thing list: which order the list is
 * in, as a card like the others on its page — the same shell, rings and size
 * (`sizeClass`: the page's own card height) — whose
 * whole face is the order in force. A tap anywhere turns it to the other face,
 * and the list behind it reorders.
 *
 * お気に入り is the order the user put the list in; 最近 puts the one updated
 * last first (a field written by a run, a restart, an answer). Both are on the
 * card where a card keeps its type — the chip at the lower left — the one in
 * force lit, so what a tap leads to is in sight.
 */
export const ListOrderCard: React.FC<{
  list: OrderedList;
  /** Stood on by the keyboard or a gamepad (the list's virtual slot). */
  focused?: boolean;
  /**
   * The height the page's own cards have, so this one is one of them: the want
   * list's follows the card-height setting (GRID_CARD_HEIGHT), the thing
   * list's is fixed (ENTITY_CARD_HEIGHT).
   */
  sizeClass: string;
  /** Drawn inside the card: the list's cursor, when it stands here. */
  children?: React.ReactNode;
  className?: string;
}> = ({ list, focused = false, sizeClass, children, className }) => {
  const order = useListOrderStore(s => s.order[list]);
  const toggle = useListOrderStore(s => s.toggle);
  const isDark = useDarkMode();
  const ring = useMyCursorColor();
  const face = FACES[order];
  return (
    <button
      type="button"
      onClick={() => toggle(list)}
      data-free-cursor-item
      data-list-order-card
      data-keyboard-nav-id="__list-order__"
      data-keyboard-nav-selected={focused}
      tabIndex={0}
      aria-label={`並び順：${face.label}（タップで切り替え）`}
      className={classNames(
        CARD_SHELL_BASE, CARD_HOVER_RING, CARD_BORDER_BASE, CARD_FOCUS_BASE,
        'relative w-full text-left select-none group hover:shadow-md transition-[box-shadow,transform] duration-300 active:scale-[0.98]',
        sizeClass,
        className,
      )}
      style={{ ...hoverRingVars(ring, isDark), ...(focused ? focusGlowVars(ring, isDark) : null) }}
    >
      {/* Both faces are laid down; the one in force shows, so a turn is a fade. */}
      {ORDERS.map(o => (
        <span
          key={o}
          aria-hidden
          className="absolute inset-0 transition-opacity duration-300"
          style={{ background: isDark ? FACES[o].dark : FACES[o].light, opacity: o === order ? 1 : 0 }}
        />
      ))}
      {children}
      <span className="relative z-10 flex h-full items-center gap-3 px-4 sm:px-6 text-white">
        <face.Icon
          className="w-10 h-10 sm:w-16 sm:h-16 flex-shrink-0"
          strokeWidth={1.75}
          style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.25))' }}
        />
        <span className="min-w-0">
          <span className="block text-xl sm:text-3xl font-bold leading-tight" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.25)' }}>
            {face.label}
          </span>
          <span className="block text-xs sm:text-sm text-white/85">{face.caption}</span>
        </span>
      </span>
      {/* The orders, where a card keeps its type: the one in force lit. */}
      <span className="absolute z-10 bottom-1.5 left-1.5 flex items-center gap-1 rounded-full bg-black/20 px-1.5 py-1">
        {ORDERS.map(o => {
          const { Icon } = FACES[o];
          return (
            <Icon
              key={o}
              className={classNames('w-3.5 h-3.5 transition-opacity', o === order ? 'text-white opacity-100' : 'text-white opacity-40')}
              strokeWidth={2.25}
            />
          );
        })}
      </span>
    </button>
  );
};
