/**
 * The silhouette a remembered thing wears, wherever it is drawn — the canvas,
 * a kata's waza tile, a card's icon badge.
 *
 * A circle. A want is a card with corners and a face; a thing is a single named
 * value with nothing inside it to lay out, and a round badge says so at any
 * size, down to the few pixels the minimap gives it.
 *
 * Applied as a `clip-path`, so anything that needs a shadow has to use a
 * `drop-shadow` filter — a box-shadow is drawn outside the border box and gets
 * clipped away with everything else.
 */
export const THING_CLIP = 'circle(50% at 50% 50%)';

/**
 * The ball a thing is drawn as lives in utils/thingFace.ts (sphereBackground) —
 * ONE recipe, wherever the thing appears.
 *
 * There used to be a second one here, and the two disagreed about the thing's
 * own colour by a lot: the canvas tile laid it down at alpha d9/c4 (all but
 * opaque, and the same weight thingFaceBackground gives the minimap dot, the
 * card badge and the sidebar swatch), while this one used 66/7a and came out
 * a washed, greyer ball. So a thing was one colour on the board and a paler
 * one everywhere small — which is the single place that difference matters
 * most, because at 14px the colour is all there is to recognise it by.
 */
