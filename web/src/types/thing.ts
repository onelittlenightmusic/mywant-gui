/**
 * Thing — the first-class view over ~/.mywant/thing.yaml. Each named value the
 * system has learned (a city, a place, a URL, …) becomes one ThingRecord card;
 * ThingEvent is the provenance timeline behind it (when/which want named it).
 */

/** One named value in the thing — a single card. */
export interface ThingRecord {
  /** The thing's own id — a UUID, stable across its category and name changing. */
  id: string;
  /** thing.yaml section key, e.g. "places", "cities". */
  catalogKey: string;
  /** The value itself, e.g. "会社". */
  value: string;
  /** Resolved data-type name for icon/color, e.g. "place" (falls back to catalogKey). */
  typeName: string;
  /** Lucide icon component name. */
  icon: string;
  /** Hex color for the card header/background. */
  color: string;
  /**
   * A picture for this kind's cards, named by its subtype and served from
   * /resources (so "station" is /resources/station.png). Absent for every kind
   * that has none, which is all but one — see the server's DataTypeInfo.
   */
  background?: string;
  /** Usage count from the provenance log (0 if never used since logging began). */
  count: number;
  /** RFC3339 timestamp of the most recent use, or '' if none. */
  lastUsed: string;
  /**
   * Its place among all things in the order they were added (0 the first).
   * Every thing has one, including those added before the server kept when —
   * the list's 最近 order falls back to it (see thingUpdatedAt).
   */
  addedOrder?: number;
  /** When it was added, RFC 3339 — absent for things added before it was kept. */
  createdAt?: string;
  /** The want types this value is most used with, count desc (up to 3). */
  topWantTypes: WantTypeCount[];
  /**
   * The thing's own labels, as the server keeps them.
   *
   * Carried rather than dropped because two of them are read by the GUI: the
   * canvas coordinates, and the theme membership whose value doubles as the
   * thing's place in that theme (see utils/thingOrder).
   */
  labels?: Record<string, string>;
}

/** A want type and how often a value was used with it. */
export interface WantTypeCount {
  type: string;
  count: number;
}

/** A name given to a value, and who gave it. Read out of the thing ledger. */
export interface ThingDefinition {
  /**
   * The thing this name belongs to.
   *
   * Not sent by the server — the definitions arrive nested inside their thing,
   * and the store stamps each one with its parent's id on the way out (see
   * thingStore.fetchThings). It is what lets a card that recognised its value
   * as a thing point at the very tile that thing stands on.
   */
  thingId?: string;
  catalog: string;
  subtype: string;
  /** The name given, e.g. "run". */
  name: string;
  /** What the name was given to — the URL behind "run", the coordinate behind "会社". */
  value?: unknown;
  at: string;
  characterId?: string;
  characterName?: string;
  wantId?: string;
  wantType?: string;
}

/**
 * One remembered value as the server assembles it: GET /api/v1/things returns
 * these, and nothing else has to be fetched to draw one.
 */
export interface ThingFull {
  /** "<catalog>::<value>" — the id used wherever a thing is referred to. */
  id: string;
  catalog: string;
  subtype: string;
  value: string;
  icon: string;
  color: string;
  /** The subtype's picture name, if it declares one. See ThingRecord. */
  background?: string;
  /** Every character's name for this value, not just the current user's. */
  definitions?: ThingDefinition[];
  stats?: MemoStat;
  /** Its place in the order things were added (see ThingRecord.addedOrder). */
  addedOrder?: number;
  /** When it was added, RFC 3339 — absent for things added before it was kept. */
  createdAt?: string;
  /** The live wants naming this value right now. */
  wantIDs?: string[];
  /**
   * The subset of those that name it through a parameter taking a LIST.
   *
   * A want that names a thing in a slot of its own is about that thing; one
   * that names it among several has it as one of a set — a stop on a route
   * rather than either end of it. The board draws the second as a dashed line.
   */
  listWantIDs?: string[];
  labels?: Record<string, string>;
}

/**
 * The live thing↔want relation: one remembered value and the wants currently
 * naming it. Derived server-side on every read from the wants' parameters, so
 * it never drifts from what is actually deployed.
 */
export interface ThingUsage {
  /** Thing record id — matches ThingRecord.id. */
  id: string;
  catalog: string;
  subtype: string;
  value: string;
  wantIDs: string[];
  /** Those of them that name it as one of several — see ThingRecord. */
  listWantIDs?: string[];
}

/** Per-value usage stats keyed by catalog then value. */
export interface MemoStat {
  count: number;
  lastUsed: string;
  topWantTypes?: WantTypeCount[];
}
export type ThingStats = Record<string, Record<string, MemoStat>>;

/** How a value came to be in the thing. Mirrors the backend ThingSource* consts. */
export type MemoEventSource = 'want-param' | 'aura-definition' | 'card-name' | string;

/** One provenance event: a value entering (or re-entering) the thing. */
export interface ThingEvent {
  at: string;            // RFC3339 timestamp
  catalog: string;       // thing.yaml section key, e.g. "places"
  subtype: string;       // data subtype/kind, e.g. "place"
  value: string;
  source: MemoEventSource;
  wantId?: string;
  wantType?: string;
  characterId?: string;
  characterName?: string;
}

/** Human label for an event source. */
export const MEMO_SOURCE_LABELS: Record<string, string> = {
  'want-param': 'Want parameter',
  'aura-definition': 'Named (catalog)',
  'card-name': 'Named from card',
};
