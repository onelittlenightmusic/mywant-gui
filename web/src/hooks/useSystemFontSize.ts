import { useDisplaySettings, DISPLAY_DEFAULTS } from './useDisplaySettings';

export type SystemFontSize = 'small' | 'medium' | 'large';

/** Default matches the current look so nothing shrinks until the user chooses. */
export const SYSTEM_FONT_SIZE_DEFAULT: SystemFontSize = DISPLAY_DEFAULTS.system_font_size;

/** Tailwind size classes per element, per level. 'large' = current sizes,
 *  'medium' = the sizes before the recent enlargements, 'small' = smaller. */
export const CARD_FACE_NAME_SIZE: Record<SystemFontSize, string> = {
  small:  'text-[9px] sm:text-[12px]',
  medium: 'text-[11px] sm:text-sm',
  large:  'text-[26px] sm:text-[34px]',
};

// Base (mobile / iPhone) sizes are ~75% of the sm+ (tablet/desktop) sizes.
export const MENU_FONT_SIZE: Record<SystemFontSize, string> = {
  small:  'text-[9px] sm:text-xs',
  medium: 'text-[10.5px] sm:text-sm',
  large:  'text-lg sm:text-2xl',
};

/**
 * Bounds for the hamburger menu's fitted labels (see .nav-card-label).
 *
 * Those labels are sized to the card rather than picked from a scale, so the
 * preference cannot be a class here — it becomes the floor and ceiling that the
 * fitting is allowed to move between. The floor matters: below about 8px a
 * label stops being readable at arm's length, and it is better for a long word
 * to clip than for every word to be too small.
 */
export const NAV_CARD_FIT: Record<SystemFontSize, { min: string; max: string }> = {
  small:  { min: '8px',  max: '12px' },
  medium: { min: '9px',  max: '15px' },
  large:  { min: '11px', max: '20px' },
};

/** Body text inside want-type card content (plugins + built-in type renderers).
 *
 *  This picks the *scale*; the actual size also steps up with the card's own
 *  size via container queries on .wc-body (see styles/index.css). A viewport
 *  breakpoint would be wrong here — maximizing a card does not change the
 *  viewport, so the text would stay put exactly when it should grow.
 *
 *  Applied once on the .wc-body wrapper in WantCardContent so every plugin
 *  inherits it — plugins must not set their own text size. Emoji and icons keep
 *  their explicit sizes; SVG <text> uses viewBox units and is unaffected. */
export const CARD_CONTENT_SIZE: Record<SystemFontSize, string> = {
  small:  'wc-font-small',
  medium: 'wc-font-medium',
  large:  'wc-font-large',
};

export function useSystemFontSize(): SystemFontSize {
  return useDisplaySettings().system_font_size;
}
