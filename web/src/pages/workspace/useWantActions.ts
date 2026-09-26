import { useCallback, useRef, useState } from 'react';
import { Want } from '@/types/want';
import { WantRecipeAnalysis, RecipeMetadata, StateDef } from '@/types/recipe';
import { useWantStore } from '@/stores/wantStore';
import { useConstellationStore } from '@/stores/constellationStore';
import { apiClient } from '@/api/client';

/**
 * What can be done to a want, once you have one.
 *
 * Everything here is a verb the cards and the detail panel offer — delete,
 * suspend, resume, archive, approve a reaction, save as a recipe — plus the
 * batch forms of the same for select mode, and the confirmation state each of
 * them raises on the way. It is all request-then-notify: no board geometry,
 * no input routing, nothing that has to know where anything is on screen.
 *
 * The confirmations live here rather than in Dashboard because a confirmation
 * has no meaning apart from the action it is asking about — `deleteWantState`
 * and `handleDeleteWantConfirm` were only ever read together.
 */
export interface WantActionsApi {
  /** Speak a transient message through the robot's bubble. */
  showNotification: (message: string) => void;
  /** The want the detail panel is showing, so a delete can clear it. */
  selectedWant: Want | null;
  clearSelection: () => void;
  /** Select mode's tick list — batch actions consume and then clear it. */
  selectedWantIds: Set<string>;
  setSelectedWantIds: (ids: Set<string>) => void;
  /** The other half of a canvas selection. Only the actions that genuinely
   *  act on both — naming a constellation — read it. */
  selectedThingIds?: Set<string>;
  setSelectedThingIds?: (ids: Set<string>) => void;
  setIsSelectMode: (on: boolean) => void;
  /** A deleted draft is no longer a recommendation worth holding open. */
  setSelectedRecommendation: (rec: null) => void;
}

