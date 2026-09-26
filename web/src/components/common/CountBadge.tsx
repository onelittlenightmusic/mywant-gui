import React from 'react';
import { classNames } from '@/utils/helpers';
import { boardLiftShadow } from '@/components/dashboard/WantCardFace';
import { characterInkOn } from '@/design/characterColor';

/**
 * A count pinned to the corner of something.
 *
 * There were four of these, and they agreed on nothing. The sidebar's tab
 * badge was 14px blue with no border and no shadow; the form tab's was the
 * same 14px but red-or-blue; a want tile's unread count was 18px red with a
 * 1.5px white ring; the child-expand control beside it was 20px cyan with a
 * 1.5px cyan ring. Two of them — the unread count and the expand control —
 * were even pinned to the SAME corner at almost the same coordinates
 * (`left + w - 10, top - 8` against `left + w - 11, top - 7`), so a want with
 * children and an unread alert drew one badge on top of the other.
 *
 * One component, one geometry. `size` is the only thing a caller varies, and
 * everything else — padding, type size, ring width, the lift — is derived from
 * it, so a 14px badge in a tab bar and a 20px one on the board are recognisably
 * the same object at two scales rather than two objects.
 */

export type CountBadgeTone = 'alert' | 'info' | 'accent' | 'quiet' | 'warn';

/**
 * Tones, not colours, at the call site: "this is an alert" survives a palette
 * change and `#ef4444` does not.
 */
const TONES: Record<CountBadgeTone, { bg: string; fg: string }> = {
  /** Unread, unhandled, wrong — anything the user is being asked to look at. */
  alert:  { bg: '#ef4444',             fg: '#ffffff' },
  /** A plain count: how many params, how many labels. No urgency. */
  info:   { bg: '#3b82f6',             fg: '#ffffff' },
  /** An engaged toggle — the expand control while its children are showing. */
  accent: { bg: '#22d3ee',             fg: '#0f172a' },
  /** The same control at rest: legible, but not competing with the alert. */
  quiet:  { bg: 'rgba(15,23,42,0.85)', fg: '#67e8f9' },
  /** Set-aside, not urgent — how many wants are in the archive. Amber so it
   *  belongs to the archive control it is pinned to rather than reading as an
   *  alert. */
  warn:   { bg: '#f59e0b',             fg: '#ffffff' },
};

/**
 * What the badge is pinned to, which is what decides whether it needs a ring
 * and a shadow — not its tone.
 *
 * `board`: a painted tile, a photo, a gradient. The ring is what stops a red
 *   disc from dissolving into a red want, and the lift is the board's own
 *   (boardLiftShadow), thrown by the same light as the block under it.
 * `panel`: a flat tab bar or sidebar. A ring and a shadow there are decoration
 *   on a surface that already separates the badge for free.
 */
export type CountBadgeSurface = 'board' | 'panel';

export interface CountBadgeProps {
  /** What to show. A number over 99 is rendered as `99+`. */
  count?: number;
  /** Shown instead of `count` — the expand control's `−` when it is open. */
  children?: React.ReactNode;
  tone?: CountBadgeTone;
  /**
   * Overrides the tone's background with an explicit colour — used where the
   * badge takes on a character's colour rather than a semantic tone (a want's
   * unread-alert count, the menu's attention dot). Text colour is chosen for
   * contrast; the surface ring is unchanged.
   */
  color?: string;
  /** What it is pinned to — see CountBadgeSurface. Defaults to `panel`. */
  surface?: CountBadgeSurface;
  /** Diameter in px; every other measurement is derived from it. */
  size?: number;
  /** Position (and z-index) is the caller's business, not the badge's. */
  style?: React.CSSProperties;
  className?: string;
  title?: string;
  ariaLabel?: string;
  /** Present makes the badge a real button rather than a static mark. */
  onClick?: (e: React.MouseEvent) => void;
  testId?: string;
}

export const CountBadge: React.FC<CountBadgeProps> = ({
  count,
  children,
  tone = 'alert',
  color,
  surface = 'panel',
  size = 18,
  style,
  className,
  title,
  ariaLabel,
  onClick,
  testId,
}) => {
  const t = TONES[tone];
  const bg = color ?? t.bg;
  const fg = color ? characterInkOn(color) : t.fg;
  const onBoard = surface === 'board';
  const content = children ?? (count != null && count > 99 ? '99+' : count);

  const css: React.CSSProperties = {
    minWidth: size,
    height: size,
    padding: `0 ${Math.round(size * 0.28)}px`,
    borderRadius: 'var(--r-pill)',
    backgroundColor: bg,
    color: fg,
    fontSize: Math.round(size * 0.6),
    fontWeight: 700,
    lineHeight: `${size}px`,
    textAlign: 'center',
    boxSizing: 'border-box',
    // On the board a badge is a SOLID BEAD, not a flat disc ringed in white —
    // the ring was the one thing here lit from nowhere, on a surface where
    // every block is top-lit and throws its shadow down-and-right. So: a
    // top-to-bottom sheen on the fill, a bright inset lip up top and a dark
    // one below to round it, a hairline dark edge for the silhouette (the
    // same one CubicWalls strokes its blocks with), and the board's own lift
    // underneath. On a flat panel none of that is needed — the panel already
    // separates the badge — so it stays a plain fill there.
    ...(onBoard
      ? {
          backgroundImage:
            'linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 44%, rgba(0,0,0,0.22) 100%)',
          boxShadow: [
            'inset 0 1px 0 rgba(255,255,255,0.5)',
            'inset 0 -1.5px 2px rgba(0,0,0,0.3)',
            '0 0 0 0.75px rgba(0,0,0,0.45)',
            boardLiftShadow(0.5),
          ].join(', '),
        }
      : null),
    ...(onClick ? { cursor: 'pointer' } : { pointerEvents: 'none' }),
    ...style,
  };

  const cls = classNames('flex items-center justify-center leading-none', className);

  return onClick ? (
    <button data-testid={testId} title={title} aria-label={ariaLabel} className={classNames('absolute', cls)} style={css} onClick={onClick}>
      {content}
    </button>
  ) : (
    <span data-testid={testId} title={title} aria-label={ariaLabel} className={cls} style={css}>
      {content}
    </span>
  );
};
