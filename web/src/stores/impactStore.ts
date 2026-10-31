import { subscribeSSE } from '@/api/sseClient';

/**
 * What a want's connections just did to the wants they reach — an attack
 * landing, a mend, a freeze, a value handed on (feed) — as moments, for whatever draws those wants to
 * show it landing (components/impact).
 *
 * The acting want says so on itself — its `impact` field ({kind, to, n}, the
 * engine's predefined.yaml) — and the server tells every page as it is
 * written: a `moment` of kind impact, one per want it lands on, with what
 * drawing it needs (engine server/moments.go). Read off the want instead, every
 * effect sent the page back for the whole of the want that acted. Each one is
 * told here to every drawing of the want it landed on.
 */

export type ImpactKind = 'attack' | 'mend' | 'freeze' | 'feed';

export interface ImpactMoment {
  kind: ImpactKind;
  /** The want that acted, by name. */
  from: string;
  /** The want it landed on, by name. */
  on: string;
  /** One per moment, page-wide: what a drawing claims its sound by. */
  id: number;
  /** What was handed on (feed), shortened — said over the want as it lands. */
  value?: string;
}

/** An effect as the server says it: the wants by name. */
interface ImpactMomentWire { kind: string; type?: string; from?: string; on?: string; value?: string }

const KINDS = new Set<ImpactKind>(['attack', 'mend', 'freeze', 'feed']);

/**
 * How soon the same kind may land on the same want again and be shown again.
 * The engine reports every tick an effect is applied — an enemy wearing a
 * want down, a heal mending it, four times a second — and a burst every
 * quarter second is a flicker, not a hit.
 */
const SHOW_GAP_MS: Record<ImpactKind, number> = { attack: 380, mend: 1100, freeze: 0, feed: 300 };

/**
 * How soon the same kind landing on the same want may be heard again. Kept
 * per want, not per kind: a battle has enemies wearing the keep down four
 * times a second, and heard as one stream they drowned a turret's hit on an
 * enemy — another want, a hit worth hearing — whenever it fell just after.
 */
const HEAR_GAP_MS: Record<ImpactKind, number> = { attack: 650, mend: 900, freeze: 300, feed: 250 };

/** And how soon any two of the same kind, anywhere: closer is one flam. */
const FLAM_MS = 45;

type Listener = (m: ImpactMoment) => void;
const listeners = new Map<string, Set<Listener>>();
const lastShown = new Map<string, number>();      // `${kind}\0${name}` → when
const lastHeard = new Map<string, number>();       // `${kind}\0${name}`, or the kind alone → when
const claimed = new Map<number, { by: object; heard: boolean }>(); // moment id → who makes its sound
let nextId = 1;

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function tell(name: string, kind: ImpactKind, from: string, value: string | undefined, t: number): void {
  const key = `${kind}\u0000${name}`;
  if (t - (lastShown.get(key) ?? -Infinity) < SHOW_GAP_MS[kind]) return;
  lastShown.set(key, t);
  const subs = listeners.get(name);
  if (!subs || subs.size === 0) return;
  const m: ImpactMoment = { kind, from, on: name, id: nextId++, value };
  for (const l of subs) l(m);
}

/**
 * A moment this page saw happen itself, with no want to say so: a thing's
 * value put into a want's parameter by connecting the two. A thing is not a
 * want and keeps no fields, so nothing on the server could carry it.
 */
export function showImpact(wantName: string, kind: ImpactKind, from: string, value?: string): void {
  tell(wantName, kind, from, value, now());
}

let watching = false;
function watch(): void {
  if (watching) return;
  watching = true;
  subscribeSSE<{ moments?: ImpactMomentWire[] }>('moment', (data) => {
    const t = now();
    for (const m of data?.moments ?? []) {
      if (m.kind !== 'impact' || !m.on || !KINDS.has(m.type as ImpactKind)) continue;
      tell(m.on, m.type as ImpactKind, m.from ?? '', m.value, t);
    }
  });
}

/** Be told each moment something lands on the want of this name. */
export function subscribeImpacts(wantName: string, l: Listener): () => void {
  watch();
  let subs = listeners.get(wantName);
  if (!subs) listeners.set(wantName, (subs = new Set()));
  subs.add(l);
  return () => {
    subs!.delete(l);
    if (subs!.size === 0) listeners.delete(wantName);
  };
}

/**
 * Whether this drawing is the one to make the moment's sound: the first to
 * ask, and only while its kind has not just been heard. The want in the list
 * and on the board are two drawings of one moment — seen twice, heard once.
 * `drawing` is the asker, the same object each time it asks: asked again (an
 * effect run twice) it gets the same answer.
 */
export function claimImpactSound(m: ImpactMoment, drawing: object): boolean {
  const have = claimed.get(m.id);
  if (have) return have.by === drawing && have.heard;
  const t = now();
  const key = `${m.kind}\u0000${m.on}`;
  const heard = t - (lastHeard.get(key) ?? -Infinity) >= HEAR_GAP_MS[m.kind]
    && t - (lastHeard.get(m.kind) ?? -Infinity) >= FLAM_MS;
  if (heard) { lastHeard.set(key, t); lastHeard.set(m.kind, t); }
  if (claimed.size > 256) claimed.clear();
  claimed.set(m.id, { by: drawing, heard });
  return heard;
}
