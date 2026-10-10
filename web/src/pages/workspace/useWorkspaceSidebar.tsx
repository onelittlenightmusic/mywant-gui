import { hostPanelRoute } from '@/lib/nativeHost';
import { thingDisplayName } from '@/utils/thingFace';
import { ConstellationFilterPanel } from '@/components/sidebar/ConstellationFilterPanel';
import React from 'react';
import { Globe, Waypoints, RefreshCw } from 'lucide-react';
import { Want, WantExecutionStatus } from '@/types/want';
import type { ThingRecord } from '@/types/thing';
import type { WantTypeListItem } from '@/types/wantType';
import type { Recommendation } from '@/types/interact';
import { useAppSidebar } from '@/hooks/useAppSidebar';
import { useWantStore } from '@/stores/wantStore';
import { wantTypeIconStyle } from '@/components/dashboard/WantCardFace';
import { getCardBackgroundStyle, resolveIconForFamily } from '@/components/dashboard/WantTypeVisuals';
import { StatusChangeIcon } from '@/components/dashboard/WantCard/parts/StatusChangeIcon';
import { classNames } from '@/utils/helpers';
import { GlobalStateSidebar } from '@/components/sidebar/GlobalStateSidebar';
import { AddThingSidebar } from '@/components/sidebar/AddThingSidebar';
import { ThingDetailsSidebar } from '@/components/sidebar/ThingDetailsSidebar';
import { WantDetailsSidebar } from '@/components/sidebar/WantDetailsSidebar';

export type SidebarTab = 'settings' | 'results' | 'wiring' | 'expose' | 'import' | 'history' | 'versions' | 'chat';

/**
 * What the right-hand panel shows, and what closing it means.
 *
 * One frame, five possible occupants, and an order of precedence between them:
 * Global, the Add Thing form, the Edit Thing form, the thing underfoot, the
 * selected want. The frame itself is the app's — every page rides the same
 * shell (Layout to AppSidebarHost), which is what keeps the panel alive across
 * a navigation — so all of this is configuration, not markup of its own.
 *
 * Closing is the part worth reading. It unwinds in the same order, and the two
 * detail panels close differently on purpose: a want's selection is cleared,
 * while a thing's is only DISMISSED, because the character is still standing on
 * it and clearing the focus would leave the tile silent until you stepped off
 * and back on.
 */
export interface WorkspaceSidebarApi {
  // — who is in the frame —
  sidebar: {
    showGlobal: boolean;
    clearSelection: () => void;
    closeMemo: () => void;
    registerHeaderActions?: (fn: unknown) => void;
    toggleHeaderAction?: ((action: 'refresh' | 'autoRefresh') => void) | null;
  };
  selectedWant: Want | null;
  cursorThingRecord: ThingRecord | null;
  /** The group the character is standing at, and the panel the board draws
   *  for it (its forms, its card) — shown
   *  ahead of the thing and the want (see useDetailTarget's cursorGroupShown). */
  cursorGroup: { name: string; panel: React.ReactNode } | null;
  addingThing: boolean;
  /** The constellation filter is open (the want list's Filter button). */
  filterOpen?: boolean;
  onCloseFilter?: () => void;
  setAddingThing: (v: boolean) => void;
  editingThing: ThingRecord | null;
  consumeThingEdit: () => void;

  // — the frame's own state —
  detailPanelOpen: boolean;
  isMobileCanvas: boolean;
  isDarkMode: boolean;
  /** The open balloon's ancestry; a backdrop click must not close over it. */
  expandedChain: Want[];
  setExpandedChain: (chain: Want[]) => void;
  /** The card's own header, mirrored into the frame while a want is open —
   *  see headerActions below, computed from this. */
  headerState: { autoRefresh: boolean; loading: boolean; status: WantExecutionStatus } | null;
  sidebarWantTypes: WantTypeListItem[];

  // — the request that opened it, and dismissing it —
  setDetailsRequestedFor: (id: string | null) => void;
  setDetailsDismissed: (v: boolean) => void;

  // — the want panel —
  sidebarInitialTab: SidebarTab;
  setSidebarInitialTab: (t: SidebarTab) => void;
  sidebarTabVersion: number;
  seriesWants: Want[];
  setHeaderState: (s: { autoRefresh: boolean; loading: boolean; status: WantExecutionStatus } | null) => void;
  onRecommendationSelect: (rec: Recommendation) => void;
  onDeleteWant: (w: Want) => void;
  onSaveRecipe: (w: Want) => void;
  startWant: (id: string) => void;
  stopWant: (id: string) => void;
  suspendWant: (id: string) => void;
  resumeWant: (id: string) => void;

