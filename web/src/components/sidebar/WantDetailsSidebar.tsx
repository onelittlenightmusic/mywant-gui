import React, { useEffect, useLayoutEffect, useState, useCallback, useMemo, useRef } from 'react';
import { nativePanelPage, useHostCardSlot } from '@/lib/nativeHost';
import { useHeaderAtBottom } from '@/hooks/useDisplaySettings';
import { Settings, Eye, Database, Check, History, MessageSquare, ArrowDownUp } from 'lucide-react';
import { Want, WantExecutionStatus } from '@/types/want';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useWantStore } from '@/stores/wantStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useConfigStore } from '@/stores/configStore';
import { useSidebarFocusStore, focusSidebarCard } from '@/stores/sidebarFocusStore';
import { classNames } from '@/utils/helpers';
import { PanelIdentityRow } from './PanelIdentityRow';
import { stringifyYaml, validateYaml, validateYamlWithSpec, WantTypeDefinition } from '@/utils/yaml';
import { WantCardContent } from '@/components/dashboard/WantCardContent';
import { WantCard } from '@/components/dashboard/WantCard/WantCard';
import { SummarySidebarContent } from './SummarySidebarContent';
import { ConfirmationBubble } from '@/components/notifications';
import { apiClient } from '@/api/client';
import { Recommendation } from '@/types/interact';
import {
  DetailsSidebar,
  TabContent,
  TabSection,
  TabGrid,
  EmptyState,
  InfoRow,
  TabConfig
} from './DetailsSidebar';
import { useInputActions } from '@/hooks/useInputActions';
import { useCardGridNavigation } from '@/hooks/useCardGridNavigation';
import { useSSEEvent } from '@/hooks/useSSEEvent';
import { FormTab, FORM_TABS, SETTINGS_FORM_TABS } from '@/components/forms/FormTabBar';
import { SidebarTabBar } from '@/components/common/SidebarTabBar';
import { usePanelTabs } from '@/hooks/usePanelTabs';
import { playSound } from '@/utils/sounds';

import { TabType, RequestedTab, normalizeTab, HistorySubTab, HISTORY_SUB_TAB_LIST } from './want-details/shared';
import { WiringTab } from './want-details/WiringTab';
import { ChatTab } from './want-details/ChatTab';
import { SettingsTab } from './want-details/SettingsTab';
import { ResultsTab } from './want-details/ResultsTab';
import { HistoryTab } from './want-details/HistoryTab';
import { VersionsTab } from './want-details/VersionsTab';
// Re-exported for external consumers that used to import these directly
// from this file (WantCardContent, GlobalStateSidebar) — see want-details/.
export { NestedCard } from './want-details/NestedCard';
export { StateFieldCard } from './want-details/StateFieldCard';
export { JsonFieldCard } from './want-details/JsonFieldCard';

interface WantDetailsSidebarProps {
  want: Want | null;
  initialTab?: RequestedTab;
  initialTabVersion?: number;
  seriesWants?: Want[]; // All wants in the same series (for Versions tab)
  onRecommendationSelect?: (rec: Recommendation) => void;
  onWantUpdate?: () => void;
  onHeaderStateChange?: (state: { autoRefresh: boolean; loading: boolean; status: WantExecutionStatus }) => void;
  onRegisterHeaderActions?: (handlers: { handleRefresh: () => void; handleToggleAutoRefresh: () => void }) => void;
  onStart?: (want: Want) => void;
  onStop?: (want: Want) => void;
  onSuspend?: (want: Want) => void;
  onResume?: (want: Want) => void;
  onDelete?: (want: Want) => void;
  onSaveRecipe?: (want: Want) => void;
  onTabChange?: (tab: TabType) => void;
  /**
   * Dismiss the panel.
   *
   * The frame used to own the way out, in a header row that also repeated the
   * want's name and status under a card already showing both. The row is gone
   * (RightSidebar's `chromeless`), so the panel carries the close itself — on
   * the card, where the identity is.
   */
  onClose?: () => void;
  
  // Summary related props (added for non-want state)
  summaryProps?: {
    wants: Want[];
    loading: boolean;
    allLabels: Map<string, Set<string>>;
    onLabelClick: (key: string, value: string) => void;
    selectedLabel: { key: string; value: string } | null;
    onClearSelectedLabel: () => void;
    labelOwners: Want[];
    labelUsers: Want[];
    onViewWant: (want: Want) => void;
    fetchLabels: () => Promise<void>;
    fetchWants: () => Promise<void>;
  };
}

