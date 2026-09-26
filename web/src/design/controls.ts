/**
 * How big a thing you can touch is.
 *
 * Sizes used to be decided per component, and it showed: a survey of the app
 * found ten different icon sizes, fifteen vertical paddings and eight font
 * sizes across the interactive elements alone. Nothing was wrong with any one
 * of them — each was chosen to fit the space it was in — but together they read
 * as an interface assembled from parts of other interfaces.
 *
 * Worse, ten places shrank themselves on small screens (`py-0.5 sm:py-2` and
 * friends), which is backwards: the screen gets smaller, the finger does not.
 * A detail tab was 18px tall on a phone and 42px on a desktop, and the phone is
 * the one being touched.
 *
 * So there are three sizes, and a component picks one rather than inventing a
 * fourth. The vocabulary shrinks from 10 × 15 × 8 to 3 × 3 × 3.
 *
 * ── The rule these exist to keep ────────────────────────────────────────────
 *
 * Anything you can press is at least MIN_TAP_PX tall, on every screen. Not a
 * target — a floor. When a row will not fit, the answer is fewer controls (see
 * the header's create menu), a different order, or leaving some out with a way
 * back to them. Never a smaller control.
 */

/**
 * The floor, in CSS pixels.
 *
 * 44 is Apple's, and the smaller of the two conventions — Material asks for
 * 48dp. Taking the smaller one means the rule can be applied everywhere without
 * argument; anything that wants to be bigger already has `lg`.
 */
export const MIN_TAP_PX = 44;

export type ControlSize = 'sm' | 'md' | 'lg';

/** Height in CSS pixels, by size. */
export const CONTROL_H: Record<ControlSize, number> = {
  // Below the floor on purpose, and the only size that is: a control that is
  // not on the way to anything — a copy button beside a value, a dismiss on a
  // chip — sits inside something already big enough to hit. Reach for `md`
  // unless the thing is genuinely incidental.
  sm: 36,
  md: MIN_TAP_PX,
  lg: 56,
};

/** Icon edge in CSS pixels, by size. */
export const CONTROL_ICON: Record<ControlSize, number> = { sm: 16, md: 20, lg: 24 };

/** Label size in CSS pixels, by size. */
export const CONTROL_TEXT: Record<ControlSize, number> = { sm: 11, md: 13, lg: 15 };

/**
 * The classes a control of this size wears.
 *
 * Written out rather than composed from the numbers above, because Tailwind
 * generates utilities by reading the source: a class assembled at runtime from
 * a template literal never appears in the file, so the rule for it is never
 * emitted and the control silently has no size at all. The numbers and these
 * strings say the same thing, and the test beside them checks that they do.
 *
 * `min-h` rather than `h`: a cell with two lines in it is allowed to grow, and
 * a fixed height would clip the second. The floor is what matters.
 *
 * Identical at every width — that is the point. A size that changed with the
 * viewport is the thing this replaces.
 */
export const CONTROL: Record<ControlSize, string> = {
  sm: 'min-h-[36px] px-2',
  md: 'min-h-[44px] px-3',
  lg: 'min-h-[56px] px-4',
};

/**
 * The height alone, for a control whose width comes from the layout it is in.
 *
 * A tab in a `flex-1` row and a cell in a grid are already told how wide to be;
 * giving them the padding as well would fight the layout for the same pixels.
 * The floor is the part that is not the layout's business.
 */
export const CONTROL_MIN_H: Record<ControlSize, string> = {
  sm: 'min-h-[36px]',
  md: 'min-h-[44px]',
  lg: 'min-h-[56px]',
};

/** The icon class for a control of this size. */
export const CONTROL_ICON_CLASS: Record<ControlSize, string> = {
  sm: 'h-[16px] w-[16px]',
  md: 'h-[20px] w-[20px]',
  lg: 'h-[24px] w-[24px]',
};

/** The label class for a control of this size. */
export const CONTROL_TEXT_CLASS: Record<ControlSize, string> = {
  sm: 'text-[11px]',
  md: 'text-[13px]',
  lg: 'text-[15px]',
};

/**
 * A tab in a strip.
 *
 * Fixed, not a floor, and one value for every strip in the app. The three that
 * exist — the panel's own tabs, the settings sub-tabs, the history sub-tabs —
 * each set their own padding around an icon and a label, and each arrived at a
 * different total: 50 and 55 and whatever the next one would have been. All
 * three cleared the 44px floor and none of them agreed, which is the kind of
 * difference nobody can name but everybody sees when two of them sit one above
 * the other in the same panel.
 *
 * 52 is what the tallest of them needed: a 20px icon, a 10px label under it and
 * the breathing room between. Fixing it means a strip cannot drift by being
 * given a slightly different label.
 */
export const CONTROL_TAB = 'h-[52px]';