  // — the summary, shared by the Global and want panels —
  wants: Want[];
  loading: boolean;
  filteredWants: Want[];
  allLabels: Map<string, Set<string>>;
  selectedLabel: { key: string; value: string } | null;
  setSelectedLabel: (l: { key: string; value: string } | null) => void;
  labelOwners: Want[];
  setLabelOwners: (w: Want[]) => void;
  labelUsers: Want[];
  setLabelUsers: (w: Want[]) => void;
  onLabelClick: (key: string, value: string) => void;
  onViewWant: (want: Want, opts?: unknown) => void;
  fetchLabels: () => Promise<void>;
  fetchWants: () => Promise<void>;
  radarMode: boolean;
  setRadarMode: React.Dispatch<React.SetStateAction<boolean>>;
  focusGlobalParamKey: string | null;

  // — placing a thing where the character stands —
  cursorManPosRef: React.MutableRefObject<{ x: number; y: number } | null>;
  /** The board's answer to a theme being lined up — see ThemeOrderSection. */
  onArranged?: React.ComponentProps<typeof ThingDetailsSidebar>['onArranged'];
  canvasCenterX: number | undefined;
  canvasCenterY: number | undefined;

  onAddWantFromThing: (r: ThingRecord) => void;
  deleteThingRecord: (r: ThingRecord) => Promise<void> | void;
}

