import { useEffect, useState } from 'react';
import { useDisplaySettings, displaySettings } from '@/hooks/useDisplaySettings';
import { useCharacterStore } from '@/stores/characterStore';
import type { CharacterDisplay } from '@/types/character';
import type { OverlayTone } from './tones';

/**
 * How overlays look — a skin over the one overlay object.
 *
 * Every overlay is the same thing (see tones.ts), laid out the same way; what a
 * design decides is only how it is painted: the colour each tone gets, the
 * cell's shape and hover, the ring, the words, the box and its tail, how it
 * comes in. Two are built in: `sheet`, the default — each cell a white card,
 * its meaning in its icon's colour — and `grid`, full-bleed coloured tiles on
 * a dark box. An extension can add another (registerOverlayDesign, or `overlayDesigns`
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
  /**
   * The box a free-standing overlay sits in (shape + surface), and the colour
   * of the words said in it — a character's line is written in the frame's ink,
   * so it reads on whichever fill the design gives the box.
   */
  frame: string;
  /** The grid the cells are laid out in: the space between and around them. */
  grid?: string;
  /** The tail's colour: a CSS colour, matching the frame's outline. */
  tailColor: string;
  /** What is laid over a card behind an overlay drawn on it. */
  backdrop: string;
  /** A text field inside an overlay. */
  input: string;
  /** The whole overlay arriving, and one cell arriving (CSS animation shorthands). */
  enterAnimation: string;
  cellEnterAnimation: string;
  /**
   * The same look as plain CSS values, for overlays drawn where this app's
   * classes do not exist — the browser extension's and the bookmarklet's menus
   * on other people's pages. Stored with the choice (see withOverlayDesign), so
   * those can read it off the character — and the global control pill, which is
 * drawn from these values everywhere, the app's header included (see
 * shared/controlPill). Absent: they keep the grid look.
   */
  portable?: OverlayPortableStyle;
}

/**
 * An overlay design as values rather than class names — what a page that is
 * not this app can apply as CSS custom properties (--mwo-*).
 */
export interface OverlayPortableStyle {
  /** A cell's fill, per tone: any CSS colour. */
  tones: Record<OverlayTone, string>;
  /** The box's fill, its outline, and the colour of its words. */
  surface: string;
  outline: string;
  ink: string;
  /** The box's corner radius, px. */
  radius: number;
  /** A cell's corner radius, and the gap between cells, px — 0 and 0 are full-bleed tiles. */
  cellRadius: number;
  cellGap: number;
  /** The word under a cell's icon. */
  labelTransform: 'uppercase' | 'none';
  labelWeight: number;
  labelSize: number;
  /** What is laid over a page behind a dialog. */
  backdrop: string;
  /**
   * Solid colours for a state that has to be seen at once (the control pill's
   * paused sign and play button), where `tones` are too faint to carry white
   * words. Without them the pill fills with `tones`.
   */
  signals?: Partial<Record<'confirm' | 'caution' | 'info', string>>;
  /** Cells are raised cards on a sunken tray, as the sheet's tabs are. */
  cards?: boolean;
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
  frame: 'rounded-2xl overflow-hidden bg-slate-900 border border-slate-600 text-slate-200 shadow-2xl',
  tailColor: 'rgb(71 85 105)',
  backdrop: 'bg-black/60',
  input:
    'w-full rounded-md bg-slate-800 border border-slate-700 px-2.5 py-1 text-sm text-slate-100 ' +
    'placeholder-slate-500 outline-none focus:border-sky-500',
  // Keyframes in WantCard.module.css.
  enterAnimation: 'quickActionsIn 150ms ease-out forwards',
  cellEnterAnimation: 'quickActionBtnIn 150ms ease-out both',
  portable: {
    tones: {
      confirm: 'rgba(5,150,105,.9)',
      cancel:  'rgba(75,85,99,.9)',
      danger:  'rgba(190,18,60,.9)',
      primary: 'rgba(37,99,235,.9)',
      caution: 'rgba(217,119,6,.9)',
      info:    'rgba(2,132,199,.9)',
      accent:  'rgba(79,70,229,.9)',
      special: 'rgba(124,58,237,.9)',
      muted:   '#334155',
    },
    surface: '#0f172a',
    outline: '#475569',
    ink: '#ffffff',
    radius: 16,
    cellRadius: 0,
    cellGap: 0,
    labelTransform: 'uppercase',
    labelWeight: 700,
    labelSize: 9,
    backdrop: 'rgba(0,0,0,.6)',
  },
};