export function useWantActions(api: WantActionsApi) {
  const { fetchWants, deleteWant, deleteWants, suspendWant, resumeWant, stopWant, startWant, archiveWant, unarchiveWant } = useWantStore();
  const createConstellation = useConstellationStore((s) => s.createConstellation);

  // Read through a mirror: several of these are called from JSX far below the
  // hook call, and none of them should re-create a handler when they change.
  const apiRef = useRef(api);
  apiRef.current = api;

  const [deleteWantState, setDeleteWantState] = useState<Want | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [isDeletingWant, setIsDeletingWant] = useState(false);
  const [showBatchConfirmation, setShowBatchConfirmation] = useState(false);
  const [batchAction, setBatchAction] = useState<'start' | 'stop' | 'delete' | null>(null);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [reactionWantState, setReactionWantState] = useState<Want | null>(null);
  const [showReactionConfirmation, setShowReactionConfirmation] = useState(false);
  const [reactionAction, setReactionAction] = useState<'approve' | 'deny' | null>(null);
  const [isSubmittingReaction, setIsSubmittingReaction] = useState(false);
  const [deleteDraftState, setDeleteDraftState] = useState<Want | null>(null);
  const [showDeleteDraftConfirmation, setShowDeleteDraftConfirmation] = useState(false);
  const [showSaveRecipeModal, setShowSaveRecipeModal] = useState(false);
  const [saveRecipeTarget, setSaveRecipeTarget] = useState<Want | null>(null);
  const [saveRecipeAnalysis, setSaveRecipeAnalysis] = useState<WantRecipeAnalysis | null>(null);
  const [saveRecipeLoading, setSaveRecipeLoading] = useState(false);

  // ── Batch (select mode) ────────────────────────────────────────────────────

  const handleBatchConfirm = useCallback(async () => {
    setIsBatchProcessing(true);
    const { selectedWantIds, setSelectedWantIds, setIsSelectMode, showNotification } = apiRef.current;
    const ids = Array.from(selectedWantIds);
    try {
      if (batchAction === 'start') {
        for (const id of ids) {
          await startWant(id);
        }
        showNotification(`Started ${ids.length} wants`);
      } else if (batchAction === 'stop') {
        for (const id of ids) {
          await stopWant(id);
        }
        showNotification(`Stopped ${ids.length} wants`);
      } else if (batchAction === 'delete') {
        await deleteWants(ids);
        showNotification(`Deleted ${ids.length} wants`);
      }
      setShowBatchConfirmation(false); setBatchAction(null);
      setSelectedWantIds(new Set()); setIsSelectMode(false);
    } catch (e) { console.error(e); showNotification(`Failed to ${batchAction} some wants`); }
    finally { setIsBatchProcessing(false); }
  }, [batchAction, startWant, stopWant, deleteWants]);

  const handleBatchGroup = useCallback(async (name: string) => {
    const { selectedWantIds, selectedThingIds, setSelectedWantIds, setSelectedThingIds, setIsSelectMode, showNotification } = apiRef.current;
    const members = [...selectedWantIds, ...(selectedThingIds ?? [])];
    if (members.length === 0) return;
    // Both kinds in one constellation. The server decides which store each
    // member lives in (memberKindOf) — a constellation is a name someone gave
    // to a handful of things on the board, and the board has two kinds on it.
    await createConstellation(name, 'mixed', members);
    setSelectedWantIds(new Set()); setSelectedThingIds?.(new Set()); setIsSelectMode(false);
    showNotification(`Grouped ${members.length} tiles as "${name}"`);
  }, [createConstellation]);

  const handleBatchCancel = useCallback(() => { setShowBatchConfirmation(false); setBatchAction(null); }, []);

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDeleteWantCancel = useCallback(() => { setShowDeleteConfirmation(false); setDeleteWantState(null); }, []);

  /** Core delete: calls API, clears sidebar if the deleted want was selected. */
  const executeDeleteWant = useCallback(async (id: string) => {
    setIsDeletingWant(true);
    try {
      await deleteWant(id);
      const { selectedWant, clearSelection } = apiRef.current;
      if (selectedWant && (selectedWant.metadata?.id === id || selectedWant.id === id)) {
        clearSelection();
      }
    } catch { /* callers handle notifications */ }
    finally { setIsDeletingWant(false); }
  }, [deleteWant]);

  const handleDeleteWantConfirm = useCallback(async () => {
    const id = deleteWantState?.metadata?.id || deleteWantState?.id;
    if (!id) return;
    await executeDeleteWant(id);
    setShowDeleteConfirmation(false);
    setDeleteWantState(null);
  }, [deleteWantState, executeDeleteWant]);

  const handleShowDeleteConfirmation = useCallback((want: Want) => { setDeleteWantState(want); setShowDeleteConfirmation(true); }, []);

  const handleDirectDeleteWant = useCallback(async (want: Want) => {
    const id = want.metadata?.id || want.id;
    if (id) await executeDeleteWant(id);
  }, [executeDeleteWant]);

  // ── Drafts ─────────────────────────────────────────────────────────────────

  const handleDraftDelete = useCallback((want: Want) => { setDeleteDraftState(want); setShowDeleteDraftConfirmation(true); }, []);

  const handleDeleteDraftConfirm = useCallback(async () => {
    if (deleteDraftState) {
      const draftId = deleteDraftState.metadata?.id || deleteDraftState.id;
      const { selectedWant, clearSelection, setSelectedRecommendation, showNotification } = apiRef.current;
      try {
        await apiClient.deleteDraftWant(draftId);
        setShowDeleteDraftConfirmation(false);
        setDeleteDraftState(null);
        setSelectedRecommendation(null);
        const selectedId = selectedWant?.metadata?.id || selectedWant?.id;
        if (selectedId === draftId) {
          clearSelection();
        }
        showNotification(`Deleted draft`);
        await fetchWants();
      } catch (e) {
        showNotification('Failed to delete draft');
      }
    }
  }, [deleteDraftState, fetchWants]);

  const handleDeleteDraftCancel = useCallback(() => { setShowDeleteDraftConfirmation(false); setDeleteDraftState(null); }, []);

  // ── Reactions (approve / deny a proposal or reminder) ──────────────────────

  const handleReactionCancel = useCallback(() => { setShowReactionConfirmation(false); setReactionWantState(null); setReactionAction(null); }, []);

  const handleReactionConfirm = useCallback(async () => {
    if (!reactionWantState || !reactionAction) return;
    setIsSubmittingReaction(true);
    try {
      const qid = reactionWantState.state?.current?.reaction_queue_id as string | undefined;
      if (!qid) return;
      const isGoal = reactionWantState.metadata?.type === 'goal';
      const typeLabel = isGoal ? 'decomposition proposal' : 'reminder';
      const comment = `User ${reactionAction === 'approve' ? 'approved' : 'denied'} ${typeLabel}`;
      const r = await fetch(`/api/v1/reactions/${qid}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approved: reactionAction === 'approve', comment }) });
      if (!r.ok) throw new Error(`Failed: ${r.statusText}`);
      setShowReactionConfirmation(false); setReactionWantState(null); setReactionAction(null);
    } catch (e) {} finally { setIsSubmittingReaction(false); }
  }, [reactionWantState, reactionAction]);

  const handleShowReactionConfirmation = useCallback((want: Want, action: 'approve' | 'deny') => { setReactionWantState(want); setReactionAction(action); setShowReactionConfirmation(true); }, []);

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  const handleSuspendWant = useCallback(async (want: Want) => {
    const wantId = want.metadata?.id || want.id;
    if (!wantId) return;
    try { await suspendWant(wantId); } catch (e) { console.error('Failed to suspend want:', e); }
  }, [suspendWant]);

  const handleResumeWant = useCallback(async (want: Want) => {
    const wantId = want.metadata?.id || want.id;
    if (!wantId) return;
    try { await resumeWant(wantId); } catch (e) { console.error('Failed to resume want:', e); }
  }, [resumeWant]);

  const handleArchiveWant = useCallback(async (want: Want) => {
    const wantId = want.metadata?.id || want.id;
    if (!wantId) return;
    try { await archiveWant(wantId); } catch (e) { console.error('Failed to archive want:', e); }
  }, [archiveWant]);

  const handleUnarchiveWant = useCallback(async (want: Want) => {
    const wantId = want.metadata?.id || want.id;
    if (!wantId) return;
    try { await unarchiveWant(wantId); } catch (e) { console.error('Failed to unarchive want:', e); }
  }, [unarchiveWant]);

  // ── Save as recipe ─────────────────────────────────────────────────────────

  const handleSaveRecipeFromWant = useCallback(async (w: Want) => {
    const id = w.metadata?.id || w.id;
    if (!id) return;
    setSaveRecipeLoading(true);
    try {
      const analysis = await apiClient.analyzeWantForRecipe(id);
      setSaveRecipeTarget(w);
      setSaveRecipeAnalysis(analysis);
      setShowSaveRecipeModal(true);
    } catch (e: any) {
      apiRef.current.showNotification(`✗ Failed to analyze want: ${e.message}`);
    } finally {
      setSaveRecipeLoading(false);
    }
  }, []);

  const handleSaveRecipeSubmit = useCallback(async (metadata: RecipeMetadata, state: StateDef[]) => {
    const id = saveRecipeTarget?.metadata?.id || saveRecipeTarget?.id;
    if (!id) return;
    try {
      const r = await apiClient.saveRecipeFromWant(id, metadata, state);
      apiRef.current.showNotification(`✓ Recipe '${r.id}' saved successfully`);
      setShowSaveRecipeModal(false);
      setSaveRecipeTarget(null);
      setSaveRecipeAnalysis(null);
    } catch (e: any) {
      apiRef.current.showNotification(`✗ Failed: ${e.message}`);
    }
  }, [saveRecipeTarget]);

  const closeSaveRecipeModal = useCallback(() => {
    setShowSaveRecipeModal(false);
    setSaveRecipeTarget(null);
    setSaveRecipeAnalysis(null);
  }, []);

  /** Everything a "close the modals" gesture has to put back. */
  const resetConfirmations = useCallback(() => {
    setDeleteWantState(null);
    setShowDeleteConfirmation(false);
    setReactionWantState(null);
    setShowReactionConfirmation(false);
    setReactionAction(null);
  }, []);

  return {
    // state read by the confirmation UI
    deleteWantState, showDeleteConfirmation, isDeletingWant,
    showBatchConfirmation, batchAction, isBatchProcessing,
    reactionWantState, showReactionConfirmation, reactionAction, isSubmittingReaction,
    deleteDraftState, showDeleteDraftConfirmation,
    showSaveRecipeModal, saveRecipeTarget, saveRecipeAnalysis, saveRecipeLoading,
    // raising a batch confirmation, and Escape dismissing one
    setBatchAction, setShowBatchConfirmation,
    // actions
    handleBatchConfirm, handleBatchGroup, handleBatchCancel,
    handleDeleteWantCancel, handleDeleteWantConfirm, handleShowDeleteConfirmation, handleDirectDeleteWant,
    handleDraftDelete, handleDeleteDraftConfirm, handleDeleteDraftCancel,
    handleReactionCancel, handleReactionConfirm, handleShowReactionConfirmation,
    handleSuspendWant, handleResumeWant, handleArchiveWant, handleUnarchiveWant,
    handleSaveRecipeFromWant, handleSaveRecipeSubmit, closeSaveRecipeModal,
    resetConfirmations,
  };
}
