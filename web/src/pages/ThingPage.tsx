import { useHostPanel } from '@/lib/nativeHost';
import { ItemMinimap, usePageMinimap, type MinimapItem } from '@/components/dashboard/ItemMinimap';
import { resolveLucideIcon } from '@/utils/subtypeIcons';
import { vividIconColor } from '@/components/dashboard/WantCardFace';
import { useColorMode } from '@/hooks/useColorMode';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Circle } from 'lucide-react';
import { useThingStore } from '@/stores/thingStore';
import { useWantSeedStore } from '@/stores/wantSeedStore';
import { useSeedFlightStore } from '@/stores/seedFlightStore';
import { entityCardId } from '@/stores/cardOverlayStore';
import { useConstellationStore } from '@/stores/constellationStore';
import { useAppHeader } from '@/hooks/useAppHeader';
import { useAppSidebar } from '@/hooks/useAppSidebar';
import { ThingGrid } from '@/components/dashboard/ThingGrid';
import { useThingTileStore } from '@/stores/thingTileStore';
import { ThingDetailsSidebar } from '@/components/sidebar/ThingDetailsSidebar';
import { AddThingSidebar } from '@/components/sidebar/AddThingSidebar';
import { useThingEditStore, requestThingEdit } from '@/stores/thingEditStore';
import { HeaderOverlay } from '@/components/layout/HeaderOverlay';
import { BatchActionBar } from '@/components/dashboard/BatchActionBar';
import { ThingRecord } from '@/types/thing';
import { Constellation } from '@/types/constellation';
import { useDashboardNav } from '@/hooks/useDashboardNav';
import { useGridCols } from '@/hooks/useGridCols';

