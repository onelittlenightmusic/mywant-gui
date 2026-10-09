/**
 * Shared visual face for want-type cards.
 * Renders: background + overlay + centered category icon + display name.
 *
 * Used by:
 *  - WantTypeCard  (theme="light", adds bottom bar via children)
 *  - WantCanvas    (theme="dark",  adds status bar / drag chrome via children)
 */
import React from 'react';
import { useIconFont } from '@/hooks/useDisplaySettings';
import { classNames } from '@/utils/helpers';
import {
  getCardBackgroundStyle,
  getCardOverlayBg,
  getCategoryHexColor,
  shade,
  type IconFamily,
} from './WantTypeVisuals';
import { getBackgroundToneColor } from '@/utils/backgroundStyles';
import { characterColor } from '@/design/characterColor';
import { WantIcon } from './WantIcon';
import { useWantTypeStore } from '@/stores/wantTypeStore';
import { useConfigStore } from '@/stores/configStore';
import { useCardOpacity } from '@/hooks/useCardOpacity';

/**
 * Boost a hex colour into a vivid icon tint that stands out from the tile face.
 * Raises saturation and pins lightness into a band chosen for the background:
 * a bright band on dark (canvas) tiles, a darker band on light (white) cards.
 */
/**
 * The tile's "emboss" — a drop-shadow filter that outlines a coloured icon so it
 * pops against its background. The strong (dark-outline) variant is what the
 * canvas tile uses; a soft variant suits light surfaces.
 */
export function iconEmbossFilter(soft = false): string {
  return soft
    ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))'
    : 'drop-shadow(0 0 1px rgba(0,0,0,0.9)) drop-shadow(0 2px 3px rgba(0,0,0,0.7))';
}

/**
 * Where the board's light comes from, as the ratio a shadow is thrown at.
 *
 * Not a taste call: a cubic tile's walls project its depth down-and-right by
 * exactly {dx: 6, dy: 8} (design/cubic/index.ts), which fixes the light at the
 * upper left, and a thing's sphere already puts its highlight there too
 * (utils/thingShape.ts). Everything else that casts a shadow on this board has
 * to agree, and the pieces that didn't — a thing tile dropping straight down at
 * `0 4px 8px`, a thing dot with no direction at all — are why they read as
 * stickers laid on the board rather than objects standing on it.
 */
const BOARD_LIGHT_RATIO = 6 / 8;

/**
 * What something STANDING on the board casts.
 *
 * `depth` scales the whole shadow — 1 is a thing at tile height, less is a
 * marker barely off the surface, more is a tile picked up and held. Offset and
 * blur move together, because a shadow that only gets darker reads as a bigger
 * object rather than a higher one.
 *
 * `isLight` is the board's mode. The DIRECTION never changes — the light is
 * fixed at the upper left whatever the theme — only how dark the shadow lands:
 * a 0.38-black drop under a small pale sphere on a white board read as a grey
 * smudge bigger than the object, so a light board gets a much softer one.
 */
export function boardLiftFilter(depth = 1, isLight = false): string {
  const y = +(4 * depth).toFixed(1);
  const x = +(y * BOARD_LIGHT_RATIO).toFixed(1);
  const blur = +(8 * depth).toFixed(1);
  return `drop-shadow(${x}px ${y}px ${blur}px rgba(0,0,0,${isLight ? 0.16 : 0.38}))`;
}

/** The same lift as a `box-shadow`, for the things that aren't clipped and so
 *  don't need to pay for a filter. */
export function boardLiftShadow(depth = 1, isLight = false): string {
  const y = +(4 * depth).toFixed(1);
  const x = +(y * BOARD_LIGHT_RATIO).toFixed(1);
  const blur = +(8 * depth).toFixed(1);
  // As dark as boardLiftFilter lands on each board.
  return `${x}px ${y}px ${blur}px rgba(0,0,0,${isLight ? 0.16 : 0.38})`;
}

/**
 * The hairline that puts a small clipped shape ON the board instead of in it.
 *
 * The same dark silhouette edge CubicWalls strokes its blocks with, as a filter
 * rather than a border because a clip-path eats a box-shadow. Deliberately no
 * white counter-glow: a light halo is the one thing on this board that has no
 * light source behind it, and the dot wearing one was exactly what made it look
 * pasted on. Separation on a dark ground comes from the sphere's own highlight,
 * which is lit from the same corner as everything else.
 *
 * `isLight` is the board's mode. On a white board the full-strength pair read
 * as a dark blurred ring around the sphere rather than a hairline on it, so it
 * drops to roughly half — enough to seat the sphere, not enough to smudge it.
 */
