import { useThingStore } from '@/stores/thingStore';
import { useThingTileStore } from '@/stores/thingTileStore';
import type { SeedThing } from '@/stores/wantSeedStore';

/**
 * The things behind a set of ids, as something a want form can be started from.
 *
 * Two places ask for this and they are the same question: a batch of ticked
 * tiles, and the pair Y just put together. It was written out in the first of
 * them, which is why the second could not have it without a copy — and a thing
 * is read from two stores here (the record, and the tile that may be standing
 * in for one that has not loaded), so a copy is two lookups and two fallbacks
 * to keep in step.
 *
 * Order is the caller's and is meaningful: the first value is the one that
 * claims a want type's declared `seed-param`. Anything without both a value and
 * a subtype is dropped — a want type is matched on the subtype, so a thing that
 * cannot say what it is cannot seed anything.
 */
export function seedThingsFromIds(ids: string[]): SeedThing[] {
  const records = useThingStore.getState().records;
  const tiles = useThingTileStore.getState().tiles;
  return ids.map(id => {
    const r = records.find(x => x.id === id);
    const t = tiles.find(x => x.id === id);
    return {
      catalogKey: r?.catalogKey ?? '',
      subtype: r?.typeName ?? t?.subtype ?? '',
      value: r?.value ?? t?.value ?? '',
      sourceMemoId: id,
      icon: r?.icon ?? t?.icon ?? '',
      color: r?.color ?? t?.color ?? '',
    };
  }).filter(x => x.value && x.subtype);
}
