import { useEffect, useRef, useCallback } from 'react';
import { useCharacterStore } from '@/stores/characterStore';
import { apiClient } from '@/api/client';
import { usePendingActionStore, useCallInviteStore, PendingDeviceAction } from '@/stores/pendingActionStore';
import { subscribeGUIState } from '@/api/guiStateStream';
import { myDeviceId } from '@/hooks/useDeviceSession';

export function useDismissPendingAction() {
  return useCallback(async (actionId: string) => {
    for (let i = 0; i < 3; i++) {
      try {
        const { seq, state } = await apiClient.getGUIState();
        const current = Array.isArray(state.pendingDeviceActions)
          ? (state.pendingDeviceActions as PendingDeviceAction[])
          : [];
        await apiClient.updateGUIState(
          { pendingDeviceActions: current.filter(a => a.id !== actionId) },
          seq,
        );
        return;
      } catch (err: any) {
        if (err?.status === 412 && i < 2) continue;
        break;
      }
    }
  }, []);
}

/**
 * Watches gui_state for pendingDeviceActions targeting this device (or
 * untargeted/broadcast actions) and consumes them. Same push pattern as
 * RobotStateManager: one initial fetch (catches actions queued before the
 * SSE connection opened) plus a 'gui_state' SSE subscription — no polling.
 *
 * 'open-url' is handled here via window.open(), which is best-effort: this
 * fires outside a user gesture, so browsers may pop-up-block it. A browser
 * extension can consume the same action type via chrome.tabs.create instead
 * (bypassing that restriction) — see PendingDeviceAction's doc comment for
 * the planned 'show-robot' action type that will need exactly that.
 */
export function usePendingDeviceActionsWatcher() {
  const setActions = usePendingActionStore(s => s.setActions);
  const setInvite = useCallInviteStore(s => s.setInvite);
  const dismiss = useDismissPendingAction();
  const processedIdsRef = useRef<Set<string>>(new Set());

  const processState = useCallback((state: Record<string, unknown>) => {
    const all = Array.isArray(state.pendingDeviceActions)
      ? (state.pendingDeviceActions as PendingDeviceAction[])
      : [];
    // Mine by character first: an invitation belongs to whoever is playing that
    // character now, which is not necessarily the screen it was sent to — it may
    // have been sent when nobody was playing them at all, and it waits in
    // gui_state until somebody is. Everything else is still addressed to a
    // device, since opening a page is a thing a particular browser does.
    const myCharacterId = useCharacterStore.getState().myCharacterId;
    const mine = all.filter(a => (
      a.to_character_id
        ? a.to_character_id === myCharacterId
        : (!a.device_id || a.device_id === myDeviceId)
    ));
    setActions(mine);

    for (const action of mine) {
      if (processedIdsRef.current.has(action.id)) continue;
      processedIdsRef.current.add(action.id);
      if (action.type === 'open-url') {
        window.open(action.url, '_blank');
        dismiss(action.id);
      } else if (action.type === 'call-invite') {
        // Deliberately NOT dismissed here: an invite is a question, so it stays
        // queued until the player answers it. Dashboard renders the prompt and
        // dismisses on accept or decline.
        setInvite(action);
      }
    }
  }, [setActions, setInvite, dismiss]);

  useEffect(() => {
    apiClient.getGUIState()
      .then(data => processState(data.state as Record<string, unknown>))
      .catch(() => {});
  }, [processState]);

  // guiStateStream (SSE + polling), not raw SSE: a call invite that only ever
  // arrives by SSE is lost entirely behind a buffering proxy, and an invite
  // nobody receives is indistinguishable from a broken feature.
  useEffect(() => subscribeGUIState(data => processState(data.state)), [processState]);
}
