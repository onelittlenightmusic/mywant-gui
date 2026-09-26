import React from 'react';
import { THING_CLIP } from '@/utils/thingShape';
import { thingFaceText, thingInk, sphereBackground, thingNameShadow } from '@/utils/thingFace';
import { iconEmbossFilter, boardEdgeFilter } from '@/components/dashboard/WantCardFace';
import { resolveLucideIcon } from '@/utils/subtypeIcons';
import { useDarkMode } from '@/hooks/useDarkMode';

interface ThingDotProps {
  /** The dot's own colour: a data type's colour, or the marking character's. */
  color: string;
  /** Outer diameter in px. */
  size?: number;
  /** Lucide icon name. Omitted leaves a bare sphere, which is right below ~14px. */
  icon?: string;
  /**
   * The thing's name. Its first character is drawn over the glyph, the way the
   * canvas tile does it — the initial is what makes two dots of the same type
   * tell apart at a glance, and at this size only one character fits.
   */
  label?: string;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

/**
 * The one dot a remembered value wears, wherever it is drawn.
 *
 * The canvas has always drawn a thing as a small sphere, and everything else
 * that pointed at a thing drew something else: a dog-ear on a marked parameter,
 * a coloured pill on the map, a flat disc on a relation road. The shapes were
 * meant to separate "marked" from "remembered", but pressing X does both at
 * once — it sets the character's aura default AND names the value into the
 * thing — so the two were never actually different sets, and three silhouettes
 * were saying one thing.
 *
 * Below roughly 14px the glyph turns to mud, so the icon is dropped and the
 * sphere carries it alone; the colour is what identifies it at that size anyway.
 */
export const ThingDot: React.FC<ThingDotProps> = ({
  color, size = 14, icon, label, className, style, title,
}) => {
  const isDark = useDarkMode();
  const isLight = !isDark;
  const Icon = icon ? resolveLucideIcon(icon) : null;
  const showIcon = !!Icon && size >= 14;
  const initial = label ? [...label][0] ?? '' : '';

  return (
    <div
      title={title}
      className={className}
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: `0 0 ${size}px`,
        ...style,
      }}
    >
      {/* The anchor. Small on purpose, the way the canvas tile's is: it is the
          thing's colour and the point it stands on, not the object. */}
      <div
        style={{
          position: 'absolute',
          width: Math.round(size * (showIcon ? 0.34 : 1)),
          height: Math.round(size * (showIcon ? 0.34 : 1)),
          borderRadius: '50%',
          clipPath: THING_CLIP,
          background: sphereBackground(color, isLight),
          // A clip eats a box-shadow, so the outline has to be a filter — the
          // same reason the dog-ear this replaces used one. The board's shared
          // edge, not a bespoke pair: this used to carry a white counter-glow,
          // the only light halo anywhere on a board whose light all comes from
          // one corner, and that is what made the dot read as pasted on.
          // Softer on a light board — see boardEdgeFilter.
          filter: boardEdgeFilter(isLight),
        }}
      />
      {showIcon && Icon && (
        // Bigger than the dot and past it, in the thing's own colour lifted to
        // read — the canvas tile's arrangement at this size. It used to be a
        // pale glyph inside a full-size ball, which put two marks of nearly the
        // same weight in a 14px box and left neither legible.
        <Icon
          style={{
            position: 'absolute',
            width: Math.round(size * 0.95),
            height: Math.round(size * 0.95),
            // The same ink the canvas thing tile's glyph and name wear
            // (thingInk), so one thing's mark is one colour at every size.
            color: thingInk(color, isLight),
            filter: iconEmbossFilter(isLight),
          }}
          strokeWidth={1.75}
        />
      )}
      {/* Only where there is no glyph. Below the size a glyph survives, the
          initial is the whole of what tells two dots of one type apart; above
          it, adding one back would be the second foreground the canvas tile
          exists to have got rid of. */}
      {!showIcon && initial && (
        <span
          style={{
            position: 'relative',
            fontSize: Math.round(size * 0.82),
            lineHeight: 1,
            fontWeight: 700,
            // The same ink and halo the canvas tile's name uses.
            color: thingFaceText(color, isLight),
            textShadow: thingNameShadow(color, isLight),
          }}
        >
          {initial}
        </span>
      )}
    </div>
  );
};

/**
 * The same dot as bare markup, for the one place that cannot take a React node:
 * Leaflet's divIcon takes an HTML string.
 *
 * `label` is the thing's name, and its initial is drawn in the ball exactly as
 * the component above draws it — same fraction of the diameter, same weight,
 * same shadow. It used to be dropped here on the grounds that a map pin is
 * small and the name is written beside it anyway, which made the one place a
 * thing appears on a map the one place it did not wear its own face. The name
 * beside it is read; the initial is recognised, and at a glance over a busy
 * map that is the difference.
 *
 * Still no glyph: resolving a Lucide icon to markup means rendering a React
 * node, and the initial is what tells two dots of one type apart.
 */
export function thingDotHtml(color: string, size: number, isLight: boolean, label?: string): string {
  const initial = label ? [...label][0] ?? '' : '';
  const shadow = thingNameShadow(color, isLight);
  const face = initial
    ? `<span style="position:relative;font-size:${Math.round(size * 0.82)}px;line-height:1;` +
      `font-weight:700;color:${thingFaceText(color, isLight)};text-shadow:${shadow}">` +
      escapeDotHtml(initial) +
      `</span>`
    : '';
  return (
    `<span style="display:inline-flex;align-items:center;justify-content:center;` +
    `width:${size}px;height:${size}px;border-radius:50%;` +
    `clip-path:${THING_CLIP};background:${sphereBackground(color, isLight)};` +
    `filter:${boardEdgeFilter(isLight)}">` +
    face +
    `</span>`
  );
}

/** Names come from user input and this builds markup, so the initial is escaped
 *  before it goes in — the same care the map's own labels take. */
function escapeDotHtml(s: string): string {
  return s.replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!
  ));
}
