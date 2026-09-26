import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { apiClient } from '@/api/client';
import { ThingRecord, ThingEvent, ThingDefinition } from '@/types/thing';
import type { DataTypeInfo, DataTypesResponse } from '@/hooks/useDataTypes';
import { applyManualOrder, assignThemeRanks, reorderIds, themeLabelKey, themeLabelKeys } from '@/utils/thingOrder';

interface ThingStore {
  records: ThingRecord[];
  loading: boolean;
  error: string | null;

  /** User-saved manual card order (thing ids), persisted in gui_state.thingOrder.
   *  Applied only in the "default" sort; other sorts are temporary and never
   *  overwrite it. */
  manualOrder: string[];

  /** Provenance events for the currently-selected record, newest first. */
  eventsByRecord: Record<string, ThingEvent[]>;
  eventsLoading: boolean;

  /** The data type catalog, kept so the Add Thing form can list categories. */
  dataTypes: Record<string, DataTypeInfo>;

  /**
   * Every name in force, from every character, flattened out of the things.
   *
   * This is where a field card learns what its value is called. It used to walk
   * each character's auraDefaults, but a name belongs to the thing it names —
   * the character file no longer keeps definitions at all.
   */
  definitions: ThingDefinition[];

  fetchThings: () => Promise<void>;
  /** Loads once if nothing has loaded yet — for callers that only need the
   *  definitions (a want's sidebar) and never open the Thing page. */
  ensureThings: () => void;
  fetchEventsForRecord: (record: ThingRecord) => Promise<void>;
  /**
   * Remembers `value` under the category named by `typeName` (a data type name
   * such as "station"). Values normally arrive by being typed into a want's
   * field; this is the manual door in, for naming things ahead of time.
   * Returns the new record's id.
   */
  addRecord: (typeName: string, value: string) => Promise<string | null>;
  /** Removes a single value from its catalog in the thing. */
  deleteRecord: (record: ThingRecord) => Promise<void>;
  /**
   * Moves a value into a different category.
   *
   * A thing is stored as its catalog plus its text, and its id is the two
   * joined — so changing the category is not an edit of one field but a move:
   * out of the old catalog, into the new one, under a new id. Named for what it
   * does rather than "update", which would suggest the record survives.
   *
   * A no-op when the category is unchanged, and refuses when the destination
   * already holds that value rather than silently merging two records.
   */
  recategorizeRecord: (record: ThingRecord, typeName: string) => Promise<string | null>;
  /** Persist a manual drag/keyboard reorder: move `id` between the two
   *  neighbours and save the resulting full order to gui_state. */
  reorderRecord: (id: string, previousId?: string, nextId?: string) => Promise<void>;
  /**
   * Write down what order a theme's members go in.
   *
   * The rank rides in the value of each member's own membership label, so this
   * is one small write per member whose place actually moved — nothing is
   * renumbered on the server, and a member the caller left out keeps whatever
   * it had. See utils/thingOrder.
   */
  setThemeOrder: (theme: string, orderedIds: string[]) => Promise<void>;
  /**
   * Take things out of a theme.
   *
   * Drops the membership label from exactly the ones named, and touches nobody
   * else. Not PUT /constellations with the members that remain, which is the
   * obvious way and the wrong one: that endpoint reconciles by writing "true"
   * to every member it is given, so removing one thing from a theme reset the
   * order of all the others — the rank lives in that label's value.
   *
   * Removing the label removes the rank with it, so a thing put back into the
   * theme later arrives unranked, which is what it is.
   */
  removeFromTheme: (theme: string, ids: string[]) => Promise<void>;
  /**
   * Put things into a theme.
   *
   * Sets the membership label to "true" — a member with no place yet, which
   * sorts to the end of the theme's order until the user gives it one (see
   * utils/thingOrder). Ones already in the theme keep whatever rank they had.
   */
  addToTheme: (theme: string, ids: string[]) => Promise<void>;
  clearError: () => void;
}

/** id → that thing's labels, the shape sortThings asks for. */
export function labelsById(records: ThingRecord[]): Map<string, Record<string, string>> {
  return new Map(records.map((r) => [r.id, r.labels ?? {}]));
}

const DEFAULT_TYPE: DataTypeInfo = { memoKey: 'strings', icon: 'Type', color: '#64748b' };

/** Build catalogKey → type info from the datatypes catalog. thing.yaml is keyed
 *  by memoKey (e.g. "places"); the catalog is keyed by type name (e.g. "place").
 *  A real subtype (base_type set) wins over a primitive sharing the same key so
 *  "cities" resolves to city, not some primitive. */
