import { useCallback, useEffect, useState } from 'react';
import type { ThingRecord } from '@/types/thing';
import { useThingStore } from '@/stores/thingStore';
import { useThingEditStore } from '@/stores/thingEditStore';
import { useWantSeedStore } from '@/stores/wantSeedStore';

/**
 * What has been asked of the detail panel, and the thing forms it can hold.
 *
 * Shared by the list and the board: a request to look inside, a dismissal, the
 * Add / Edit Thing forms and the thing records they read are about the panel,
 * not about where the character stands. They lived in the board's
 * useCursorFocus only because the board was the first to need them — which
 * would have left the list page unable to exist without the board.
 */
export function usePanelRequests(opts: {
  /** Load the thing records (the board and the panel read them). */
  loadThings: boolean;
}) {
  /**
   * WHICH want (or thing) detail was asked for, not merely that it was.
   *
   * As a boolean this leaked: it was cleared on the paths that walk or arrow to
   * another card, but tapping a card goes through the card's own onView and
   * never touched it — so on a phone one "look inside" made every later tap
   * open the sheet too. Naming the subject closes that by construction: a
   * request for one card simply does not match another, and there is no reset
   * to forget to call.
   */
  const [detailsRequestedFor, setDetailsRequestedFor] = useState<string | null>(null);
  // Closing the sidebar while still standing on the tile. Without this the
  // panel would reopen on the next render on the layouts where it opens by
  // itself, so Close would do nothing at all there.
  const [detailsDismissed, setDetailsDismissed] = useState(false);
  /** True only while the request names the very thing on screen. */
  const detailsAskedFor = useCallback((id: string | null | undefined) =>
    !!id && detailsRequestedFor === id, [detailsRequestedFor]);

  const editingThing = useThingEditStore(s => s.record);
  const consumeThingEdit = useThingEditStore(s => s.consume);
  /** Add Thing open in the sidebar, exactly as on the Thing page. Making a
   *  thing is not a thing about the board, so nothing here is remembered
   *  beyond "the form is open". */
  const [addingThing, setAddingThing] = useState(false);

  const thingRecords = useThingStore(s => s.records);
  // Nothing on this page has otherwise asked for the records the panel and the
  // corner cards read. Ask once; the store keeps them.
  const fetchThings = useThingStore(s => s.fetchThings);
  const { loadThings } = opts;
  useEffect(() => { if (loadThings && thingRecords.length === 0) void fetchThings(); }, [loadThings, thingRecords.length, fetchThings]);

  // A thing's card carries the same controls wherever it is drawn.
  const deleteThingRecord = useThingStore(s => s.deleteRecord);
  // Add Want from a thing opens the form here, with the thing as its seed — no
  // navigation: leaving the page would throw away what the user picked it on.
  const requestWantSeed = useWantSeedStore(s => s.requestSeed);
  const handleAddWantFromThing = useCallback((r: ThingRecord) => {
    requestWantSeed({
      catalogKey: r.catalogKey,
      subtype: r.typeName,
      value: r.value,
      sourceMemoId: r.id,
      icon: r.icon,
      color: r.color,
    });
  }, [requestWantSeed]);

  return {
    detailsRequestedFor, setDetailsRequestedFor,
    detailsDismissed, setDetailsDismissed,
    detailsAskedFor,
    editingThing, consumeThingEdit,
    addingThing, setAddingThing,
    thingRecords, deleteThingRecord,
    handleAddWantFromThing,
  };
}
