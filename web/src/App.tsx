import React, { useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { WantListPage } from '@/pages/list/WantListPage';
import { WantAppPage } from '@/pages/WantAppPage';
import { LogsPage } from '@/pages/ErrorHistoryPage';
import { AgentsPage } from '@/pages/AgentsPage';
import RecipePage from '@/pages/RecipePage';
import WantTypePage from '@/pages/WantTypePage';
import WorldsPage from '@/pages/WorldsPage';
import { AchievementsPage } from '@/pages/AchievementsPage';
import DevicesPage from '@/pages/DevicesPage';
import CharactersPage from '@/pages/CharactersPage';
import { ThingPage } from '@/pages/ThingPage';
import { useConfigStore } from '@/stores/configStore';
import { useWantTypeStore } from '@/stores/wantTypeStore';
import { useCharacterStore } from '@/stores/characterStore';
import { useThingStore } from '@/stores/thingStore';
import { Layout } from '@/components/layout/Layout';
import { RouteTransition } from '@/components/layout/RouteTransition';
import { FocusRingColor } from '@/components/common/FocusRingColor';
import { GlobalFreeCursor } from '@/components/common/GlobalFreeCursor';
import { useAppIdentity } from '@/lib/appIdentity';
import { useDeviceSession, myDeviceId, myDeviceName } from '@/hooks/useDeviceSession';
import { useLocationSender } from '@/hooks/useLocationSender';
import { usePendingDeviceActionsWatcher } from '@/hooks/usePendingDeviceActions';
import { apiClient } from '@/api/client';
import { useWantStore } from '@/stores/wantStore';
import { startNotificationPolling } from '@/stores/notificationStore';
import { registerServiceWorker } from '@/lib/push';
import { useSSEEvent } from '@/hooks/useSSEEvent';
import { useCodingAgentRing } from '@/hooks/useCodingAgentRing';
import { useIntersectionEffects } from '@/hooks/useIntersectionEffects';
import { NoticeToast } from '@/components/common/NoticeToast';
import { Slot } from '@/extensions/Slot';
import { extensionRoutes, extensionBareRoutes, extensionPluginEndpoints, useExtensionHooks } from '@/extensions/registry';

function DeviceManager() {
  useDeviceSession();
  usePendingDeviceActionsWatcher();
  const activeRef = useRef(false);
  const [isActive, setIsActive] = React.useState(false);
  const locationWantIds = useWantStore(s =>
    s.wants
      .filter(w => w.metadata?.type === 'location')
      .map(w => w.metadata.id!)
      .filter(Boolean)
      .join(',')
  );
  const locationWantIdsArray = React.useMemo(
    () => locationWantIds ? locationWantIds.split(',') : [],
    [locationWantIds]
  );
  const fetchWants = useWantStore(s => s.fetchWants);

  // The want store is only populated by the Dashboard's polling. When this
  // device is the active location sender but no location wants are loaded —
  // e.g. the browser was reloaded on /devices or any non-Dashboard route —
  // fetch wants here so geolocation sending resumes without having to open the
  // Dashboard first. Guarded by length so it runs once per activation, not in a
  // loop (an install with zero location wants leaves the deps unchanged).
  useEffect(() => {
    if (isActive && locationWantIdsArray.length === 0) {
      fetchWants().catch(() => {});
    }
  }, [isActive, locationWantIdsArray.length, fetchWants]);

  const applyActive = (state: Record<string, unknown>) => {
    const active = String(state.activeLocationDevice ?? '') === myDeviceId;
    if (active !== activeRef.current) {
      activeRef.current = active;
      setIsActive(active);
    }
  };

  // Initial fetch to catch the current activeLocationDevice before the SSE
  // connection opens, then live-update via the same 'gui_state' push
  // RobotStateManager uses — no more polling GET /gui/state every 2s.
  useEffect(() => {
    apiClient.getGUIState()
      .then(({ state }) => applyActive(state as Record<string, unknown>))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useSSEEvent<{ seq: number; state: Record<string, unknown> }>('gui_state', (data) => {
    applyActive(data.state);
  });

  useLocationSender(isActive, myDeviceName, locationWantIdsArray);
  return null;
}

async function loadExternalModules(endpoint: string) {
  try {
    const res = await fetch(endpoint)
    if (!res.ok) return
    const urls: string[] = await res.json()
    await Promise.allSettled(urls.map(url => import(/* @vite-ignore */ url)))
  } catch {
    // External modules unavailable — continue without them
  }
}

async function loadExternalPlugins() {
  // Everything a custom can add to the UI, all self-registering via
  // window.__mywant.* on import:
  //   /plugins          card views       ~/.mywant/custom-types/<id>/view
  //   /design-plugins   design customs   ~/.mywant/design-plugin/<id>/plugin.*
  // and whatever an extension accepts besides (the canvas: board forms — see
  // its pluginEndpoints). Loaded together and unordered — each registers under
  // its own id, and ESM resolves any imports between them.
  //
  // Design customs are the app's own to load, not an extension's: an overlay
  // design (registerOverlayDesign) is drawn in this app's header pill and every
  // overlay, with or without the canvas. A design custom written for the canvas
  // alone (registerDesign) fails to register without it, and only it — each
  // module is imported on its own.
  const endpoints = new Set(['/api/v1/plugins', '/api/v1/design-plugins', ...extensionPluginEndpoints()]);
  await Promise.allSettled([...endpoints].map(loadExternalModules))
}

function App() {
  const fetchConfig = useConfigStore(state => state.fetchConfig);
  const fetchWantTypes = useWantTypeStore(state => state.fetchWantTypes);
  const fetchCharacters = useCharacterStore(state => state.fetchCharacters);
  // The tab: this server's name and this person's character — see appIdentity.
  useAppIdentity();

  useEffect(() => {
    fetchConfig();
    fetchWantTypes();
    fetchCharacters();
    loadExternalPlugins();
    startNotificationPolling();
    void registerServiceWorker();
  }, [fetchConfig, fetchWantTypes, fetchCharacters]);

  // Live cross-tab/cross-device sync: a character created, edited, or deleted
  // in any session (e.g. adding a new player) refreshes this tab's character
  // store immediately, so aura colors and dog-ear flags stay correct for
  // dynamically-added characters without needing a reload.
  useSSEEvent('character_changed', () => { fetchCharacters(); });

  // A coding agent handing the turn back is the one event worth interrupting
  // somebody for, and it can happen on any page — so the bell is hung at the
  // root rather than on whichever screen the agent's card is showing.
  useCodingAgentRing();

  // What extensions keep running at the root — the robot's bubble, the speech
  // column's record, the board's moving things. See extensions/registry.
  useExtensionHooks('appHooks');

  // Things belong to the world they were entered in, so switching worlds
  // replaces the whole set — see world_things.go. Nothing about any individual
  // thing changed; the question did, and a tab already holding the old world's
  // answer has no other way to find that out. Bound here, at the root, because
  // a world can be opened from the Worlds page, from a world card on the
  // canvas, or from outside this tab entirely.
  useSSEEvent('thing_changed', () => { void useThingStore.getState().fetchThings(); });

  // What the server decided a shared cell meant, shown. A thing that slid into
  // a bin on its own was archived in silence — the board only ever animated the
  // disposals it had performed itself.
  useIntersectionEffects();

  return (
    <ErrorBoundary>
      <Router>
        {/* The character's colour, as a CSS variable every focus ring reads —
            renders nothing */}
        <FocusRingColor />
        {/* Device session + location sender + pending action watcher — renders nothing */}
        <DeviceManager />
        {/* Whatever extensions mount at the root — the robot's cursor, the
            speech column, the tab-hop picker. See extensions/registry. */}
        <Slot name="appRoot" />
        {/* A notice nobody else has taken the job of showing — see noticeStore. */}
        <NoticeToast />
        {/* Single app-wide free-roaming cursor for list/grid pages (want list,
            sidebars, agents/want-types/recipes, ...) — see useGlobalFreeCursor. */}
        <GlobalFreeCursor />
        <div className="App">
          <Routes>
            {/* One want, on its own — the address a home-screen icon points at.
                Outside Layout on purpose: no nav header, no sidebar, no card
                frame, just the want's content full-bleed. */}
            <Route path="/w/:id" element={<WantAppPage />} />
            {/* Extensions' pages outside the frame, for the same reason. */}
            {extensionBareRoutes().map(r => <Route key={r.path} path={r.path} element={r.element} />)}
            <Route path="*" element={
          <Layout>
            <RouteTransition>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<WantListPage />} />
              {/* A panel on its own, for an app's sheet (lib/nativeHost). */}
              <Route path="/panel/:kind/:id?" element={<WantListPage panel />} />
              {/* A corner card on its own, for an app's native card frame. */}
              <Route path="/panel/card/:kind/:id" element={<WantListPage card />} />
              <Route path="/agents" element={<AgentsPage />} />
              <Route path="/recipes" element={<RecipePage />} />
              <Route path="/want-types" element={<WantTypePage />} />
              <Route path="/worlds" element={<WorldsPage />} />
              <Route path="/devices" element={<DevicesPage />} />
              <Route path="/characters" element={<CharactersPage />} />
              <Route path="/thing" element={<ThingPage />} />
              {/* The page was /memo; keep the old address working. */}
              <Route path="/memo" element={<Navigate to="/thing" replace />} />
              <Route path="/logs" element={<LogsPage />} />
              <Route path="/achievements" element={<AchievementsPage />} />
              {extensionRoutes().map(r => <Route key={r.path} path={r.path} element={r.element} />)}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
            </RouteTransition>
          </Layout>
            } />
          </Routes>
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default App;