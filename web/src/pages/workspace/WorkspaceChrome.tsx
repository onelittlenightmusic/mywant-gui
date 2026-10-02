import React from 'react';
import { Zap } from 'lucide-react';
import { HeaderOverlay } from '@/components/layout/HeaderOverlay';
import { BatchActionBar } from '@/components/dashboard/BatchActionBar';
import { WantForm } from '@/components/forms/WantForm';
import { SaveAsRecipeModal } from '@/components/modals/SaveAsRecipeModal';
import { isDraftWant } from '@/types/draft';
import type { Recommendation } from '@/types/interact';
import type { useWorkspace } from './useWorkspace';
import { useHostSheet, hostSheetsOn } from '@/lib/nativeHost';

type Workspace = ReturnType<typeof useWorkspace>;

/**
 * What sits over the header while something is being chosen or confirmed —
 * the select-mode bar and the confirm/cancel strip. The same on both pages.
 */
export const WorkspaceHeaderOverlay: React.FC<{ ws: Workspace }> = ({ ws }) => (
  <HeaderOverlay
    isVisible={ws.isSelectMode || ws.showReactionConfirmation || ws.showDeleteDraftConfirmation}
    confirmationVisible={ws.showBatchConfirmation || ws.showReactionConfirmation || ws.showDeleteDraftConfirmation}
    confirmationTitle={
      ws.showBatchConfirmation ? `Batch ${ws.batchAction}`
      : ws.showDeleteDraftConfirmation ? 'Delete Draft'
      : 'Confirm'
    }
    confirmationDanger={
      (ws.showBatchConfirmation && ws.batchAction === 'delete') ||
      ws.showDeleteDraftConfirmation
    }
    onConfirmAction={
      ws.showBatchConfirmation ? ws.handleBatchConfirm
      : ws.showDeleteDraftConfirmation ? ws.handleDeleteDraftConfirm
      : ws.handleReactionConfirm
    }
    onCancelAction={
      ws.showBatchConfirmation ? ws.handleBatchCancel
      : ws.showDeleteDraftConfirmation ? ws.handleDeleteDraftCancel
      : ws.handleReactionCancel
    }
    loading={ws.isBatchProcessing || ws.isSubmittingReaction}
  >
    {ws.isSelectMode && (
      <BatchActionBar
        selectedItems={ws.selectedBatchItems}
        // Both kinds. The bar says how much is selected, and a thing you
        // ticked is selected — counting only the wants made the tick look
        // like it had not registered. The want-only actions below still
        // read the want set, so they act on what they can act on.
        selectedCount={ws.selectedWantIds.size + ws.selectedThingIds.size}
        onBatchConstellation={ws.handleBatchGroup}
        onBatchStart={() => { ws.setBatchAction('start'); ws.setShowBatchConfirmation(true); }}
        onBatchStop={() => { ws.setBatchAction('stop'); ws.setShowBatchConfirmation(true); }}
        onBatchDelete={() => { ws.setBatchAction('delete'); ws.setShowBatchConfirmation(true); }}
        onClearSelection={() => { ws.setSelectedWantIds(new Set()); ws.setSelectedThingIds(new Set()); }}
        // Things are what a want takes; a selection of only wants has
        // nothing to seed a form with, so the action is not offered.
        onBatchAddWant={ws.selectedThingIds.size > 0 ? ws.handleBatchAddWant : undefined}
        onExit={ws.handleToggleSelectMode}
        loading={ws.isBatchProcessing}
        focusedIdx={ws.formSituation === 'batch-action' ? ws.batchFocusIdx : undefined}
      />
    )}
  </HeaderOverlay>
);

/**
 * The forms and dialogs either page can raise: Add/Edit Want, Save as Recipe,
 * and the ghost a template leaves under a finger while it is dragged.
 */
export const WorkspaceModals: React.FC<{
  ws: Workspace;
  /** Where a want made from the form lands on the board — null off the board. */
  canvasPlacementPos: { x: number; y: number } | null;
}> = ({ ws, canvasPlacementPos }) => {
  const { selectedWant } = ws;
  // Framed by an app on a phone, the form is the app's sheet (useHostSheet),
  // opened on its own page — the plain cases: adding a want (under a parent
  // or not), editing one. A form seeded with something that cannot go in an
  // address (a thing, a recommendation, parameters) is still drawn here.
  const plainForm = ws.sidebar.showForm && !ws.showRecommendationForm && !ws.wantSeed
    && !ws.initialFormParams && !ws.initialFormImports && !ws.initialFormTypeId
    && ws.initialFormItemType === 'want-type';
  const formAsSheet = hostSheetsOn() && plainForm;
  const ownerId = ws.ownerWant ? (ws.ownerWant.metadata?.id || ws.ownerWant.id || '') : '';
  const editId = ws.editingWant ? (ws.editingWant.metadata?.id || ws.editingWant.id || '') : '';
  useHostSheet(
    !formAsSheet ? null
      : editId ? `/panel/edit-want/${encodeURIComponent(editId)}`
      : `/panel/add-want${ownerId ? `?owner=${encodeURIComponent(ownerId)}` : ''}`,
    editId ? 'Edit' : 'Add Want',
    'Heart',
    () => { ws.handleCloseModals(); void ws.fetchWants(); },
  );
  return (
    <>
      <WantForm ref={ws.wantFormRef} isOpen={ws.sidebar.showForm && !formAsSheet} onClose={ws.handleCloseModals} editingWant={ws.editingWant} ownerWant={ws.ownerWant} initialTypeId={ws.initialFormTypeId} initialParams={ws.initialFormParams} initialImports={ws.initialFormImports} initialItemType={ws.initialFormItemType} mode={ws.showRecommendationForm ? 'recommendation' : (ws.editingWant ? 'edit' : 'create')} recommendations={(selectedWant && isDraftWant(selectedWant) ? ((selectedWant.state?.current?.proposed_recommendations as Recommendation[]) || (selectedWant.state?.current?.recommendations as Recommendation[]) || []) : [])} selectedRecommendation={ws.selectedRecommendation} onRecommendationSelect={ws.setSelectedRecommendation} onRecommendationDeploy={ws.handleRecommendationDeploy} formSituation={ws.formSituation} onSituationChange={ws.setFormSituation} canvasPlacementPos={canvasPlacementPos} seed={ws.wantSeed} onBackToThing={() => { ws.handleCloseModals(); ws.navigate('/thing'); }} />
      <SaveAsRecipeModal
        isOpen={ws.showSaveRecipeModal}
        want={ws.saveRecipeTarget}
        analysis={ws.saveRecipeAnalysis}
        onClose={ws.closeSaveRecipeModal}
        onSave={ws.handleSaveRecipeSubmit}
        loading={ws.saveRecipeLoading}
      />
      {/* Mobile Touch Drag Ghost */}
      {ws.draggingTemplate && ws.touchPos && (
        <div
          className="fixed z-[9999] pointer-events-none bg-blue-600/90 text-white px-3 py-1.5 rounded-lg shadow-2xl flex items-center gap-2 animate-in fade-in zoom-in duration-200"
          style={{
            left: ws.touchPos.x,
            top: ws.touchPos.y,
            transform: 'translate(-50%, -120%)',
            width: 'max-content'
          }}
        >
          <Zap className="w-4 h-4 text-white" />
          <span className="text-xs font-bold">{ws.draggingTemplate.name}</span>
        </div>
      )}
    </>
  );
};
