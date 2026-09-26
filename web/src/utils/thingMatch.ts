import type { ThingDefinition } from '@/types/thing';

/** A {lat,lng} pair if the value is coordinate-shaped, else null. */
export function coordOf(v: unknown): { lat: number; lng: number } | null {
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.lat === 'number' && typeof o.lng === 'number') return { lat: o.lat, lng: o.lng };
  }
  return null;
}

/**
 * Great-circle distance in metres — for matching a named place by proximity
 * rather than exact value (GPS jitter means the live reading never equals the
 * one captured at name time).
 */
export function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export const PLACE_MATCH_RADIUS_M = 150;

/** Canonical string form of a value, for comparing one against another. */
function canon(v: unknown): string {
  if (v === null || v === undefined) return '';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

/**
 * Is this value a thing? — the one rule, in one place.
 *
 * A value is a thing when some character has named it: the ledger holds the
 * name and the value it was given to, and this asks whether the value in hand
 * is that value. Coordinates match by proximity because GPS never reproduces a
 * reading exactly; everything else matches exactly.
 *
 * `subtype` narrows the search to one catalog when the caller knows it (a field
 * card knows its own declared type). A road only knows what it is carrying, so
 * it passes nothing and takes whichever catalog claims the value.
 *
 * Returns every matching definition — the same value can carry a name from more
 * than one character.
 */
export function definitionsForValue(
  definitions: ThingDefinition[],
  value: unknown,
  subtype?: string | null,
): ThingDefinition[] {
  if (value === null || value === undefined || value === '') return [];
  const target = canon(value);
  const coord = coordOf(value);

  return definitions.filter(d => {
    if (subtype && d.subtype !== subtype) return false;
    const defCoord = coordOf(d.value);
    if (coord && defCoord) return metersBetween(coord, defCoord) <= PLACE_MATCH_RADIUS_M;
    return canon(d.value) === target;
  });
}

/** The first definition matching this value, or undefined. */
export function definitionForValue(
  definitions: ThingDefinition[],
  value: unknown,
  subtype?: string | null,
): ThingDefinition | undefined {
  return definitionsForValue(definitions, value, subtype)[0];
}
