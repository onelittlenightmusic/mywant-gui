import React from 'react';
import * as LucideIcons from 'lucide-react';
import { Clock, type LucideIcon } from 'lucide-react';

/**
 * A timing — a moment of a type's answer worth telling of (engine
 * core/result_timings.go) — drawn as a cube, as the board draws a want: a face
 * and a wall below it. A timing belongs to the want that says it, so its cube
 * is that want's type colour, but pale: a face washed nearly white with the
 * glyph in the colour itself, beside a want's own cube filled with it. Seen
 * together (Hear: who hears whose moment) the two read as "the want" and "a
 * moment of it" at a glance.
 *
 * `icon` is the timing's own (its `icon` in the type's YAML): a lucide name,
 * kebab-case ("check-circle") or as the component is named ("CheckCircle").
 * None, or one this build does not know: a clock.
 */

const toPascal = (name: string) =>
  name.includes('-') || /^[a-z]/.test(name)
    ? name.split('-').filter(Boolean).map(s => s[0].toUpperCase() + s.slice(1)).join('')
    : name;

/** A timing's glyph by its name, a clock when there is none. */
export function timingIcon(name?: string): LucideIcon {
  if (!name) return Clock;
  const found = (LucideIcons as Record<string, unknown>)[toPascal(name.trim())];
  return found && (typeof found === 'function' || typeof found === 'object') ? found as LucideIcon : Clock;
}

/** `color` (any CSS colour) with `share` of it kept, the rest white — or black. */
const mix = (color: string, share: number, other = 'white') =>
  `color-mix(in srgb, ${color} ${Math.round(share * 100)}%, ${other})`;

export const TimingCube: React.FC<{
  /** The timing's icon name. */
  icon?: string;
  /** The colour of the type it belongs to (solidTypeColor). */
  color: string;
  /** The cube's width, px; its face is as tall, its wall below a tenth. */
  size?: number;
  /** A word under the glyph, on the face. */
  label?: string;
  title?: string;
}> = ({ icon, color, size = 36, label, title }) => {
  const Icon = timingIcon(icon);
  const wall = Math.max(3, Math.round(size * 0.1));
  const face = mix(color, 0.16);
  const ink = mix(color, 0.75, 'black');
  return (
    <span title={title} className="relative inline-block flex-none" style={{ width: size, height: size + wall }}>
      <span aria-hidden className="absolute inset-x-0 bottom-0 rounded-[22%]"
        style={{ top: wall, background: mix(color, 0.55) }} />
      <span className="absolute inset-x-0 top-0 rounded-[22%] flex flex-col items-center justify-center gap-0.5 border"
        style={{ height: size, background: face, borderColor: mix(color, 0.35), color: ink }}>
        <Icon style={{ width: size * (label ? 0.36 : 0.48), height: size * (label ? 0.36 : 0.48) }} strokeWidth={2.2} />
        {label && <span className="font-bold leading-none truncate max-w-[90%]" style={{ fontSize: Math.max(8, size * 0.14) }}>{label}</span>}
      </span>
    </span>
  );
};