export const WantDetailsSidebar: React.FC<WantDetailsSidebarProps> = ({
  want,
  initialTab = 'settings',
  initialTabVersion = 0,
  onRecommendationSelect,
  onWantUpdate,
  onHeaderStateChange,
  onRegisterHeaderActions,
  onStart,
  onStop,
  onSuspend,
  onResume,
  onDelete,
  onSaveRecipe,
  onTabChange,
  onClose,
  summaryProps,
  seriesWants = [],
}) => {
  // Check if this is a flight want
  const isFlightWant = want?.metadata?.type === 'flight';

  const {
    wants: allWants,
    selectedWantDetails,
    selectedWantResults,
    fetchWantDetails,
    fetchWantResults,
    fetchWants,
    updateWant,
    loading
  } = useWantStore();

  // Identify if this want is a Target (can have children)
  const wantType = want?.metadata?.type?.toLowerCase() || '';
  const wantId = want?.metadata?.id || want?.id;
  const hasChildren = allWants.some(w =>
    w.metadata?.ownerReferences?.some(ref => ref.id === wantId)
  );
  const isTargetWant = wantType.includes('target') ||
                       wantType === 'owner' ||
                       wantType.includes('approval') ||
                       hasChildren;

  // Opening a want's detail panel counts as "I've seen it" — clear its unread
  // alert badge (tile / minimap), the same as opening the /w/<id> app.
  useEffect(() => {
    if (wantId) void useNotificationStore.getState().markRead(wantId);
  }, [wantId]);

  const [activeTab, setActiveTab] = useState<TabType>('settings');
  const [prevTabIndex, setPrevTabIndex] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showClearStateConfirmation, setShowClearStateConfirmation] = useState(false);
  const [editedConfig, setEditedConfig] = useState<string>('');
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Sub-tab state — all lifted here so the common sub-tab (B+L1/R1) handler can dispatch to
  // whichever tab is currently active.
  const [activeSettingsTab, setActiveSettingsTab] = useState<FormTab>('params');
  const [historySubTab, setHistorySubTab] = useState<HistorySubTab>('state');

  // Pending key for pre-populating expose/import add form when navigating from result cards
  const [pendingExposeKey, setPendingExposeKey] = useState<string | null>(null);
  const [pendingImportKey, setPendingImportKey] = useState<string | null>(null);

  // Global state keys for ImportTab datalist
  const [sidebarGlobalStateKeys, setSidebarGlobalStateKeys] = useState<string[]>([]);
  useEffect(() => {
    fetch('/api/v1/global-state')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.state) setSidebarGlobalStateKeys(Object.keys(data.state)); })
      .catch(() => {});
  }, []);

  // Tracks whether the user has explicitly entered "detail-focus mode" for the
  // sidebar content (L1/R1 or B+L1/R1 press, or parameter card click).
  // In detail-focus mode, arrow keys navigate parameter cards.
  // In want-focus mode (false), arrow keys navigate between want cards/tiles.
  // Lives in a store rather than here: the canvas needs to know whether focus
  // has been taken (to stop offering it) and RightSidebar needs to know to draw
  // the frame. See sidebarFocusStore.
  const sidebarDetailFocused = useSidebarFocusStore(s => s.focused);
  const setSidebarDetailFocused = useSidebarFocusStore(s => s.setFocused);

  // Counter that increments on every L1/R1 / B+L1/R1 tab switch, and when the
  // canvas hands focus over. useCardGridNavigation watches this via
  // focusRequest and auto-focuses the first card (or AddCard if empty)
  // whenever it changes.
  const sidebarFocusRequest = useSidebarFocusStore(s => s.request);

  /**
   * Which half of the sidebar the arrows are steering: its card, or the field
   * cards below.
   *
   * Without this there is no way to land on the card at all. A field grid
   * activates itself the moment the sidebar is focused (StateSectionCards'
   * effect on isActive) and immediately takes DOM focus, so focus arrived and
   * was gone in the same beat. Gating the grids on the region lets focus rest
   * on the card first; an arrow key hands it down.
   */
  const [detailRegion, setDetailRegion] = useState<'card' | 'fields'>('card');
  /** What the tabs get: focused, but only once the arrows have gone down. */
  const fieldsFocused = sidebarDetailFocused && detailRegion === 'fields';
  /** The card is the top of the walk, whichever tab is showing below it. */
  const cardFocused = sidebarDetailFocused && detailRegion === 'card';
  // Leaving the sidebar entirely, or changing want, starts back at the card.
  useEffect(() => { if (!sidebarDetailFocused) setDetailRegion('card'); }, [sidebarDetailFocused]);
  const setSidebarFocusRequest = useSidebarFocusStore(s => s.bumpRequest);

  /**
   * The embedded card, blown up — the same double Enter / double A that
   * maximises a card on the board, so the gesture means one thing in both
   * places. WantCard already knows how to expand; it only needs telling which
   * card is maximised, exactly as the dashboard tells it.
   *
   * The gesture is bound by the card itself, alongside the other thing a press
   * there can mean (going into the want's controls). Two hooks each with their
   * own double-press timer could not tell those apart — whichever acted on the
   * first press won every time. This side just follows what the card reports
   * through onMaximizeChange.
   */
  const [cardMaximized, setCardMaximized] = useState(false);
  // Walking down into the tab puts it back down: a card left maximised would
  // cover the very rows the arrows just moved to.
  //
  // The region, not focus. A blown-up card is a portal at the document root
  // rather than inside the sidebar, so touching it at all — clicking it,
  // dragging across a line to copy it — reads as focus leaving the sidebar.
  // Hanging the collapse off that closed the card on mousedown, before the
  // click had even landed, so it shut on every attempt to use it and did so
  // through a path that looks nothing like closing a card. Walking down to the
  // fields is a real reason to put it away; operating it is not.
  useEffect(() => { if (detailRegion !== 'card') setCardMaximized(false); }, [detailRegion]);

  // Ref for keyboard tab-switching handler — updated each render after tabs/handleTabChange are computed.

  // Memoize handlers to prevent recreation on every render
  const handleRefresh = useCallback(() => {
    if (want) {
      const wantId = want.metadata?.id || want.id;
      if (wantId) {
        fetchWantDetails(wantId);
        fetchWantResults(wantId);
        fetchWants();
      }
    }
  }, [want, fetchWantDetails, fetchWantResults, fetchWants]);

  const handleToggleAutoRefresh = useCallback(() => {
    setAutoRefresh(prev => !prev);
  }, []);

  const wantDetails = selectedWantDetails || want;

  const handleClearState = async () => {
    if (!wantId) return;
    try {
      await apiClient.clearWantState(wantId);
      await fetchWantDetails(wantId);
    } catch (e) {
      console.error('Failed to clear want state:', e);
    } finally {
      setShowClearStateConfirmation(false);
    }
  };

  // Reset sub-tabs and detail-focus mode when the selected want changes.
  // New want → back to want-focus mode (arrow keys navigate wants again).
  //
  // Deliberately NOT on first mount. The sidebar can be opened by an explicit
  // "open details" press on the canvas, which asks for focus in the same beat;
  // a mount-time reset would land after that ask and throw it away, so the
  // press would open the sidebar and then bounce you straight back out of it.
  const prevWantIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    setActiveSettingsTab('params');
    setHistorySubTab('state');
    if (prevWantIdRef.current !== undefined && prevWantIdRef.current !== wantId) {
      setSidebarDetailFocused(false);
    }
    prevWantIdRef.current = wantId;
  }, [wantId]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for robot:settings-subtab event (CLI / RobotStateManager)
  useEffect(() => {
    const handler = (e: Event) => {
      const subtab = (e as CustomEvent<{ subtab: string }>).detail?.subtab as FormTab;
      if (subtab && FORM_TABS.includes(subtab)) {
        setActiveSettingsTab(subtab);
      }
    };
    window.addEventListener('robot:settings-subtab', handler);
    return () => window.removeEventListener('robot:settings-subtab', handler);
  }, []);

  // Fetch details when want ID changes (not on every want object change)
  useEffect(() => {
    if (wantId) {
      fetchWantDetails(wantId);
      fetchWantResults(wantId);
    }
  }, [wantId, fetchWantDetails, fetchWantResults]);

  // Reset state when initialTab prop changes (from parent handling onViewResults)
  // initialTabVersion ensures the effect fires even when the tab value is the same
  // wantId is included so that when a new want is selected with a specific initialTab, it applies correctly
  useEffect(() => {
    if (want) {
      setIsEditing(false);
      setUpdateError(null);
      setActiveTab(normalizeTab(initialTab));
    }
  }, [initialTab, initialTabVersion, wantId]);

  // The tab now follows the user from want to want, and two of them are not on
  // every want: Versions only exists for a series, Chat only for an interactive
  // want (see the `tabs` list below). Carrying one onto a want that has neither
  // would leave the panel on a tab with no button and nothing under it, so fall
  // back to Results. Gated on THIS want's details having arrived: while the fetch
  // is still out, selectedWantDetails is still the previous want's, and
  // `interactive` read off it would bounce Chat off a want that does have it.
  useEffect(() => {
    const detailsId = selectedWantDetails?.metadata?.id || selectedWantDetails?.id;
    if (!detailsId || detailsId !== wantId) return;
    if (activeTab === 'versions' && seriesWants.length <= 1) setActiveTab('results');
    if (activeTab === 'chat' && selectedWantDetails?.state?.current?.interactive !== true) setActiveTab('results');
  }, [activeTab, seriesWants.length, selectedWantDetails, wantId]);

  // SSE push: immediately refetch when this want is changed from another tab/browser.
  // This replaces the old autoRefresh polling interval — SSE delivers changes in real time,
  // so a periodic poll just produces redundant 304s.
  useSSEEvent<string[]>('want_changed', (ids) => {
    if (!wantId) return;
    // Empty ids = broadcast (e.g. batch delete) → always refresh.
    if (ids.length === 0 || ids.includes(wantId)) {
      // 削除で飛んでくる want_changed もあるので、すでに一覧から消えていれば
      // 取りに行かない（行くと必ず 404 になる）。
      const stillExists = useWantStore.getState().wants
        .some(w => (w.metadata?.id || w.id) === wantId);
      if (!stillExists) return;
      fetchWantDetails(wantId).then(({ updated }) => {
        if (updated) fetchWantResults(wantId);
      });
    }
  });

  // Register header action handlers with the sidebar
  useEffect(() => {
    if (onRegisterHeaderActions) {
      onRegisterHeaderActions({
        handleRefresh,
        handleToggleAutoRefresh
      });
    }
  }, [onRegisterHeaderActions, handleRefresh, handleToggleAutoRefresh]);

  const handleEditConfig = () => {
    if (selectedWantDetails) {
      const yamlContent = stringifyYaml({
        metadata: selectedWantDetails.metadata,
        spec: selectedWantDetails.spec
      });
      setEditedConfig(yamlContent);
      setIsEditing(true);
    }
  };

  const handleSaveConfig = async () => {
    if (!want || !editedConfig || !selectedWantDetails) return;

    const wantId = want.metadata?.id || want.id;
    if (!wantId) return;

    setUpdateLoading(true);
    setUpdateError(null);

    try {
      // Get the want type
      const wantType = selectedWantDetails.metadata?.type;
      if (!wantType) {
        setUpdateError('Cannot determine want type');
        setUpdateLoading(false);
        return;
      }

      // Fetch want type specification from backend
      const specResponse = await fetch(`/api/v1/want-types/${wantType}`);
      let spec: WantTypeDefinition | undefined;

      if (specResponse.ok) {
        spec = await specResponse.json();
      }

      // Validate YAML against spec (or just basic validation if spec not available)
      const yamlValidation = spec
        ? validateYamlWithSpec(editedConfig, wantType, spec)
        : validateYaml(editedConfig);

      if (!yamlValidation.isValid) {
        setUpdateError(yamlValidation.error || 'Invalid YAML');
        setUpdateLoading(false);
        return;
      }

      // Use parsed YAML as update request
      const updateRequest = yamlValidation.data;
      await updateWant(wantId, updateRequest);
      setIsEditing(false);
      // Refresh details after update
      await fetchWantDetails(wantId);
      await fetchWants();
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : 'Failed to update want');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedConfig('');
    setUpdateError(null);
  };

  // Memoize header state to only trigger when values actually change (not object reference)
  const headerState = useMemo(() => ({
    autoRefresh,
    loading,
    status: (selectedWantDetails?.status || want?.status || 'created') as WantExecutionStatus
  }), [autoRefresh, loading, selectedWantDetails?.status, want?.status]);

  // Notify parent of header state changes - must be before early return to keep hook order consistent
  // Only depends on memoized state object, not on want/selectedWantDetails objects
  useEffect(() => {
    if (want) {
      onHeaderStateChange?.(headerState);
    }
  }, [want, headerState, onHeaderStateChange]);

  // Trigger animation when want changes (new want selected)
  // Note: Don't set activeTab here - let the initialTab effect handle it
  // This ensures initialTab prop takes precedence over wantId changes
  useEffect(() => {
    if (wantId) {
      setIsInitialLoad(true);
      setPrevTabIndex(-1); // Force animation on initial load
    }
  }, [wantId]);

  // Must be before early return to keep hook order consistent
  const config = useConfigStore(state => state.config);
  const isBottom = useHeaderAtBottom();

  // Ref used by the gamepad hook below to access tabs/index defined after the
  // early return, without violating Rules of Hooks.
  /** This panel's own element — what Tab counts as "inside" (see usePanelTabs). */
  const panelRootRef = useRef<HTMLDivElement>(null);
  const gamepadTabRef = useRef<{
    tabs: Array<{ id: string }>;
    currentTabIndex: number;
    handleTabChange: (id: string) => void;
  } | null>(null);

  // L1/R1 and Tab — the walk along the tab bar, shared with every other detail
  // panel (see usePanelTabs). The tabs are computed below the early return, so
  // they are read through the ref that already exists for that reason.
  usePanelTabs({
    tabs: () => gamepadTabRef.current?.tabs ?? [],
    activeTab: () => activeTab,
    onTabChange: (id) => gamepadTabRef.current?.handleTabChange(id),
    enabled: !!want,
    scope: () => panelRootRef.current,
    focus: {
      hasFocus: () => sidebarDetailFocused,
      takeFocus: () => {
        setSidebarDetailFocused(true);
        setDetailRegion('fields');
        setSidebarFocusRequest();
      },
      afterChange: () => setSidebarFocusRequest(),
    },
  });

  // B + L1/R1 cycles the sub-tabs inside the active tab — this panel's own,
  // since it is the only one with any. (It was the L2/R2 triggers until R2
  // became Z mode's button; see useInputActions' gamepad mapping.)
  useInputActions({
    gamepadOnly: true,
    ignoreWhenInputFocused: false,
    ignoreWhenInSidebar: false,
    enabled: !!want,
    onSubTabForward: () => {
      if (activeTab === 'settings') {
        setActiveSettingsTab(t => SETTINGS_FORM_TABS[(SETTINGS_FORM_TABS.indexOf(t) + 1) % SETTINGS_FORM_TABS.length]);
      } else if (activeTab === 'history') {
        setHistorySubTab(t => HISTORY_SUB_TAB_LIST[(HISTORY_SUB_TAB_LIST.indexOf(t) + 1) % HISTORY_SUB_TAB_LIST.length]);
      }
      setSidebarDetailFocused(true);
      setDetailRegion('fields');
      setSidebarFocusRequest();
    },
    onSubTabBackward: () => {
      if (activeTab === 'settings') {
        setActiveSettingsTab(t => SETTINGS_FORM_TABS[(SETTINGS_FORM_TABS.indexOf(t) - 1 + SETTINGS_FORM_TABS.length) % SETTINGS_FORM_TABS.length]);
      } else if (activeTab === 'history') {
        setHistorySubTab(t => HISTORY_SUB_TAB_LIST[(HISTORY_SUB_TAB_LIST.indexOf(t) - 1 + HISTORY_SUB_TAB_LIST.length) % HISTORY_SUB_TAB_LIST.length]);
      }
      setSidebarDetailFocused(true);
      setDetailRegion('fields');
      setSidebarFocusRequest();
    },
  });

  if (!want) {
    if (summaryProps) {
      return (
        <div className="px-4 py-8">
          <SummarySidebarContent {...summaryProps} />
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Eye className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Select a want to view details</p>
        </div>
      </div>
    );
  }

  const hasMultipleVersions = seriesWants.length > 1;
  const isInteractiveWant = wantDetails?.state?.current?.interactive === true;

  const SYSTEM_STATE_KEYS = new Set(['proposed_recommendations', 'proposed_breakdown', 'proposed_response', 'recommendations', 'interactive']);
  const resultsBadge = (
    Object.keys(wantDetails?.state?.current ?? {}).filter(k => !SYSTEM_STATE_KEYS.has(k)).length +
    Object.keys(wantDetails?.state?.goal ?? {}).length +
    Object.keys(wantDetails?.state?.plan ?? {}).length
  ) || null;
  const exposeBadge = wantDetails?.spec?.exposes?.filter(e => e.currentState && (e.as || e.asGoal || e.asGlobalParam)).length || null;
  const importBadge = Object.keys(wantDetails?.spec?.imports ?? {}).length || null;

  const tabs = [
    { id: 'settings' as TabType, label: 'Settings', icon: Settings },
    { id: 'results' as TabType, label: 'Results', icon: Database, badge: resultsBadge },
    // One tab, because it is one story: what comes in, and what goes out.
    { id: 'wiring' as TabType, label: 'Wiring', icon: ArrowDownUp,
      badge: (importBadge ?? 0) + (exposeBadge ?? 0) || null },
    { id: 'history' as TabType, label: 'History', icon: History },
    ...(hasMultipleVersions ? [{ id: 'versions' as TabType, label: 'Versions', icon: History }] : []),
    ...(isInteractiveWant ? [{ id: 'chat' as TabType, label: 'Chat', icon: MessageSquare }] : []),
  ];

  // Get current tab index
  const currentTabIndex = tabs.findIndex(t => t.id === activeTab);

  // Handle tab change with animation direction
  const handleTabChange = (tabId: TabType) => {
    setPrevTabIndex(currentTabIndex);
    setActiveTab(tabId);
    // Tell the parent, or the tab the user picked is known only in here.
    // Dashboard's sidebarInitialTab is what gets re-applied whenever the panel
    // re-opens on a want (landing on a tile, a click, a poll from another tab),
    // and it is also what gets persisted as sidebar_active_tab. Without this it
    // stayed frozen at 'results', so every landing snapped the panel back to
    // Results however far the user had walked away from it.
    onTabChange?.(tabId);
  };

  // Determine animation direction (true = moving right/forward, false = moving left/backward)
  const isMovingRight = currentTabIndex > prevTabIndex;

  // Get previous tab ID for simultaneous animation
  const prevTabId = tabs[prevTabIndex]?.id;
  const showPrevTab = prevTabId && prevTabId !== activeTab && prevTabIndex >= 0;

  // Keep refs up-to-date with current render values.
  gamepadTabRef.current = { tabs, currentTabIndex, handleTabChange };

  return (
    <>
    {/* onFocus bubbles up from any child: Tab-navigating into the sidebar (or
        clicking any focusable element inside it) enters detail-focus mode —
        same behaviour as gamepad L1/R1 or B+L1/R1. */}
    <div className="h-full flex flex-col relative overflow-hidden" ref={panelRootRef} onFocus={() => setSidebarDetailFocused(true)}>
      {/* Content container */}
      <div className="h-full flex flex-col relative z-10">
      {/**
        * The want's own card, above the tabs and standing on every one of them.
        *
        * It used to live inside the Results tab, scrolling with that tab's
        * fields and disappearing entirely on the other six — which made the
        * panel about a different thing depending on which tab you were on, and
        * left the walk with no top rung anywhere but Results. Every other
        * detail panel in the app already puts its card here (see
        * DetailsSidebar, and WantTypeDetailsSidebar / RecipeDetailsSidebar
        * which spell out the same three rows); this one was the exception.
        *
        * order-first alongside the tab body below: when the sheet docks to the
        * bottom the body is re-ordered above the tab bar, and a card left in
        * plain DOM order would sink beneath it. Both being order-first keeps
        * their relative order while lifting the pair over the bar.
        */}
      <div className={classNames('flex-shrink-0 px-3 pt-3', isBottom ? 'order-first' : '')}>
        {/* Who this is, on the card that is already showing it — see
            PanelIdentityRow, which the thing panel wears too. */}
        {wantDetails && (
          <PanelIdentityRow
            title={wantDetails.metadata?.name || wantDetails.metadata?.id || ''}
            onClose={onClose}
          />
        )}
        <div className="h-40 sm:h-44">
        {/* Where focus lands when the sidebar is handed the keys, and the step
            the arrows leave from. tabIndex -1 so it can be focused
            programmatically without joining the Tab order. The ring is the
            same sky ring every other focused surface uses, so "you are here"
            reads the same in the sidebar as on the board. */}
        <div
          data-sidebar-primary="true"
          tabIndex={-1}
          onKeyDown={(e) => {
            // Down/Right step into whatever tab is showing. Up/Left are left
            // alone: the card is the top of the walk, so there is nowhere
            // above it.
            if (!['ArrowDown', 'ArrowRight'].includes(e.key)) return;
            // Hand the arrows down. The grids activate on the region change
            // and focus their first card themselves, so this only has to say
            // where the keys go next.
            e.preventDefault();
            e.stopPropagation();
            // A step like any other — this one just happens to cross from the
            // panel's card into its body. It was the last silent rung.
            playSound('gridMove');
            setDetailRegion('fields');
            setSidebarFocusRequest();
          }}
          className="relative h-full rounded-xl outline-none"
        >
          {/* In an app's sheet the card is the app's native card frame, put
              over the room left here for it (useHostCardSlot). */}
          {nativePanelPage ? (
            <HostCardSlot id={wantDetails.metadata?.id || wantDetails.id || ''} />
          ) : (
          <WantCard
            want={wantDetails}
            // NOT selected: the quick-action overlay opens on right-click (or
            // long-press) regardless — it keys off the want id, not the
            // selection — while `selected` would switch on this card's
            // keyboard handlers and have it fight the board's card for the
            // same keys. The handlers below are the sidebar's own, so an
            // action taken here does what the sidebar's buttons would.
            selected={false}
            // The board has no grid card, and in the list Enter only ever
            // hands the keys over to here — so this copy is the only place the
            // want's controls are ever reached.
            innerFocusScope="sidebar"
            // The second Enter. The first one brought focus into the panel and
            // onto this card; pressing again goes further in, to the slider or
            // the agent's box. The card itself decides whether it has anything
            // to go into.
            confirmEntersInnerFocus={cardFocused}
            maximizedWantId={cardMaximized ? (wantDetails.metadata?.id || wantDetails.id) : null}
            onMaximizeChange={(id) => setCardMaximized(!!id)}
            onView={() => {}}
            onEdit={() => {}}
            onDelete={() => onDelete?.(wantDetails)}
            onSuspend={() => onSuspend?.(wantDetails)}
            onResume={() => onResume?.(wantDetails)}
            index={0}
            className="h-full w-full"
          />
          )}

          {/* The highlight, on its own layer over the card.
              As a box-shadow on the wrapper it was invisible: the card fills
              the wrapper and paints its own background above the wrapper's
              decoration, and an outward shadow is clipped by the scrolling
              section around it. Drawn here as an inset ring it sits above the
              card and cannot be clipped — the same fix the sidebar's own frame
              needed, for the same reason.

              The glow the rest of the app uses, not a hard band: the keys being
              here is the same statement a pointer makes by hovering a card and
              a character makes by standing on one, and it should not be a third
              picture. See .mw-card-focus-strong. */}
          {cardFocused && (
            <div className="absolute inset-0 pointer-events-none rounded-xl mw-card-focus-strong" />
          )}
        </div>
        </div>
      </div>

      {/* Tab navigation */}
      <SidebarTabBar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        isBottom={isBottom}
      />

      {/* Clear State confirmation overlay */}
      <ConfirmationBubble
        isVisible={showClearStateConfirmation}
        onConfirm={handleClearState}
        onCancel={() => setShowClearStateConfirmation(false)}
        onDismiss={() => setShowClearStateConfirmation(false)}
        title="Clear State"
        message="Clear all state data? This cannot be undone."
        layout="header-overlay"
      />

      {/* Tab content */}
      <div className={classNames('flex-1 min-h-0 overflow-hidden relative', isBottom ? 'order-first' : '')}>
        {loading && !selectedWantDetails ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <>
            {/* Previous tab - animate out */}
            {showPrevTab && prevTabId === 'settings' && (
              <div className={classNames('absolute inset-0 overflow-y-auto pointer-events-none', isMovingRight ? 'animate-slide-out-left' : 'animate-slide-out-right')}>
                <SettingsTab
                  want={wantDetails}
                  isEditing={isEditing}
                  editedConfig={editedConfig}
                  updateLoading={updateLoading}
                  updateError={updateError}
                  onEdit={handleEditConfig}
                  onSave={handleSaveConfig}
                  onCancel={handleCancelEdit}
                  onConfigChange={setEditedConfig}
                  onWantUpdate={() => {
                    const wantId = want.metadata?.id || want.id;
                    if (wantId) {
                      fetchWantDetails(wantId);
                      fetchWants();
                    }
                  }}
                  updateWant={updateWant}
                  activeSettingsTab={activeSettingsTab}
                  setActiveSettingsTab={setActiveSettingsTab}
                  sidebarDetailFocused={fieldsFocused}
                  focusRequest={sidebarFocusRequest}
                  onDetailFocusEnter={() => setSidebarDetailFocused(true)}
                />
              </div>
            )}
            {showPrevTab && prevTabId === 'results' && (
              <div className={classNames('absolute inset-0 overflow-y-auto pointer-events-none', isMovingRight ? 'animate-slide-out-left' : 'animate-slide-out-right')}>
                <ResultsTab want={wantDetails} onRecommendationSelect={onRecommendationSelect} onClearState={() => setShowClearStateConfirmation(true)} sidebarDetailFocused={false} />
              </div>
            )}
            {showPrevTab && prevTabId === 'wiring' && (
              <div className={classNames('absolute inset-0 pointer-events-none', isMovingRight ? 'animate-slide-out-left' : 'animate-slide-out-right')}>
                <WiringTab want={wantDetails} updateWant={updateWant} onWantUpdate={onWantUpdate} sidebarDetailFocused={false} />
              </div>
            )}
            {showPrevTab && prevTabId === 'history' && (
              <div className={classNames('absolute inset-0 overflow-hidden pointer-events-none', isMovingRight ? 'animate-slide-out-left' : 'animate-slide-out-right')}>
                <HistoryTab want={wantDetails} results={selectedWantResults} historySubTab={historySubTab} setHistorySubTab={setHistorySubTab} />
              </div>
            )}
            {showPrevTab && prevTabId === 'versions' && (
              <div className={classNames('absolute inset-0 overflow-y-auto pointer-events-none', isMovingRight ? 'animate-slide-out-left' : 'animate-slide-out-right')}>
                <VersionsTab seriesWants={seriesWants} currentWantId={wantId} />
              </div>
            )}
            {showPrevTab && prevTabId === 'chat' && (
              <div className={classNames('absolute inset-0 overflow-hidden pointer-events-none', isMovingRight ? 'animate-slide-out-left' : 'animate-slide-out-right')}>
                <ChatTab want={wantDetails} />
              </div>
            )}

            {/* Current tab - animate in */}
            {activeTab === 'settings' && (
              <div className={classNames('relative z-10 h-full', isMovingRight ? 'animate-slide-in-right' : 'animate-slide-in-left')}>
                <SettingsTab
                  want={wantDetails}
                  isEditing={isEditing}
                  editedConfig={editedConfig}
                  updateLoading={updateLoading}
                  updateError={updateError}
                  onEdit={handleEditConfig}
                  onSave={handleSaveConfig}
                  onCancel={handleCancelEdit}
                  onConfigChange={setEditedConfig}
                  onWantUpdate={() => {
                    const wantId = want.metadata?.id || want.id;
                    if (wantId) {
                      fetchWantDetails(wantId);
                      fetchWants();
                    }
                  }}
                  updateWant={updateWant}
                  activeSettingsTab={activeSettingsTab}
                  setActiveSettingsTab={setActiveSettingsTab}
                  sidebarDetailFocused={fieldsFocused}
                  focusRequest={sidebarFocusRequest}
                  onDetailFocusEnter={() => setSidebarDetailFocused(true)}
                />
              </div>
            )}

            {activeTab === 'results' && (
              <div className={classNames('absolute inset-0 overflow-hidden z-10', isMovingRight ? 'animate-slide-in-right' : 'animate-slide-in-left')}>
                <ResultsTab
                  want={wantDetails}
                  onBackToCard={() => { setDetailRegion('card'); focusSidebarCard(); }}
                  // No focus request and no tick: the click has already put the
                  // ring where the user pointed, and asking would move it to the
                  // first card instead. This only says which half of the panel
                  // the keys are in now.
                  onFieldFocused={() => setDetailRegion('fields')}
                  onRecommendationSelect={onRecommendationSelect}
                  onClearState={() => setShowClearStateConfirmation(true)}
                  onWantUpdate={() => {
                    const wantId = want.metadata?.id || want.id;
                    if (wantId) { fetchWantDetails(wantId); fetchWants(); }
                    onWantUpdate?.();
                  }}
                  onGoToExpose={(key) => {
                    if (key) setPendingExposeKey(key);
                    handleTabChange('wiring');
                  }}
                  onGoToImport={(key) => {
                    if (key) setPendingImportKey(key);
                    handleTabChange('wiring');
                  }}
                  sidebarDetailFocused={fieldsFocused}
                />
              </div>
            )}

            {activeTab === 'wiring' && (
              <div className={classNames('absolute inset-0 overflow-hidden z-10', isMovingRight ? 'animate-slide-in-right' : 'animate-slide-in-left')}>
                <WiringTab
                  want={wantDetails}
                  updateWant={updateWant}
                  onWantUpdate={() => {
                    const wantId = want.metadata?.id || want.id;
                    if (wantId) { fetchWantDetails(wantId); fetchWants(); }
                    onWantUpdate?.();
                  }}
                  globalStateKeys={sidebarGlobalStateKeys}
                  initialImportKey={pendingImportKey}
                  onImportKeyConsumed={() => setPendingImportKey(null)}
                  initialExposeKey={pendingExposeKey}
                  onExposeKeyConsumed={() => setPendingExposeKey(null)}
                  sidebarDetailFocused={fieldsFocused}
                  focusRequest={sidebarFocusRequest}
                />
              </div>
            )}

            {activeTab === 'history' && (
              <div className={classNames('absolute inset-0 overflow-hidden z-10', isMovingRight ? 'animate-slide-in-right' : 'animate-slide-in-left')}>
                <HistoryTab want={wantDetails} results={selectedWantResults} historySubTab={historySubTab} setHistorySubTab={setHistorySubTab} />
              </div>
            )}

            {activeTab === 'versions' && (
              <div className={classNames('absolute inset-0 overflow-y-auto z-10', isMovingRight ? 'animate-slide-in-right' : 'animate-slide-in-left')}>
                <VersionsTab seriesWants={seriesWants} currentWantId={wantId} />
              </div>
            )}

            {activeTab === 'chat' && (
              <div className={classNames('relative z-10 h-full', isMovingRight ? 'animate-slide-in-right' : 'animate-slide-in-left')}>
                <ChatTab want={wantDetails} />
              </div>
            )}
          </>
        )}
      </div>
      </div>
    </div>

    </>
  );
};

/** The room an app's native card frame is put over (see useHostCardSlot). */
const HostCardSlot: React.FC<{ id: string }> = ({ id }) => {
  const ref = useHostCardSlot('want', id);
  return <div ref={ref} className="h-full w-full rounded-xl" />;
};
