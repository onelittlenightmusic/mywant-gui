import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useHeaderAtBottom } from '@/hooks/useDisplaySettings';
import { useMinimapFocusStore } from '@/stores/minimapFocusStore';
import { WantExecutionStatus, Want } from '@/types/want';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWantStore } from '@/stores/wantStore';
import { useWantSeedStore } from '@/stores/wantSeedStore';
import { seedThingsFromIds } from '@/utils/thingSeed';
import { useAddWantTypeStore } from '@/stores/addWantTypeStore';
import { useChatOpenStore } from '@/stores/chatOpenStore';
import { hasExtensionRoute } from '@/extensions/registry';
import { useWantTypeStore } from '@/stores/wantTypeStore';
import { useConfigStore } from '@/stores/configStore';
import { useConstellationStore } from '@/stores/constellationStore';
import { onSSEReconnect } from '@/api/sseClient';
import { writeWantState } from '@/api/wantState';
import { smartPollWants, seedWantETags } from '@/stores/wantHashCache';
import { useRightSidebarExclusivity } from '@/hooks/useRightSidebarExclusivity';
import { useDarkMode } from '@/hooks/useDarkMode';
import { apiClient } from '@/api/client';
import { useSSEEvent } from '@/hooks/useSSEEvent';
import { useCharacterStore } from '@/stores/characterStore';
import { notify } from '@/stores/noticeStore';
import { Recommendation, ConfigModifications } from '@/types/interact';
import { isDraftWant } from '@/types/draft';

// Components
import { WantMinimapRef } from '@/components/dashboard/WantMinimap';
import { getTypeIcon, getCategoryIcon } from '@/components/dashboard/WantTypeVisuals';
import { resolveLucideIcon } from '@/utils/subtypeIcons';
import { useThingTileStore } from '@/stores/thingTileStore';
import { WeatherCondition } from '@/components/dashboard/WeatherEffect';
import { useInputHandedOver } from '@/stores/focusOwner';
import { useGlobalTemplateDrop } from './useGlobalTemplateDrop';
import { useWantActions } from './useWantActions';
import { useWantCreationDrops } from './useWantCreationDrops';
import { useGuiStateSync } from './useGuiStateSync';
import { usePanelRequests } from './usePanelRequests';
import { useAddWantForm } from './useAddWantForm';
import { useWantView } from './useWantView';
import { useWantLists } from './useWantLists';
import type { BoardLink } from './boardLink';
import { publishCursorManCell } from '@/utils/cursorManCell';

/**
 * The workspace both pages share — the wants and what is selected of them,
 * the detail panel's requests, the Add Want form, the confirmations, the
 * saved GUI state, the drops. Everything of the old Dashboard that is not the
 * board and not the list.
 *
 * The list page (list/WantListPage) and the canvas page (canvas/CanvasPage)
 * each call this first, then their own hooks. It registers no key listeners
 * of its own, so where a page calls it does not change who answers a key.
 */
