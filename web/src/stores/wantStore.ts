import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { Want, WantDetails, WantResults, CreateWantRequest, UpdateWantRequest, WantExecutionStatus } from '@/types/want';
import { apiClient } from '@/api/client';
import { send } from '@/api/outbox';
import { smartPollWants, registerWantCacheActions, getWantETag, setWantETag, seedWantETags, suspendWantPolling, invalidateCollectionETag } from '@/stores/wantHashCache';

interface DraggingTemplate {
  id: string;
  type: 'want-type' | 'recipe';
  name: string;
}

interface WantStore {
  // State
  wants: Want[];
  selectedWant: Want | null;
  selectedWantDetails: WantDetails | null;
  selectedWantResults: WantResults | null;
  loading: boolean;
  error: string | null;
  draggingWant: string | null;
  draggingTemplate: DraggingTemplate | null;
  touchPos: { x: number; y: number } | null;
  isOverTarget: boolean;
  highlightedLabel: { key: string; value: string } | null;
  quickActionsWantId: string | null;
  isInitialLoad: boolean; // Track if this is the first load

  // Actions
  fetchWants: () => Promise<void>;
  createWant: (request: CreateWantRequest) => Promise<Want>;
  updateWant: (id: string, request: UpdateWantRequest) => Promise<void>;
  deleteWant: (id: string) => Promise<void>;
  deleteWants: (ids: string[]) => Promise<void>;
  selectWant: (want: Want | null) => void;
  fetchWantDetails: (id: string) => Promise<{ updated: boolean }>;
  fetchWantResults: (id: string) => Promise<void>;
  clearError: () => void;
  refreshWant: (id: string) => Promise<void>;
  /** The one control. The four below are its names at the call sites. */
  controlWant: (id: string, control: 'suspend' | 'resume' | 'stop' | 'start') => void;
  suspendWant: (id: string) => Promise<void>;
  resumeWant: (id: string) => Promise<void>;
  stopWant: (id: string) => Promise<void>;
  startWant: (id: string) => Promise<void>;
  /** The same, over a selection. */
  controlWants: (ids: string[], control: 'suspend' | 'resume' | 'stop' | 'start') => void;
  suspendWants: (ids: string[]) => Promise<void>;
  resumeWants: (ids: string[]) => Promise<void>;
  stopWants: (ids: string[]) => Promise<void>;
  startWants: (ids: string[]) => Promise<void>;
  setDraggingWant: (wantId: string | null) => void;
  setDraggingTemplate: (template: DraggingTemplate | null) => void;
  setTouchPos: (pos: { x: number; y: number } | null) => void;
  setIsOverTarget: (isOver: boolean) => void;
  setHighlightedLabel: (label: { key: string; value: string } | null) => void;
  setQuickActionsWantId: (wantId: string | null) => void;
  reorderWant: (id: string, previousWantId?: string, nextWantId?: string) => Promise<void>;
  /** The order this tab has just made, until the server's keys say the same.
   *  Ids, because orderKeys are the server's to mint — see reorderWant. */
  orderOverride: string[] | null;
  archiveWant: (id: string) => Promise<void>;
  unarchiveWant: (id: string) => Promise<void>;
  // Partial-update helpers used by smart polling
  patchWant: (updated: Want) => void;
  /** Same as patchWant but merges a whole batch in one state update — used by
   * smartPollWants so a poll tick where several wants changed at once (e.g.
   * every sibling's orderKey shifting after a reorder) doesn't apply each
   * change as a separate render, which was re-triggering WantGrid's sibling
   * FLIP animation once per want instead of once per poll tick. */
  patchWants: (updatedList: Want[]) => void;
  removeWantById: (id: string) => void;
}

