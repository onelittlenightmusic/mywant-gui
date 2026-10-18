import { apiClient } from '@/api/client';
import { useResultPageStore } from '@/stores/resultPageStore';
import { outputEntryKey } from '@/stores/outputFocusStore';
import { useWantStore } from '@/stores/wantStore';
import type { Want } from '@/types/want';

/**
 * Delete history: let the answer a want's cards are turned to go
 * (DELETE /wants/{id}/results/{key} — not brought back by the want's own run).
 *
 * Asked from the long-press overlay (QuickActionsOverlay), once the card's
 * own question has been answered (buildDeleteConfirmConfig). The focus
 * moves on first, to the answer behind it, else the one in front: every card
 * of the want and its ball follow (resultPageStore).
 */
export async function deleteFocusedAnswer(want: Want, key: string): Promise<void> {
  const wantId = want.metadata?.id || want.id || '';
  if (!wantId || !key) return;
  // Newest first, as the card deals them.
  const keys = [...(want.history?.resultHistory ?? [])].reverse().map(outputEntryKey);
  const at = keys.indexOf(key);
  const next = at < 0 ? undefined : keys[at + 1] ?? keys[at - 1];
  const focus = useResultPageStore.getState();
  focus.setFocus(wantId, next ?? null);
  try {
    await apiClient.deleteResultHistory(wantId, key);
    await useWantStore.getState().refreshWant(wantId);
  } catch {
    focus.setFocus(wantId, key);
  }
}
