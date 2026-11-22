import React from 'react';

/**
 * A want type as a filled block, the way the board draws a want up close:
 * the type's colour all over (solidTypeColor), its glyph white at the top
 * left, a small white label at the top right, and a white face set into the
 * block below them holding whatever this surface has to say — the Add Want
 * picker its name, the Want Types page its name and description. The board's
 * own (WantTileFace) lays a want's card out the same way.
 *
 * Sized by the block's height (container query units), so the one shape
 * scales from a picker's square to a page's wide card with nothing measured.
 */
export const SolidTypeFace: React.FC<{
  /** The block's colour (solidTypeColor). */
  color: string;
  /** The glyph, drawn white (SOLID_ICON_STYLE). */
  icon: React.ReactNode;
  /** Top right, white and small: a category, a want's name. */
  label?: React.ReactNode;
  /** What the white face says. */
  children?: React.ReactNode;
  className?: string;
}> = ({ color, icon, label, children, className }) => (
  <div
    className={`absolute inset-0 overflow-hidden rounded-[inherit] ${className ?? ''}`}
    style={{ background: color, containerType: 'size' }}
  >
    <div
      className="absolute flex items-center justify-center text-white [&_svg]:w-full [&_svg]:h-full"
      style={{ left: 'calc(max(5px, 6.5cqh) + 2px)', top: 'max(5px, 6.5cqh)', width: 'max(16px, 21cqh)', height: 'max(16px, 21cqh)' }}
      aria-hidden
    >
      {icon}
    </div>
    {label != null && label !== '' && (
      <div
        className="absolute text-right font-bold text-white truncate"
        style={{
          left: 'calc(max(5px, 6.5cqh) * 2 + max(16px, 21cqh) + 6px)',
          right: 'calc(max(5px, 6.5cqh) + 2px)',
          top: 'max(5px, 6.5cqh)',
          height: 'max(16px, 21cqh)',
          lineHeight: 'max(16px, 21cqh)',
          fontSize: 'max(9px, 6.5cqh)',
        }}
      >
        {label}
      </div>
    )}
    <div
      className="absolute bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden"
      style={{
        left: 'max(5px, 6.5cqh)',
        right: 'max(5px, 6.5cqh)',
        top: 'calc(max(5px, 6.5cqh) + max(16px, 21cqh) + 6cqh)',
        bottom: 'max(5px, 6.5cqh)',
        borderRadius: 'max(6px, 7cqh)',
      }}
    >
      {children}
    </div>
  </div>
);