export function boardEdgeFilter(isLight = false): string {
  return isLight
    ? 'drop-shadow(0 0 0.75px rgba(0,0,0,0.35)) drop-shadow(0 1px 1px rgba(0,0,0,0.22))'
    : 'drop-shadow(0 0 1px rgba(0,0,0,0.75)) drop-shadow(0 1px 1.5px rgba(0,0,0,0.5))';
}

/**
 * A small pointer drawn ON the board — a character's facing triangle, a
 * direction want's arrow.
 *
 * One treatment for both, because they are the same mark: "this points that
 * way". They had drifted into two — the character's was its own colour ringed
 * in hard white, the direction want's a white body ringed in near-black — so
 * the board carried two arrow species, and the white one was the only pure
 * white on a surface made entirely of tinted solids, which is what made it
 * float. Now both take the colour of whatever they belong to.
 *
 * And no outline. It used to carry a dark edge, borrowed from the blocks, but
 * the blocks do not have one: a want is faces of one tone shaded apart, a thing
 * is a ball, a character is a filled silhouette, and a button gave up the last
 * line work on the board. A solid is separated from what is behind it by the
 * shadow it throws, so the marker is separated the same way — the lift is
 * deeper than it was, which is the outline's job done in the material's own
 * terms.
 *
 * `scale` no longer sizes a stroke and is kept for the callers that pass one;
 * it is what the lift would scale with if a marker ever needed a bigger one.
 */
export function boardMarkerStyle(color: string, _scale = 1): {
  fill: string; filter: string;
} {
  return {
    // Its own colour, at the lit rung — a shade brighter than any top face
    // (see WantTypeVisuals' body shading), so a marker always reads as sitting
    // on top of whatever it marks even when that thing's tone is a dark slate.
    // This is the job the flat white was doing, done in the material's own hue.
    fill: shade(color, 1.15),
    filter: boardLiftFilter(0.8),
  };
}

/**
 * Colour + emboss for a want-type icon. One formula for every surface that
 * paints one — the want card's badge pill, the canvas tile and the child mini
 * tile — so the same want type never looks like two different colours.
 * The type's own background tone wins; failing that, its category's colour for
 * the current theme.
 */
export function wantTypeIconStyle(typeName: string, category: string, isDark: boolean): React.CSSProperties {
  const declared = getBackgroundToneColor(typeName);
  return {
    color: vividIconColor(
      // A type that names its own colour gets it. One that does not used to
      // fall back to its category's, which every one of its siblings also fell
      // back to — so Direction and Going, both "drive", were the same mark, and
      // so were Button and Gauge under "system". The category is what the tile
      // says; the icon is supposed to say which of them this is.
      declared ?? rotateHue(getCategoryHexColor(category, isDark), typeHueOffset(typeName)),
      !isDark,
    ),
    filter: iconEmbossFilter(!isDark),
  };
}

/**
 * A stable angle for a type with no colour of its own.
 *
 * Derived from the name, so it is the same on every screen and every reload
 * without anything being stored, and spread over a range wide enough to tell
 * neighbours apart but narrow enough that they still read as the family the
 * tile behind them says they belong to. Nine steps across ±40°: two types have
 * to collide on the hash before they collide on screen.
 */
function typeHueOffset(typeName: string): number {
  let hash = 0;
  for (let i = 0; i < typeName.length; i++) hash = (hash * 31 + typeName.charCodeAt(i)) | 0;
  return ((Math.abs(hash) % 9) - 4) * 10;
}

