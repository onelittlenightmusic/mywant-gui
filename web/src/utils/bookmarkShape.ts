/**
 * The dog-ear a character leaves on something it has marked as its default —
 * a rectangle with a notch cut out of its foot.
 *
 * It used to say "marked, not remembered", against the round shape of a thing.
 * That distinction is gone: pressing X both marks the value and names it into
 * the thing, so the two were never separate sets, and the marks now wear the
 * thing's dot (see ThingDot.tsx). What is left here is EntityCard's
 * `badgeShape="bookmark"` option, which nothing currently passes.
 *
 * Applied as a `clip-path`, so anything that needs a shadow has to use a
 * `drop-shadow` filter — a box-shadow is drawn outside the border box and gets
 * clipped away with everything else.
 */
export const BOOKMARK_CLIP = 'polygon(0% 0%, 100% 0%, 100% 100%, 50% 76%, 0% 100%)';