export function useWorkspaceSidebar(api: WorkspaceSidebarApi) {
  const {
    sidebar, selectedWant, cursorThingRecord, cursorGroup, addingThing, setAddingThing,
    editingThing, consumeThingEdit, detailPanelOpen, isMobileCanvas, isDarkMode,
    expandedChain, setExpandedChain, headerState,
    sidebarWantTypes, setDetailsRequestedFor, setDetailsDismissed,
    sidebarInitialTab, setSidebarInitialTab, sidebarTabVersion, seriesWants,
    setHeaderState, onRecommendationSelect, onDeleteWant, onSaveRecipe,
    startWant, stopWant, suspendWant, resumeWant,
    wants, loading, filteredWants, allLabels, selectedLabel, setSelectedLabel,
    labelOwners, setLabelOwners, labelUsers, setLabelUsers, onLabelClick,
    onViewWant, fetchLabels, fetchWants, radarMode, setRadarMode, focusGlobalParamKey,
    cursorManPosRef, onArranged, canvasCenterX, canvasCenterY,
    onAddWantFromThing, deleteThingRecord,
  } = api;

  // The selected want's own card colours and icon, echoed onto the frame that
  // holds it — so the panel reads as an extension of the card, not a
  // different surface the card happened to open.
  const sidebarBgStyle = React.useMemo(() => {
    if (!selectedWant) return undefined;
    const typeName = selectedWant.metadata?.type ?? '';
    const category = sidebarWantTypes.find(t => t.name === typeName)?.category ?? '';
    return getCardBackgroundStyle(typeName, category, isDarkMode ? 'dark' : 'light', 'canvas');
  }, [selectedWant, sidebarWantTypes, isDarkMode]);

  const sidebarTitleIcon = React.useMemo(() => {
    if (!selectedWant) return undefined;
    const typeName = selectedWant.metadata?.type ?? '';
    const category = sidebarWantTypes.find(t => t.name === typeName)?.category ?? '';
    return resolveIconForFamily(category, typeName, 'lucide');
  }, [selectedWant, sidebarWantTypes]);

  // The reload / auto-refresh control WantDetailsSidebar reports up through
  // onHeaderStateChange, drawn into the frame's own header row.
  const headerActions = headerState ? (
    <div className="flex items-stretch h-full">
      <div className="flex items-center px-4 border-r border-gray-100 dark:border-gray-800">
        <StatusChangeIcon status={headerState.status} size="sm" showLabel={true} />
      </div>
      <div className="flex items-stretch relative">
        <button
          onClick={() => sidebar.toggleHeaderAction?.('refresh')}
          className={classNames(
            "flex flex-col items-center justify-center gap-0.5 px-5 h-full transition-all duration-150 flex-shrink-0 focus:outline-none",
            headerState.autoRefresh
              ? "text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800"
          )}
          title={`Reload now${headerState.autoRefresh ? ' (Auto-refresh is ON)' : ''}`}
        >
          <div className="relative">
            <RefreshCw className={classNames("h-5 w-5", (headerState.loading || headerState.autoRefresh) && "animate-spin")} />
            {headerState.autoRefresh && (
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white dark:border-gray-900 animate-pulse" />
            )}
          </div>
          <span className="text-[9px] font-bold uppercase tracking-tighter hidden sm:block">
            {headerState.autoRefresh ? 'Live' : 'Reload'}
          </span>
        </button>

        {/* Subtle toggle area for auto-refresh */}
        <button
          onClick={() => sidebar.toggleHeaderAction?.('autoRefresh')}
          className={classNames(
            "absolute top-0 right-0 bottom-0 w-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center justify-center group",
            headerState.autoRefresh ? "text-blue-500" : "text-gray-300"
          )}
          title={headerState.autoRefresh ? "Disable auto-refresh" : "Enable auto-refresh"}
        >
          <div className={classNames(
            "w-1 h-4 rounded-full transition-colors",
            headerState.autoRefresh ? "bg-blue-400/50" : "bg-gray-200 dark:bg-gray-800 group-hover:bg-gray-300"
          )} />
        </button>
      </div>
    </div>
  ) : null;

  // Where the character stands, for a panel opened on a page of its own.
  const here = (): Record<string, number> | undefined => {
    const p = cursorManPosRef.current
      ?? (canvasCenterX !== undefined && canvasCenterY !== undefined ? { x: canvasCenterX, y: canvasCenterY } : null);
    return p ? { x: p.x, y: p.y } : undefined;
  };

  useAppSidebar({
    // On a phone, selecting a card is focus — not "show me everything". The
    // sheet covers the list it was chosen from, so it opens when asked for
    // (Enter, or a second tap), exactly as it does on the board.
    open: detailPanelOpen || !!api.filterOpen,
    // Every panel stands on a page of its own, for an app to open as a sheet
    // of its own (lib/nativeHost) — all but a group's, whose panel is the
    // board's. What a panel reads off the board (where the character stands,
    // for a thing pinned underfoot or lined up from there) goes with it.
    // On the want list's page (no board to load behind it); see WantListPage.
    hostRoute: api.filterOpen ? hostPanelRoute('/dashboard', 'filter')
      : sidebar.showGlobal ? hostPanelRoute('/dashboard', 'global')
      : addingThing ? hostPanelRoute('/dashboard', 'add-thing', here())
      : editingThing ? hostPanelRoute('/dashboard', `edit-thing:${editingThing.id}`)
      : cursorGroup ? undefined
      : selectedWant ? hostPanelRoute('/dashboard', `want:${selectedWant.metadata?.id || selectedWant.id || ''}`)
      : cursorThingRecord ? hostPanelRoute('/dashboard', `thing:${cursorThingRecord.id}`, here())
      : undefined,
    mobileForceBottom: isMobileCanvas,
    disableBackdropClick: expandedChain.length > 0,
    title: api.filterOpen ? 'Filter' : sidebar.showGlobal ? 'Global'
      // Naming itself in a bar is what the detail panels stopped doing, and a
      // form is the last thing that needs it: its own first field says what it
      // makes. The header row stays, holding nothing but the way out — which is
      // what a chromeless panel's row is too, so the close lands in the same
      // place whichever panel is open. Edit keeps its title: it names a
      // subject, which is a detail panel's job rather than a form's.
      : addingThing ? ''
      : editingThing ? `Edit ${editingThing.value}`
      : cursorGroup ? cursorGroup.name
      : selectedWant ? (selectedWant.metadata?.name || selectedWant.metadata?.id || 'Want Details')
      : (cursorThingRecord ? thingDisplayName(cursorThingRecord.value) : ''),
    titleIcon: api.filterOpen ? Waypoints : sidebar.showGlobal ? Globe : (selectedWant && !cursorGroup ? sidebarTitleIcon : undefined),
    titleIconClassName: sidebar.showGlobal ? 'text-green-500' : undefined,
    titleIconStyle: sidebar.showGlobal || !selectedWant || cursorGroup
      ? undefined
      : wantTypeIconStyle(
          selectedWant.metadata?.type ?? '',
          sidebarWantTypes.find(t => t.name === selectedWant.metadata?.type)?.category ?? '',
          isDarkMode,
        ),
    backgroundStyle: api.filterOpen ? undefined : !sidebar.showGlobal && selectedWant && !cursorGroup ? sidebarBgStyle : undefined,
    // The want detail says which want it is on its own card, so the frame's
    // header — name, status, close, all under a card already showing them —
    // is not drawn for it. Every other panel (Global, Add Thing, Edit Thing)
    // keeps it: they have no card of their own to say it with.
    // Both detail panels open on a card that already names their subject, so
    // neither wants the frame's header. They wear PanelIdentityRow instead —
    // one component, so the two cannot say it differently.
    // Add Thing is chromeless too now. Not for a card of its own — it has none
    // — but because the frame's header bar is drawn at the BOTTOM of the
    // sidebar in this layout, so a panel that kept it had its way out in a
    // different place from every panel that had given it up. One row, one
    // place, whichever panel is open; the shell supplies it (see PanelShell).
    chromeless: !api.filterOpen && !sidebar.showGlobal && !editingThing
      && (addingThing || !!selectedWant || !!cursorThingRecord || !!cursorGroup),
    // The want panel builds its own identity row, glued to the card inside the
    // block the phone's bottom sheet re-orders. Everything else — this page's
    // thing detail included — takes the host's. See appSidebarStore.ownIdentity.
    ownIdentity: !api.filterOpen && (!!selectedWant && !cursorGroup),
    // The two forms are panels the user went and opened, so they arrive
    // holding the input and B cancels out of them — the same contract Add Want
    // has had all along (WantForm passes it directly). The detail panels
    // deliberately do not: they open by themselves as the character walks onto
    // something, and taking the stick on an arrival strands the walk.
    claimsInputOnOpen: !!api.filterOpen || addingThing || !!editingThing,
    headerActions: api.filterOpen ? undefined : !sidebar.showGlobal && selectedWant && !cursorGroup ? headerActions : undefined,
    onClose: () => {
      if (api.filterOpen) { api.onCloseFilter?.(); return; }
      if (addingThing) { setAddingThing(false); return; }
      if (editingThing) { consumeThingEdit(); return; }
      if (sidebar.showGlobal) { sidebar.closeMemo(); return; }
      // Closing spends the request. It names a want so that choosing a
      // DIFFERENT card cannot inherit it, but the same card would still match
      // its own earlier request — so tapping it again after closing reopened
      // the sheet by itself. A request is for one opening, not for the want
      // forever.
      setDetailsRequestedFor(null);
      // A group is dismissed the same way: the character is still there.
      if (cursorGroup) { setDetailsDismissed(true); return; }
      // Dismiss, don't forget. The character is still standing on the thing, so
      // Enter opens it again — clearing the focused id instead would leave the
      // tile silent until you stepped off and back on.
      if (cursorThingRecord) { setDetailsDismissed(true); return; }
      sidebar.clearSelection();
      setExpandedChain([]);
    },
    // Directional swap when walking between want cards with the sidebar open.
    //
    // Keyed by what is SHOWN, in the same order of precedence as `content`
    // below. The thing forms used to fall through to the want/thing under the
    // cursor, so the stick walking the board changed the key while Add Thing
    // was on screen — and the swap remounted the form, back to its Add tab at
    // the top of its list, with whatever had been typed gone.
    contentKey: api.filterOpen ? 'filter' : sidebar.showGlobal ? 'global'
      : addingThing ? 'add-thing'
      : editingThing ? `edit-thing:${editingThing.id}`
      : cursorGroup ? `group:${cursorGroup.name}`
      : ((selectedWant?.metadata?.id || selectedWant?.id) ?? cursorThingRecord?.id ?? ''),
    contentOrder: sidebar.showGlobal || addingThing || editingThing || !selectedWant || cursorGroup
      ? undefined
      : (() => {
          const id = selectedWant.metadata?.id || selectedWant.id;
          const idx = filteredWants.findIndex(w => (w.metadata?.id || w.id) === id);
          return idx >= 0 ? idx : undefined;
        })(),
    content: api.filterOpen ? (
      <ConstellationFilterPanel page="want" />
    ) : sidebar.showGlobal ? (
      <GlobalStateSidebar
        summaryProps={{
          wants,
          loading,
          allLabels,
          onLabelClick,
          selectedLabel,
          onClearSelectedLabel: () => { setSelectedLabel(null); setLabelOwners([]); setLabelUsers([]); },
          labelOwners,
          labelUsers,
          onViewWant,
          fetchLabels,
          fetchWants,
        }}
        radarMode={radarMode}
        onRadarModeToggle={() => setRadarMode(prev => !prev)}
        focusParamKey={focusGlobalParamKey}
      />
    ) : addingThing ? (
      // The header's Add Thing. The same form the Thing page opens — a thing
      // made from the board is a thing, and there is no second way to make one.
      <AddThingSidebar
        onAdded={() => setAddingThing(false)}
        onCancel={() => setAddingThing(false)}
        // Pinning puts the thing underfoot. Read at the moment of the press, and
        // through the ref so a walking character does not re-render the panel:
        // same source Add Want places a new want from.
        getPinPosition={() => {
          const p = cursorManPosRef.current;
          if (p) return p;
          if (canvasCenterX === undefined || canvasCenterY === undefined) return null;
          return { x: canvasCenterX, y: canvasCenterY };
        }}
      />
    ) : editingThing ? (
      // A thing card asked for its editor. Same panel as naming one, so the
      // board answers it the way the Thing page does rather than sending you
      // off the board to change a category.
      <AddThingSidebar
        record={editingThing}
        onAdded={() => consumeThingEdit()}
        onCancel={() => consumeThingEdit()}
      />
    ) : cursorGroup ? (
      cursorGroup.panel
    ) : cursorThingRecord ? (
      <ThingDetailsSidebar
        record={cursorThingRecord}
        onAddWant={onAddWantFromThing}
        // The card only offers Delete when it is given somewhere to send it, so
        // leaving this out did not grey the action out — it removed it, and the
        // board was the one place a thing could not be thrown away. The card
        // runs its own confirm first; the sheet then has nothing left to show,
        // so it stands down and leaves the character where it is.
        onDelete={(r) => { void deleteThingRecord(r); setDetailsDismissed(true); }}
        // Lining a theme up starts where you are standing, read at the moment
        // of the press and through the ref — the same source pinning a thing
        // underfoot uses, and for the same reason: a walking character must not
        // re-render the panel.
        getOrigin={() => cursorManPosRef.current}
        onArranged={onArranged}
      />
    ) : selectedWant ? (
      <WantDetailsSidebar
        want={selectedWant}
        // The way out, now that the frame draws no header to hold one.
        onClose={() => {
          setDetailsRequestedFor(null);
          if (cursorThingRecord) { setDetailsDismissed(true); return; }
          sidebar.clearSelection();
          setExpandedChain([]);
        }}
        initialTab={sidebarInitialTab}
        initialTabVersion={sidebarTabVersion}
        onRecommendationSelect={onRecommendationSelect}
        onWantUpdate={() => { if (selectedWant?.metadata?.id || selectedWant?.id) useWantStore.getState().fetchWantDetails((selectedWant.metadata?.id || selectedWant.id) as string); }}
        onHeaderStateChange={setHeaderState}
        onRegisterHeaderActions={sidebar.registerHeaderActions}
        onStart={() => startWant(selectedWant?.metadata?.id || selectedWant?.id || '')}
        onStop={() => stopWant(selectedWant?.metadata?.id || selectedWant?.id || '')}
        onSuspend={() => suspendWant(selectedWant?.metadata?.id || selectedWant?.id || '')}
        onResume={() => resumeWant(selectedWant?.metadata?.id || selectedWant?.id || '')}
        // Deletes. This used to set wantStore.deleteConfirmWantId, which nothing
        // read — so confirming delete on the sidebar's embedded card did
        // nothing at all. The card runs its own confirm overlay before calling
        // this, so asking again would be the second time anyway.
        onDelete={(w) => { void onDeleteWant(w); }}
        onSaveRecipe={() => onSaveRecipe(selectedWant!)}
        onTabChange={setSidebarInitialTab}
        seriesWants={seriesWants}
        summaryProps={{
          wants,
          loading,
          allLabels,
          onLabelClick,
          selectedLabel,
          onClearSelectedLabel: () => { setSelectedLabel(null); setLabelOwners([]); setLabelUsers([]); },
          labelOwners,
          labelUsers,
          onViewWant,
          fetchLabels,
          fetchWants
        }}
      />
    ) : null,
  });
}
