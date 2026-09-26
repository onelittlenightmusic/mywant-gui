import React from 'react';
import { ThingDot } from './ThingDot';

interface DogEarBookmarksProps {
  /** One color per bookmark, e.g. the marking character(s)' colors. Empty renders nothing. */
  colors: string[];
  size?: number;
  className?: string;
}

/**
 * Small stacked marks in the top-right of the nearest positioned ancestor —
 * same drop-in shape as DogEarFlags (colors/size/className).
 *
 * Pressing X on a value both marks it as that character's aura default and
 * names it into the thing, so the mark wears the dot every remembered value
 * wears: the mark and the thing card it produced are the same thing seen twice.
 * (The dog-ear silhouette this used to draw said "marked, not remembered" — a
 * distinction the X gesture never actually made.)
 */
export const DogEarBookmarks: React.FC<DogEarBookmarksProps> = ({ colors, size = 12, className }) => {
  if (colors.length === 0) return null;

  return (
    <div className={`absolute top-0 right-0 z-10 pointer-events-none flex ${className ?? ''}`}>
      {colors.map((color, i) => (
        <ThingDot
          key={i}
          color={color}
          size={size}
          style={{ marginRight: i === 0 ? 0 : -size * 0.35 }}
        />
      ))}
    </div>
  );
};
