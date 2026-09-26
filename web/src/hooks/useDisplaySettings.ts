import { useCharacterStore } from '@/stores/characterStore';
import { setSoundEnabledFlag } from '@/utils/sounds';
import type { CharacterDisplay } from '@/types/character';

/**
 * How the app looks and sounds, for whoever is using it.
 *
 * These were the global Settings. They are read from MY character now, because
 * a character is a person here — two people share one server and one board, and
 * how loud the interface is, how tall its cards are and what colour the ground
 * is were never facts about the board. Nothing here reaches the server config
 * any more; a character that has chosen nothing gets DISPLAY_DEFAULTS, which
 * are the values the app has always shipped with.
 *
 * One module, so the resolution rule exists once. Before this, each setting was
 * read at every call site as `config?.x ?? fallback`, with the fallback spelled
 * out again each time — which is how a default drifts between two files and
 * nobody notices until the two disagree on screen.
 */

export type HeaderPosition = 'top' | 'bottom';
export type ColorModeSetting = 'light' | 'dark' | 'system';
export type CardHeight = 'sm' | 'md' | 'lg';
export type SystemFontSize = 'small' | 'medium' | 'large';
export type IconFont = 'lucide' | 'lucide-thin' | 'heroicons-outline' | 'heroicons-solid';

/** What the app looks like before anyone has an opinion. */
export const DISPLAY_DEFAULTS: Required<Omit<CharacterDisplay, 'canvas_bg_url' | 'canvas_bg_color' | 'ext'>> & {
  canvas_bg_url: string;
  canvas_bg_color: string;
  ext?: CharacterDisplay['ext'];
} = {
  header_position: 'top',
  color_mode: 'system',
  card_height: 'sm',
  system_font_size: 'large',
  sound_enabled: true,
  // 1.0 is the original solid look: the card's opaque base is inside the layer
  // this fades, so anything less makes the card genuinely see-through.
  card_opacity: 1,
  icon_font: 'lucide',
  canvas_bg_color: '',
  canvas_bg_url: '',
};

/**
 * My character's choices, filled in with the defaults.
 *
 * The non-React read, for the imperative paths — the sound player, the canvas
 * rAF loop, the class that gets written onto <html>. React code should use the
 * hook below so it re-renders when the choice changes.
 */
export function displaySettings(): typeof DISPLAY_DEFAULTS {
  const me = useCharacterStore.getState().getMyCharacter();
  return { ...DISPLAY_DEFAULTS, ...(me?.display ?? {}) };
}

/** My character's choices, filled in with the defaults, as a subscription. */
export function useDisplaySettings(): typeof DISPLAY_DEFAULTS {
  const me = useCharacterStore(s => s.characters.find(c => c.id === s.myCharacterId) ?? null);
  return { ...DISPLAY_DEFAULTS, ...(me?.display ?? {}) };
}

/** Where the header sits. */
export function useHeaderPosition(): HeaderPosition {
  return useDisplaySettings().header_position;
}

/** True when the header is along the bottom — the shape most callers want. */
export function useHeaderAtBottom(): boolean {
  return useDisplaySettings().header_position === 'bottom';
}

/** Which icon family category/type icons are drawn from. */
export function useIconFont(): IconFont {
  return useDisplaySettings().icon_font;
}

/**
 * The three settings that are not read where they are used.
 *
 * Dark mode is a class on <html>, the canvas ground is a CSS variable, and the
 * sound player is a module with a flag — none of them can subscribe to a store,
 * so somebody has to push. This is that somebody, and it is called from the
 * subscription below rather than from a component, so the app looks right from
 * the moment the characters land rather than from the moment some particular
 * screen happens to mount.
 */
export function applyDisplaySettings(d: typeof DISPLAY_DEFAULTS): void {
  const root = window.document.documentElement;

  const dark = d.color_mode === 'dark'
    || (d.color_mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('dark', dark);

  // Empty means "whatever the theme says", which is the variable being absent
  // rather than set to something — see index.css's :root / .dark blocks.
  if (d.canvas_bg_color) root.style.setProperty('--canvas-bg', d.canvas_bg_color);
  else root.style.removeProperty('--canvas-bg');

  setSoundEnabledFlag(d.sound_enabled);
}

/**
 * Keep the pushed settings in step with whoever is using the app.
 *
 * Module scope, so it is armed by the first import rather than by a component
 * mounting: these are app-wide facts, and the screen that happens to need them
 * first should not be the thing that decides when they take effect. Fires on
 * the character list arriving, on the choice changing, and on switching which
 * character is mine.
 */
let _lastApplied = '';
useCharacterStore.subscribe(() => {
  const d = displaySettings();
  const key = JSON.stringify(d);
  if (key === _lastApplied) return;   // unrelated store writes are most of them
  _lastApplied = key;
  applyDisplaySettings(d);
});

// The system theme can change under a character who asked to follow it.
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (displaySettings().color_mode === 'system') applyDisplaySettings(displaySettings());
});
