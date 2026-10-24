/**
 * Where a thing's picture comes from.
 *
 * The subtype names the source in the server's data type catalog
 * (DataTypeInfo.Background), in one of two forms, because there are two
 * genuinely different kinds of picture:
 *
 *   background: station            a file every station shares, shipped with
 *                                  the GUI at /resources/station.png
 *   background: "@album_art_url"   THIS thing's own picture, whose URL is kept
 *                                  as a label on the thing itself
 *
 * The catalog says a NAME either way: it never spells out where the GUI keeps
 * its files, and it never holds a URL of its own.
 *
 * Shared rather than written per card: the Thing card, the pin picker and the
 * kind picker all draw the same picture, and three copies of this rule is three
 * chances for one of them to show a different thing from the others.
 */
export function thingBackgroundSrc(
  background: string | undefined,
  labels?: Record<string, string>,
): string | undefined {
  // Its own picture, then its art, then its kind's: a drawing of 新宿 says
  // more than the picture every station shares.
  return thingOwnPicture(background, labels)
    ?? (background && !background.startsWith('@') ? `/resources/${background}.png` : undefined);
}

/**
 * The label a thing's art rides on: a picture drawn for it on the phone
 * (Image Playground, mywant-ios ThingArt), its URL — the engine's thing_art.go.
 */
export const THING_ART_LABEL = 'mywant.io/art';

/**
 * The picture that is THIS thing's, not its kind's: its own ("@label"), or,
 * with none, the art drawn for it. What its card wears; on the board the art
 * is laid on the floor instead (ThingTile.art).
 */
export function thingOwnPicture(
  background: string | undefined,
  labels?: Record<string, string>,
): string | undefined {
  if (background?.startsWith('@')) {
    const url = labels?.[background.slice(1)]?.trim();
    if (url) return url;
  }
  return labels?.[THING_ART_LABEL]?.trim() || undefined;
}

/**
 * The picture a KIND is drawn over, for a picker that has no thing in hand.
 *
 * Only the file form: the other form names a label on a thing, and an album's
 * cover belongs to an album, not to "album".
 */
export function kindBackgroundSrc(background: string | undefined): string | undefined {
  if (!background || background.startsWith('@')) return undefined;
  return `/resources/${background}.png`;
}

/**
 * The scrim over a thing's picture — light at the ends, thin in the middle, so
 * a glyph and a name stay readable without covering the photograph. The Thing
 * card's, shared so every surface that shows a thing over its picture holds the
 * picture back by the same amount.
 */
export const THING_BACKGROUND_SCRIM =
  'absolute inset-0 pointer-events-none bg-gradient-to-b from-white/60 via-white/20 to-white/60'
  + ' dark:from-gray-900/60 dark:via-gray-900/25 dark:to-gray-900/60';
