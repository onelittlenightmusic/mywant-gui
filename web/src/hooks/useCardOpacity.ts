import { useDisplaySettings, DISPLAY_DEFAULTS } from './useDisplaySettings';

/**
 * The card surface opacity every card shares — now one person's own choice
 * rather than a server setting (see useDisplaySettings).
 *
 * 1.0 is the default because the card's opaque base is now part of this layer:
 * fully opaque reproduces the original look exactly, and anything below it
 * makes the card genuinely see-through. (The old hardcoded 0.7 applied only to
 * the gradient, which sat over a white base that never faded — so it still
 * looked solid. Defaulting to 0.7 here would render every card 30%
 * transparent out of the box.)
 */
export const CARD_OPACITY_DEFAULT = DISPLAY_DEFAULTS.card_opacity;

/**
 * Opacity for a card's whole painted surface — base tint, category gradient or
 * image, and any screenshot/thumbnail on top.
 *
 * Cards render all of that in one absolutely-positioned layer, so this value
 * never touches icons, names or badges: turning it down makes the card
 * see-through without hurting readability.
 */
export function useCardOpacity(): number {
  return useDisplaySettings().card_opacity;
}
