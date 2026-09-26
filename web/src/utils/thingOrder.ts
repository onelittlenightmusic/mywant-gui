import { ThingRecord } from '@/types/thing';

/**
 * The one place that answers "in what order do these things go?".
 *
 * Every surface that lists things asks the same question — the Thing page's
 * grid, the canvas when it lines a theme up — so the answer is a pure function
 * over the things plus the two things the user has said about order: the manual
 * card order they dragged, and the rank a thing carries inside a theme.
 */

/**
 * The label a theme's membership rides on. Mirrors the server's
 * constellationLabelPrefix: a constellation IS the label "constellation/<name>"
 * carried by each member, and there is no separate ledger behind it.
 */
export const THEME_LABEL_PREFIX = 'constellation/';

/** What the same relation was stored under before the rename. Read, never written. */
const LEGACY_THEME_LABEL_PREFIX = 'group/';

/** The label key that says a thing belongs to `theme`. */
export function themeLabelKey(theme: string): string {
  return THEME_LABEL_PREFIX + theme;
}

/**
 * Every key a membership can be filed under — the current one and the one it
 * was written under before the rename.
 *
 * Only removal needs both. Writing uses themeLabelKey alone, exactly as the
 * server does: a legacy membership converts the first time it is edited.
 */
export function themeLabelKeys(theme: string): string[] {
  return [THEME_LABEL_PREFIX + theme, LEGACY_THEME_LABEL_PREFIX + theme];
}

/**
 * Where a thing sits inside a theme, or undefined when it has never been given
 * a place in one.
 *
 * The rank rides in the VALUE of the very label that says the thing is a
 * member. The server writes "true" there and only ever asks whether the key
 * exists — membership is the key, never the value — so a number in that slot is
 * a position and nothing else has to be invented to hold one. A member written
 * before any ordering existed still reads "true", which is not a position, and
 * sorts as unranked.
 */
export function themeRank(labels: Record<string, string> | undefined, theme: string): number | undefined {
  const raw = labels?.[themeLabelKey(theme)] ?? labels?.[LEGACY_THEME_LABEL_PREFIX + theme];
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined; // "true" — a member with no place yet
}

/** Gaps between ranks, so a later insertion has room without renumbering. */
const RANK_STRIDE = 10;
/**
 * Ranks are written zero-padded because a label value is text, and the CLI
 * lists labels as text: "0020" after "0010" reads in the order it means, where
 * "20" after "10" would not.
 */
const RANK_WIDTH = 5;

/** The label value for the i-th place in a theme (0-based). */
export function rankLabelValue(index: number): string {
  return String((index + 1) * RANK_STRIDE).padStart(RANK_WIDTH, '0');
}

/**
 * The label value each id should carry to spell out exactly this order.
 * Renumbers the whole theme: the caller writes only the ones that changed.
 */
export function assignThemeRanks(orderedIds: string[]): Map<string, string> {
  return new Map(orderedIds.map((id, i) => [id, rankLabelValue(i)]));
}

/** What the shared sorts ask of a thing. ThingRecord and ThingTile both fit. */
export interface SortableThing {
  id: string;
  value: string;
  lastUsed?: string;
  count?: number;
}

export type ThingSortKey = 'manual' | 'theme' | 'value' | 'recent' | 'used';

export interface ThingSortSpec {
  key: ThingSortKey;
  /** Which theme's order to follow. Required for key 'theme', ignored otherwise. */
  theme?: string;
  desc?: boolean;
}

export interface ThingSortContext {
  /** The user's dragged card order (thing ids), from gui_state.thingOrder. */
  manualOrder: string[];
  /** id → that thing's labels. Only 'theme' reads it. */
  labels?: Map<string, Record<string, string>>;
}

/**
 * Order `items` by `spec`.
 *
 * The manual order is the floor under every sort, not one sort among them: two
 * things a key cannot tell apart — same rank, no rank at all, the same name —
 * fall back to where the user dragged them, and only then to the order they
 * arrived in. So a sort never reshuffles things the user has already arranged
 * for reasons it does not know about.
 */
