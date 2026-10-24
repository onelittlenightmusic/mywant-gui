import { useWantStore } from '@/stores/wantStore';
import type { Want } from '@/types/want';

/**
 * What a want's connections just did to the wants they reach — an attack
 * landing, a mend, a freeze — as moments, for whatever draws those wants to
 * show it landing (components/impact).
 *
 * The acting want says so on itself: its `impact` field ({kind, to, n}, the
 * engine's predefined.yaml), kept where its connections (stateSubscriptions)
 * are. A drawing is of the want acted ON, so the moments are turned round
 * here, once for the whole page: each new `n` on any want is one moment, told
 * to every drawing of each want named in its `to`. Read on the first sight of
 * a want, an `impact` is history and is not told.
 */

export type ImpactKind = 'attack' | 'mend' | 'freeze';

export interface ImpactMoment {
  kind: ImpactKind;
  /** The want that acted, by name. */
  from: string;
  /** One per moment, page-wide: what a drawing claims its sound by. */
  id: number;
}

interface ImpactField { kind?: unknown; to?: unknown; n?: unknown }

const KINDS = new Set<ImpactKind>(['attack', 'mend', 'freeze']);

/**
 * How soon the same kind may land on the same want again and be shown again.
 * The engine reports every tick an effect is applied — an enemy wearing a
 * want down, a heal mending it, four times a second — and a burst every
 * quarter second is a flicker, not a hit.
 */
const SHOW_GAP_MS: Record<ImpactKind, number> = { attack: 380, mend: 1100, freeze: 0 };

/**
 * How soon the same kind may be heard again, anywhere. A battle has many
 * hits at once; heard each time they are a rattle, so the board says each kind
 * no faster than this.
 */
const HEAR_GAP_MS: Record<ImpactKind, number> = { attack: 120, mend: 500, freeze: 80 };

type Listener = (m: ImpactMoment) => void;
const listeners = new Map<string, Set<Listener>>();
const lastN = new Map<string, number>();          // acting want id → last n told
const lastShown = new Map<string, number>();      // `${kind}\0${name}` → when
const lastHeard = new Map<ImpactKind, number>();  // kind → when
const claimed = new Map<number, { by: object; heard: boolean }>(); // moment id → who makes its sound
let nextId = 1;

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function impactOf(w: Want): { kind: ImpactKind; to: string[]; n: number } | null {
  const f = w.state?.current?.impact as ImpactField | null | undefined;
  if (!f || typeof f !== 'object' || !KINDS.has(f.kind as ImpactKind) || !Array.isArray(f.to)) return null;
  return { kind: f.kind as ImpactKind, to: f.to.filter((x): x is string => typeof x === 'string'), n: Number(f.n) || 0 };
}

function look(wants: Want[]): void {
  const t = now();
  for (const w of wants) {
    const id = w.metadata?.id || w.id;
    const imp = id ? impactOf(w) : null;
    if (!id || !imp) continue;
    const seen = lastN.get(id);
    lastN.set(id, imp.n);
    if (seen === undefined || seen === imp.n) continue;
    const from = w.metadata?.name ?? id;
    for (const name of imp.to) {
      const key = `${imp.kind}\u0000${name}`;
      if (t - (lastShown.get(key) ?? -Infinity) < SHOW_GAP_MS[imp.kind]) continue;
      lastShown.set(key, t);
      const subs = listeners.get(name);
      if (!subs || subs.size === 0) continue;
      const m: ImpactMoment = { kind: imp.kind, from, id: nextId++ };
      for (const l of subs) l(m);
    }
  }
}

let watching = false;
function watch(): void {
  if (watching) return;
  watching = true;
  // Seen now, so what was there before anything listened is history.
  look(useWantStore.getState().wants);
  useWantStore.subscribe((s, prev) => { if (s.wants !== prev.wants) look(s.wants); });
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
  const heard = t - (lastHeard.get(m.kind) ?? -Infinity) >= HEAR_GAP_MS[m.kind];
  if (heard) lastHeard.set(m.kind, t);
  if (claimed.size > 256) claimed.clear();
  claimed.set(m.id, { by: drawing, heard });
  return heard;
}
