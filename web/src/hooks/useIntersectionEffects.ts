import { useSSEEvent } from '@/hooks/useSSEEvent';
import { useTrashStore } from '@/stores/trashStore';
import { useThingStore } from '@/stores/thingStore';
import { useWantStore } from '@/stores/wantStore';
import { useThingTileStore } from '@/stores/thingTileStore';

/**
 * What an intersection looks like.
 *
 * The server decides what a shared cell MEANS — a bin swallows a thing, a plate
 * starts it moving (see the engine's intersection.go) — and until now the board
 * only ever saw the result. Something dragged into a bin animated because this
 * side had just done it; something that slid in on its own was archived in
 * silence, the tile blinking out with the lid shut.
 *
 * So the rules announce themselves and this plays them. One listener rather
 * than one per rule: an intersection is already a general fact, and the next
 * rule with something to show belongs in the switch below rather than in a new
 * event of its own.
 *
 * Only what the board cannot already see for itself. Occupancy fires on every
 * plate anybody steps on and has no animation — the tile's own state says it —
 * and a drag into a bin still animates from the gesture, which is earlier and
 * therefore better: the lid should follow the hand, not the network.
 */

interface IntersectionEvent {
  rule: string;
  phase: 'enter' | 'leave';
  wantId: string;
  wantType: string;
  moverKind: 'character' | 'thing';
  moverId: string;
}

/** What went in, for the bin to name as it disappears. */
function moverName(e: IntersectionEvent): string {
  if (e.moverKind === 'thing') {
    const r = useThingStore.getState().records.find(t => t.id === e.moverId);
    if (r?.value) return r.value;
  }
  const w = useWantStore.getState().wants.find(w => (w.metadata?.id || w.id) === e.moverId);
  return w?.metadata?.name || e.moverId;
}

export function useIntersectionEffects(): void {
  useSSEEvent<IntersectionEvent>('intersection', (e) => {
    if (!e || e.phase !== 'enter') return;
    switch (e.rule) {
      case 'trash': {
        // The same animation the drag path starts, from the same store — a bin
        // has one way of swallowing something and it should not matter how the
        // thing got there.
        const already = useTrashStore.getState().swallow;
        if (already && already.trashId === e.wantId) return; // the drag got there first
        useTrashStore.getState().beginSwallow({
          trashId: e.wantId,
          name: moverName(e),
          kind: e.moverKind === 'thing' ? 'thing' : 'want',
        });
        // And it is off the board, now rather than whenever something else
        // happens to refetch. The server has already unpinned it; the tile
        // lingering beside the bin it just went into is only this side not
        // having been told.
        if (e.moverKind === 'thing') useThingTileStore.getState().removeFromCanvas(e.moverId);
        break;
      }
      default:
        break;
    }
  });
}
