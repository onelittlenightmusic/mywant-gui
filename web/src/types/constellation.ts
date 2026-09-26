/**
 * Constellation — a user-defined, named collection of items that carries a meaning the
 * user assigns (e.g. grouping the stations "Nakano" and "中野坂上" as "近い"/close).
 * thing and want groups live in separate namespaces (`kind`); an item id may
 * appear in several groups (tag-style). Mirrors the backend Constellation struct.
 */
export interface Constellation {
  id: string;
  name: string;
  kind: ConstellationKind;
  /**
   * The colour the user picked for this constellation — its line on the board,
   * its folder marks in the sidebar and on thing cards. Stored server-side as a
   * reserved label its members carry (see handlers_constellations.go); absent
   * means the default blue starlight.
   */
  color?: string;
  /** thing id ("catalogKey::value") or want id. */
  members: string[];
  /** Which kind each member is, keyed by the same ids as `members`. */
  memberKinds?: Record<string, 'thing' | 'want'>;
}

/** What is in a constellation. 'mixed' holds both — see the engine's
 *  handlers_constellations, where the kind moved onto the member. */
export type ConstellationKind = 'thing' | 'want' | 'mixed';

/** The colours the Themes tab offers for a constellation. */
export const CONSTELLATION_COLORS = [
  '#38bdf8', // sky
  '#818cf8', // indigo
  '#a78bfa', // violet
  '#f472b6', // pink
  '#fb7185', // rose
  '#fbbf24', // amber
  '#34d399', // emerald
  '#2dd4bf', // teal
] as const;