/** `hex`, turned `deg` around the colour wheel. */
function rotateHue(hex: string, deg: number): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m || deg === 0) return hex;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2, d = max - min;
  if (d === 0) {
    // Grey has no hue to turn, and several categories are grey in one theme or
    // the other. Give it one — the offset itself — so the icons still differ.
    const [rr, gg, bb] = hslParts(((deg + 360) % 360), 0.5, l);
    return `#${[rr, gg, bb].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;
  }
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + deg + 360) % 360;
  const [rr, gg, bb] = hslParts(h, s, l);
  return `#${[rr, gg, bb].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Label colour for a card whose surface is tinted with `hex`.
 *
 * The card's own colour, pushed to a lightness that stays readable on that
 * tint: well below it on a light surface, well above it on a dark one. Without
 * the clamp a saturated category sinks into its own background. Values are
 * deliberately NOT painted with this — percentage red/amber and boolean
 * green/red carry meaning, and a tint would fight them.
 */
export function cardInkColor(hex: string, isDark: boolean): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  const S = Math.min(1, s * 0.9 + 0.18);
  const L = isDark ? 0.78 : 0.32;
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const mm = L - c / 2;
  let rr = 0, gg = 0, bb = 0;
  if (h < 60) { rr = c; gg = x; }
  else if (h < 120) { rr = x; gg = c; }
  else if (h < 180) { gg = c; bb = x; }
  else if (h < 240) { gg = x; bb = c; }
  else if (h < 300) { rr = x; bb = c; }
  else { rr = c; bb = x; }
  const to = (v: number) => Math.round((v + mm) * 255).toString(16).padStart(2, '0');
  return `#${to(rr)}${to(gg)}${to(bb)}`;
}

/** HSL (h in degrees, s and l 0-1) as r/g/b components in 0-1. */
function hslParts(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
      h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, b + m];
}

/**
 * A character's colour at the weight a HIGHLIGHT FRAME should be — a card's
 * hover/focus ring, the board frame, an overlay control's ring, the want-detail
 * panel's inner frame.
 *
 * This is now one role of characterColor (see src/design/characterColor.ts),
 * which is the single place a character's colour is re-weighted for anything
 * that is not the cursor itself: `frame` here, `badge` for notification marks.
 * Kept as a named export because half the app imports `ringColor`.
 */
export function ringColor(hex: string, isDark: boolean): string {
  return characterColor(hex, 'frame', isDark);
}

/** Inline `--card-ink` for a card root; every `.card-ink` label inside picks it up. */
export function cardInkVars(hex: string | undefined, isDark: boolean): React.CSSProperties {
  if (!hex) return {};
  return { '--card-ink': cardInkColor(hex, isDark) } as React.CSSProperties;
}

export function vividIconColor(hex: string, forLightBg = false): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  let r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  // Vivify: high saturation, and a lightness band matched to the background —
  // bright on dark tiles, darker on white cards — so the tint always separates.
  const S = Math.min(1, s * 1.35 + 0.35);
  let L = forLightBg
    ? Math.min(0.48, Math.max(0.38, l))
    : Math.min(0.68, Math.max(0.58, l));

  // Then again by luminance, because lightness is not what the eye measures.
  //
  // HSL lightness treats every hue alike; the eye does not. Blue carries about
  // 7% of a colour's luminance against green's 72%, so a saturated blue sitting
  // in the middle of the band came out at 3:1 against a dark tile while an
  // orange at the same L reached 8:1 — one icon legible across the board, the
  // other a dark smudge. The band is a starting point; this walks it until the
  // contrast is actually there.
  const relLum = (hh: number, ss: number, ll: number): number => {
    const [rr, gg, bb] = hslParts(hh, ss, ll);
    const ch = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return 0.2126 * ch(rr) + 0.7152 * ch(gg) + 0.0722 * ch(bb);
  };
  // Floors chosen against the surfaces these actually sit on: a board tile in
  // the dark, a white card in the light. Both clear 4.5:1 there.
  for (let i = 0; i < 24; i++) {
    const y = relLum(h, S, L);
    if (forLightBg ? y <= 0.22 : y >= 0.32) break;
    L = forLightBg ? Math.max(0.16, L - 0.02) : Math.min(0.88, L + 0.02);
  }
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const mm = L - c / 2;
  let rr = 0, gg = 0, bb = 0;
  if (h < 60) { rr = c; gg = x; }
  else if (h < 120) { rr = x; gg = c; }
  else if (h < 180) { gg = c; bb = x; }
  else if (h < 240) { gg = x; bb = c; }
  else if (h < 300) { rr = x; bb = c; }
  else { rr = c; bb = x; }
  const to = (v: number) => Math.round((v + mm) * 255).toString(16).padStart(2, '0');
  return `#${to(rr)}${to(gg)}${to(bb)}`;
}

