import React from 'react';
import { classNames } from '@/utils/helpers';

/**
 * The one button shape every want card uses.
 *
 * Card buttons had grown up one at a time, each in the plugin that needed it,
 * and they had drifted into a dozen different pills of text: "前の階に戻る",
 * "Open", "Replay", each a different width, each reading as a sentence you have
 * to finish before you know what it does. On a board you are walking around,
 * that is the wrong way round. The picture is what you recognise at a glance
 * and the words are the confirmation, so the icon is the button and the caption
 * sits under it, small.
 *
 * Near-square, and the same size everywhere: a row of these reads as a row of
 * controls rather than as a ragged line of links, and a square is the shape a
 * thumb expects to hit. The caption is allowed to be wider than the icon and to
 * wrap onto a second line — the button grows a little rather than truncating a
 * word, because a caption clipped to "前の階に…" tells you less than no caption
 * at all.
 *
 * Every button on a card is a stop in that card's inner-focus ring
 * (data-inner-focus), and takes no focus ring of its own: useInnerFocusRing
 * dresses the current stop in the character's colour, so every stop on every
 * card is marked the same way.
 */

export interface CardActionButtonProps {
  /** The picture. A lucide icon; it is sized here, so pass it bare. */
  icon: React.ReactNode;
  /** The words under it. Kept short — this is a caption, not a sentence. */
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** In flight. Shows pendingLabel instead, and refuses further presses. */
  pending?: boolean;
  pendingLabel?: string;
  /**
   * Make this the stop the caret lands on when the card is entered. One per
   * card — the thing a player most likely came here to do.
   */
  isDefaultStop?: boolean;
  /**
   * Colour of the button when it is not disabled, as a Tailwind class set.
   * Defaults to the primary tint every other stop uses; pass something else
   * only when the action itself has a colour (a destructive red, a live green).
   */
  tone?: string;
  className?: string;
  title?: string;
}

const DEFAULT_TONE =
  'border-primary-400 bg-primary-50 text-primary-700 ' +
  'dark:bg-primary-900/20 dark:border-primary-600 dark:text-primary-300';

export const CardActionButton: React.FC<CardActionButtonProps> = ({
  icon, label, onPress, disabled, pending, pendingLabel, isDefaultStop, tone, className, title,
}) => {
  const blocked = !!disabled || !!pending;
  const caption = pending ? (pendingLabel ?? label) : label;

  return (
    <button
      // A stop in the card's inner-focus ring: entering the card lands the
      // caret here, Tab and the arrows walk to it. See useInnerFocusRing.
      data-inner-focus
      {...(isDefaultStop ? { 'data-inner-focus-default': true } : {})}
      title={title ?? label}
      onClick={(e) => { e.stopPropagation(); if (!blocked) onPress(); }}
      // The board reads presses as walking and dragging; one that lands on a
      // button is meant for the button.
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      disabled={blocked}
      className={classNames(
        'inline-flex flex-col items-center justify-center gap-[0.15em]',
        // Square-ish: a floor on both sides, and only the caption may push it
        // wider. min-height on the box rather than a fixed height so a caption
        // that wraps is given the room instead of being cut.
        'min-w-[4.2em] min-h-[4.2em] px-[0.4em] py-[0.35em]',
        'rounded-lg border font-semibold',
        'disabled:opacity-50',
        tone ?? DEFAULT_TONE,
        className,
      )}
    >
      <span className="flex items-center justify-center text-[1.5em] leading-none" aria-hidden>
        {icon}
      </span>
      <span
        className="text-[0.62em] leading-[1.15] text-center max-w-[7em] break-words"
      >
        {caption}
      </span>
    </button>
  );
};