/**
 * The quiet sheet — the default: every cell a card of its own on a pale box,
 * as the board's tiles are things of their own. A cell is white (slate in the
 * dark), set down with its shadow to the lower right (the board's one light,
 * from the upper left); what an action means is in its icon's colour, not its
 * fill — a wide coloured face draws the eye from everything on it, so colour
 * goes where it is small. Only danger also wears a stripe down its left edge,
 * to be told apart before it is read.
 *
 * Icons handed in white (most callers drew them for the grid's coloured tiles)
 * take the cell's colour instead (`[&_svg]`), so no overlay has to change.
 */
export const SHEET_OVERLAY_DESIGN: OverlayDesign = {
  id: 'sheet',
  name: 'Sheet',
  tones: {
    confirm: 'text-emerald-600 dark:text-emerald-400',
    cancel:  'text-slate-500 dark:text-slate-400',
    danger:  'text-rose-600 dark:text-rose-400 border-l-4 border-l-rose-500 dark:border-l-rose-500',
    primary: 'text-blue-600 dark:text-blue-400',
    caution: 'text-amber-600 dark:text-amber-400',
    info:    'text-sky-600 dark:text-sky-400',
    accent:  'text-indigo-600 dark:text-indigo-400',
    special: 'text-violet-600 dark:text-violet-400',
    muted:   'text-slate-600 dark:text-slate-300',
  },
  disabled: 'bg-slate-100 dark:bg-slate-800/40 text-slate-300 dark:text-slate-600 shadow-none cursor-not-allowed',
  cell:
    'rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 ' +
    'shadow-[2px_3px_6px_rgba(15,23,42,0.12)] [&_svg]:!text-inherit',
  cellInteractive:
    'hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_4px_10px_rgba(15,23,42,0.16)] ' +
    'active:translate-x-px active:translate-y-px active:shadow-none',
  cellOff: 'opacity-50',
  focus: 'ring-2 ring-offset-2 ring-offset-slate-50 dark:ring-offset-slate-900',
  label: 'text-slate-600 dark:text-slate-300 text-[10px] font-medium leading-none',
  header: 'flex items-center gap-1.5 text-slate-600 dark:text-slate-300 text-xs font-semibold',
  surface: 'bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700',
  frame:
    'rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 ' +
    'text-slate-800 dark:text-slate-100 shadow-[6px_8px_20px_rgba(15,23,42,0.22)]',
  grid: 'gap-1.5 p-1.5',
  // The outline's colour, which reads against the board in either mode.
  tailColor: 'rgb(203 213 225)',
  backdrop: 'bg-slate-50/85 dark:bg-slate-900/85 backdrop-blur-[2px]',
  input:
    'w-full rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 px-2.5 py-1 text-sm ' +
    'text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-sky-500',
  enterAnimation: 'quickActionsIn 150ms ease-out forwards',
  cellEnterAnimation: 'quickActionBtnIn 150ms ease-out both',
  // Portable values paint a cell's fill per tone and one ink for every word,
  // so the colour moves to a faint tint of the fill.
  portable: {
    tones: {
      confirm: '#ecfdf5',
      cancel:  '#f1f5f9',
      danger:  '#fff1f2',
      primary: '#eff6ff',
      caution: '#fffbeb',
      info:    '#f0f9ff',
      accent:  '#eef2ff',
      special: '#f5f3ff',
      muted:   '#ffffff',
    },
    surface: '#f8fafc',
    outline: '#cbd5e1',
    ink: '#334155',
    radius: 16,
    cellRadius: 12,
    cellGap: 6,
    labelTransform: 'none',
    labelWeight: 500,
    labelSize: 10,
    backdrop: 'rgba(248,250,252,.85)',
    signals: { confirm: '#059669', caution: '#d97706', info: '#0284c7' },
    cards: true,
  },
};

/** The design drawn when nobody chose one. */
export const DEFAULT_OVERLAY_DESIGN = SHEET_OVERLAY_DESIGN;

// ── Registry ─────────────────────────────────────────────────────────────────

const designs = new Map<string, OverlayDesign>([
  [SHEET_OVERLAY_DESIGN.id, SHEET_OVERLAY_DESIGN],
  [GRID_OVERLAY_DESIGN.id, GRID_OVERLAY_DESIGN],
]);
const listeners = new Set<() => void>();

