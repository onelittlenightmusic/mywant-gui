import { useEffect, useState } from 'react';
import { useDisplaySettings, displaySettings } from '@/hooks/useDisplaySettings';
import type { CharacterDisplay } from '@/types/character';
import type { OverlayTone } from './tones';

/**
 * How overlays look — a skin over the one overlay object.
 *
 * Every overlay is the same thing (see tones.ts), laid out the same way; what a
 * design decides is only how it is painted: the colour each tone gets, the
 * cell's shape and hover, the ring, the words, the box and its tail, how it
 * comes in. The built-in design is `grid` — full-bleed coloured tiles on a dark
 * box. An extension can add another (registerOverlayDesign, or `overlayDesigns`
 * on a GuiExtension), and a person picks one for themselves: the choice is a
 * display setting of their character (ext.overlay.design), like the canvas's
 * design.
 *
 * Every field is a class name. The app's own Tailwind build only contains
 * classes the app itself uses, so a design from an extension names classes its
 * own stylesheet defines (the manifest's `styles`) — see the flat design in the
 * developer docs.
 */
export interface OverlayDesign {
  id: string;
  /** What the picker calls it. */
  name: string;
  /** A cell's fill, per tone. */
  tones: Record<OverlayTone, string>;
  /** A cell that cannot be pressed right now (replaces its tone). */
  disabled: string;
  /** Every cell: its shape and anything else that is not its colour. */
  cell: string;
  /** A cell that can be pressed: hover and press feedback. */
  cellInteractive: string;
  /** The off half of an on/off cell (see OverlayCell's `off`). */
  cellOff: string;
  /**
   * The ring on the cell the keys are on. Its colour comes from whoever holds
   * the keys (mw-focus-ring, a CSS variable), so a design sets the ring's
   * shape, not its colour.
   */
  focus: string;
  /** The word under a cell's icon. */
  label: string;
  /** The question over a grid. */
  header: string;
  /** The overlay's surface — its fill and outline — whatever its shape. */
  surface: string;
  /** The box a free-standing overlay sits in (shape + surface). */
  frame: string;
  /** The tail's colour: a CSS colour, matching the frame's outline. */
  tailColor: string;
  /** What is laid over a card behind an overlay drawn on it. */
  backdrop: string;
  /** A text field inside an overlay. */
  input: string;
  /** The whole overlay arriving, and one cell arriving (CSS animation shorthands). */
  enterAnimation: string;
  cellEnterAnimation: string;
}

/** The built-in design: full-bleed coloured tiles on a dark box. */
export const GRID_OVERLAY_DESIGN: OverlayDesign = {
  id: 'grid',
  name: 'Grid',
  tones: {
    confirm: 'bg-emerald-600/90',
    cancel:  'bg-gray-600/90',
    danger:  'bg-rose-700/90',
    primary: 'bg-blue-600/90',
    caution: 'bg-amber-600/90',
    info:    'bg-sky-600/90',
    accent:  'bg-indigo-600/90',
    special: 'bg-violet-600/90',
    muted:   'bg-slate-700',
  },
  disabled: 'bg-gray-400/30 cursor-not-allowed grayscale opacity-50',
  cell: '',
  cellInteractive: 'hover:brightness-110 active:opacity-80',
  cellOff: 'opacity-60 saturate-50',
  // Thick enough to read at a glance over a coloured tile, and inset so it
  // frames the tile without overlapping its neighbours.
  focus: 'ring-4 ring-inset',
  label: 'text-white text-[9px] font-bold leading-none uppercase tracking-tighter',
  header: 'flex items-center gap-1.5 text-white text-xs font-bold uppercase tracking-widest opacity-80',
  surface: 'bg-slate-900 border border-slate-600',
  frame: 'rounded-2xl overflow-hidden bg-slate-900 border border-slate-600 shadow-2xl',
  tailColor: 'rgb(71 85 105)',
  backdrop: 'bg-black/60',
  input:
    'w-full rounded-md bg-slate-800 border border-slate-700 px-2.5 py-1 text-sm text-slate-100 ' +
    'placeholder-slate-500 outline-none focus:border-sky-500',
  // Keyframes in WantCard.module.css.
  enterAnimation: 'quickActionsIn 150ms ease-out forwards',
  cellEnterAnimation: 'quickActionBtnIn 150ms ease-out both',
};

// ── Registry ─────────────────────────────────────────────────────────────────

const designs = new Map<string, OverlayDesign>([[GRID_OVERLAY_DESIGN.id, GRID_OVERLAY_DESIGN]]);
const listeners = new Set<() => void>();

/**
 * Add a design. A later one with the same id replaces the earlier — `grid`
 * included, for an extension that wants to restyle the default in place.
 */
export function registerOverlayDesign(design: OverlayDesign): void {
  designs.set(design.id, { ...GRID_OVERLAY_DESIGN, ...design });
  listeners.forEach(fn => fn());
}

/** Every design, the built-in one first. */
export function listOverlayDesigns(): OverlayDesign[] {
  return [...designs.values()];
}

/** Hear designs arriving — an extension loaded at runtime registers late. */
export function onOverlayDesignRegistered(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

// ── The choice ───────────────────────────────────────────────────────────────

/** The design a display names, as an id — `grid` when it names none. */
export function overlayDesignOf(display: Pick<CharacterDisplay, 'ext'> | null | undefined): string {
  const ext = display?.ext as { overlay?: { design?: unknown } } | undefined;
  const id = ext?.overlay?.design;
  return typeof id === 'string' && id ? id : GRID_OVERLAY_DESIGN.id;
}

/** A display's `ext` with the overlay design set — for the character display editor. */
export function withOverlayDesign(display: Pick<CharacterDisplay, 'ext'>, id: string): CharacterDisplay['ext'] {
  const ext = (display.ext ?? {}) as Record<string, unknown>;
  return { ...ext, overlay: { ...((ext.overlay as object) ?? {}), design: id } };
}

const resolve = (id: string): OverlayDesign => designs.get(id) ?? GRID_OVERLAY_DESIGN;

/** The design in use, for code that is not a React render. */
export function overlayDesign(): OverlayDesign {
  return resolve(overlayDesignOf(displaySettings()));
}

/**
 * The design in use, as a subscription: re-renders when the choice changes or
 * the chosen design arrives late (an extension loaded after the first paint).
 * A choice naming a design that is not installed falls back to `grid`.
 */
export function useOverlayDesign(): OverlayDesign {
  const id = overlayDesignOf(useDisplaySettings());
  const [, bump] = useState(0);
  useEffect(() => onOverlayDesignRegistered(() => bump(n => n + 1)), []);
  return resolve(id);
}
