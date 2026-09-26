import { useEffect } from 'react';
import { useMyCursorColor } from '@/hooks/useMyCursorColor';
import { useDarkMode } from '@/hooks/useDarkMode';
import { ringColor } from '@/components/dashboard/WantCardFace';

/**
 * Publishes the current character's colour as a root CSS variable, so anything
 * drawing a "you are here" ring can use it — including the parts that render
 * through a portal and so have no React ancestor to inherit from.
 *
 * The rings used to be a fixed sky blue. Blue is nobody: the cursor, the card
 * frames and the speech cards are all drawn in the colour of whoever is at the
 * controls, and the ring saying where they are was the one thing that wasn't.
 * On a board two people share, both saw the same blue.
 *
 * Renders nothing. A variable rather than a class per colour, because a
 * character's colour is a hex nobody can enumerate at build time.
 *
 * The value is ringColor(), not the raw colour and no longer a plain lift
 * toward white: a cursor colour is picked to be found instantly at 20px, and
 * wrapped around a whole card or an overlay button that same saturation reads
 * as neon piping. See ringColor for the full reasoning. `--mw-ring` is
 * published alongside it so `.mw-inner-focus-ring` — the want-detail panel's
 * own frame — falls back to the character's ring instead of a hardcoded sky
 * blue when no card above it has set one.
 */
export function FocusRingColor() {
  const color = useMyCursorColor();
  const isDark = useDarkMode();
  useEffect(() => {
    const ring = ringColor(color, isDark);
    const root = document.documentElement.style;
    root.setProperty('--mw-focus-ring', ring);
    root.setProperty('--mw-ring', ring);
    root.setProperty('--mw-ring-soft', `${ring}99`);
    root.setProperty('--mw-ring-faint', `${ring}55`);
  }, [color, isDark]);
  return null;
}