export const useWantStore = create<WantStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    wants: [],
    selectedWant: null,
    selectedWantDetails: null,
    selectedWantResults: null,
    loading: false,
    error: null,
    draggingWant: null,
    draggingTemplate: null,
    touchPos: null,
    isOverTarget: false,
    highlightedLabel: null,
    quickActionsWantId: null,
    orderOverride: null,
    isInitialLoad: true,

    // Actions
    setDraggingWant: (wantId: string | null) => set({ draggingWant: wantId }),
    setDraggingTemplate: (template: DraggingTemplate | null) => set({ draggingTemplate: template }),
    setTouchPos: (pos: { x: number; y: number } | null) => set({ touchPos: pos }),
    // Called from WantCard's onDragOver, i.e. tens of times per second while a
    // card is being dragged. zustand's set() always allocates a new state
    // object, and every such allocation notifies EVERY subscriber — so an
    // unconditional set() here re-rendered the whole card grid on every single
    // dragover event. Only publish an actual transition.
    setIsOverTarget: (isOver: boolean) => {
      if (get().isOverTarget !== isOver) set({ isOverTarget: isOver });
    },
    setQuickActionsWantId: (wantId: string | null) => set({ quickActionsWantId: wantId }),
    setHighlightedLabel: (label: { key: string; value: string } | null) => {
      set({ highlightedLabel: label });
      // Automatically clear after a short delay so the animation can be re-triggered
      if (label) {
        setTimeout(() => {
          set({ highlightedLabel: null });
        }, 2000);
      }
    },

    // Replace or insert a single want in the list without touching others
    patchWant: (updated: Want) => set(state => {
      const updatedId = updated.metadata?.id || '';
      const idx = state.wants.findIndex(w => (w.metadata?.id || '') === updatedId);
      if (idx === -1) {
        // New want: append then sort by orderKey
        const newWants = [...state.wants, updated].sort((a, b) => {
          const keyA = a.metadata?.orderKey || a.metadata?.id || '';
          const keyB = b.metadata?.orderKey || b.metadata?.id || '';
          return keyA.localeCompare(keyB);
        });
        return { wants: newWants };
      }
      const newWants = [...state.wants];
      newWants[idx] = updated;
      return {
        wants: newWants,
        selectedWant: state.selectedWant?.metadata?.id === updatedId ? updated : state.selectedWant,
        selectedWantDetails: state.selectedWantDetails?.metadata?.id === updatedId ? updated : state.selectedWantDetails,
      };
    }),

    // Batched version of patchWant — replaces/inserts every entry in a
    // single set() call so callers with several simultaneous changes (e.g.
    // smartPollWants after a reorder shifted many siblings' orderKeys) only
    // trigger one downstream re-render/re-sort instead of one per want.
    patchWants: (updatedList: Want[]) => set(state => {
      if (updatedList.length === 0) return {};
      const byId = new Map(state.wants.map((w, idx) => [w.metadata?.id || '', idx]));
      const newWants = [...state.wants];
      const appended: Want[] = [];
      for (const updated of updatedList) {
        const updatedId = updated.metadata?.id || '';
        const idx = byId.get(updatedId);
        if (idx === undefined) appended.push(updated);
        else newWants[idx] = updated;
      }
      const finalWants = appended.length > 0
        ? [...newWants, ...appended].sort((a, b) => {
            const keyA = a.metadata?.orderKey || a.metadata?.id || '';
            const keyB = b.metadata?.orderKey || b.metadata?.id || '';
            return keyA.localeCompare(keyB);
          })
        : newWants;
      const updatedById = new Map(updatedList.map(w => [w.metadata?.id || '', w]));
      return {
        wants: finalWants,
        selectedWant: state.selectedWant?.metadata?.id
          ? updatedById.get(state.selectedWant.metadata.id) ?? state.selectedWant
          : state.selectedWant,
        selectedWantDetails: state.selectedWantDetails?.metadata?.id
          ? updatedById.get(state.selectedWantDetails.metadata.id) ?? state.selectedWantDetails
          : state.selectedWantDetails,
      };
    }),

    removeWantById: (id: string) => set(state => ({
      wants: state.wants.filter(w => (w.metadata?.id || '') !== id),
      selectedWant: state.selectedWant?.metadata?.id === id ? null : state.selectedWant,
      selectedWantDetails: state.selectedWantDetails?.metadata?.id === id ? null : state.selectedWantDetails,
      selectedWantResults: state.selectedWantDetails?.metadata?.id === id ? null : state.selectedWantResults,
    })),

    reorderWant: async (id: string, previousWantId?: string, nextWantId?: string) => {
      // Where the card goes, said in ids rather than in keys.
      //
      // The grid sorts by orderKey, and orderKeys are the server's to mint —
      // a fractional-index algorithm that lives in engine/core/order_key.go and
      // has already been subtly wrong once. Working out the new key here so the
      // move could be shown at once would mean a second copy of that algorithm
      // in a second language, and a card landing on the wrong side of its
      // neighbour is precisely the bug the two copies would disagree on.
      //
      // So what is claimed locally is the ORDER, not the key: the ids in the
      // sequence the user just made. The grid honours the claim while it
      // stands, and it stands until the server's own keys come back saying the
      // same thing. Same rule as everywhere else — what this tab changed is
      // this tab's until the server agrees — put in the only terms this
      // particular value can be claimed in.
      const byOrderKey = (a: Want, b: Want) => {
        const keyA = a.metadata?.orderKey || a.metadata?.id || '';
        const keyB = b.metadata?.orderKey || b.metadata?.id || '';
        return keyA.localeCompare(keyB);
      };
      const ids = [...get().wants].sort(byOrderKey).map(w => w.metadata?.id || w.id || '');
      const from = ids.indexOf(id);
      if (from !== -1) {
        ids.splice(from, 1);
        const at = previousWantId ? ids.indexOf(previousWantId) + 1
          : nextWantId ? ids.indexOf(nextWantId)
          : 0;
        ids.splice(at < 0 ? ids.length : at, 0, id);
        set({ orderOverride: ids, error: null });
      }

      send(`want:${id}:order`, 'reorder', async () => {
        // A reorder rewrites order keys, and the grid sorts by order key — so a
        // poll that read its snapshot before the PUT and lands after the re-list
        // below would patch the old keys back and snap the cards to their former
        // positions. Hold the poller off for the whole round trip.
        const resumePolling = suspendWantPolling();
        try {
          await apiClient.updateWantOrder(id, { previousWantId, nextWantId });
          // Take the keys the server minted and let go of the local claim in
          // the same breath: applied a render apart, the cards would snap back
          // to the old order and then forward again.
          const wants = await apiClient.listWants();
          const sortedWants = [...wants].sort(byOrderKey);
          set({ wants: sortedWants, orderOverride: null });
          // Re-seed the smart-poll ETag cache with this fresh data — without
          // this, every want whose orderKey just shifted still has its OLD
          // hash cached, so the very next smartPollWants() tick sees them all
          // as "changed" against the server, redundantly re-fetches them, and
          // re-applies an (identical) array to the store — a spurious update
          // that retriggers WantGrid's sibling FLIP animation a second time
          // right after the real one.
          seedWantETags(sortedWants);
          // The collection hash we hold predates the reorder, so the next poll
          // would 304 and never learn about the new keys. Force a re-check.
          invalidateCollectionETag();
        } finally {
          resumePolling();
        }
      }, () => {
        // The server will never take this move. Drop the claim rather than
        // leave the grid showing an order nobody else will ever see.
        set({ orderOverride: null });
      });
    },

    fetchWants: async () => {
      const currentState = useWantStore.getState();

      // Only show loading on initial load
      if (currentState.isInitialLoad) {
        set({ loading: true, error: null });
      }

      try {
        const wants = await apiClient.listWants();
        // Sort by orderKey for consistent ordering that respects reordering
        const sortedWants = [...wants].sort((a, b) => {
          const keyA = a.metadata?.orderKey || a.metadata?.id || '';
          const keyB = b.metadata?.orderKey || b.metadata?.id || '';
          return keyA.localeCompare(keyB);
        });

        // Compare hashes to detect changes (ID-based comparison)
        const currentWants = currentState.wants;

        // Build a map of current wants by ID for efficient lookup
        const currentWantsMap = new Map(
          currentWants.map(w => [w.metadata?.id || w.id || '', w])
        );

        // Check if there are any changes
        const hasChanges = sortedWants.length !== currentWants.length ||
          sortedWants.some((newWant) => {
            const wantId = newWant.metadata?.id || newWant.id || '';
            const oldWant = currentWantsMap.get(wantId);

            // If old want doesn't exist, it's a new want
            if (!oldWant) return true;

            // If either hash is missing/empty, consider it as changed
            if (!newWant.hash || !oldWant.hash) return true;

            // Compare hashes
            return newWant.hash !== oldWant.hash;
          });

        // Re-seed the smart-poll ETag cache with this fresh full list. Without
        // this, a want just added/changed here still has a stale (or missing)
        // hash in the cache, so the very next smartPollWants() tick — fired by
        // the create's want_changed SSE or the 250ms interval — sees it as
        // "changed", redundantly re-fetches it and re-patches the store, an
        // extra update right after the real one.
        seedWantETags(sortedWants);

        // Only update state if there are actual changes
        if (hasChanges || currentState.isInitialLoad) {
          set({
            wants: sortedWants,
            loading: false,
            isInitialLoad: false
          });
        } else {
          // No changes, just update loading state if it was set
          if (currentState.isInitialLoad) {
            set({ loading: false, isInitialLoad: false });
          }
        }
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to fetch wants',
          loading: false,
          isInitialLoad: false
        });
      }
    },

    createWant: async (request: CreateWantRequest) => {
      set({ loading: true, error: null });
      try {
        // Document want types are pure state — the note text, the checklist
        // items — and a `param` of the same name is only the initial seed.
        // Left to reset on restart, ScriptableWant.Initialize copies that
        // (now-empty) param back over the live state on every server restart,
        // so a redeploy wiped the checklist. handleCreateNote already pins
        // this; do it for every document type, however it is created (the
        // generic Add Want form has no per-type hook).
        const DOC_TYPES = new Set(['note', 'checklist']);
        if (
          request.metadata?.type && DOC_TYPES.has(request.metadata.type) &&
          request.spec?.resetOnRestart === undefined
        ) {
          request = { ...request, spec: { ...request.spec, resetOnRestart: false } };
        }
        const want = await apiClient.createWant(request);
        set(state => ({
          wants: [...state.wants, want],
          loading: false
        }));
        return want;
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to create want',
          loading: false
        });
        throw error;
      }
    },

    updateWant: async (id: string, request: UpdateWantRequest) => {
      set({ loading: true, error: null });
      try {
        const updatedWant = await apiClient.updateWant(id, request);
        set(state => ({
          wants: state.wants.map(w => (w.metadata?.id === id || w.id === id) ? updatedWant : w),
          selectedWant: (state.selectedWant?.metadata?.id === id || state.selectedWant?.id === id) ? updatedWant : state.selectedWant,
          selectedWantDetails: state.selectedWantDetails?.metadata?.id === id ? updatedWant : state.selectedWantDetails,
          loading: false
        }));
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to update want',
          loading: false
        });
        throw error;
      }
    },

    deleteWant: async (id: string) => {
      set({ loading: true, error: null });
      // Optimistically update the status of the specific want to 'deleting'
      set(state => ({
        wants: state.wants.map(w =>
          (w.metadata?.id === id || w.id === id) ? { ...w, status: 'deleting' } : w
        ),
      }));

      try {
        await apiClient.deleteWant(id);
        set(state => ({
          wants: state.wants.filter(w => w.metadata?.id !== id && w.id !== id),
          selectedWant: (state.selectedWant?.metadata?.id === id || state.selectedWant?.id === id) ? null : state.selectedWant,
          selectedWantDetails: (state.selectedWantDetails?.metadata?.id === id || state.selectedWantDetails?.id === id) ? null : state.selectedWantDetails,
          selectedWantResults: null,
          loading: false
        }));
      } catch (error) {
        // If deletion fails, revert the status or rely on next fetchWants to correct
        set(state => ({
          wants: state.wants.map(w =>
            (w.metadata?.id === id || w.id === id) ? { ...w, status: 'failed' } : w // Revert to a 'failed' status on error
          ),
          error: error instanceof Error ? error.message : 'Failed to delete want',
          loading: false
        }));
        throw error;
      }
    },

    deleteWants: async (ids: string[]) => {
      set({ loading: true, error: null });
      // Optimistically update the status of specific wants to 'deleting'
      set(state => ({
        wants: state.wants.map(w =>
          (ids.includes(w.metadata?.id || w.id || '')) ? { ...w, status: 'deleting' } : w
        ),
      }));

      try {
        await apiClient.deleteWants(ids);
        set(state => ({
          wants: state.wants.filter(w => !ids.includes(w.metadata?.id || w.id || '')),
          selectedWant: (state.selectedWant && ids.includes(state.selectedWant.metadata?.id || state.selectedWant.id || '')) ? null : state.selectedWant,
          selectedWantDetails: (state.selectedWantDetails && ids.includes(state.selectedWantDetails.metadata?.id || state.selectedWantDetails.id || '')) ? null : state.selectedWantDetails,
          selectedWantResults: (state.selectedWantDetails && ids.includes(state.selectedWantDetails.metadata?.id || state.selectedWantDetails.id || '')) ? null : state.selectedWantResults,
          loading: false
        }));
      } catch (error) {
        // If deletion fails, revert the status or rely on next fetchWants to correct
        set(state => ({
          wants: state.wants.map(w =>
            (ids.includes(w.metadata?.id || w.id || '')) ? { ...w, status: 'failed' } : w // Revert to a 'failed' status on error
          ),
          error: error instanceof Error ? error.message : 'Failed to delete wants',
          loading: false
        }));
        throw error;
      }
    },

    selectWant: (want: Want | null) => {
      set({
        selectedWant: want,
        selectedWantDetails: null,
        selectedWantResults: null
      });
    },

    fetchWantDetails: async (id: string) => {
      // Only show global loading spinner on initial load (no cached data yet for this want).
      // Re-fetches (polling / ETag refresh) must NOT set loading:true — that causes the
      // control-button flash visible on slow networks even when 304 is returned.
      const cachedDetails = useWantStore.getState().selectedWantDetails;
      const isInitialLoad = !cachedDetails || cachedDetails.metadata?.id !== id;
      if (isInitialLoad) {
        set({ loading: true, error: null });
      }
      try {
        // Only send ETag on re-fetches (polling). On initial load the detail data
        // is not in memory yet, so a 304 would leave selectedWantDetails null.
        const result = await apiClient.getWantConditional(id, isInitialLoad ? undefined : getWantETag(id));
        if (result.data === null) {
          // 304: cached detail is still valid — no state change needed
          return { updated: false };
        }
        if (result.etag) setWantETag(id, result.etag);
        // Also patch the wants list so the card status updates immediately.
        // Without this, smartPollWants may skip the want because fetchWantDetails
        // already advanced wantETags to the new hash, causing the card to show stale status.
        useWantStore.getState().patchWant(result.data!);
        set({ selectedWantDetails: result.data, loading: false });
        return { updated: true };
      } catch (error) {
        // 削除直後の再取得は 404 になる（DELETE とサイドバー/ポーリングのレース）。
        // エラー表示はせず、消えた want として選択状態と一覧から落とすだけにする。
        if ((error as any)?.status === 404) {
          useWantStore.getState().removeWantById(id);
          set(state => ({
            selectedWant: (state.selectedWant?.metadata?.id === id || state.selectedWant?.id === id) ? null : state.selectedWant,
            selectedWantDetails: (state.selectedWantDetails?.metadata?.id === id || state.selectedWantDetails?.id === id) ? null : state.selectedWantDetails,
            loading: false,
          }));
          return { updated: false };
        }
        set({
          error: error instanceof Error ? error.message : 'Failed to fetch want details',
          loading: false
        });
        return { updated: false };
      }
    },

    fetchWantResults: async (id: string) => {
      // Don't set loading:true on re-fetches to avoid flashing on slow networks.
      const hasResults = !!useWantStore.getState().selectedWantResults;
      if (!hasResults) {
        set({ loading: true, error: null });
      }
      try {
        const results = await apiClient.getWantResults(id);
        set({
          selectedWantResults: results,
          loading: false
        });
      } catch (error) {
        // 削除済み want の結果取得（SSE との競合）は 404。エラー表示はしない。
        if ((error as any)?.status === 404) {
          set({ selectedWantResults: null, loading: false });
          return;
        }
        set({
          error: error instanceof Error ? error.message : 'Failed to fetch want results',
          loading: false
        });
      }
    },

    refreshWant: async (id: string) => {
      try {
        const [wantResult, status] = await Promise.all([
          apiClient.getWantConditional(id, getWantETag(id)),
          apiClient.getWantStatus(id)
        ]);

        if (wantResult.data !== null) {
          if (wantResult.etag) setWantETag(id, wantResult.etag);
          set(state => ({
            wants: state.wants.map(w => w.id === id ? { ...w, status: status.status } : w),
            selectedWant: state.selectedWant?.id === id ? { ...state.selectedWant, status: status.status } : state.selectedWant,
            selectedWantDetails: { ...wantResult.data!, suspended: status.suspended }
          }));
        } else {
          // 304: want detail unchanged, just sync status
          set(state => ({
            wants: state.wants.map(w => w.id === id ? { ...w, status: status.status } : w),
            selectedWant: state.selectedWant?.id === id ? { ...state.selectedWant, status: status.status } : state.selectedWant,
          }));
        }
      } catch (error) {
        console.error('Failed to refresh want:', error);
      }
    },

    clearError: () => {
      set({ error: null });
    },

    /**
     * Suspend, resume, stop, start — the same act four times over, and now
     * written once.
     *
     * It used to be four copies of: raise the loading flag, await the control,
     * await a SECOND request to read back the status it produced, apply that,
     * and on failure put the old status back. Two round trips before the card
     * moved, a spinner over the whole list while they happened, and a dropped
     * packet undoing what the user had asked for.
     *
     * The status a control produces is not a secret worth a request to learn.
     * So it is applied here at once, the control is owed to the server through
     * the outbox, and `want_changed` carries the real status back — the same
     * way this card would learn about anybody else pressing the same button.
     * If the guess below is ever wrong, that event is what corrects it, and it
     * arrives in the time the read-back request would have taken anyway.
     */
    controlWant: (id: string, control: 'suspend' | 'resume' | 'stop' | 'start') => {
      const expected: Record<typeof control, WantExecutionStatus> = {
        suspend: 'suspended',
        resume: 'reaching',
        stop: 'stopped',
        start: 'reaching',
      };
      const status = expected[control];
      const isThisWant = (w: Want | null) => !!w && (w.metadata?.id === id || w.id === id);
      set(state => ({
        wants: state.wants.map(w => isThisWant(w) ? { ...w, status } : w),
        selectedWant: isThisWant(state.selectedWant) ? { ...state.selectedWant!, status } : state.selectedWant,
        selectedWantDetails: isThisWant(state.selectedWantDetails as Want | null)
          ? { ...state.selectedWantDetails!, status }
          : state.selectedWantDetails,
        error: null,
      }));
      // One key for all four: pressing stop while a suspend is still being
      // retried means stop, and the suspend should never arrive after it.
      send(`want:${id}:control`, `${control} want`, () => apiClient[`${control}Want`](id));
    },

    suspendWant: async (id: string) => { get().controlWant(id, 'suspend'); },
    resumeWant: async (id: string) => { get().controlWant(id, 'resume'); },
    stopWant: async (id: string) => { get().controlWant(id, 'stop'); },
    startWant: async (id: string) => { get().controlWant(id, 'start'); },

    /**
     * The same control over a selection of cards.
     *
     * Applied to each of them here, then sent as the one batch request the
     * server already offers — the cards move together, which is what asking
     * for them together meant. Keyed per want, not per batch, so a card whose
     * status is changed again on its own supersedes its share of this.
     */
    controlWants: (ids: string[], control: 'suspend' | 'resume' | 'stop' | 'start') => {
      const expected: Record<typeof control, WantExecutionStatus> = {
        suspend: 'suspended',
        resume: 'reaching',
        stop: 'stopped',
        start: 'reaching',
      };
      const status = expected[control];
      const inBatch = new Set(ids);
      const isInBatch = (w: Want | null) => !!w && inBatch.has((w.metadata?.id || w.id) as string);
      set(state => ({
        wants: state.wants.map(w => isInBatch(w) ? { ...w, status } : w),
        selectedWant: isInBatch(state.selectedWant) ? { ...state.selectedWant!, status } : state.selectedWant,
        error: null,
      }));
      send(`wants:${ids.join(',')}:control`, `${control} ${ids.length} wants`, () => apiClient[`${control}Wants`](ids));
    },

    suspendWants: async (ids: string[]) => { get().controlWants(ids, 'suspend'); },
    resumeWants: async (ids: string[]) => { get().controlWants(ids, 'resume'); },
    stopWants: async (ids: string[]) => { get().controlWants(ids, 'stop'); },
    startWants: async (ids: string[]) => { get().controlWants(ids, 'start'); },

    archiveWant: async (id: string) => {
      const want = useWantStore.getState().wants.find(w => (w.metadata?.id || w.id) === id);
      if (!want) return;
      try {
        const updatedWant = await apiClient.updateWant(id, {
          metadata: { ...want.metadata, labels: { ...(want.metadata?.labels ?? {}), 'mywant.io/archived': 'true' } },
          spec: want.spec,
        });
        set(s => ({ wants: s.wants.map(w => (w.metadata?.id === id || w.id === id) ? updatedWant : w) }));
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to archive want' });
        throw error;
      }
    },

    unarchiveWant: async (id: string) => {
      const want = useWantStore.getState().wants.find(w => (w.metadata?.id || w.id) === id);
      if (!want) return;
      const labels = { ...(want.metadata?.labels ?? {}) };
      delete labels['mywant.io/archived'];
      try {
        const updatedWant = await apiClient.updateWant(id, {
          metadata: { ...want.metadata, labels },
          spec: want.spec,
        });
        set(s => ({ wants: s.wants.map(w => (w.metadata?.id === id || w.id === id) ? updatedWant : w) }));
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to unarchive want' });
        throw error;
      }
    },
  }))
);

// Register store actions in the cache module to avoid circular imports
registerWantCacheActions(
  (updated) => useWantStore.getState().patchWant(updated),
  (id) => useWantStore.getState().removeWantById(id),
  (updatedList) => useWantStore.getState().patchWants(updatedList)
);

// Auto-refresh via smart polling every 5 seconds (background baseline)
let autoRefreshStarted = false;
useWantStore.subscribe((state) => {
  if (!autoRefreshStarted && state.wants.length > 0) {
    autoRefreshStarted = true;
    setInterval(() => {
      if (useWantStore.getState().wants.length > 0) {
        smartPollWants();
      }
    }, 5000);
  }
});