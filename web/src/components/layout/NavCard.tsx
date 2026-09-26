import React from 'react';
import { Link } from 'react-router-dom';
import { classNames } from '@/utils/helpers';

/**
 * One hamburger-menu destination, as a card.
 *
 * The same principle the want cards were just put on (see WantCard/CardFrame):
 * an eyecatch on the left at a size you can actually aim at, and the words
 * beside it. Here it buys something extra — as a row, each entry needed the
 * full menu width for a single short word, so the menu was a tall column that
 * ran off small screens. As cards they tile three across and the whole map of
 * the app is visible without scrolling.
 *
 * The label is fitted to the space rather than set: `--fit` is the size at
 * which this particular label stops fitting, in cqw against the card's own
 * width, so a narrow menu shrinks "Achievements" without touching "Thing".
 * See .nav-card in styles/index.css.
 */

/**
 * How many characters have to fit on one line.
 *
 * The longest WORD, not the whole label — a label with a space in it ("Want
 * Types") wraps to the second line for free, so sizing it by its total length
 * would shrink it for a constraint it doesn't have.
 */
function longestWord(label: string): number {
  return label.split(/\s+/).reduce((n, w) => Math.max(n, w.length), 1);
}

export interface NavCardProps {
  /** Matches NAV_ENTRIES: a plain component, not necessarily a Lucide icon. */
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  /** The entry's accent — the icon takes it, and so does the badge dot. */
  color?: string;
  /** Route to navigate to. Omit for entries that open a modal instead. */
  to?: string;
  onClick?: () => void;
  active?: boolean;
  /** Keyboard/gamepad cursor is on this one. */
  focused?: boolean;
  /** Show the unread marker. */
  badge?: boolean;
  onMouseEnter?: () => void;
  /** Index the menu's keyboard navigation scrolls to. */
  menuIdx?: number;
}

export const NavCard: React.FC<NavCardProps> = ({
  icon: Icon, label, color, to, onClick, active, focused, badge, onMouseEnter, menuIdx,
}) => {
  const className = classNames(
    'nav-card relative flex items-center gap-1.5 px-2 py-2 rounded-lg font-medium transition-colors text-left',
    active
      ? 'bg-primary-100 text-primary-900 dark:bg-primary-900/30 dark:text-primary-300'
      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200',
    focused && !active && 'ring-2 ring-inset ring-sky-400 dark:ring-sky-400 bg-sky-50 dark:bg-sky-900/20',
  );

  // The one number the CSS needs: how many characters must survive on a line.
  const style = { '--fit-chars': longestWord(label) } as React.CSSProperties;

  const inner = (
    <>
      <Icon className="nav-card-icon flex-shrink-0" style={{ color }} />
      <span className="nav-card-label min-w-0 flex-1 leading-tight break-words line-clamp-2">
        {label}
      </span>
      {badge && (
        <span
          aria-hidden
          className="absolute top-1 right-1 block w-2 h-2 rounded-full ring-2 ring-slate-100 dark:ring-gray-900"
          style={{ background: color ?? '#ef4444' }}
        />
      )}
    </>
  );

  const shared = {
    className,
    style,
    onMouseEnter,
    role: 'menuitem' as const,
    'data-menu-idx': menuIdx,
  };

  if (to) {
    return (
      <Link {...shared} to={to} onClick={onClick} onMouseDown={(e) => e.preventDefault()}>
        {inner}
      </Link>
    );
  }
  return (
    <button {...shared} onClick={onClick} type="button">
      {inner}
    </button>
  );
};
