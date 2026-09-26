import React from 'react';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useCharacterStore, getDefaultCursorColor } from '@/stores/characterStore';
import { Character } from '@/types/character';
import { cursorManStickFigureInnerSvgMarkup } from '@/shared/cursorManFigure';
import { CharacterBadge } from './CharacterBadge';
import { characterShapePath } from '@/shared/characterShapes';

interface CursorManIconProps {
  size?: number;
  className?: string;
  /** Override color (used when rendering the default human design in a custom color) */
  color?: string;
}

/**
 * Stick-figure SVG with configurable color. Inner shapes live in
 * shared/cursorManFigure.ts (also used by the Web Inspector overlay) — only
 * this outer wrapper (sizing, glow style) stays React-specific.
 */
export const CursorManSVG: React.FC<{ size: number; color: string; className?: string }> = ({ size, color, className }) => {
  const glow = color.startsWith('#00') || color.startsWith('#0e') || color.startsWith('#22')
    ? `drop-shadow(0 0 6px ${color}) drop-shadow(0 0 12px ${color})`
    : `drop-shadow(0 0 5px ${color})`;
  const w = Math.round(size * 24 / 29);
  return (
    <svg
      width={w}
      height={size}
      viewBox="0 0 24 29"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ filter: glow }}
      dangerouslySetInnerHTML={{ __html: cursorManStickFigureInnerSvgMarkup(color) }}
    />
  );
};

/**
 * CursorManIcon — renders either:
 *   • The selected character's emoji avatar in a colored circle, or
 *   • The default stick-figure SVG in the configured/passed color
 */
export const CursorManIcon: React.FC<CursorManIconProps> = ({ size = 22, className, color: colorOverride }) => {
  const isDark = useDarkMode();
  const myCharacter = useCharacterStore(s => s.getMyCharacter());
  const myDefaultColor = useCharacterStore(s => s.myDefaultCursorColor);

  if (myCharacter) {
    // The emoji in the outline this character chose — a circle unless they
    // picked otherwise, which is what this drew before shapes existed.
    //
    // CharacterBadge rather than cursorManAvatarCircleMarkup: the badge knows
    // the shape catalogue, and the shared markup deliberately does not (it is
    // spliced into the browser-extension overlay as source text, which cannot
    // reach out to another module — see webext/build-shared-visuals.js). The
    // overlay has no character record to read a shape from anyway.
    return (
      <CharacterBadge
        avatar={myCharacter.avatar}
        color={myCharacter.color}
        shape={myCharacter.shape}
        size={size}
        strokeWidth={2}
        fontSize={Math.round(size * 0.58)}
        className={className}
        style={{ flexShrink: 0, filter: `drop-shadow(0 0 6px ${myCharacter.color}99)` }}
      />
    );
  }

  // Default human SVG design with configurable color
  const color = colorOverride ?? myDefaultColor ?? getDefaultCursorColor(isDark);
  return <CursorManSVG size={size} color={color} className={className} />;
};

// ── SVG-native version (for use inside <svg> elements, e.g. WantMinimap) ────

interface CursorManSVGIconProps {
  /** Centre X in SVG coordinate space */
  cx: number;
  /** Centre Y in SVG coordinate space */
  cy: number;
  /** Base radius — controls overall size */
  r: number;
  isDark?: boolean;
}

/**
 * SVG-native CursorMan indicator for use inside an existing `<svg>` element.
 * Shows the selected character's emoji in their own colour and chosen outline,
 * or the classic two-circle stick figure when no character is selected.
 */
export const CursorManSVGIcon: React.FC<CursorManSVGIconProps> = ({ cx, cy, r, isDark = false }) => {
  const myCharacterId = useCharacterStore(s => s.myCharacterId);
  const characters    = useCharacterStore(s => s.characters);
  const myCharacter: Character | null = characters.find(c => c.id === myCharacterId) ?? null;

  if (myCharacter) {
    // The shape catalogue is drawn in a 100x100 box, placed and scaled into
    // the diameter the ring used to have — see MinimapCharacterToken, which
    // does the same for everybody else.
    const side = r * 2.4;
    return (
      <g pointerEvents="none">
        <g transform={`translate(${cx - side / 2} ${cy - side / 2}) scale(${side / 100})`}>
          <path
            d={characterShapePath(myCharacter.shape)}
            // Flat, as everywhere else this person is drawn (CharacterBadge).
            fill={myCharacter.color}
            stroke={myCharacter.color}
            strokeWidth={(0.9 * 100) / side}
            strokeLinejoin="round"
          />
        </g>
        <text
          x={cx} y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={r * 1.7}
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {myCharacter.avatar}
        </text>
      </g>
    );
  }

  // Default: two-circle stick-figure (original minimap style)
  const fill = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.85)';
  return (
    <g pointerEvents="none">
      <circle cx={cx} cy={cy + r * 0.4}  r={r}        fill={fill} />
      <circle cx={cx} cy={cy - r * 1.1}  r={r * 0.65} fill={fill} />
      <circle cx={cx} cy={cy + r * 0.4}  r={r + 1.5}  fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth={1} />
    </g>
  );
};
