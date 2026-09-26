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
  if (!background) return undefined;
  if (background.startsWith('@')) {
    const url = labels?.[background.slice(1)]?.trim();
    return url || undefined;
  }
  return `/resources/${background}.png`;
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
