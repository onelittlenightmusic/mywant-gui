import React, { useState } from 'react';
import { WantCardPluginProps, registerWantCardPlugin } from '../registry';
import { WantCardLayout } from '../../WantCardLayout';
import { CardFrame, CardFrameBadge, CardFrameTitle, CardFrameNote } from '../../CardFrame';
import { Globe, DoorOpen } from 'lucide-react';
import { CardActionButton } from '../../CardActionButton';
import { apiClient } from '@/api/client';
import { useWorldSpawnStore } from '@/stores/worldSpawnStore';
import { useCharacterStore } from '@/stores/characterStore';
import { useGuiStateFlushStore } from '@/stores/guiStateFlushStore';

const WorldContentSection: React.FC<WantCardPluginProps> = ({ want }) => {
  const params = (want.spec?.params ?? {}) as Record<string, unknown>;
  const worldName = typeof params.world_name === 'string' ? params.world_name : '';
  const spawnX = Number(params.spawn_x ?? 0);
  const spawnY = Number(params.spawn_y ?? 0);
  const requestSpawn = useWorldSpawnStore(s => s.requestSpawn);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = async () => {
    if (pending || !worldName) return;
    setPending(true);
    setError(null);
    try {
      // Push this character's position out before the world closes: the
      // server snapshots the outgoing world's GUI state during the switch, and
      // the dashboard's write is debounced by 800ms, so a move made just now
      // would otherwise not be in the world we are leaving.
      await useGuiStateFlushStore.getState().flush?.();

      const opened = await apiClient.openWorld(worldName);

      // Where to stand on the board we just arrived at.
      //
      // Opening a world from a card leaves the dashboard mounted, so the
      // character is still standing where the *previous* world left it. The
      // gui_state sync will not move it: it deliberately refuses to overrule a
      // cursor that has moved since the last acknowledged write, which is
      // exactly the case here — and the write-back then persists that stale
      // position into the world just opened, so the move looks undone.
      //
      // So place it explicitly, down the same path the spawn point already
      // uses (Dashboard's imperative teleport), which is not subject to that
      // guard. The board's memory of this character wins; the spawn point is
      // the answer only when there is no memory — a first visit, or a world
      // written by hand.
      const charId = useCharacterStore.getState().myCharacterId;
      let target: { x: number; y: number } | null = null;
      try {
        // cursor_restored is the server saying the board had a position for
        // somebody. When it says no, there is nothing to read back.
        const { state } = opened.cursor_restored
          ? await apiClient.getGUIState()
          : { state: {} as Record<string, unknown> };
        const sx = state[charId ? `canvas_cursor_x_${charId}` : 'canvas_cursor_x'];
        const sy = state[charId ? `canvas_cursor_y_${charId}` : 'canvas_cursor_y'];
        if (typeof sx === 'number' && typeof sy === 'number') target = { x: sx, y: sy };
      } catch {
        // Unreadable state is not a reason to refuse to arrive — fall back to
        // the spawn point below.
      }
      requestSpawn(target?.x ?? spawnX, target?.y ?? spawnY, 'world');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open world');
    } finally {
      setPending(false);
    }
  };

  const content = (
    <CardFrame
      eyecatch={
        <CardFrameBadge
          color="#0ea5e9"
          icon={<Globe className="w-[1.8em] h-[1.8em]" strokeWidth={2.5} />}
          caption="ワールド"
        />
      }
    >
      <CardFrameTitle>
        {worldName || <span className="italic text-gray-400">(unset)</span>}
      </CardFrameTitle>
      <CardFrameNote>spawn ({spawnX}, {spawnY})</CardFrameNote>
      {error && <span className="text-[0.75em] text-red-500 truncate">{error}</span>}

      <div
        className="mt-1"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <CardActionButton
          icon={<DoorOpen />}
          label="開く"
          pendingLabel="Opening…"
          pending={pending}
          disabled={!worldName}
          onPress={handleOpen}
          isDefaultStop
        />
      </div>
    </CardFrame>
  );

  return <WantCardLayout content={content} />;
};

registerWantCardPlugin({
  types: ['world'],
  ContentSection: WorldContentSection,
});
