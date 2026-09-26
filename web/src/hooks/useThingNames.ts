import { useEffect } from 'react';
import { useThingStore } from '@/stores/thingStore';
import { useDataTypes, selfDescribedSubtype } from '@/hooks/useDataTypes';
import { definitionsForValue } from '@/utils/thingMatch';
import type { ThingDefinition } from '@/types/thing';
import type { Mark } from '@/components/common/MarkButton';

/**
 * What this value is — a thing, or just a value.
 *
 * Two surfaces ask that: the naming flow (useAuraNaming), which needs it to
 * decide between "name this" and "rename this", and the mark a card wears
 * (MarkButton). They used to be one piece of code inside the naming hook, which
 * meant a card could only show the mark by taking the whole flow with it — and
 * the parameter cards run that flow once, for the focused card, so every other
 * card had no way to say what its value was. Splitting the question out is what
 * lets any card ask it.
 *
 * A value is a thing two ways round, and both count:
 *
 *  - somebody NAMED it — the ledger holds the name and the value it was given
 *    to, which is how a coordinate is "自宅" (`namedDefs`);
 *  - it simply IS one — the same text, in the catalog this value belongs to.
 *    Most things carry no name at all: they are remembered values, and a
 *    station parameter reading 新宿駅 is pointing at the 新宿駅 that is already
 *    on the board whether or not anyone ever named it.
 *
 * `subType` is what the caller declares the value to be; the value's own
 * self-described type still wins over it, exactly as it does everywhere else.
 */
export function useThingNames(value: unknown, subType?: string | null) {
  const { getTypeInfo } = useDataTypes();
  // The ledger. Loaded once for surfaces that never open the Thing page.
  const thingDefinitions = useThingStore(s => s.definitions);
  const records = useThingStore(s => s.records);
  const ensureThings = useThingStore(s => s.ensureThings);
  useEffect(() => { ensureThings(); }, [ensureThings]);

  // The catalog a value names into is its own type, resolved through the data
  // type's `catalog` relationship: a station-typed value names into the station
  // catalog, a location_coordinate into "place". "value" is the catch-all.
  const rawKind = selfDescribedSubtype(value) || subType || 'value';
  const catalogKind = getTypeInfo(rawKind)?.catalog || rawKind;
  const typeInfo = getTypeInfo(catalogKind);
  const namedDefs: ThingDefinition[] = definitionsForValue(thingDefinitions, value, catalogKind);

  // The same text in the same catalog. Only when the catalog is known: "value"
  // is the catch-all every untyped field falls into, and matching text across
  // all of it would mark any word that anybody ever remembered anywhere.
  const asText = value === null || value === undefined || typeof value === 'object'
    ? null
    : String(value);
  const matchedRecords = asText && catalogKind !== 'value'
    ? records.filter(r => r.typeName === catalogKind && r.value === asText)
    : [];

  // Handed back in the shape every card wears a mark in (see MarkButton), so
  // no caller has to translate between "what this value is" and "how it is
  // drawn".
  const marks: Mark[] = [];
  const seen = new Set<string>();
  const add = (thingId: string | undefined, name: string, color?: string, icon?: string) => {
    if (!name) return;
    // One mark per thing. A name and the record it was given to are the same
    // thing twice, and two characters agreeing on a name are one thing too.
    const key = thingId ?? `name:${name}`;
    if (seen.has(key)) return;
    seen.add(key);
    marks.push({ kind: 'thing', id: thingId, name, color: color ?? typeInfo.color, icon: icon ?? typeInfo.icon });
  };
  // Names first: a thing that was named is called by its name, not by whatever
  // text happens to be stored under it.
  for (const d of namedDefs) {
    const r = d.thingId ? records.find(x => x.id === d.thingId) : undefined;
    add(d.thingId, d.name, r?.color, r?.icon);
  }
  for (const r of matchedRecords) add(r.id, r.value, r.color, r.icon);

  return { catalogKind, typeInfo, namedDefs, marks };
}