export function useWorkspace({ board }: { board: BoardLink }) {
  const {
    wants, loading, error, fetchWants, deleteWant, deleteWants,
    suspendWant, resumeWant, stopWant, startWant, clearError, reorderWant, archiveWant, unarchiveWant,
    draggingTemplate, setDraggingTemplate, touchPos, setTouchPos,
  } = useWantStore();

  const sidebar = useRightSidebarExclusivity<Want>();
  const [expandedChain, setExpandedChain] = useState<Want[]>([]);
  const [gridColumns, setGridColumns] = useState(1);
  const [lastSelectedWantId, setLastSelectedWantId] = useState<string | null>(null);
  const [sidebarInitialTab, setSidebarInitialTab] = useState<'settings' | 'results' | 'wiring' | 'expose' | 'import' | 'history' | 'versions' | 'chat'>('settings');
  const [sidebarTabVersion, setSidebarTabVersion] = useState(0);
  // Authoritative UI situation — written at Dashboard level immediately when the
  // form opens/closes so input routing is never delayed by WantForm's render cycle.
  const [formSituation, setFormSituation] = useState<'closed' | 'type-selection' | 'fields' | 'select-mode' | 'batch-action'>('closed');
  const navigate = useNavigate();
  const location = useLocation();
  // Thing-seeded Add Want: a value picked on /thing lands here as a store seed;
  // we hold it locally for the form's lifetime and clear the store.
  const storeSeed = useWantSeedStore(s => s.seed);
  const requestWantSeed = useWantSeedStore(s => s.requestSeed);
  const consumeSeed = useWantSeedStore(s => s.consume);
  // Add Want opened from a Want Types card (type preselected, no thing seed).
  const addTypeId = useAddWantTypeStore(s => s.typeId);
  const consumeAddType = useAddWantTypeStore(s => s.consume);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [maximizedWantId, setMaximizedWantId] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<{ key: string; value: string } | null>(null);
  const [labelOwners, setLabelOwners] = useState<Want[]>([]);
  const [labelUsers, setLabelUsers] = useState<Want[]>([]);
  const [allLabels, setAllLabels] = useState<Map<string, Set<string>>>(new Map());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedWantIds, setSelectedWantIds] = useState<Set<string>>(new Set());
  /**
   * The things ticked in select mode.
   *
   * A second set rather than thing ids mixed into the one above, and the
   * reason is the batch actions: start, stop and delete take the selection
   * straight to the want API. A thing id in that set would be sent to it as a
   * want, and "the compiler cannot tell them apart" is exactly the argument
   * for keeping them apart. What genuinely acts on both — moving the
   * selection, naming it as a constellation — takes the union deliberately.
   */
  const [selectedThingIds, setSelectedThingIds] = useState<Set<string>>(new Set());
  const fetchConstellations = useConstellationStore((s) => s.fetchConstellations);
  const createConstellation = useConstellationStore((s) => s.createConstellation);
  const cardListScrollRef = useRef<HTMLDivElement>(null);

  // Minimap state
  const [minimapOpen, setMinimapOpen] = useState(window.innerWidth >= 1024); // Desktop default: true, Mobile: false
  const [radarMode, setRadarMode] = useState(false);

  // Track viewport width so we can compute canvas insets correctly.
  // On lg+ (≥1024px) screens, lg:pr-[480px] already narrows the canvas container.
  // On sm-lg (640-1023px) screens, the minimap is fixed-overlay (w-[480px]) without container adjustment.
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Load want constellations once so cards can show their group badges.
  useEffect(() => { fetchConstellations('want'); }, [fetchConstellations]);
  const minimapInsetRight = minimapOpen && viewportWidth >= 640 && viewportWidth < 1024 ? 480 : 0;

  const config = useConfigStore(state => state.config);
  const updateConfig = useConfigStore(state => state.updateConfig);
  const isBottom = useHeaderAtBottom();
  // Game mode locks canvas want-tile positions — see onShiftDown/handleMoveWant
  // below (GUI drag paths) and the mirrored server-side barrier in updateWant.
  const isGameMode = (config?.interaction_mode ?? 'edit') === 'game';

  // Weather effect: manual Settings override takes priority, then auto-detect from weather_effect want.
  const weatherCondition = useMemo<WeatherCondition>(() => {
    if (config?.canvas_weather_effect) return config.canvas_weather_effect as WeatherCondition;
    const w = wants.find(w => w.metadata?.type === 'weather_effect');
    return ((w?.state?.current as Record<string, unknown>)?.weather_condition as WeatherCondition) || '';
  }, [wants, config?.canvas_weather_effect]);
  const weatherIntensity = useMemo<number>(() => {
    const w = wants.find(w => w.metadata?.type === 'weather_effect');
    return ((w?.state?.current as Record<string, unknown>)?.weather_intensity as number) || 60;
  }, [wants]);
  const isDarkMode = useDarkMode();
  const sidebarWantTypes = useWantTypeStore(s => s.wantTypes);
  useWantTypeStore(s => s.categoryBgMap);
  const myCharacterId   = useCharacterStore(s => s.myCharacterId);
  const myCharacter     = useCharacterStore(s => s.characters.find(c => c.id === s.myCharacterId) ?? null);
  const myDefaultCursorColor = useCharacterStore(s => s.myDefaultCursorColor);

  // Canvas mode (2D grid placement) is the route: /canvas is the board,
  // /dashboard is the list. Keeping it in the address means the menu can link
  // to it, the back button works, and no per-character flag has to be restored
  // before the page knows what it is showing.
  const canvasMode = location.pathname === '/canvas';
  const setCanvasMode = useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    const wanted = typeof next === 'function' ? next(canvasMode) : next;
    // Only to a board that this build has — see extensions/registry.
    if (wanted && !hasExtensionRoute('/canvas')) return;
    if (wanted !== canvasMode) navigate(wanted ? '/canvas' : '/dashboard');
  }, [canvasMode, navigate, location.pathname]);
  // Guards the one-time restore-from-gui-state below (see pollGUIState) so a
  // later poll never overrides a toggle the user just made in this tab.
  const canvasModeRestoredRef = useRef(false);
  // Whether the first gui_state has landed. Nothing may be placed from, or
  // written back to, the saved state before it has — see placeCursorFromState.
  const hasSyncedGuiStateRef = useRef(false);
  // When an Add Want form is opened from a thing/type seed on mount, suppress the
  // one-time restore-from-gui-state of the previously-selected want (it would
  // otherwise clobber the just-opened form).
  const suppressWantRestoreRef = useRef(false);
  // The last (wantId, tab) applied from gui-state, so a repeated poll doesn't
  // keep yanking the sidebar back to the persisted tab after a local switch.
  const lastAppliedSidebarTabRef = useRef<string>('');
  // On small screens in canvas mode, scale the canvas to 50% so the sidebar overlays without covering it.
  /**
   * The phone layout. Detail is a near-full-screen sheet here, so it waits to
   * be asked for — on the board AND in the list, which is the same rule stated
   * once instead of twice.
   */
  const isMobileLayout = viewportWidth < 640;
  const isMobileCanvas = canvasMode && isMobileLayout;
  /** Key of the global param card to highlight in GlobalStateSidebar */
  const [focusGlobalParamKey, setFocusGlobalParamKey] = useState<string | null>(null);
  const canvasModeRef = useRef(false);
  const myCharacterIdRef = useRef<string | null>(null);
  // Keep refs in sync so polling callback (stale closure) always reads current values
  useEffect(() => { canvasModeRef.current = canvasMode; }, [canvasMode]);
  useEffect(() => { myCharacterIdRef.current = myCharacterId; }, [myCharacterId]);
  const prevWantIdsRef = useRef<Set<string>>(new Set());
  const wantMinimapRef = useRef<WantMinimapRef>(null);

  // The board this workspace reaches onto, or the still one the list page
  // hands in. See workspace/boardLink.
  const {
    cursorManPos, setCursorManPos, cursorManPosRef, initCursorManPosRef, lastLocalCursorMoveRef, cursorManFocusedWantIdRef, canvasScale, setCanvasScale, clampScale, canvasScaleRef, canvasCenterX, canvasCenterY, canvasCenterXRef, canvasCenterYRef, pendingCanvasPosRef, hasLoadedCharacterViewportRef, canvasPositionMapRef, wantCanvasRef, canvasMiddle,
  } = board;

  // Only orphan (no ownerReferences) draft wants are shown as top-level DraftWantCards.
  // Draft wants that are children of another want (e.g. goal under whim) are rendered
  // inside the parent's WantChildrenBubble instead.
  // The one filter everything else is derived from, and what sits on top of
  // it — top-level vs. archived, which want is selected, the parent→children
  // map, and the canvas's expanded-parent set. See workspace/useWantLists.
  const {
    drafts, hasThinkingDraft,
    regularWants, allTopLevelWants, topLevelWants,
    selectedWant,
    childWantsByParentId, listHiddenTypeNames, wantsForGrid,
    canvasChildWants,
    manualExpandedIds, setManualExpandedIds,
    cursorAutoExpandedId, setCursorAutoExpandedId,
    canvasExpandedIds, handleToggleCanvasExpand,
    canvasExpandedChildWants, canvasChildCounts,
  } = useWantLists({
    wants,
    selectedItem: sidebar.selectedItem,
    sidebarWantTypes,
  });

  const [selectedRecommendation, setSelectedRecommendation] = useState<Recommendation | null>(null);
  const [showRecommendationForm, setShowRecommendationForm] = useState(false);
  // Every transient notice speaks through the robot's bubble — the bottom-center
  // Toast is gone, so there is one place a message can come from. Kept as a
  // wrapper so the call sites below read unchanged, and addressed by getState()
  // rather than a subscription: this page must not re-render when the robot moves.
  // Note the Toast used to truncate at 30 chars; the bubble shows the full text.
  const showNotification = useCallback((message: string) => {
    notify(message);
  }, []);

  // What can be done to a want, and the confirmations each of those raises.
  // See workspace/useWantActions.
  const {
    deleteWantState, showDeleteConfirmation, isDeletingWant,
    showBatchConfirmation, batchAction, isBatchProcessing,
    reactionWantState, showReactionConfirmation, reactionAction, isSubmittingReaction,
    deleteDraftState, showDeleteDraftConfirmation,
    showSaveRecipeModal, saveRecipeTarget, saveRecipeAnalysis, saveRecipeLoading,
    setBatchAction, setShowBatchConfirmation,
    handleBatchConfirm, handleBatchGroup, handleBatchCancel,
    handleDeleteWantCancel, handleDeleteWantConfirm, handleShowDeleteConfirmation, handleDirectDeleteWant,
    handleDraftDelete, handleDeleteDraftConfirm, handleDeleteDraftCancel,
    handleReactionCancel, handleReactionConfirm, handleShowReactionConfirmation,
    handleSuspendWant, handleResumeWant, handleArchiveWant, handleUnarchiveWant,
    handleSaveRecipeFromWant, handleSaveRecipeSubmit, closeSaveRecipeModal,
    resetConfirmations,
  } = useWantActions({
    showNotification,
    selectedWant,
    clearSelection: sidebar.clearSelection,
    selectedWantIds,
    setSelectedWantIds,
    selectedThingIds,
    setSelectedThingIds,
    setIsSelectMode,
    setSelectedRecommendation,
  });

  // Kept current each render so Shift keydown handler can read without stale closure
  const selectedWantRef = useRef<Want | null>(null);
  selectedWantRef.current = selectedWant ?? null;

  // Exit corner-move mode when selection changes
  const prevSelectedIdRef = useRef<string | null>(null);
  const selId = selectedWant ? (selectedWant.metadata?.id || selectedWant.id || null) : null;
  if (selId !== prevSelectedIdRef.current) { prevSelectedIdRef.current = selId; }

  const [seriesWants, setSeriesWants] = useState<Want[]>([]);
  useEffect(() => {
    const series = selectedWant?.metadata?.series;
    if (!series) { setSeriesWants([]); return; }
    // Asked of the server by series. Every want has one, so this runs each
    // time a different want is selected — which on a phone is every landing
    // on a want — and without the filter it fetched the whole board, cancelled
    // wants and all (megabytes), to keep the handful in this series. Still
    // filtered here, for a server that predates the parameter.
    apiClient.listWants({ includeCancelled: true, series })
      .then(all => setSeriesWants(all.filter(w => w.metadata?.series === series)))
      .catch(() => setSeriesWants([]));
  }, [selectedWant?.metadata?.series]);

  const [filteredWants, setFilteredWants] = useState<Want[]>([]);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archivedNavWants, setArchivedNavWants] = useState<Want[]>([]);
  const [focusedSlotId, setFocusedSlotId] = useState<string | null>(null);
  // Clear slot focus when a real want becomes selected
  React.useEffect(() => { if (selectedWant) setFocusedSlotId(null); }, [selectedWant]);

  // Use filteredWants for navigation when the WantGrid has populated it; fall
  // back to the raw store `wants` so keyboard/gamepad navigation works
  // immediately on page load before the first filter callback fires.
  const flattenedWants = (filteredWants.length > 0 ? filteredWants : wants).flatMap((pw: any) => [pw, ...(pw.children || [])]);
  const hierarchicalWants: Array<{ id: string; parentId?: string }> = [
    ...flattenedWants.map(w => ({ id: w.metadata?.id || w.id || '', parentId: w.metadata?.ownerReferences?.[0]?.id })),
    { id: '__add-want__' },
    { id: '__open-archive__' },
    ...(archiveOpen ? archivedNavWants.map(w => ({ id: w.metadata?.id || w.id || '' })) : []),
  ];
  const currentHierarchicalWant = focusedSlotId
    ? { id: focusedSlotId }
    : selectedWant
    ? { id: selectedWant.metadata?.id || selectedWant.id || '', parentId: selectedWant.metadata?.ownerReferences?.[0]?.id }
    : null;

  // Map of wantID -> rate for correlation highlighting (only populated when radarMode is active and a want is selected).
  // Prefer the polled `selectedWant` (has latest correlation) but fall back to sidebar.selectedItem.
  const correlationHighlights = useMemo<Map<string, number>>(() => {
    if (!radarMode) return new Map();
    const source = selectedWant ?? sidebar.selectedItem;
    if (!source) return new Map();
    const entries = source.metadata?.correlation;
    if (!entries?.length) return new Map();
    const map = new Map<string, number>();
    for (const entry of entries) {
      map.set(entry.wantID, entry.rate);
    }
    return map;
  }, [radarMode, selectedWant, sidebar.selectedItem]);
  const [headerState, setHeaderState] = useState<{ autoRefresh: boolean; loading: boolean; status: WantExecutionStatus } | null>(null);

  const fetchLabels = async () => {
    try {
      const response = await fetch('/api/v1/labels');
      if (response.ok) {
        const data = await response.json();
        const labelsMap = new Map<string, Set<string>>();
        if (data.labelValues) {
          for (const [key, valuesArray] of Object.entries(data.labelValues)) {
            if (!labelsMap.has(key)) labelsMap.set(key, new Set());
            if (Array.isArray(valuesArray)) {
              (valuesArray as any[]).forEach(item => {
                const v = typeof item === 'string' ? item : item.value;
                if (v) labelsMap.get(key)!.add(v);
              });
            }
          }
        }
        setAllLabels(labelsMap);
      }
    } catch (e) { console.error('Error fetching labels:', e); }
  };

  useEffect(() => {
    fetchWants().then(() => {
      // Seed the ETag cache from the initial full load so that subsequent
      // smart-polling calls can skip unchanged wants via If-None-Match.
      seedWantETags(useWantStore.getState().wants);
    });
    fetchLabels();
  }, [fetchWants]);

  // The stream says when a want changed. Nothing asks on a timer.
  //
  // Both used to run: a poll every second AND this, doing the same work — and
  // the server broadcasts `want_changed` for every create, update and delete,
  // so the timer never learned anything the stream had not already said. Idle,
  // the two of them made 69 requests in six seconds on a board nobody was
  // touching.
  useSSEEvent('want_changed', () => {
    if (wants.length > 0) smartPollWants();
    fetchLabels();
  });

  // What the timer was quietly also doing: covering a dropped stream.
  //
  // Events sent while the connection was down are gone, and listening harder
  // does not get them back — so the catch-up is explicit, and happens once when
  // the stream comes back rather than every second in case it ever does.
  useEffect(() => onSSEReconnect(() => { smartPollWants(); fetchLabels(); }), [smartPollWants, fetchLabels]);

  useEffect(() => {
    if (sidebar.selectedItem) {
      const wantId = sidebar.selectedItem.metadata?.id || sidebar.selectedItem.id;
      if (!wants.some(w => (w.metadata?.id === wantId) || (w.id === wantId))) sidebar.clearSelection();
      else sidebar.closeMemo(); // Close global state panel when a want is selected
    }
  }, [wants, sidebar.selectedItem]);

  useEffect(() => { if (error) { const t = setTimeout(() => clearError(), 5000); return () => clearTimeout(t); } }, [error, clearError]);

  // Where a new want lands, for the paths that add one without the form's
  // placement (a card overlay, a recipe deploy, another page) — see
  // cursorManCell.ts. The character's canvas centre stands in until CursorMan
  // has a cell, as the Add press does.
  useEffect(() => {
    publishCursorManCell(cursorManPos ?? (canvasCenterX !== undefined && canvasCenterY !== undefined
      ? { x: canvasCenterX, y: canvasCenterY }
      : null));
  }, [cursorManPos, canvasCenterX, canvasCenterY]);

  // pendingCanvasPosRef is set when the form opens in canvas mode.
  // Canvas labels are now included directly in the createWant request via WantForm's
  // canvasPlacementPos prop, so no post-creation patch is needed.
  // Reset the ref when a new want appears so it doesn't linger.
  useEffect(() => {
    if (!pendingCanvasPosRef.current) return;
    const currentIds = new Set(wants.map(w => w.metadata?.id || w.id || '').filter(Boolean));
    const newIds = Array.from(currentIds).filter(id => !prevWantIdsRef.current.has(id));
    if (newIds.length > 0) {
      pendingCanvasPosRef.current = null;
    }
  }, [wants]);

  /** Tick or untick one id. The same act for a want and for a thing. */
  const toggled = (prev: Set<string>, id: string) => {
    const s = new Set(prev);
    if (s.has(id)) s.delete(id); else s.add(id);
    return s;
  };

  const handleToggleSelectMode = () => {
    if (isSelectMode) {
      setSelectedWantIds(new Set());
      setSelectedThingIds(new Set());
      setIsSelectMode(false);
      setFormSituation('closed');
    } else {
      setIsSelectMode(true);
      setFormSituation('select-mode');
    }
  };
  const handleSelectWant = (id: string) => {
    // Do NOT call setLastSelectedWantId here — the triangle cursor is driven by
    // navigation (handleViewWant), not by checkbox toggling.
    setSelectedWantIds(prev => toggled(prev, id));
  };
  /** The same tick, on the other kind of tile. */
  const handleSelectThing = (id: string) => setSelectedThingIds(prev => toggled(prev, id));

  // Which BatchActionBar button is highlighted (0=Start, 1=Stop, 2=Delete) when formSituation === 'batch-action'
  const [batchFocusIdx, setBatchFocusIdx] = useState(0);
  const thingTiles = useThingTileStore(s => s.tiles);

  /**
   * The ticked tiles, as icons for the bar to show.
   *
   * A want is drawn by its type's icon and a thing by its subtype's, which is
   * what each is drawn with everywhere else — the row should be recognisable as
   * the same tiles, not a second vocabulary invented for the header.
   */
  const selectedBatchItems = useMemo(() => {
    const out: Array<{ id: string; icon?: React.ReactNode; label: string; color?: string }> = [];
    for (const id of selectedWantIds) {
      const w = wants.find(x => (x.metadata?.id || x.id) === id);
      const type = w?.metadata?.type ?? '';
      const Icon = getTypeIcon(type) ?? getCategoryIcon(sidebarWantTypes.find(t => t.name === type)?.category ?? '');
      out.push({ id, label: w?.metadata?.name || type || id, icon: Icon ? <Icon className="w-3 h-3" /> : undefined });
    }
    for (const id of selectedThingIds) {
      const t = thingTiles.find(x => x.id === id);
      const Icon = resolveLucideIcon(t?.icon);
      out.push({ id, label: t?.value ?? id, color: t?.color, icon: Icon ? <Icon className="w-3 h-3" /> : undefined });
    }
    return out;
  }, [selectedWantIds, selectedThingIds, wants, sidebarWantTypes, thingTiles]);

  /**
   * Add Want from a whole selection of things.
   *
   * The same door a single thing's card opens, widened: the form is seeded with
   * every ticked thing in the order it was ticked, offers only want types with
   * a parameter to spare for each of them, and fills one parameter per thing.
   * Select mode ends first — the form is where the user is going, and a
   * selection bar over it would be answering keys the form wants.
   */
  const handleBatchAddWant = useCallback(() => {
    // Same reading of a set of things the Y-join's own Add Want does — see
    // seedThingsFromIds.
    const picked = seedThingsFromIds([...selectedThingIds]);
    if (picked.length === 0) return;
    handleToggleSelectMode();
    requestWantSeed({ ...picked[0], more: picked.slice(1) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThingIds, requestWantSeed]);

  // What has been asked of the detail panel, and the thing forms it holds —
  // shared by the list and the board. See workspace/usePanelRequests.
  const {
    setDetailsRequestedFor,
    detailsDismissed, setDetailsDismissed,
    detailsAskedFor,
    editingThing, consumeThingEdit,
    addingThing, setAddingThing,
    thingRecords, deleteThingRecord,
    handleAddWantFromThing,
  } = usePanelRequests({ loadThings: canvasMode });
  // useWantView needs openCanvasDetails, which useDetailTarget only produces
  // further down — so it is read through this mirror, filled in below that
  // call. Only ever called later, from inside a callback, by which time the
  // ref has been filled.
  const openCanvasDetailsRef = useRef<(forWantId?: string) => void>(() => {});

  // Opening the Add Want form, and the three doors that lead there — a plain
  // press, a thing/type seed, editing a want that already exists. Called here
  // (rather than beside the rest of the form state) because useGuiStateSync
  // just below needs its wantFormRef. See workspace/useAddWantForm.
  const {
    editingWant, setEditingWant,
    ownerWant, setOwnerWant,
    initialFormTypeId, setInitialFormTypeId,
    initialFormParams, initialFormImports,
    initialFormItemType, setInitialFormItemType,
    wantSeed,
    wantFormRef,
    handleCreateWant, handleEditWant,
    resetForm: resetAddWantForm,
  } = useAddWantForm({
    sidebar,
    cursorManPos,
    canvasCenterX,
    canvasCenterY,
    wants,
    prevWantIdsRef,
    pendingCanvasPosRef,
    suppressWantRestoreRef,
    setDetailsDismissed,
    showNotification,
    fetchWants,
    setFormSituation,
    storeSeed,
    consumeSeed,
    addTypeId,
    consumeAddType,
  });

  /**
   * Brings a want card into view on the dashboard.
   *
   * Desktop only. The phone used to snap the tapped card's top edge to the
   * top of the viewport, which is no longer wanted: tapping already tells you
   * which card you chose, and the snap was an animated scroll that the
   * CursorMan then had to chase it for the whole
   * duration — the card moved under them frame by frame, which is what read as
   * sluggish. Nothing on a phone needs the list to move at all.
   */
  const focusWantInDashboard = (wantId: string, smooth = true) => {
    if (window.innerWidth < 640) return;
    const element = document.querySelector(`[data-want-id="${wantId}"]`);
    if (!element) return;

    element.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
    // No focus flash: scrolling the card into view and the CursorMan sitting on
    // it are the focus signal. A 2s wash over the card on every arrow press was
    // noise, and it fought the card-opacity setting by briefly repainting the
    // background at a value the user did not choose.
  };

  // The one conversation with /api/v1/gui/state — which want the panel is on,
  // where this character stands, how far the board is zoomed, what phase the
  // form is in. Read on mount and on every `gui_state` broadcast, written back
  // as it changes. See workspace/useGuiStateSync.
  //
  // Placed here rather than beside the other state because it needs
  // `focusWantInDashboard` above, and reads everything else through a mirror.
  const { lastSyncedStateRef } = useGuiStateSync({
    wants,
    sidebar,
    canvasMode,
    canvasScale,
    canvasCenterX,
    canvasCenterY,
    cursorManPos,
    maximizedWantId,
    formSituation,
    sidebarInitialTab,
    myCharacterId,
    canvasModeRef,
    cursorManPosRef,
    canvasCenterXRef,
    canvasCenterYRef,
    canvasScaleRef,
    myCharacterIdRef,
    cursorManFocusedWantIdRef,
    hasSyncedGuiStateRef,
    suppressWantRestoreRef,
    initCursorManPosRef,
    hasLoadedCharacterViewportRef,
    prevWantIdsRef,
    pendingCanvasPosRef,
    wantCanvasRef,
    wantFormRef,
    setCursorManPos,
    setCanvasScale,
    clampScale,
    setMaximizedWantId,
    setFormSituation,
    setIsSelectMode,
    setFocusGlobalParamKey,
    setSidebarInitialTab,
    setSidebarTabVersion,
    setInitialFormTypeId,
    setInitialFormItemType,
    setOwnerWant,
    canvasMiddle,
    focusWantInDashboard,
  });

  // Selecting a want, wherever the selection came from — a list card, a
  // canvas tile, a bubble child, the minimap, a draft. See
  // workspace/useWantView.
  //
  // Called here (rather than beside useCursorFocus, which needs its
  // onViewWant) because that is exactly the circular dependency this avoids:
  // the three detail-panel values it also needs are read through the
  // ref-mirrors declared above, filled in once useCursorFocus and
  // useDetailTarget have run further down.
  const {
    handleViewWant,
    handleBubbleChildClick,
    handleEnterBubble,
    handleViewAgents,
    handleViewResults,
    handleViewChat,
    handleDraftClick,
    handleMinimapClick,
    handleMinimapDoubleClick,
    handleMinimapDraftClick,
  } = useWantView({
    wants,
    selectedWant,
    sidebar,
    expandedChain,
    setExpandedChain,
    childWantsByParentId,
    sidebarWantTypes,
    canvasMode,
    canvasPositionMapRef,
    initCursorManPosRef,
    setCursorManPos,
    lastLocalCursorMoveRef,
    setLastSelectedWantId,
    focusWantInDashboard,
    setSidebarInitialTab,
    setSidebarTabVersion,
    drafts,
    setMinimapOpen,
    detailsAskedFor,
    setDetailsRequestedFor,
    openCanvasDetails: (id) => openCanvasDetailsRef.current(id),
  });

  // The interact bubble itself is now wired at the SPA root (see
  // useRobotInteract/AppHeaderHost) so it works identically on every page,
  // not just Dashboard. Dashboard's only remaining job is to open the
  // robot's chat sidebar when the user clicks the header's unread-reply
  // badge — it's the only page that owns that sidebar UI, so a page
  // navigated here from elsewhere leaves a pending request behind.
  const pendingChatOpen = useChatOpenStore(s => s.pending);
  const consumeChatOpenRequest = useChatOpenStore(s => s.consume);
  useEffect(() => {
    if (!pendingChatOpen) return;
    const chatWant = useWantStore.getState().wants.find(w => w.metadata?.name === pendingChatOpen);
    if (chatWant) handleViewChat(chatWant);
    consumeChatOpenRequest();
  }, [pendingChatOpen]);

  const handleRecommendationDeploy = async (rid: string, mods?: ConfigModifications) => {
    if (!selectedWant || !isDraftWant(selectedWant)) return;
    const draftId = selectedWant.metadata?.id || selectedWant.id || '';
    const sessionId = (selectedWant.state?.current?.sessionId as string) || '';

    // Handle goal-thinker drafts (no sessionId)
    if (!sessionId) {
      try {
        writeWantState(draftId, { selected_recommendation_id: rid });
        showNotification(`Materializing idea...`);
        setShowRecommendationForm(false);
        setSelectedRecommendation(null);
        sidebar.closeForm(); setFormSituation('closed');
        sidebar.clearSelection();
        await fetchWants();
        return;
      } catch (e: any) {
        showNotification(`Failed to materialize: ${e.message}`);
        return;
      }
    }

    // Normal interactive session deployment
    try {
      const r = await apiClient.deployRecommendation(sessionId, { recommendation_id: rid, modifications: mods });
      showNotification(`Deployed ${r.want_ids.length} want(s) successfully!`);
      try { await apiClient.deleteDraftWant(draftId); } catch (e) {}
      await fetchWants(); setShowRecommendationForm(false); setSelectedRecommendation(null); sidebar.closeForm(); setFormSituation('closed');
    } catch (e: any) { showNotification(`Deployment failed: ${e.message}`); }
  };

  const handleLabelClick = async (key: string, value: string) => {
    setSelectedLabel({ key, value });
    setLabelOwners([]);
    setLabelUsers([]);
    
    // Trigger highlight animation on cards
    useWantStore.getState().setHighlightedLabel({ key, value });

    try {
      const r = await fetch('/api/v1/labels');
      if (!r.ok) return;
      const d = await r.json();
      if (d.labelValues && d.labelValues[key]) {
        const info = d.labelValues[key].find((i: any) => i.value === value);
        if (info) {
          const wr = await fetch('/api/v1/wants');
          if (wr.ok) {
            const wd = await wr.json();
            setLabelOwners(wd.wants.filter((w: Want) => info.owners.includes(w.metadata?.id || w.id || '')));
            setLabelUsers(wd.wants.filter((w: Want) => info.users.includes(w.metadata?.id || w.id || '')));
          }
        }
      }
    } catch (e) {}
  };

  const inputHandedOver = useInputHandedOver();
  // Distinct from inputHandedOver, which is true for the panel too: this is the
  // one state where the keys drive the camera.
  const minimapFocused = useMinimapFocusStore(s => s.focused);

  const handleRecommendationSelectFromSidebar = (rec: Recommendation) => {
    setSelectedRecommendation(rec);
    setShowRecommendationForm(true);
    setEditingWant(null);
    setFormSituation('fields');
    sidebar.openForm();
  };

  const handleToggleExpand = (wantId: string) => setExpandedParents(prev => { const next = new Set(prev); if (next.has(wantId)) next.delete(wantId); else next.add(wantId); return next; });

  // Wants that come into being, or change parent, because something was
  // dropped. See workspace/useWantCreationDrops.
  const {
    handleCanvasTemplateDrop,
    handleTemplateDropped,
    handleUnparentWant,
    handleLabelDropped,
    handleWantDropped,
  } = useWantCreationDrops({
    showNotification,
    collapseParents: (pids) => setExpandedParents(prev => { const n = new Set(prev); pids.forEach(p => n.delete(p)); return n; }),
    toggleParentExpanded: handleToggleExpand,
    selectWant: sidebar.selectItem,
  });

  // Dropping onto the page rather than onto anything in particular — a
  // template becoming a want, or a want leaving its parent. See
  // workspace/useGlobalTemplateDrop.
  const {
    isGlobalDragOver,
    handleGlobalDragEnter,
    handleGlobalDragOver,
    handleGlobalDragLeave,
    handleGlobalDrop,
  } = useGlobalTemplateDrop({
    canvasMode,
    onTemplateDropped: handleTemplateDropped,
    onUnparentWant: handleUnparentWant,
  });

  // No sound here — the card sounds its own maximise from the state both this
  // and the detail panel feed it, so the two agree. See WantCard.
  const handleMaximizeChange = useCallback((id: string | null) => {
    setMaximizedWantId(id);
  }, []);
  const handleCloseModals = () => { sidebar.closeForm(); setFormSituation('closed'); resetAddWantForm(); resetConfirmations(); };

  return {
    wants, loading, error, fetchWants, deleteWant, deleteWants, suspendWant, resumeWant,
    stopWant, startWant, clearError, reorderWant, archiveWant, unarchiveWant, draggingTemplate, setDraggingTemplate,
    touchPos, setTouchPos, sidebar, expandedChain, setExpandedChain, gridColumns, setGridColumns, lastSelectedWantId,
    setLastSelectedWantId, sidebarInitialTab, setSidebarInitialTab, sidebarTabVersion, setSidebarTabVersion, formSituation, setFormSituation, navigate,
    location, storeSeed, requestWantSeed, consumeSeed, addTypeId, consumeAddType, expandedParents, setExpandedParents,
    maximizedWantId, setMaximizedWantId, selectedLabel, setSelectedLabel, labelOwners, setLabelOwners, labelUsers, setLabelUsers,
    allLabels, setAllLabels, isSelectMode, setIsSelectMode, selectedWantIds, setSelectedWantIds, selectedThingIds, setSelectedThingIds,
    fetchConstellations, createConstellation, cardListScrollRef, minimapOpen, setMinimapOpen, radarMode, setRadarMode, viewportWidth,
    setViewportWidth, minimapInsetRight, config, updateConfig, isBottom, isGameMode, weatherCondition, weatherIntensity,
    isDarkMode, sidebarWantTypes, myCharacterId, myCharacter, myDefaultCursorColor, canvasMode, setCanvasMode, canvasModeRestoredRef,
    hasSyncedGuiStateRef, suppressWantRestoreRef, lastAppliedSidebarTabRef, isMobileLayout, isMobileCanvas, focusGlobalParamKey, setFocusGlobalParamKey, canvasModeRef,
    myCharacterIdRef, prevWantIdsRef, wantMinimapRef, drafts, hasThinkingDraft, regularWants, allTopLevelWants, topLevelWants,
    selectedWant, childWantsByParentId, listHiddenTypeNames, wantsForGrid, canvasChildWants, manualExpandedIds, setManualExpandedIds, cursorAutoExpandedId,
    setCursorAutoExpandedId, canvasExpandedIds, handleToggleCanvasExpand, canvasExpandedChildWants, canvasChildCounts, selectedRecommendation, setSelectedRecommendation, showRecommendationForm,
    setShowRecommendationForm, showNotification, deleteWantState, showDeleteConfirmation, isDeletingWant, showBatchConfirmation, batchAction, isBatchProcessing,
    reactionWantState, showReactionConfirmation, reactionAction, isSubmittingReaction, deleteDraftState, showDeleteDraftConfirmation, showSaveRecipeModal, saveRecipeTarget,
    saveRecipeAnalysis, saveRecipeLoading, setBatchAction, setShowBatchConfirmation, handleBatchConfirm, handleBatchGroup, handleBatchCancel, handleDeleteWantCancel,
    handleDeleteWantConfirm, handleShowDeleteConfirmation, handleDirectDeleteWant, handleDraftDelete, handleDeleteDraftConfirm, handleDeleteDraftCancel, handleReactionCancel, handleReactionConfirm,
    handleShowReactionConfirmation, handleSuspendWant, handleResumeWant, handleArchiveWant, handleUnarchiveWant, handleSaveRecipeFromWant, handleSaveRecipeSubmit, closeSaveRecipeModal,
    resetConfirmations, selectedWantRef, prevSelectedIdRef, selId, seriesWants, setSeriesWants, filteredWants, setFilteredWants,
    archiveOpen, setArchiveOpen, archivedNavWants, setArchivedNavWants, focusedSlotId, setFocusedSlotId, flattenedWants, hierarchicalWants,
    currentHierarchicalWant, correlationHighlights, headerState, setHeaderState, fetchLabels, toggled, handleToggleSelectMode, handleSelectWant,
    handleSelectThing, batchFocusIdx, setBatchFocusIdx, thingTiles, selectedBatchItems, handleBatchAddWant, setDetailsRequestedFor, detailsDismissed,
    setDetailsDismissed, detailsAskedFor, editingThing, consumeThingEdit, addingThing, setAddingThing, thingRecords, deleteThingRecord,
    handleAddWantFromThing, openCanvasDetailsRef, editingWant, setEditingWant, ownerWant, setOwnerWant, initialFormTypeId, setInitialFormTypeId,
    initialFormParams, initialFormImports, initialFormItemType, setInitialFormItemType, wantSeed, wantFormRef, handleCreateWant, handleEditWant,
    resetAddWantForm, focusWantInDashboard, lastSyncedStateRef, handleViewWant, handleBubbleChildClick, handleEnterBubble, handleViewAgents, handleViewResults,
    handleViewChat, handleDraftClick, handleMinimapClick, handleMinimapDoubleClick, handleMinimapDraftClick, pendingChatOpen, consumeChatOpenRequest, handleRecommendationDeploy,
    handleLabelClick, inputHandedOver, minimapFocused, handleRecommendationSelectFromSidebar, handleToggleExpand, handleCanvasTemplateDrop, handleTemplateDropped, handleUnparentWant,
    handleLabelDropped, handleWantDropped, isGlobalDragOver, handleGlobalDragEnter, handleGlobalDragOver, handleGlobalDragLeave, handleGlobalDrop, handleMaximizeChange,
    handleCloseModals,
  };
}
