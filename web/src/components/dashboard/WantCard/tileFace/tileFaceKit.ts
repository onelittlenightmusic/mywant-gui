import { useEffect, useState } from 'react';

/**
 * What every tile face shares: the panel it is drawn on, the ink on that
 * panel, the clock it reads the time from and the few motions it is allowed.
 *
 * A face sits on a tile whose colour belongs to its category, light or dark
 * with the board, so it never draws text straight onto the tile: it draws a
 * panel of its own first and puts its ink on that, which is the only way the
 * contrast is the face's to promise.
 */
export interface TileFacePalette {
  /** The face's own panel, laid on the tile. */
  panel: string;
  /** Text and line work on the panel. */
  ink: string;
  /** Secondary text on the panel — still 4.5:1 against it. */
  muted: string;
  /** The face's one accent: a mark, a hand, a glyph. */
  accent: string;
  /** "Something is waiting on you" — the pill lamp's orange, darkened for text on it. */
  calling: string;
}

export function tileFacePalette(isLight: boolean): TileFacePalette {
  return isLight
    ? { panel: 'rgba(255,253,246,0.92)', ink: '#2b2118', muted: '#5e4e3c', accent: '#1e4fa8', calling: '#c2410c' }
    : { panel: 'rgba(15,23,42,0.78)', ink: '#f1f5f9', muted: '#cbd5e1', accent: '#93c5fd', calling: '#c2410c' };
}

/**
 * The time, now, re-read every `everyMs`. A face that counts down reads its
 * remaining time from this, so every face on the board ticks from one kind of
 * clock and none of them runs a timer faster than it can show a change.
 */
export function useNow(everyMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(id);
  }, [everyMs]);
  return now;
}

const STYLE_ID = 'mw-tile-face-motion';

/**
 * The motions a face may use, injected once per document.
 *
 * A face moves only to say something — a bell swings while it waits for an
 * answer, weather drifts because weather does. Everything stops for a viewer
 * who asked for less motion.
 */
export function ensureTileFaceMotion(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = [
    '@keyframes mw-tf-swing { 0%,100% { transform: rotate(-12deg); } 50% { transform: rotate(12deg); } }',
    '@keyframes mw-tf-bob { 0%,100% { transform: translateX(0); } 50% { transform: translateX(3px); } }',
    '@keyframes mw-tf-fall { 0% { transform: translateY(-6px); opacity: 0; } 20% { opacity: 1; } 100% { transform: translateY(14px); opacity: 0; } }',
    '.mw-tf-swing { transform-box: fill-box; transform-origin: 50% 8%; animation: mw-tf-swing 1.1s ease-in-out infinite; }',
    '.mw-tf-bob { animation: mw-tf-bob 6s ease-in-out infinite; }',
    '.mw-tf-fall { animation: mw-tf-fall 1.3s linear infinite; }',
    '@media (prefers-reduced-motion: reduce) { .mw-tf-swing, .mw-tf-bob, .mw-tf-fall { animation: none; } }',
  ].join('\n');
  document.head.appendChild(el);
}

/**
 * How long until `ms`, said the way a person would on a tile: minutes when it
 * is close, hours later today, the day and time after that.
 */
export function untilLabel(target: number, now: number): string {
  const diff = target - now;
  if (diff <= 0) return 'いま';
  const min = Math.ceil(diff / 60_000);
  if (min < 60) return `あと${min}分`;
  const t = new Date(target);
  const n = new Date(now);
  const hm = `${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`;
  const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((dayStart(t) - dayStart(n)) / 86_400_000);
  if (days === 0) return min < 180 ? `あと${Math.floor(min / 60)}時間` : `きょう ${hm}`;
  if (days === 1) return `あした ${hm}`;
  return `${t.getMonth() + 1}/${t.getDate()} ${hm}`;
}

/** The first of `keys` set anywhere in a want's state, as a string. */
export function stateString(
  state: { current?: Record<string, unknown>; goal?: Record<string, unknown>; internal?: Record<string, unknown> } | undefined,
  ...keys: string[]
): string {
  for (const key of keys) {
    for (const group of [state?.current, state?.goal, state?.internal]) {
      const v = group?.[key];
      if (typeof v === 'string' && v !== '') return v;
    }
  }
  return '';
}