export const ThingPage: React.FC = () => {
  const { records, loading, error, fetchThings, clearError, deleteRecord } = useThingStore();
  const navigate = useNavigate();
  const requestSeed = useWantSeedStore((s) => s.requestSeed);
  const fetchConstellations = useConstellationStore((s) => s.fetchConstellations);
  const createConstellation = useConstellationStore((s) => s.createConstellation);
  const updateConstellation = useConstellationStore((s) => s.updateConstellation);
  const deleteConstellation = useConstellationStore((s) => s.deleteConstellation);
  const constellations = useConstellationStore((s) => s.constellations);

  const startFlight = useSeedFlightStore((s) => s.startFlight);

  const handleAddWant = useCallback((r: ThingRecord) => {
    // Shared-element hop: remember where the thing card sits right now so the
    // SeedFlightOverlay ghost can fly it onto the Add Want form's seed chip.
    const cardEl = document.querySelector(`[data-keyboard-nav-id="${entityCardId('thing', r.id)}"]`);
    if (cardEl) {
      const rect = cardEl.getBoundingClientRect();
      startFlight({
        kind: 'thing',
        sourceRect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
        icon: r.icon,
        color: r.color,
        value: r.value,
        subtype: r.typeName,
      });
    }
    requestSeed({
      catalogKey: r.catalogKey,
      subtype: r.typeName,
      value: r.value,
      sourceMemoId: r.id,
      icon: r.icon,
      color: r.color,
    });
    navigate('/dashboard');
  }, [requestSeed, navigate, startFlight]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [minimapOpen, setMinimapOpen] = useState(false);
  const isDarkMode = useColorMode() === 'dark';
  /** Add Thing form open in the sidebar. */
  const [adding, setAdding] = useState(false);
  const [filtered, setFiltered] = useState<ThingRecord[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);
  const cols = useGridCols(gridRef);

  // Multi-select mode (mirrors the want dashboard's select mode). When
  // editingConstellationId is set, the same mode is editing an existing group: the
  // current members are pre-selected and Save writes them back.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingConstellationId, setEditingGroupId] = useState<string | null>(null);
  const editingConstellation: Constellation | null = editingConstellationId ? constellations.find((g) => g.id === editingConstellationId) ?? null : null;

  useEffect(() => {
    fetchThings();
    fetchConstellations('thing');
  }, [fetchThings, fetchConstellations]);

  useEffect(() => {
    if (error) {
      const t = setTimeout(clearError, 5000);
      return () => clearTimeout(t);
    }
  }, [error, clearError]);

  const selected = records.find((r) => r.id === selectedId) ?? null;
  const currentIndex = selectedId ? filtered.findIndex((r) => r.id === selectedId) : -1;
  const handleGetFiltered = useCallback((list: ThingRecord[]) => setFiltered(list), []);

  const toggleSelectMode = useCallback(() => {
    setSelectMode((on) => {
      if (on) setSelectedIds(new Set());
      return !on;
    });
    setEditingGroupId(null);
    setSelectedId(null);
  }, []);

  // Click a group chip → edit that group: enter select mode with its current
  // members pre-selected so the user can add/remove them.
  const handleEditConstellation = useCallback((group: { id: string; name: string }) => {
    const full = constellations.find((g) => g.id === group.id);
    setEditingGroupId(group.id);
    setSelectedIds(new Set(full?.members ?? []));
    setSelectMode(true);
    setSelectedId(null);
  }, [constellations]);

  const handleSaveConstellation = useCallback(async (name: string) => {
    // Edit mode: save name + membership back to the existing group.
    await updateConstellation(editingConstellationId as string, 'thing', { name, members: Array.from(selectedIds) });
    setSelectedIds(new Set());
    setSelectMode(false);
    setEditingGroupId(null);
  }, [editingConstellationId, selectedIds, updateConstellation]);

  const handleDeleteEditingConstellation = useCallback(async () => {
    if (!editingConstellationId) return;
    await deleteConstellation(editingConstellationId, 'thing');
    setSelectedIds(new Set());
    setSelectMode(false);
    setEditingGroupId(null);
  }, [editingConstellationId, deleteConstellation]);

  const handleToggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleCreateConstellation = useCallback(async (name: string) => {
    if (selectedIds.size === 0) return;
    await createConstellation(name, 'thing', Array.from(selectedIds));
    setSelectedIds(new Set());
    setSelectMode(false);
  }, [selectedIds, createConstellation]);

  useDashboardNav({
    itemCount: filtered.length,
    currentIndex,
    onNavigate: (index) => {
      if (filtered[index]) setSelectedId(filtered[index].id);
    },
    onClose: selected ? () => setSelectedId(null) : undefined,
    enabled: !selectMode && filtered.length > 0,
    cols,
  });

  useAppHeader({
    // Add Thing mirrors the dashboard's Add Want: the header button opens a form
    // in the sidebar rather than a modal.
    onCreateWant: () => { setSelectedId(null); setAdding(true); },
    title: 'Thing',
    createButtonLabel: 'Add Thing',
    createButtonIcon: Circle,
    isAddWantActive: adding,
    itemCount: records.length,
    itemLabel: 'value',
    showSelectMode: selectMode,
    onToggleSelectMode: toggleSelectMode,
    showMinimap: minimapOpen,
    onMinimapToggle: () => setMinimapOpen(v => !v),
  });

  // The map of the things, the want list's layout (ItemMinimap): a press
  // scrolls to the thing's card and lands on it.
  const minimap = usePageMinimap(minimapOpen, setMinimapOpen, { pick: (id) => {
    document.querySelector(`[data-reorder-id="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setSelectedId(id);
  } });
  const minimapItems = useMemo<MinimapItem[]>(() => (filtered.length ? filtered : records).map(r => {
    const Icon = resolveLucideIcon(r.icon) ?? Circle;
    return {
      id: r.id,
      title: r.value,
      background: `${r.color}${isDarkMode ? '40' : '33'}`,
      icon: <Icon width={21} height={21} style={{ color: vividIconColor(r.color, !isDarkMode), flexShrink: 0 }} strokeWidth={1.75} />,
    };
  }), [filtered, records, isDarkMode]);

  // A card asked for its editor — the same panel naming a thing uses, opened
  // on an existing one. See thingEditStore.
  const editingThing = useThingEditStore(s => s.record);
  const consumeThingEdit = useThingEditStore(s => s.consume);

  const panelRoute = useHostPanel(
    adding ? '__add' : editingThing ? `__edit:${editingThing.id}` : selected ? selected.id : null,
    (id) => {
      if (id === '__add') { setAdding(true); return; }
      const editId = id.startsWith('__edit:') ? id.slice(7) : null;
      const r = records.find(x => x.id === (editId ?? id));
      if (!r) return false;
      if (editId) requestThingEdit(r); else setSelectedId(r.id);
    },
    records.length,
  );

  useAppSidebar({
    // In an app on a phone, the app's own sheet (lib/nativeHost, useHostPanel).
    hostRoute: panelRoute,
    open: !selectMode && (adding || !!editingThing || !!selected),
    title: adding ? 'Add Thing' : editingThing ? `Edit ${editingThing.value}` : (selected ? selected.value : ''),
    // The thing detail opens on a card that already names its subject and
    // carries its own way out, exactly as it does on the board — so the frame
    // draws no header over it here either. The two surfaces show one panel; it
    // should not have two different places to press to leave.
    //
    // The forms are chromeless too. They have no card of their own, but the
    // shell's identity row says what they are (the title above), and going
    // through it is what puts their submit where Add Want's is — on the same
    // side as the header, by the same rule, from the same component. This page
    // and the board open the same two forms; a button that sits in a different
    // place on each is two forms.
    chromeless: true,
    onClose: () => { setAdding(false); consumeThingEdit(); setSelectedId(null); },
    content: adding ? (
      <AddThingSidebar
        onAdded={(id) => { setAdding(false); setSelectedId(id); }}
        onCancel={() => setAdding(false)}
      />
    ) : editingThing ? (
      <AddThingSidebar
        record={editingThing}
        onAdded={(id) => { consumeThingEdit(); setSelectedId(id); }}
        onCancel={() => consumeThingEdit()}
      />
    ) : selected ? (
      <ThingDetailsSidebar record={selected} onAddWant={handleAddWant} onDelete={deleteRecord} />
    ) : null,
    // Directional swap when walking between thing cards with the sidebar open.
    contentKey: adding ? 'add' : editingThing ? `edit:${editingThing.id}` : (selected?.id ?? ''),
    contentOrder: currentIndex >= 0 ? currentIndex : undefined,
  });

  const selectedCount = useMemo(() => selectedIds.size, [selectedIds]);
  // Pinning a whole selection at once. The selection is deliberately kept
  // afterwards: the cards mark themselves as pinned in place, so the batch shows
  // its own result and can be corrected without re-selecting anything.
  const setPinnedMany = useThingTileStore((s) => s.setPinnedMany);

  return (
    <>
      <HeaderOverlay isVisible={selectMode}>
        {selectMode && (
          <BatchActionBar
            selectedCount={selectedCount}
            onBatchConstellation={editingConstellation ? handleSaveConstellation : handleCreateConstellation}
            editingConstellationName={editingConstellation ? editingConstellation.name : undefined}
            onDeleteConstellation={editingConstellation ? handleDeleteEditingConstellation : undefined}
            onBatchDelete={editingConstellation ? undefined : () => {
              selectedIds.forEach((id) => {
                const r = records.find((x) => x.id === id);
                if (r) deleteRecord(r);
              });
              setSelectedIds(new Set());
              setSelectMode(false);
            }}
            onBatchPin={editingConstellation ? undefined : () => { void setPinnedMany([...selectedIds], true); }}
            onBatchUnpin={editingConstellation ? undefined : () => { void setPinnedMany([...selectedIds], false); }}
            onExit={toggleSelectMode}
          />
        )}
      </HeaderOverlay>

      <main className="host-scroll-edges flex-1 overflow-y-auto bg-transparent lg:mr-[480px]">
        <div className="p-3 sm:p-6 pb-24">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md flex items-center justify-between">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              <button onClick={clearError} className="text-red-400 hover:text-red-600 ml-4 text-sm">✕</button>
            </div>
          )}

          {records.length === 0 && !loading ? (
            <div className="text-center py-20 text-gray-400">
              <Circle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium mb-1">No things yet</p>
              <p className="text-sm">Values are remembered as you name places, cities, URLs and other typed fields.</p>
            </div>
          ) : (
            <ThingGrid
              records={records}
              loading={loading}
              selectedId={selectedId}
              selectMode={selectMode}
              selectedIds={selectedIds}
              onToggleSelected={handleToggleSelected}
              onView={(r) => setSelectedId(r.id)}
              onDelete={(r) => { if (selectedId === r.id) setSelectedId(null); deleteRecord(r); }}
              onAddWant={handleAddWant}
              onEditConstellation={handleEditConstellation}
              onGetFiltered={handleGetFiltered}
              gridRef={gridRef}
            />
          )}
        </div>
      </main>
      <ItemMinimap items={minimapItems} selectedId={selectedId} map={minimap} />
    </>
  );
};

export default ThingPage;