/**
 * Add a design. A later one with the same id replaces the earlier — `grid`
 * included, for an extension that wants to restyle the default in place.
 */
export function registerOverlayDesign(design: OverlayDesign): void {
  designs.set(design.id, { ...GRID_OVERLAY_DESIGN, ...design });
  listeners.forEach(fn => fn());
}

/** Every design, the built-in ones first (the default before the grid). */
export function listOverlayDesigns(): OverlayDesign[] {
  return [...designs.values()];
}

/** Hear designs arriving — an extension loaded at runtime registers late. */
export function onOverlayDesignRegistered(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

// ── The choice ───────────────────────────────────────────────────────────────

/** The design a display names, as an id — the default (`sheet`) when it names none. */
export function overlayDesignOf(display: Pick<CharacterDisplay, 'ext'> | null | undefined): string {
  const ext = display?.ext as { overlay?: { design?: unknown } } | undefined;
  const id = ext?.overlay?.design;
  return typeof id === 'string' && id ? id : DEFAULT_OVERLAY_DESIGN.id;
}

/**
 * A display's `ext` with the overlay design set — for the character display
 * editor. The design's portable values go with it (or are cleared, for a
 * design without them), so the extension and the bookmarklet can draw their
 * menus the same way without knowing any design by name.
 */
export function withOverlayDesign(display: Pick<CharacterDisplay, 'ext'>, id: string): CharacterDisplay['ext'] {
  const ext = (display.ext ?? {}) as Record<string, unknown>;
  const portable = designs.get(id)?.portable ?? null;
  return { ...ext, overlay: { ...((ext.overlay as object) ?? {}), design: id, portable } };
}

/** The portable values a display carries for its chosen design, if any. */
export function portableOverlayStyleOf(display: Pick<CharacterDisplay, 'ext'> | null | undefined): OverlayPortableStyle | null {
  const ext = display?.ext as { overlay?: { portable?: unknown } } | undefined;
  const p = ext?.overlay?.portable;
  return p && typeof p === 'object' ? p as OverlayPortableStyle : null;
}

const resolve = (id: string): OverlayDesign => designs.get(id) ?? DEFAULT_OVERLAY_DESIGN;

// ── Without a character ──────────────────────────────────────────────────────
//
// The choice is my character's — but the app on its own has no screen for
// choosing who I am (that is the canvas's), so a browser can be nobody. Then
// the choice is kept in this browser instead: the header pill and every
// overlay are drawn here either way, and a design installed as a custom must
// be choosable without the canvas. (The browser extension reads the character,
// so it keeps the grid look for somebody who is nobody.)

const LOCAL_KEY = 'mywant.overlayDesign';

function localOverlayDesignId(): string {
  try { return localStorage.getItem(LOCAL_KEY) || DEFAULT_OVERLAY_DESIGN.id; } catch { return DEFAULT_OVERLAY_DESIGN.id; }
}

/** Keep the choice in this browser — for when there is no character to keep it on. */
export function setLocalOverlayDesign(id: string): void {
  try { localStorage.setItem(LOCAL_KEY, id); } catch { /* kept for this page only */ }
  localChosen = id;
  listeners.forEach(fn => fn());
}
let localChosen: string | null = null;
const localId = () => localChosen ?? localOverlayDesignId();

/** Whose choice it is: my character's when there is one, this browser's otherwise. */
const hasCharacter = () => !!useCharacterStore.getState().getMyCharacter();

/** The design in use, for code that is not a React render. */
export function overlayDesign(): OverlayDesign {
  return resolve(hasCharacter() ? overlayDesignOf(displaySettings()) : localId());
}

/** The id of the design in use — my character's choice, or this browser's when I am nobody. */
export function currentOverlayDesignId(display: Pick<CharacterDisplay, 'ext'> | null | undefined, character: boolean): string {
  return character ? overlayDesignOf(display) : localId();
}

/**
 * The design in use, as a subscription: re-renders when the choice changes or
 * the chosen design arrives late (an extension loaded after the first paint).
 * A choice naming a design that is not installed falls back to the default.
 */
export function useOverlayDesign(): OverlayDesign {
  const display = useDisplaySettings();
  const character = useCharacterStore(s => !!s.myCharacterId && s.characters.some(c => c.id === s.myCharacterId));
  const id = currentOverlayDesignId(display, character);
  const [, bump] = useState(0);
  useEffect(() => onOverlayDesignRegistered(() => bump(n => n + 1)), []);
  return resolve(id);
}
