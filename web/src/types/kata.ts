/**
 * Kata (型) — the practice ladder.
 *
 * A kata is a named combination of 所作 (waza). Repeat it and its 練度 deepens
 * 初伝 → 中伝 → 皆伝. Clear enough kata in a belt and the next belt opens.
 *
 * Nothing here gates a feature: every want type stays usable from day one. What
 * a kata grants is shorthand (手数), delegation (権限) and vocabulary (語彙).
 */

/** One condition parcel inside a kata. */
export interface Waza {
  kind: 'want_type' | 'thing' | 'repeat';
  /** want_type */
  type?: string;
  status?: string;
  count?: number;
  /** thing */
  subtype?: string;
  /** repeat */
  kata?: string;
  minCount?: number;
  /**
   * Parameter whose value must belong to the kata's joined constellation — what
   * makes this want be about the same thing as the others.
   */
  join?: string;
}

export interface WazaProgress {
  waza: Waza;
  satisfied: boolean;
  have: number;
  need: number;
  matchedIDs?: string[];
  /** One short phrase naming what would satisfy it. */
  hint?: string;
}

export interface KataUnlocks {
  shortcuts?: string[];   // 手数
  autonomy?: string[];    // 権限
  vocabulary?: string[];  // 語彙
}

/** Two ranks only: held once, and held often enough to be taken over. */
export type MasteryRank = '' | 'shoden' | 'kaiden';

export interface KataProgress {
  kataID: string;
  name: string;
  reading?: string;
  level: string;
  intent?: string;
  /** What the combination hands you — the answer none of its 所作 gives alone. */
  yields?: string;
  /** What this form leaves where it was 極まった, drawn rather than said.
   *  Withheld while veiled — finding out is the reward. */
  mark?: KataMark;
  /** The kata's labels — its definition's, with any set at runtime over them.
   *  Its colour rides here as `color` (read it with kataColors). */
  labels?: Record<string, string>;
  /** Lower kata whose 所作 this form subsumes. */
  contains?: string[];
  variation?: string;
  /** The constellation this standing was measured against — the shared thing. */
  group?: string;
  /** `group` under the name the rest of the system uses for it. */
  constellation?: string;
  /** EVERY constellation this form stands on right now. `constellation` above
   *  is only the one the card speaks for. */
  constellations?: string[];
  /** Moves that would complete this form somewhere it is one 所作 short. */
  suggestions?: KataSuggestion[];

  waza: WazaProgress[] | null;
  satisfied: number;
  total: number;
  complete: boolean;
  /**
   * Standing right now, on evidence still on the board. Not the same as
   * `complete`: a 口伝 built from `repeat` completes out of the record book with
   * nothing deployed, so it is complete and not live.
   */
  live: boolean;
  /** 極まった at least once before. Independent of `live`. */
  recorded: boolean;
  liveWantIDs?: string[];
  liveMemo?: string[];
  /** あと一所作 — the only moment a kata is allowed to speak up. */
  almostThere: boolean;

  mastery: number;
  masteryRank?: MasteryRank;
  thresholds: { shoden: number; kaiden: number };
  unlocks?: Record<string, KataUnlocks>;
  earned?: KataUnlocks[];

  /** The belt this kata belongs to has not opened yet. */
  locked: boolean;
  /** A 口伝 held back server-side: its 所作 are not sent until it is close. */
  masked: boolean;
  hidden: boolean;
  /**
   * Listed with the right number of blanks, contents withheld.
   *
   * The opposite secret to `hidden`, which withholds that the kata exists at
   * all. Here the arity is the invitation — "there is a form of two 所作
   * here" is what sends you looking for which two.
   */
  veiled: boolean;
}

/**
 * What a 極まった kata leaves where it was found, as something that can be
 * drawn. Not a product: holding a form makes nothing, it names something.
 */
export interface KataMark {
  /** The word you now have for this pair. */
  label?: string;
  /** A lucide icon name — what the constellation line's dot becomes once the
   *  form has been found. */
  icon?: string;
  /** How the constellation's own line is drawn once this form stands on it —
   *  a form-type id in the constellation-form registry, e.g. 'rail'. */
  form?: string;
}

/**
 * One move that would complete a form the player already knows.
 *
 * It makes nothing: it names two tiles already on the board and says that
 * putting them in one constellation would hold a form. Drawing the line is the
 * player's to do. Veiled forms send none of these — that would be the answer to
 * the question the veil is asking.
 */
export interface KataSuggestion {
  kataID: string;
  name: string;
  mark?: KataMark;
  /** The group this is about — for `lone`, the anchor's own value. */
  constellation: string;
  /** No group yet: accepting makes one out of the two ends. */
  lone?: boolean;
  /** 'thing' joins two tiles that exist; 'want_type' asks for one that does not. */
  kind: string;
  subtype?: string;
  /** The want type to place, for a `want_type` offer. */
  type?: string;
  /** What the new want should declare so the form holds once it exists — the
   *  wire itself, as spec. See the engine's wirePhase. */
  applyParams?: Record<string, unknown>;
  applyImports?: Record<string, string>;
  hint?: string;
  /** Thing already in the scope — where the offer starts. */
  anchor: string;
  /** Thing that would complete it. Absent for a want offer: the tile it asks
   *  for does not exist yet. */
  candidate?: string;
}

export interface LevelProgress {
  id: string;
  name: string;
  grade?: string;
  order: number;
  theme?: string;
  subtitle?: string;
  /** The belt's own colour — drawn as the belt bar. */
  color?: string;
  /** Ink for dots, markers and borders. A white belt's colour cannot be ink. */
  accent?: string;
  kata: string[];
  kataIDs: string[];
  promotion: { requiredKata: number };
  unlocked: boolean;
  achieved: number;
  required: number;
  promoted: boolean;
}

export interface KataListResponse {
  levels: LevelProgress[];
  kata: KataProgress[];
  count: number;
}

export interface KataRecord {
  kataID: string;
  at: string;
  sessionKey: string;
  wantIDs?: string[];
  variation?: string;
}

/**
 * A kata burning right now: the wants and things holding it together are
 * all on the board at this moment.
 *
 * Not the same as `complete` — a 口伝 built from `repeat` completes out of the
 * record book with nothing deployed, and a form of nothing but names is already
 * drawn by the thing constellation it is made of. Neither is returned here.
 */
export interface KataEdge {
  from: string;
  to: string;
}

export interface LiveKataConstellation {
  id: string;
  kataID: string;
  name: string;
  reading?: string;
  level: string;
  levelName?: string;
  /** The thing constellation the form stands in. */
  constellation?: string;
  /** The belt's colour — what is burning also says how hard it was. */
  color?: string;
  accent?: string;
  satisfied: number;
  total: number;
  locked: boolean;
  recorded: boolean;
  mastery: number;
  wantIDs: string[];
  /** Thing members as "catalogKey::value", matching the canvas's thing tile ids. */
  memoIDs: string[];
  edges: KataEdge[];
}

export interface LiveKataResponse {
  constellations: LiveKataConstellation[];
  count: number;
}

/** Display labels for the mastery ladder. */
export const MASTERY_LABELS: Record<MasteryRank, string> = {
  '': 'Not held',
  shoden: 'Learned',
  kaiden: 'Mastered',
};

/** How many filled dots a rank draws (out of MASTERY_DOT_COUNT). */
export const MASTERY_DOTS: Record<MasteryRank, number> = {
  '': 0,
  shoden: 1,
  kaiden: 2,
};

/** Dots drawn on a card's 練度 indicator. */
export const MASTERY_DOT_COUNT = 2;
