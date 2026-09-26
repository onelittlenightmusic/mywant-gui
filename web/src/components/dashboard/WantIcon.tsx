/**
 * WantIcon — shared composite icon: main category/type icon + optional role badge.
 *
 * Reusable in:
 *  - WantCardFace  (canvas tiles, dark theme with drop-shadow)
 *  - WantInventoryPicker / WantSlot  (light or dark slot background)
 *  - Any other place that needs a semantic want icon with an optional child-role badge.
 *
 * The role badge (e.g. child/master/slave) is rendered as a small coloured circle
 * overlaid on the bottom-right corner of the main icon, matching the pattern
 * previously inlined in WantCardFace.
 */
import React from 'react';
import {
  resolveIconForFamily,
  getRoleIcon,
  getRoleColor,
  type IconFamily,
} from './WantTypeVisuals';
import { useWantTypeStore } from '@/stores/wantTypeStore';
import { wantTypeIconStyle } from './WantCardFace';

export interface WantIconProps {
  typeName: string;
  category: string;
  iconFont: IconFamily;
  /** Icon width & height in px (default 26) */
  size?: number;
  /** child-role label value — renders a coloured badge at the bottom-right corner */
  role?: string;
  /**
   * Light vs dark colour mode for the icon.
   *  true  → inherits CSS text colour (applies text-gray-600 / dark:text-gray-300)
   *  false → forces rgba(255,255,255,0.9) — suitable for dark/coloured backgrounds
   */
  isLight?: boolean;
  /** Extra className(s) applied directly to the icon SVG element */
  iconClassName?: string;
  /**
   * Extra style merged into the icon element's style (applied after isLight defaults).
   * Use this to add drop-shadow, flexShrink, etc. without overriding the colour logic.
   *   e.g. iconStyle={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
   */
  iconStyle?: React.CSSProperties;
  /** Wrapper div className */
  className?: string;
}

export const WantIcon: React.FC<WantIconProps> = ({
  typeName,
  category,
  iconFont,
  size = 26,
  role,
  isLight = false,
  iconClassName,
  iconStyle,
  className,
}) => {
  // Re-render whenever plugin icon maps update (e.g. custom type-icon labels)
  useWantTypeStore(s => s.typeIconMap);
  useWantTypeStore(s => s.categoryIconMap);

  const CatIcon = resolveIconForFamily(category, typeName, iconFont);
  const strokeWidth = iconFont === 'lucide-thin' ? 1 : undefined;

  const RoleIcon  = role ? getRoleIcon(role)  : null;
  const roleColor = role ? getRoleColor(role) : null;

  return (
    <div className={`relative inline-flex flex-shrink-0${className ? ` ${className}` : ''}`}>
      <CatIcon
        width={size}
        height={size}
        strokeWidth={strokeWidth}
        style={{
          // The type's own hue, lifted to a lightness that reads against the
          // surface it sits on.
          //
          // This used to be one white — rgba(255,255,255,0.9) — for every type
          // on anything dark, so a tile told you its category by the fill
          // behind the icon and then stopped: two types in the same category
          // were the same tile with the same white mark, and a Thing was white
          // on white. The formula already existed and half the callers already
          // passed it in by hand (wantTypeIconStyle); it is the default now, so
          // a surface has to opt OUT of telling you which type it is rather
          // than opt in. Callers can still override via iconStyle.
          ...wantTypeIconStyle(typeName, category, !isLight),
          flexShrink: 0,
          ...iconStyle,
        }}
        className={
          isLight
            ? `text-gray-600 dark:text-gray-300${iconClassName ? ` ${iconClassName}` : ''}`
            : iconClassName
        }
      />

      {/* Role badge — only rendered when a recognised role is provided */}
      {RoleIcon && roleColor && (
        <div
          className="absolute -bottom-2 -right-2 z-20 rounded-full flex items-center justify-center"
          style={{
            width: 24,
            height: 24,
            backgroundColor: `${roleColor}ee`,
            boxShadow: `0 0 6px ${roleColor}bb, 0 1px 3px rgba(0,0,0,0.4)`,
          }}
        >
          <RoleIcon size={15} color="white" />
        </div>
      )}
    </div>
  );
};
