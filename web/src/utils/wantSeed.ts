import type { WantTypeListItem, ParameterDef } from '@/types/wantType';
import type { DataTypeInfo } from '@/hooks/useDataTypes';

type GetTypeInfo = (typeName: string) => DataTypeInfo & { name: string };

/** The catalog a subtype names into — the grouping key for compatibility.
 *  Falls back to the subtype itself when no explicit catalog is declared. */
function catalogOf(subtype: string, getTypeInfo: GetTypeInfo): string {
  return getTypeInfo(subtype).catalog || subtype;
}

/** Everything a parameter takes: its own subtype first, then what `accepts`
 *  adds. Mirrors want-spec's ParameterDef.AcceptedSubTypes. */
export function acceptedSubTypes(p: { subType?: string; accepts?: string[] }): string[] {
  const out: string[] = [];
  for (const s of [p.subType, ...(p.accepts ?? [])]) {
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

/** The best score any of a parameter's accepted subtypes gets against `subtype`. */
export function paramMatchScore(
  p: { subType?: string; accepts?: string[] },
  subtype: string,
  getTypeInfo: GetTypeInfo,
): 0 | 1 | 2 {
  let best: 0 | 1 | 2 = 0;
  for (const cand of acceptedSubTypes(p)) {
    const s = subtypeMatchScore(cand, subtype, getTypeInfo);
    if (s > best) best = s;
    if (best === 2) break;
  }
  return best;
}

/** 0 = no match, 1 = compatible (same catalog), 2 = exact subtype match. */
export function subtypeMatchScore(
  candidate: string,
  subtype: string,
  getTypeInfo: GetTypeInfo,
): 0 | 1 | 2 {
  if (!candidate) return 0;
  if (candidate === subtype) return 2;
  if (catalogOf(candidate, getTypeInfo) === catalogOf(subtype, getTypeInfo)) return 1;
  return 0;
}

/** Best match score of any parameter subtype of this want type against the seed. */
function typeMatchScore(wt: WantTypeListItem, subtype: string, getTypeInfo: GetTypeInfo): 0 | 1 | 2 {
  let best: 0 | 1 | 2 = 0;
  for (const cand of wt.paramSubtypes ?? []) {
    const s = subtypeMatchScore(cand, subtype, getTypeInfo);
    if (s > best) best = s;
    if (best === 2) break;
  }
  return best;
}

/** Want types that accept `subtype` as a parameter, exact matches first. */
export function wantTypesForSeed(
  wantTypes: WantTypeListItem[],
  subtype: string,
  getTypeInfo: GetTypeInfo,
): { exact: WantTypeListItem[]; compatible: WantTypeListItem[]; all: WantTypeListItem[] } {
  const exact: WantTypeListItem[] = [];
  const compatible: WantTypeListItem[] = [];
  for (const wt of wantTypes) {
    const s = typeMatchScore(wt, subtype, getTypeInfo);
    if (s === 2) exact.push(wt);
    else if (s === 1) compatible.push(wt);
  }
  return { exact, compatible, all: [...exact, ...compatible] };
}

/** The parameter name a seed value should pre-fill on the chosen want type —
 *  the first exact-subtype param, else the first compatible one. */
/**
 * The parameter a seeded value should pre-fill on the chosen want type.
 *
 * A type with several parameters of one subtype has to say which one the seed
 * means: transit takes a station for both `from` and `to`, and a value picked
 * from the thing is where the user wants to GO. The type declares that with
 * `metadata.labels.seed-param`, and the named parameter wins as long as its
 * subtype still matches. Without the label the first exact match is used, then
 * the first compatible one.
 */
export function seedParamName(
  wt: { parameters?: ParameterDef[]; labels?: Record<string, string>; metadata?: { labels?: Record<string, string> } },
  subtype: string,
  getTypeInfo: GetTypeInfo,
): string | null {
  // The list item carries labels at the top level, the full definition under
  // metadata — read whichever this caller happens to hold.
  const declared = wt.metadata?.labels?.['seed-param'] ?? wt.labels?.['seed-param'];
  let firstExact: string | null = null;
  let compatibleName: string | null = null;
  for (const p of wt.parameters ?? []) {
    const s = paramMatchScore(p, subtype, getTypeInfo);
    if (s === 2) {
      if (declared && p.name === declared) return p.name;
      if (firstExact === null) firstExact = p.name;
    } else if (s === 1 && compatibleName === null) {
      compatibleName = p.name;
    }
  }
  return firstExact ?? compatibleName;
}

/* ── Several things at once ──────────────────────────────────────────────────
 *
 * A selection ticked on the board can hold more than one thing, and "with 国分寺
 * and 中野坂上, I want…" only makes sense for want types that have room for both
 * — a parameter each. That is a different question from the one above: a type
 * whose only station parameter is `to` accepts a station, and still cannot take
 * two of them.
 *
 * So the matching below is an assignment, not a test: every seeded value has to
 * find a parameter of its own. The order it tries them in is hardest-first —
 * the value with the fewest parameters that would take it goes first, because
 * spending a shared parameter on an easy value is how a greedy pass strands the
 * one that had nowhere else to go.
 */

/** A parameter, as far as matching cares: a name and everything it takes.
 *  `list` marks one that takes any number of them. */
interface Slot { key: string; accepts: string[]; list?: boolean }

/** The best score this slot gives `subtype`, 0 when it does not take it. */
function slotScore(slot: Slot, subtype: string, getTypeInfo: GetTypeInfo): 0 | 1 | 2 {
  return paramMatchScore({ accepts: slot.accepts }, subtype, getTypeInfo);
}

/**
 * Give every seed a slot of its own.
 *
 * Reports the chosen slot key per seed index, whether every seed found one, and
 * the weakest score any of them settled for — `2` only when nothing had to fall
 * back to a merely compatible subtype, which is what orders the picker.
 */
function assignSlots(
  slots: Slot[],
  subtypes: string[],
  getTypeInfo: GetTypeInfo,
  preassigned?: Record<number, string>,
): { byIndex: Record<number, string>; worst: 1 | 2; complete: boolean } {
  const taken = new Set<string>();
  const byIndex: Record<number, string> = {};
  let worst: 1 | 2 = 2;

  for (const [idx, key] of Object.entries(preassigned ?? {})) {
    const slot = slots.find(s => s.key === key);
    if (!slot) continue;
    const score = slotScore(slot, subtypes[Number(idx)], getTypeInfo);
    if (score === 0) continue;
    taken.add(key);
    byIndex[Number(idx)] = key;
    if (score < worst) worst = score;
  }

  const candidatesOf = (i: number) =>
    slots.map(s => ({ slot: s, score: slotScore(s, subtypes[i], getTypeInfo) })).filter(c => c.score > 0);

  const order = subtypes
    .map((_, i) => i)
    .filter(i => byIndex[i] === undefined)
    .sort((a, b) => candidatesOf(a).length - candidatesOf(b).length);

  let complete = true;
  for (const i of order) {
    // A list slot is never used up: it takes any number, which is the whole
    // point of it. Everything else is one value and then gone.
    const free = candidatesOf(i).filter(c => c.slot.list || !taken.has(c.slot.key));
    // Nowhere left for this one. Keep going rather than giving up on the whole
    // assignment: filtering wants a yes/no and reads `complete`, while filling
    // a form the user chose anyway should still place what it can.
    if (free.length === 0) { complete = false; continue; }
    // Singles first: a list would swallow a value a named parameter was the
    // better home for, and then have nothing to say about the one that needed
    // it.
    const single = free.filter(c => !c.slot.list);
    const pick = single.find(c => c.score === 2) ?? single[0]
      ?? free.find(c => c.score === 2) ?? free[0];
    taken.add(pick.slot.key);
    byIndex[i] = pick.slot.key;
    if (pick.score < worst) worst = pick.score as 1 | 2;
  }
  return { byIndex, worst, complete };
}

/** The parameters of a listed want type, kept apart. Falls back to the
 *  deduplicated subtype set for a server that does not send paramSlots yet —
 *  which then has one slot per distinct subtype, and so takes one thing each. */
function slotsOfListItem(wt: WantTypeListItem): Slot[] {
  const slots = wt.paramSlots ?? (wt.paramSubtypes ?? []).map(s => [s]);
  return slots.map((accepts, i) => ({ key: String(i), accepts, list: wt.paramSlotIsList?.[i] }));
}

/** Want types with a parameter to spare for every one of `subtypes`. */
export function wantTypesForSeeds(
  wantTypes: WantTypeListItem[],
  subtypes: string[],
  getTypeInfo: GetTypeInfo,
): { exact: WantTypeListItem[]; compatible: WantTypeListItem[]; all: WantTypeListItem[] } {
  if (subtypes.length === 1) return wantTypesForSeed(wantTypes, subtypes[0], getTypeInfo);
  const exact: WantTypeListItem[] = [];
  const compatible: WantTypeListItem[] = [];
  for (const wt of wantTypes) {
    const fit = assignSlots(slotsOfListItem(wt), subtypes, getTypeInfo);
    if (!fit.complete) continue;
    (fit.worst === 2 ? exact : compatible).push(wt);
  }
  return { exact, compatible, all: [...exact, ...compatible] };
}

/**
 * What the seeded things fill in, one parameter each.
 *
 * The single-seed rule is unchanged and still first: `metadata.labels.seed-param`
 * names where a picked value goes when the type has several parameters of its
 * subtype, and the value the user started from is the one that claims it.
 */
export function seedParamValues(
  wt: { parameters?: ParameterDef[]; labels?: Record<string, string>; metadata?: { labels?: Record<string, string> } },
  seeds: Array<{ subtype: string; value: string }>,
  getTypeInfo: GetTypeInfo,
): Record<string, string | string[]> {
  if (seeds.length === 0) return {};
  const slots: Slot[] = (wt.parameters ?? [])
    .map(p => ({ key: p.name, accepts: acceptedSubTypes(p), list: p.type === 'array' }))
    .filter(s => s.accepts.length > 0);

  /**
   * A journey with stops: the parameters are in the order they are travelled.
   *
   * When one of them takes a list, the values keep the order they were picked
   * in and the parameters keep the order they were declared in — so the ones
   * before the list fill from the front, the ones after it fill from the back,
   * and the list takes what is left in between. A route declaring
   * `from, via, to` and given three places therefore goes to them in the order
   * you chose them, which is the only order anybody meant.
   *
   * Nothing clever about which place is "really" the destination: the list is
   * in the middle because the author put it there.
   */
  const listAt = slots.findIndex(s => s.list);
  if (listAt >= 0 && seeds.length > 1) {
    const before = slots.slice(0, listAt);
    const after = slots.slice(listAt + 1);
    const out: Record<string, string | string[]> = {};
    let head = 0;
    let tail = seeds.length - 1;
    for (const slot of before) {
      if (head > tail) break;
      if (slotScore(slot, seeds[head].subtype, getTypeInfo) === 0) continue;
      out[slot.key] = seeds[head].value;
      head++;
    }
    for (const slot of [...after].reverse()) {
      if (tail < head) break;
      if (slotScore(slot, seeds[tail].subtype, getTypeInfo) === 0) continue;
      out[slot.key] = seeds[tail].value;
      tail--;
    }
    const middle = seeds.slice(head, tail + 1)
      .filter(sd => slotScore(slots[listAt], sd.subtype, getTypeInfo) > 0)
      .map(sd => sd.value);
    if (middle.length > 0) out[slots[listAt].key] = middle;
    return out;
  }

  // `seed-param` answers "one value — which parameter is it?" (a place dropped
  // on a transit search is where you want to GO). Several values picked in
  // order already say which is which: they fill the parameters in the order
  // declared, so 1 then 2 is from 1 to 2 — not the first claiming `to` and
  // pushing the second back into `from`.
  const declared = seeds.length === 1 ? (wt.metadata?.labels?.['seed-param'] ?? wt.labels?.['seed-param']) : undefined;
  const preassigned: Record<number, string> = {};
  if (declared && slots.some(s => s.key === declared && slotScore(s, seeds[0].subtype, getTypeInfo) === 2)) {
    preassigned[0] = declared;
  }

  // Partial fits are kept: a type the user picked anyway should still be filled
  // with the values that do fit, rather than left blank because one did not.
  const { byIndex } = assignSlots(slots, seeds.map(s => s.subtype), getTypeInfo, preassigned);
  const out: Record<string, string | string[]> = {};
  for (const [idx, key] of Object.entries(byIndex)) out[key] = seeds[Number(idx)].value;
  return out;
}