function buildKeyToType(types: Record<string, DataTypeInfo>): Record<string, DataTypeInfo & { name: string }> {
  const out: Record<string, DataTypeInfo & { name: string }> = {};
  for (const [name, info] of Object.entries(types)) {
    const existing = out[info.memoKey];
    if (!existing || (!existing.baseType && info.baseType)) {
      out[info.memoKey] = { ...info, name };
    }
  }
  return out;
}

export const useThingStore = create<ThingStore>()(
  subscribeWithSelector((set, get) => ({
    records: [],
    loading: false,
    error: null,
    manualOrder: [],
    eventsByRecord: {},
    eventsLoading: false,
    dataTypes: {},
    definitions: [],

    ensureThings: () => {
      const { records, loading } = get();
      if (records.length || loading) return;
      void get().fetchThings();
    },

    fetchThings: async () => {
      set({ loading: true, error: null });
      try {
        // Two calls: the things themselves (assembled server-side), and the
        // data type catalog, which the Add Thing picker needs in full — it
        // offers types nothing has been filed under yet, so it cannot be
        // derived from the things that exist.
        const [things, datatypes, gui] = await Promise.all([
          apiClient.getThings(),
          fetch('/api/v1/datatypes').then((r) => r.json() as Promise<DataTypesResponse>).catch(() => null),
          apiClient.getGUIState().catch(() => null),
        ]);
        const savedOrder = gui?.state?.thingOrder;
        const manualOrder = Array.isArray(savedOrder) ? (savedOrder as string[]) : [];

        const records: ThingRecord[] = things.map((t) => ({
          id: t.id,
          catalogKey: t.catalog,
          value: t.value,
          typeName: t.subtype,
          icon: t.icon,
          color: t.color,
          background: t.background,
          count: t.stats?.count ?? 0,
          lastUsed: t.stats?.lastUsed ?? '',
          topWantTypes: t.stats?.topWantTypes ?? [],
          labels: t.labels,
        }));
        // Each name keeps a pointer home. Flattening threw away which thing a
        // definition came from, and that is exactly what a card needs to jump
        // to the thing's tile on the board.
        const definitions = things.flatMap((t) => (t.definitions ?? []).map((d) => ({ ...d, thingId: t.id })));
        set({ records, manualOrder, loading: false, dataTypes: datatypes?.types ?? {}, definitions });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to fetch thing',
          loading: false,
        });
      }
    },

    fetchEventsForRecord: async (record: ThingRecord) => {
      set({ eventsLoading: true });
      try {
        const events = await apiClient.getThingEvents({
          catalog: record.catalogKey,
          value: record.value,
          limit: 100,
        });
        set((state) => ({
          eventsByRecord: { ...state.eventsByRecord, [record.id]: events },
          eventsLoading: false,
        }));
      } catch {
        set((state) => ({
          eventsByRecord: { ...state.eventsByRecord, [record.id]: [] },
          eventsLoading: false,
        }));
      }
    },

    addRecord: async (typeName: string, value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const info = get().dataTypes[typeName] ?? DEFAULT_TYPE;
      const catalogKey = info.memoKey;
      const already = get().records.find(r => r.catalogKey === catalogKey && r.value === trimmed);
      if (already) return already.id;

      // The server mints the identity. It used to be computed here as
      // `${catalog}::${value}`, which made a thing's name and category into
      // what it IS — so changing either destroyed it and created another. Now
      // the id is the server's to give and means nothing at all.
      try {
        const created = await apiClient.createThing(catalogKey, trimmed);
        set({
          records: [
            {
              id: created.id,
              catalogKey,
              value: trimmed,
              typeName,
              icon: info.icon,
              color: info.color,
              count: 0,
              lastUsed: '',
              topWantTypes: [],
            },
            ...get().records,
          ],
        });
        return created.id;
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to remember value' });
        return null;
      }
    },

    deleteRecord: async (record: ThingRecord) => {
      // Optimistic removal.
      const prev = get().records;
      set({ records: prev.filter((r) => r.id !== record.id) });
      try {
        await apiClient.deleteThing(record.id);
      } catch (error) {
        // Roll back on failure.
        set({
          records: prev,
          error: error instanceof Error ? error.message : 'Failed to delete value',
        });
      }
    },

    recategorizeRecord: async (record: ThingRecord, typeName: string) => {
      if (typeName === record.typeName) return record.id;
      const info = get().dataTypes[typeName];
      if (!info) return null;
      const catalogKey = info.memoKey;
      if (get().records.some(r => r.catalogKey === catalogKey && r.value === record.value)) {
        set({ error: `「${record.value}」は ${typeName} に既にあります` });
        return null;
      }

      const prev = get().records;
      // The id does not change, so nothing that refers to this thing has to be
      // told anything. This used to read the thing's labels, write them under a
      // new id and delete the old ones — carrying references by hand, with the
      // list of what to carry living in this file's head. It is one field now.
      set({
        records: prev.map(r => r.id === record.id
          ? { ...r, catalogKey, typeName, icon: info.icon, color: info.color }
          : r),
      });
      try {
        await apiClient.patchThing(record.id, { catalog: catalogKey });
        return record.id;
      } catch (error) {
        set({
          records: prev,
          error: error instanceof Error ? error.message : 'Failed to change category',
        });
        return null;
      }
    },

    reorderRecord: async (id: string, previousId?: string, nextId?: string) => {
      const { records, manualOrder } = get();
      // Base the new order on the current *default*-ordered id list so the saved
      // order is a complete snapshot (any records not previously in manualOrder
      // get folded in at their displayed position).
      const orderedIds = applyManualOrder(records, manualOrder).map((r) => r.id);
      const newOrder = reorderIds(orderedIds, id, previousId, nextId);
      if (newOrder.join(' ') === orderedIds.join(' ')) return; // no-op
      const prev = manualOrder;
      set({ manualOrder: newOrder }); // optimistic
      try {
        await apiClient.updateGUIState({ thingOrder: newOrder });
      } catch (error) {
        set({
          manualOrder: prev,
          error: error instanceof Error ? error.message : 'Failed to save order',
        });
      }
    },

    setThemeOrder: async (theme: string, orderedIds: string[]) => {
      const key = themeLabelKey(theme);
      const ranks = assignThemeRanks(orderedIds);
      const prev = get().records;
      // Only what moved. Renumbering the whole theme on every nudge would be a
      // write per member for a swap of two, and every one of them broadcasts a
      // thing_changed to everybody watching the board.
      const changed = orderedIds.filter((id) => {
        const at = prev.find((r) => r.id === id);
        return !!at && at.labels?.[key] !== ranks.get(id);
      });
      if (!changed.length) return;
      set({
        records: prev.map((r) =>
          ranks.has(r.id) ? { ...r, labels: { ...(r.labels ?? {}), [key]: ranks.get(r.id) as string } } : r,
        ),
      });
      try {
        await Promise.all(changed.map((id) => apiClient.setThingLabel(id, key, ranks.get(id) as string)));
      } catch (error) {
        set({
          records: prev,
          error: error instanceof Error ? error.message : 'Failed to save theme order',
        });
      }
    },

    removeFromTheme: async (theme: string, ids: string[]) => {
      if (!ids.length) return;
      const keys = themeLabelKeys(theme);
      const wanted = new Set(ids);
      const prev = get().records;
      set({
        records: prev.map((r) => {
          if (!wanted.has(r.id) || !r.labels) return r;
          const labels = { ...r.labels };
          for (const k of keys) delete labels[k];
          return { ...r, labels };
        }),
      });
      try {
        // Both keys for each, unconditionally: removing one that was never
        // there is a no-op on the server, and asking first would be a read per
        // thing to save a write that costs nothing.
        await Promise.all(ids.flatMap((id) => keys.map((k) => apiClient.removeThingLabel(id, k))));
      } catch (error) {
        set({
          records: prev,
          error: error instanceof Error ? error.message : 'Failed to remove from theme',
        });
      }
    },

    addToTheme: async (theme: string, ids: string[]) => {
      if (!ids.length) return;
      const key = themeLabelKey(theme);
      const wanted = new Set(ids);
      const prev = get().records;
      set({
        records: prev.map((r) =>
          wanted.has(r.id) && r.labels?.[key] === undefined
            ? { ...r, labels: { ...(r.labels ?? {}), [key]: 'true' } }
            : r,
        ),
      });
      try {
        await Promise.all(ids.map((id) => apiClient.setThingLabel(id, key, 'true')));
      } catch (error) {
        set({
          records: prev,
          error: error instanceof Error ? error.message : 'Failed to add to theme',
        });
      }
    },

    clearError: () => set({ error: null }),
  }))
);
