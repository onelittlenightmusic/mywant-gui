import type { ThingDefinition } from '@/types/thing';

/**
 * What a thing is a picture of — the one rule every surface that draws a
 * thing's picture follows (its card, and the board up close), so a thing looks
 * like the same object wherever it is.
 *
 *   clock  a time ("6:50") — a clock whose hands point at it
 *   photo  a picture of its own (a shared photo, a cover, an image's URL)
 *   map    a place it was named at — the map around it
 *   glyph  anything else — its kind's icon
 *
 * A number is a glyph too: a meter needs a range, and no kind says one.
 */
export type ThingPictureKind = 'clock' | 'photo' | 'map' | 'glyph';

export interface ThingPictureSource {
  subtype: string;
  value: string;
  icon: string;
  color: string;
  coords?: { lat: number; lng: number };
  photo?: string;
}

/** The hour and minute a value says, when it is a time of day ("6:50", "13:00"). */
export function parseClock(value: string): { h: number; m: number } | null {
  const m = /^\s*(\d{1,2}):(\d{2})(?::\d{2})?\s*$/.exec(value);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  return h < 24 && min < 60 ? { h, m: min } : null;
}

export function thingPictureKind(s: ThingPictureSource): ThingPictureKind {
  if (parseClock(s.value)) return 'clock';
  if (s.photo) return 'photo';
  if (s.coords) return 'map';
  return 'glyph';
}

/**
 * Where a thing was named, if a name was given to a coordinate — the newest
 * such name's. Read out of the ledger's definitions (thingStore).
 */
export function thingCoords(definitions: ThingDefinition[], thingId: string): { lat: number; lng: number } | undefined {
  let best: { lat: number; lng: number; at: string } | undefined;
  for (const d of definitions) {
    if (d.thingId !== thingId) continue;
    const v = d.value as Record<string, unknown> | null | undefined;
    if (typeof v?.lat !== 'number' || typeof v?.lng !== 'number') continue;
    if (v.lat === 0 && v.lng === 0) continue;
    if (!best || (d.at ?? '') > best.at) best = { lat: v.lat, lng: v.lng, at: d.at ?? '' };
  }
  return best && { lat: best.lat, lng: best.lng };
}

/**
 * The thing's own picture: one kept on it (`picture`, see ThingTile.picture),
 * or, for an image, the URL it was named for.
 */
export function thingPhoto(definitions: ThingDefinition[], thingId: string, subtype: string, picture?: string): string | undefined {
  if (picture) return picture;
  if (subtype !== 'image') return undefined;
  for (const d of definitions) {
    if (d.thingId === thingId && typeof d.value === 'string' && /^https?:\/\//i.test(d.value)) return d.value;
  }
  return undefined;
}
