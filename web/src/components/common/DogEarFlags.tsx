import React from 'react';

interface DogEarFlagsProps {
  /** One color per flag, e.g. the marking character(s)' colors. Empty renders nothing. */
  colors: string[];
  size?: number;
  className?: string;
}

/**
 * Small stacked dog-ear (folded-corner triangle) badges in the top-right of the
 * nearest positioned ancestor — same visual as CharacterCornerIcons' "flag"
 * variant, reused wherever a compact per-item owner indicator is needed (e.g.
 * a choice option's aura-default mark).
 */
export const DogEarFlags: React.FC<DogEarFlagsProps> = ({ colors, size = 10, className }) => {
  if (colors.length === 0) return null;

  return (
    <div className={`absolute top-0 right-0 z-10 pointer-events-none flex ${className ?? ''}`}>
      {colors.map((color, i) => (
        <div
          key={i}
          style={{
            width: size,
            height: size,
            marginRight: i === 0 ? 0 : -size * 0.55,
            background: color,
            clipPath: 'polygon(100% 0, 100% 100%, 0 0)',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.6)',
          }}
        />
      ))}
    </div>
  );
};