export interface WantCardFaceProps {
  typeName: string;
  /**
   * Override the type name used solely for background image/gradient lookup.
   * When set, getCardBackgroundStyle uses this instead of typeName.
   * Useful for child wants that should inherit their master's recipe image.
   */
  bgTypeName?: string;
  displayName: string;
  category: string;
  /** 'dark' = canvas tiles (dark mode); 'light' = light mode or sidebar */
  theme: 'dark' | 'light';
  /** 'canvas' enables pastel gradients in light mode; 'sidebar' keeps plain white */
  context?: 'canvas' | 'sidebar';
  iconSize?: number;
  // Container passthrough
  className?: string;
  style?: React.CSSProperties;
  tabIndex?: number;
  divRef?: React.Ref<HTMLDivElement>;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  onContextMenu?: React.MouseEventHandler<HTMLDivElement>;
  draggable?: boolean;
  onDragStart?: React.DragEventHandler<HTMLDivElement>;
  onDragEnd?: React.DragEventHandler<HTMLDivElement>;
  onTouchStart?: React.TouchEventHandler<HTMLDivElement>;
  onTouchMove?: React.TouchEventHandler<HTMLDivElement>;
  onTouchEnd?: React.TouchEventHandler<HTMLDivElement>;
  onMouseDown?: React.MouseEventHandler<HTMLDivElement>;
  onMouseMove?: React.MouseEventHandler<HTMLDivElement>;
  onMouseUp?: React.MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLDivElement>;
  /** child-role label value — renders a small role badge in the bottom-right corner */
  role?: string;
  /** Whether to show the display name below the icon (default: true) */
  showName?: boolean;
  /** Whether to render the centered category icon (default: true). Set false when
   *  a caller draws its own icon (e.g. EntityCard's bottom-left badge). */
  showIcon?: boolean;
  /** Whether to paint the base tint / category background / overlay wash
   *  (default: true). Set false when the caller draws the tile's whole look
   *  itself and this face exists only for its click/drag/selection plumbing —
   *  a form-type:button want's round pressure plate (drawn underneath, in
   *  WantCanvas's form layer) would otherwise always be hidden under this
   *  face's own opaque square. */
  showBackground?: boolean;
  /** Whether the face clips its content to its own box (default: true). Set
   *  false when the icon itself needs to move outside that box — a
   *  form-type:button want's icon rides its disc up above the tile at rest
   *  and down below it when pressed (see CanvasTileCard.tsx's iconContainerStyle),
   *  and `overflow-hidden` here would cut it off at the tile edge exactly
   *  where that travel needs to read. The background layer keeps its own
   *  separate `overflow-hidden` regardless (see the layer below) — this only
   *  ever affects the icon. */
  clipContent?: boolean;
  /** How a background IMAGE is fitted. 'cover' (default) fills the face; 'right'
   *  fits it to the face height and pins it to the right, Spotify-style. */
  imageAlign?: 'cover' | 'right';
  /** Override style for the icon+name container div (replaces the default inset-0 centering). */
  iconContainerStyle?: React.CSSProperties;
  /** Extra overlay content (status bar, bottom bar, selected glow, etc.) */
  children?: React.ReactNode;
  /** data-* attributes forwarded to the outer div */
  dataAttributes?: Record<string, string | boolean>;
  /** Base tint drawn under the category background, inside the opacity layer. */
  surfaceClass?: string;
  /** Image layer over the background, still inside the opacity layer. */
  backgroundNode?: React.ReactNode;
  /** Overrides the computed icon colour/emboss — pass wantTypeIconStyle() to
   *  match the want card's badge exactly. */
  iconStyle?: React.CSSProperties;
}

