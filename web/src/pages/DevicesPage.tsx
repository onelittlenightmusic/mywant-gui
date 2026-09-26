import { useState, useEffect, useRef, useCallback } from 'react';
import { Smartphone } from 'lucide-react';
import { useAppHeader } from '@/hooks/useAppHeader';
import { useAppSidebar } from '@/hooks/useAppSidebar';
import { DeviceCard } from '@/components/devices/DeviceCard';
import { DeviceDetailsSidebar } from '@/components/sidebar/DeviceDetailsSidebar';
import { classNames } from '@/utils/helpers';
import { useCardOverlayStore, entityCardId } from '@/stores/cardOverlayStore';
import { useGridFocus } from '@/hooks/useGridFocus';
import { GRID_COLUMN_WIDTH } from '@/utils/gridUtils';
import { useGridCols } from '@/hooks/useGridCols';
import { apiClient } from '@/api/client';
import { BrowserDevice } from '@/types/device';
import { Character } from '@/types/character';
import { myDeviceId } from '@/hooks/useDeviceSession';
import { useSSEEvent } from '@/hooks/useSSEEvent';

const STALE_MS = 90_000;
const STALE_PRUNE_MS = STALE_MS * 3; // 4.5 min — matches useDeviceSession

export default function DevicesPage() {
  const toggleCardOverlay = useCardOverlayStore(s => s.toggleCardOverlay);

  const [devices, setDevices] = useState<BrowserDevice[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [activeDevice, setActiveDevice] = useState<string>('');
  const [homeDevice, setHomeDevice] = useState<string>('');
  const [guiSeq, setGuiSeq] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);
  const cols = useGridCols(gridRef);
  // Cards are rendered from the non-stale subset, so index-based callbacks
  // have to resolve against that list, not `devices`.
  const visibleDevicesRef = useRef<BrowserDevice[]>([]);

  const { focusedIdx, setFocusedIdx } = useGridFocus({
    count: devices.length,
    cols,
    // Enter/A focuses the card (its details sidebar follows focus); the
    // location toggle lives on the card's overlay grid rather than in an
    // inner-focus mode private to this page.
    onConfirm: (idx) => setFocusedIdx(idx),
    onCancel: () => setFocusedIdx(-1),
    onContextMenu: (idx) => {
      const d = visibleDevicesRef.current[idx];
      if (d) toggleCardOverlay(entityCardId('device', d.id));
    },
  });

  const loadCharacters = useCallback(async () => {
    try {
      const list = await apiClient.listCharacters();
      setCharacters(list);
    } catch { /* ignore */ }
  }, []);

  const applyGUIState = useCallback((seq: number, state: Record<string, unknown>) => {
    setGuiSeq(seq);
    const devList: BrowserDevice[] = Array.isArray(state.devices) ? state.devices as BrowserDevice[] : [];
    setDevices(devList);
    setActiveDevice(String(state.activeLocationDevice ?? ''));
    setHomeDevice(String(state.homeBrowserDevice ?? ''));
  }, []);

  const load = useCallback(async () => {
    try {
      const [{ seq, state }, charList] = await Promise.all([
        apiClient.getGUIState(),
        apiClient.listCharacters(),
      ]);
      applyGUIState(seq, state);
      setCharacters(charList);
    } catch { /* ignore transient errors */ }
  }, [applyGUIState]);

  // Initial fetch once (catches state that changed before the SSE connection
  // opened); live updates come from 'gui_state' / 'character_changed' pushes
  // below instead of the 2s polling this used to do.
  useEffect(() => {
    load();
  }, [load]);

  useSSEEvent<{ seq: number; state: Record<string, unknown> }>('gui_state', (data) => {
    applyGUIState(data.seq, data.state);
  });
  useSSEEvent('character_changed', () => { loadCharacters(); });

  // Auto-prune: remove character assignments for devices that have gone
  // stale, whenever either side changes (devices/characters now update
  // independently via separate SSE pushes instead of one combined poll).
  useEffect(() => {
    if (devices.length === 0 || characters.length === 0) return;
    const activeIds = new Set(devices.map(d => d.id));
    const staleDeviceIds = characters
      .flatMap(c => c.assignedDeviceIds)
      .filter(id => !activeIds.has(id));
    if (staleDeviceIds.length > 0) {
      apiClient.pruneCharacterDevices(staleDeviceIds).catch(() => {});
      setCharacters(prev => prev.map(c => ({
        ...c,
        assignedDeviceIds: c.assignedDeviceIds.filter(id => activeIds.has(id)),
      })));
    }
  }, [devices, characters]);

  // The browser that browser-run work is pinned to. Unset means whichever
  // browser polls first, which is how it behaved before there was a home.
  const handleToggleHome = async (id: string) => {
    if (saving) return;
    const next = homeDevice === id ? '' : id;
    setHomeDevice(next);
    setSaving(true);
    try {
      const { seq } = await apiClient.updateGUIState({ homeBrowserDevice: next }, guiSeq);
      setGuiSeq(seq);
    } catch (err: any) {
      if (err?.status === 412) await load();
    } finally {
      setSaving(false);
    }
  };

  const handleSelectDevice = async (id: string) => {
    if (saving) return;
    const next = activeDevice === id ? '' : id;
    setActiveDevice(next);
    setSaving(true);
    try {
      const { seq } = await apiClient.updateGUIState({ activeLocationDevice: next }, guiSeq);
      setGuiSeq(seq);
    } catch (err: any) {
      if (err?.status === 412) await load();
    } finally {
      setSaving(false);
    }
  };

  const handleCharacterChange = async (deviceId: string, characterId: string | null) => {
    if (characterId === null) {
      // Unassign: find current character for this device and remove it
      const currentChar = characters.find(c => c.assignedDeviceIds.includes(deviceId));
      if (!currentChar) return;
      const newIds = currentChar.assignedDeviceIds.filter(id => id !== deviceId);
      // Optimistic update
      setCharacters(prev => prev.map(c =>
        c.id === currentChar.id ? { ...c, assignedDeviceIds: newIds } : c
      ));
      try {
        await apiClient.assignDevicesToCharacter(currentChar.id, newIds);
        await loadCharacters();
      } catch { await loadCharacters(); }
    } else {
      // Assign device to character
      const targetChar = characters.find(c => c.id === characterId);
      if (!targetChar) return;
      const newIds = [...targetChar.assignedDeviceIds.filter(id => id !== deviceId), deviceId];
      // Optimistic update: remove from old, add to new
      setCharacters(prev => prev.map(c => {
        if (c.id === characterId) return { ...c, assignedDeviceIds: newIds };
        return { ...c, assignedDeviceIds: c.assignedDeviceIds.filter(id => id !== deviceId) };
      }));
      try {
        await apiClient.assignDevicesToCharacter(characterId, newIds);
        await loadCharacters();
      } catch { await loadCharacters(); }
    }
  };

  // Build a map: deviceId → characterId for quick lookup
  const deviceCharacterMap = new Map<string, string>();
  for (const c of characters) {
    for (const dId of c.assignedDeviceIds) {
      deviceCharacterMap.set(dId, c.id);
    }
  }

  const isOnline = (d: BrowserDevice) => Date.now() - d.lastSeen < STALE_MS;
  const isStale  = (d: BrowserDevice) => Date.now() - d.lastSeen >= STALE_PRUNE_MS;

  const visibleDevices = devices.filter(d => !isStale(d));
  visibleDevicesRef.current = visibleDevices;
  const focusedDevice = visibleDevices[focusedIdx] ?? null;

  // The sidebar belongs to a focused card. It used to be pinned open with a
  // page-wide summary standing in, so landing on the page put up a panel about
  // nothing — the same information the page already shows in its own banners.
  useAppSidebar({
    open: !!focusedDevice,
    title: focusedDevice ? focusedDevice.name : '',
    onClose: () => setFocusedIdx(-1),
    // A detail panel opens on its subject's card and takes the host's
    // identity row — one name, one close, in the same place on every page.
    chromeless: !!focusedDevice,
    content: focusedDevice ? (
      <DeviceDetailsSidebar
        device={focusedDevice}
        isActive={activeDevice === focusedDevice.id}
        isMe={focusedDevice.id === myDeviceId}
        isOnline={isOnline(focusedDevice)}
        characters={characters}
        assignedCharacterId={deviceCharacterMap.get(focusedDevice.id)}
        onCharacterChange={handleCharacterChange}
        isHome={homeDevice === focusedDevice.id}
        onToggleLocation={() => handleSelectDevice(focusedDevice.id)}
        onToggleHome={() => handleToggleHome(focusedDevice.id)}
      />
    ) : null,
  });

  useAppHeader({
    onCreateWant: () => {},
    title: 'Devices',
    hideCreateButton: true,
  });

  return (
    <div className="flex flex-col h-full bg-transparent text-gray-900 dark:text-gray-100">

      <main className="flex-1 overflow-hidden relative">
        {/* Main scrollable area */}
        <div className="h-full overflow-y-auto p-3 sm:p-6 pb-24 lg:mr-[480px]">

          {/* Empty state */}
          {devices.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="p-4 bg-gray-100 dark:bg-gray-900 rounded-full mb-4">
                <Smartphone className="w-10 h-10 text-gray-400 dark:text-gray-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">No devices connected yet.</h2>
              <p className="text-sm text-gray-500 max-w-md">
                Open the app on a mobile device or another browser to see it listed here.
              </p>
            </div>
          )}

          {/* Device grid */}
          {devices.length > 0 && (
            <div
              ref={gridRef}
              className="grid gap-3 sm:gap-[26px] lg:gap-[34px]"
              style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(${GRID_COLUMN_WIDTH}px, 100%), 1fr))` }}
            >
              {visibleDevices.map((device, idx) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  isFocused={focusedIdx === idx}
                  isActive={activeDevice === device.id}
                  isHome={homeDevice === device.id}
                  isMe={device.id === myDeviceId}
                  isOnline={isOnline(device)}
                  onClick={() => setFocusedIdx(idx)}
                  onToggleLocation={() => handleSelectDevice(device.id)}
                  onToggleHome={() => handleToggleHome(device.id)}
                  assignedCharacter={characters.find(c => c.id === deviceCharacterMap.get(device.id))}
                />
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
