import React from 'react';
import { characterShapePath } from '@/shared/characterShapes';

/**
 * A character's avatar in the outline they have chosen — the badge that used to
 * be a hard-coded circle in every place a person is drawn.
 *
 * The frame is one SVG path in a 100x100 box (see shared/characterShapes.ts),
 * filled and stroked with the character's own colour — flat, one colour, no
 * wash inside the outline.
 *
 * It used to be the outline solid over the colour at 20% (what the old
 * `backgroundColor: color + '33'` + `border: Npx solid color` produced), so
 * every character was a ring around a pale version of themselves and the board
 * showed through the middle. The silhouette is the thing to be recognised, and
 * a solid one carries its colour at any size — which is the same argument the
 * shapes themselves are here for.
 *
 * The emoji is laid over the middle of the box rather than flowed inside the
 * shape: a star or a plane has no inside to speak of, and an avatar that shrank
 * to fit the narrowest shape would make every other shape's badge look empty.
 *
 * Forwards its ref to the outer box because the walk cycle bounces this element
 * directly (cursorManEmojiRef in CursorManView) — a badge that cannot be moved
 * imperatively is not a drop-in for what was there.
 */
export interface CharacterBadgeProps {
  avatar: string;
  color: string;
  /** Shape id; anything unset or unknown draws the default circle. */
  shape?: string | null;
  /** Box size in px — the badge is always square. */
  size: number;
  /** Outline weight in px, in the same terms the old CSS border used. */
  strokeWidth?: number;
  /** Emoji size in px. Defaults to a little over half the box. */
  fontSize?: number;
  style?: React.CSSProperties;
  className?: string;
  title?: string;
}

export const CharacterBadge = React.forwardRef<HTMLDivElement, CharacterBadgeProps>(
  ({ avatar, color, shape, size, strokeWidth = 2.5, fontSize, style, className, title }, ref) => {
    const glyph = fontSize ?? Math.round(size * 0.56);
    return (
      <div
        ref={ref}
        className={className}
        title={title}
        style={{
          position: 'relative',
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style,
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          // The points of a star and the wings of a plane reach the edge of the
          // box, and a stroke straddles the path — so half of it would be cut
          // off by the viewport without this.
          style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
          aria-hidden
        >
          <path
            d={characterShapePath(shape)}
            fill={color}
            stroke={color}
            // Given in px of the rendered badge, converted to the box's own
            // units, so the outline stays the same visual weight at any size —
            // the way a CSS border did.
            strokeWidth={(strokeWidth * 100) / size}
            strokeLinejoin="round"
          />
        </svg>
        <span style={{ position: 'relative', fontSize: glyph, lineHeight: 1, pointerEvents: 'none' }}>
          {avatar}
        </span>
      </div>
    );
  },
);

CharacterBadge.displayName = 'CharacterBadge';