export const WantCardFace: React.FC<WantCardFaceProps> = ({
  typeName,
  bgTypeName,
  displayName,
  category,
  theme,
  context = 'sidebar',
  iconSize = 26,
  role,
  showName = true,
  showIcon = true,
  showBackground = true,
  clipContent = true,
  imageAlign = 'cover',
  className,
  style,
  tabIndex,
  divRef,
  onClick,
  onContextMenu,
  draggable,
  onDragStart,
  onDragEnd,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  children,
  dataAttributes,
  iconContainerStyle,
  surfaceClass,
  backgroundNode,
  iconStyle,
}) => {
  // Subscribe to dynamic maps so this component re-renders when plugin icons/backgrounds load
  useWantTypeStore(s => s.categoryIconMap);
  useWantTypeStore(s => s.categoryBgMap);
  useWantTypeStore(s => s.typeIconMap);

  const iconFont = useIconFont() as IconFamily;

  // bgTypeName overrides typeName for background image/gradient lookup only.
  // This lets child wants inherit their recipe master's background image.
  const effectiveBgType = bgTypeName ?? typeName;
  const bgStyleRaw = getCardBackgroundStyle(effectiveBgType, category, theme, context);
  // An image can arrive either as `backgroundImage: url(...)` (static type map)
  // or inside the `background` shorthand (a dynamic category background whose
  // label value is a url()). Gradients (no url) are left untouched.
  const bgHasImage = !!bgStyleRaw.backgroundImage ||
    (typeof bgStyleRaw.background === 'string' && bgStyleRaw.background.includes('url('));
  // Spotify-style: a background image fitted to the face height, pinned right.
  const bgStyle = imageAlign === 'right' && bgHasImage
    ? { ...bgStyleRaw, backgroundSize: 'auto 100%', backgroundPosition: 'right center', backgroundRepeat: 'no-repeat' }
    : bgStyleRaw;
  const overlayBg = getCardOverlayBg(effectiveBgType, theme, context);
  // Shared card background opacity (Settings → Cards). Applied to the
  // background layer only, never to the icon/name layer above it.
  const cardOpacity = useCardOpacity();

  const isLight = theme === 'light';
  // Canvas tiles (dark theme) tint the category icon with the want-type colour —
  // the same tone the design skins use elsewhere — instead of a flat white. Light
  // uses (WantTypeCard) keep the default text colour for contrast on white.
  const iconColor = vividIconColor(
    getBackgroundToneColor(typeName) ?? getCategoryHexColor(category, true),
    isLight,
  );

  return (
    <div
      ref={divRef}
      className={classNames(
        'relative select-none',
        clipContent && 'overflow-hidden',
        className,
      )}
      style={style}
      tabIndex={tabIndex}
      onClick={onClick}
      onContextMenu={onContextMenu}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      {...dataAttributes}
    >
      {/* The card's whole painted surface in ONE layer at the shared opacity:
          base tint, category background (gradient or image), any image node,
          and the wash on top. The base tint has to live in here — left on the
          container it would stay opaque as the rest fades, so a low opacity
          would read as "white card" rather than "transparent card". */}
      {showBackground && (
        <div
          className="absolute inset-0 pointer-events-none z-0 rounded-[inherit] overflow-hidden"
          style={{ opacity: cardOpacity }}
        >
          <div
            className={classNames(
              'absolute inset-0',
              // Light theme base (matches original WantTypeCard)
              surfaceClass ?? (isLight ? 'bg-white bg-opacity-70 dark:bg-gray-800 dark:bg-opacity-80' : ''),
            )}
            style={bgStyle}
          />
          {backgroundNode}
          <div className="absolute inset-0" style={{ background: overlayBg }} />
        </div>
      )}

      {/* Centered content: icon + name */}
      <div
        className="absolute z-10 flex flex-col items-center justify-center gap-1.5 px-2"
        style={iconContainerStyle ?? { inset: 0 }}
      >
        {/* Category icon with role badge — delegated to shared WantIcon component */}
        {showIcon && (
        <WantIcon
          typeName={typeName}
          category={category}
          iconFont={iconFont}
          size={iconSize}
          role={role}
          isLight={isLight}
          iconStyle={{
            ...(iconColor ? { color: iconColor } : {}),
            // Dark canvas tiles get a tight dark outline so the bright tint pops;
            // light cards use a soft shadow so the darker tint isn't over-ringed.
            filter: iconEmbossFilter(isLight),
            ...iconStyle,
          }}
        />
        )}
        {showName && (
          <p
            className={classNames(
              'font-semibold text-center leading-tight select-none',
              isLight
                ? 'text-gray-800 dark:text-gray-100'
                : 'text-white',
            )}
            style={{
              fontSize: 9,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical' as const,
              textShadow: isLight ? undefined : '0 1px 3px rgba(0,0,0,0.7)',
              maxWidth: '100%',
              WebkitUserSelect: 'none',
            }}
          >
            {displayName}
          </p>
        )}
      </div>

      {/* Caller-supplied overlays (status bar, bottom bar, selected glow, etc.) */}
      {children}
    </div>
  );
};