export function sortThings<T extends SortableThing>(
  items: T[],
  spec: ThingSortSpec,
  ctx: ThingSortContext,
): T[] {
  const manual = new Map(ctx.manualOrder.map((id, i) => [id, i]));
  // -1 for anything not in the saved order: a value recorded since the last
  // manual reorder belongs at the FRONT, not buried at the end. See the note on
  // applyManualOrder, which this is the general form of.
  const manualOf = (id: string) => manual.get(id) ?? -1;
  const labelsOf = (id: string) => ctx.labels?.get(id);
  const dir = spec.desc ? -1 : 1;

  const primary = (a: T, b: T): number => {
    switch (spec.key) {
      case 'theme': {
        const ra = themeRank(labelsOf(a.id), spec.theme ?? '');
        const rb = themeRank(labelsOf(b.id), spec.theme ?? '');
        if (ra === undefined && rb === undefined) return 0;
        // Unranked members sink below the ordered ones whichever way the order
        // runs: "not placed yet" is not the opposite of "first", so reversing
        // the theme must not float them to the top.
        if (ra === undefined) return 1;
        if (rb === undefined) return -1;
        return (ra - rb) * dir;
      }
      case 'value':
        return a.value.localeCompare(b.value) * dir;
      case 'recent':
        // Newest first by default — the useful end of a timestamp.
        return (b.lastUsed ?? '').localeCompare(a.lastUsed ?? '') * dir;
      case 'used':
        return ((b.count ?? 0) - (a.count ?? 0)) * dir;
      case 'manual':
      default:
        return 0;
    }
  };

  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => {
      const p = primary(a.item, b.item);
      if (p !== 0) return p;
      const ma = manualOf(a.item.id), mb = manualOf(b.item.id);
      if (ma !== mb) {
        if (ma === -1) return -1;
        if (mb === -1) return 1;
        return ma - mb;
      }
      return a.i - b.i;
    })
    .map((x) => x.item);
}

/**
 * Apply the user's saved manual card order (a list of thing ids) to the raw
 * records. Records present in `manualOrder` follow that order; records NOT in
 * it (values recorded since the last manual reorder) keep their natural
 * relative order and are placed FIRST, so freshly-named values still surface at
 * the top rather than being buried. With an empty `manualOrder` this is a no-op
 * (returns the natural order untouched).
 */
export function applyManualOrder(records: ThingRecord[], manualOrder: string[]): ThingRecord[] {
  if (!manualOrder.length) return records;
  return sortThings(records, { key: 'manual' }, { manualOrder });
}

/**
 * Compute the new full id order after moving `id` to sit between `previousId`
 * and `nextId` within `orderedIds` (the current default-ordered id list). Mirrors
 * the neighbour-based contract of useReorderableGroup's onCommit.
 */
export function reorderIds(
  orderedIds: string[],
  id: string,
  previousId: string | undefined,
  nextId: string | undefined,
): string[] {
  const ids = orderedIds.filter((x) => x !== id);
  let insertAt = ids.length;
  if (nextId) {
    const ni = ids.indexOf(nextId);
    if (ni !== -1) insertAt = ni;
  } else if (previousId) {
    const pi = ids.indexOf(previousId);
    if (pi !== -1) insertAt = pi + 1;
  } else {
    insertAt = 0;
  }
  return [...ids.slice(0, insertAt), id, ...ids.slice(insertAt)];
}

/** Move the item at `index` one place towards the front (-1) or the back (+1). */
export function stepIds(ids: string[], index: number, delta: -1 | 1): string[] {
  const to = index + delta;
  if (index < 0 || index >= ids.length || to < 0 || to >= ids.length) return ids;
  const out = [...ids];
  [out[index], out[to]] = [out[to], out[index]];
  return out;
}
