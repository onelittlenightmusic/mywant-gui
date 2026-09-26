import { useCallback, useRef } from 'react';
import { Want } from '@/types/want';
import { useWantStore } from '@/stores/wantStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { apiClient } from '@/api/client';
import { playSound } from '@/utils/sounds';
import { generateUniqueWantName } from '@/utils/nameGenerator';
import { CANVAS_LABEL_X, CANVAS_LABEL_Y } from '@/utils/wantPlacement';

/**
 * Resolve default params and effective wantType from a template drop.
 * Used by both canvas drop and list-area drop so the param-extraction
 * logic lives in exactly one place.
 */
async function resolveTemplateParams(
  tid: string,
  tt: 'want-type' | 'recipe',
): Promise<{ params: Record<string, any>; wantType: string }> {
  const { recipes } = useRecipeStore.getState();
  let params: Record<string, any> = {};
  let wantType = tid;

  if (tt === 'want-type') {
    const wt = await apiClient.getWantType(tid);
    if (wt) {
      if (wt.examples && wt.examples.length > 0) {
        params = wt.examples[0].want?.spec?.params || {};
      } else if (wt.parameters) {
        const d: any = {};
        wt.parameters.forEach(p => {
          if (p.default !== undefined) d[p.name] = p.default;
          else if (p.example !== undefined) d[p.name] = p.example;
        });
        params = d;
      }
    }
  } else {
    const r = recipes.find(x => x.recipe?.metadata?.custom_type === tid);
    if (r) {
      const paramDefs = r.recipe.parameters ?? [];
      params = Object.fromEntries(
        paramDefs.filter(p => p.default !== undefined).map(p => [p.name, p.default]),
      );
      wantType = r.recipe.metadata.custom_type || tid;
    }
  }

  return { params, wantType };
}

/**
 * Wants that come into being, or change parent, because something was dropped.
 *
 * A template dropped on the canvas arrives with a cell and is created there; the
 * same template dropped on the list arrives without one and is created wherever
 * the auto-placement puts it. A want dropped on another want becomes its child,
 * and a want dropped on open ground stops being one. All four are the same two
 * requests — create, or rewrite ownerReferences — differing only in what the
 * drop knew about where it landed.
 */
export interface WantCreationDropsApi {
  /** Speak a transient message through the robot's bubble. */
  showNotification: (message: string) => void;
  /** Collapse a parent whose children have just left it. */
  collapseParents: (parentIds: string[]) => void;
  /** Flip the expansion of the want a child was just dropped into. */
  toggleParentExpanded: (parentId: string) => void;
  /** Show a want in the detail panel (a label drop selects what it landed on). */
  selectWant: (want: Want) => void;
}

export function useWantCreationDrops(api: WantCreationDropsApi) {
  const { wants, fetchWants, setDraggingTemplate } = useWantStore();

  const apiRef = useRef(api);
  apiRef.current = api;

  const handleCanvasTemplateDrop = useCallback(async (tid: string, tt: 'want-type' | 'recipe', x: number, y: number) => {
    playSound('wantPlaced');
    try {
      const { params, wantType } = await resolveTemplateParams(tid, tt);
      const name = generateUniqueWantName(tid, tt, new Set(wants.map(w => w.metadata?.name || '')));
      const { createWant } = useWantStore.getState();
      await createWant({
        metadata: {
          name,
          type: wantType,
          labels: { 'mywant.io/type': wantType, [CANVAS_LABEL_X]: String(x), [CANVAS_LABEL_Y]: String(y) },
        },
        spec: { params },
      });
      setDraggingTemplate(null);
      apiRef.current.showNotification(`✓ Created "${name}" on canvas`);
      await fetchWants();
    } catch (e: any) {
      apiRef.current.showNotification(`✗ Failed: ${e.message}`);
    }
  }, [wants, setDraggingTemplate, fetchWants]);

  const handleTemplateDropped = useCallback(async (tid: string, tt: 'want-type' | 'recipe') => {
    playSound('wantPlaced');
    try {
      const { params, wantType } = await resolveTemplateParams(tid, tt);
      const name = generateUniqueWantName(tid, tt, new Set(wants.map(w => w.metadata?.name || '')));
      const { createWant } = useWantStore.getState();
      await createWant({ metadata: { name, type: wantType, labels: { 'mywant.io/type': wantType } }, spec: { params } });
      setDraggingTemplate(null);
      apiRef.current.showNotification(`✓ Created "${name}"`);
      await fetchWants();
    } catch (e: any) { apiRef.current.showNotification(`✗ Failed: ${e.message}`); }
  }, [wants, setDraggingTemplate, fetchWants]);

  const handleUnparentWant = useCallback(async (id: string) => {
    try {
      const w = wants.find(x => (x.metadata?.id === id) || (x.id === id));
      if (!w || !w.metadata.ownerReferences || w.metadata.ownerReferences.length === 0) return;
      const pids = w.metadata.ownerReferences.filter(r => r.controller && r.kind === 'Want').map(r => r.id).filter((i): i is string => !!i);
      await apiClient.updateWant(id, { ...w, metadata: { ...w.metadata, ownerReferences: [] } });
      apiRef.current.showNotification(`✓ Removed parent from ${w.metadata.name}`); await fetchWants();
      apiRef.current.collapseParents(pids);
    } catch (e: any) { apiRef.current.showNotification(`✗ Failed: ${e.message}`); }
  }, [wants, fetchWants]);

  const handleLabelDropped = useCallback(async (wantId: string) => {
    await fetchWants();
    const want = wants.find(w => (w.metadata?.id === wantId) || (w.id === wantId));
    if (want) apiRef.current.selectWant(want);
  }, [wants, fetchWants]);

  const handleWantDropped = useCallback(async (draggedWantId: string, targetWantId: string) => {
    try {
      const draggedWant = wants.find(w => (w.metadata?.id === draggedWantId) || (w.id === draggedWantId));
      if (!draggedWant) return;
      if (!targetWantId) { if (draggedWant.metadata.ownerReferences?.length) await handleUnparentWant(draggedWantId); return; }
      const targetWant = wants.find(w => (w.metadata?.id === targetWantId) || (w.id === targetWantId));
      if (!targetWant) return;
      const ownerRef = { apiVersion: 'mywant/v1', kind: 'Want', name: targetWant.metadata.name, id: targetWantId, controller: true, blockOwnerDeletion: true };
      await apiClient.updateWant(draggedWantId, { ...draggedWant, metadata: { ...draggedWant.metadata, ownerReferences: [...(draggedWant.metadata.ownerReferences || []), ownerRef] } });
      apiRef.current.showNotification(`✓ Added ${draggedWant.metadata.name} to ${targetWant.metadata.name}`);
      await fetchWants(); apiRef.current.toggleParentExpanded(targetWantId);
    } catch (error) { apiRef.current.showNotification(`✗ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`); }
  }, [wants, fetchWants, handleUnparentWant]);

  return {
    handleCanvasTemplateDrop,
    handleTemplateDropped,
    handleUnparentWant,
    handleLabelDropped,
    handleWantDropped,
  };
}
