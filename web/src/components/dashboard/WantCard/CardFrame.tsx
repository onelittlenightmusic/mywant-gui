import React from 'react';
import { classNames } from '@/utils/helpers';
import { useSystemFontSize, CARD_FACE_NAME_SIZE } from '@/hooks/useSystemFontSize';

/**
 * The shape most want cards want: one thing to look at, and a few words worth
 * reading.
 *
 * Nearly every card that isn't a control turned out to be saying the same kind
 * of sentence — *here is the state, and here is what it is about*. A booking
 * that exists or doesn't and where it is; a mail and its subject; a usage ring
 * and when it resets; a picture and its status. Each had grown its own layout
 * for that sentence, so twelve cards had twelve type scales and twelve ideas of
 * where the eye should land first.
 *
 * So: an EYECATCH on the left — the thing you can read across a room, a badge
 * or a glyph or a photograph — and a DETAIL on the right, in the same large
 * type a thing card gives its name, because these lines are read rather than
 * skimmed. When the card is maximised the two restack, eyecatch above and
 * detail below, which is how a full-screen player is laid out and for the same
 * reason: given room, the picture should have it.
 *
 * The rearranging is done by container queries in index.css (.wc-frame), not by
 * `isExpanded`, so a card laid out this way also reflows when it is merely
 * *wide* — dragged large on the dashboard, say — without anyone telling it that
 * it has been maximised.
 *
 * This is also the layout plugins outside the repo are styled against, by the
 * class names .wc-frame / .wc-eye / .wc-detail. Renaming them is a breaking
 * change for those plugins, not just an internal edit.
 *
 * Cards this does NOT suit, and shouldn't be forced onto: the ones where the
 * control *is* the content (slider, switch, choice, direction), and the ones
 * whose one element already fills the card (gauge, timer, a Grafana iframe).
 * Those have no second half to fill.
 */

interface CardFrameProps {
  /** The thing to look at. Use CardFrameBadge / CardFrameImage, or your own. */
  eyecatch: React.ReactNode;
  /** The words. Use CardFrameTitle / CardFrameLine, or your own. */
  children: React.ReactNode;
  /**
   * Hide the detail half while the card is narrow, showing only the eyecatch.
   * For the few cards whose detail side cannot survive being squeezed — a
   * calendar, a row of selects. Most cards want the default (both, always):
   * their detail IS the answer, so dropping it leaves a card that says nothing.
   */
  collapseDetail?: boolean;
  className?: string;
}

export const CardFrame: React.FC<CardFrameProps> = ({ eyecatch, children, collapseDetail, className }) => (
  <div className={classNames('wc-frame', collapseDetail && 'wc-frame-collapse', className)}>
    <div className="wc-eye">{eyecatch}</div>
    <div className="wc-detail">{children}</div>
  </div>
);

/**
 * The most common eyecatch: a glyph on a coloured field, with a word under it.
 *
 * The colour is what carries at a distance — "予約あり" is legible only once
 * you are close enough to read, but green against grey is not. So `tone`
 * decides the field, and the caption is a confirmation rather than the message.
 *
 * Sized in `em` off the card's own font size, so it shrinks with the tile
 * instead of overflowing it at small grid scales.
 */
export const CardFrameBadge: React.FC<{
  icon: React.ReactNode;
  caption?: React.ReactNode;
  /** Any CSS colour. The field is a wash of it; the glyph takes it solid. */
  color: string;
  /** Solid field with white ink — for the states that should shout. */
  filled?: boolean;
  /** Round rather than rounded — suits a single glyph with no caption. */
  round?: boolean;
  className?: string;
  style?: React.CSSProperties;
}> = ({ icon, caption, color, filled, round, className, style }) => (
  <div
    className={classNames(
      'flex flex-col items-center justify-center gap-1 max-w-full max-h-full',
      // A round badge takes its size from the height and squares itself off; a
      // rectangular one fills the half it was given. Giving the round one
      // w-full too would beat aspect-square and hand back an ellipse.
      round ? 'rounded-full h-full aspect-square' : 'rounded-xl w-full h-full',
      className,
    )}
    style={{
      background: filled ? color : `${color}1a`,
      border: filled ? `2px solid ${color}` : `2px solid ${color}66`,
      boxShadow: `0 4px 12px ${color}33`,
      color: filled ? '#fff' : color,
      padding: round ? 0 : '0.4em 0.5em',
      ...style,
    }}
  >
    {icon}
    {caption != null && (
      <span className="font-bold leading-none text-center whitespace-nowrap text-[0.85em] max-w-full truncate">
        {caption}
      </span>
    )}
  </div>
);

/**
 * A picture as the eyecatch: filling its half and clipped, not letterboxed
 * inside it.
 *
 * `cover` on purpose. A card is a glance, and a contained image on a wide half
 * is mostly empty card — the crop loses edges but keeps the subject, which is
 * the part doing the work. Maximised, the same rule applies to a much larger
 * box, so little is lost by then.
 */
export const CardFrameImage: React.FC<{
  src: string;
  alt?: string;
  /** Shown in the image's place when there is no src yet. */
  fallback?: React.ReactNode;
}> = ({ src, alt = '', fallback }) =>
  src ? (
    <img src={src} alt={alt} className="wc-eye-img" />
  ) : (
    <div className="w-full h-full rounded-[10px] flex items-center justify-center
                    bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500">
      {fallback ?? '—'}
    </div>
  );

/**
 * The detail's first line, at the size a thing card gives its name.
 *
 * Deliberately large. These cards exist to answer one question, and answering
 * it in caption type means the card has to be picked up and inspected — at
 * which point the frame has failed at the only thing it is for.
 */
export const CardFrameTitle: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  const faceNameSize = CARD_FACE_NAME_SIZE[useSystemFontSize()];
  return (
    <span
      className={classNames(
        'font-semibold leading-tight truncate text-gray-800 dark:text-gray-100',
        faceNameSize,
        className,
      )}
    >
      {children}
    </span>
  );
};

/** A following line: same scale as the title, dimmer, so the order still reads. */
export const CardFrameLine: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  const faceNameSize = CARD_FACE_NAME_SIZE[useSystemFontSize()];
  return (
    <span
      className={classNames(
        'font-semibold leading-tight truncate text-gray-600 dark:text-gray-300',
        faceNameSize,
        className,
      )}
    >
      {children}
    </span>
  );
};

/** The smallest line — a status, a count, a note. Not part of the answer. */
export const CardFrameNote: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <span className={classNames('text-[0.8em] leading-snug truncate text-gray-400 dark:text-gray-500', className)}>
    {children}
  </span>
);
