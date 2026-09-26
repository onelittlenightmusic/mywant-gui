import { useCallback, useEffect, useRef, useState } from 'react';
import { Want } from '@/types/want';
import { WantSeed } from '@/stores/wantSeedStore';
import { useWantStore } from '@/stores/wantStore';
import { useAddWantTypeStore } from '@/stores/addWantTypeStore';
import { generateUniqueWantName } from '@/utils/nameGenerator';
import { CANVAS_LABEL_X, CANVAS_LABEL_Y } from '@/utils/wantPlacement';
import type { WantFormHandle } from '@/components/forms/WantForm';
import type { FormSituation } from './useGuiStateSync';

/**
 * Opening the Add Want form, and the three doors that lead there.
 *
 * A plain press of the header's Add button; a value seeded from `/thing`
 * (or from the board itself) that should jump straight to picking a type;
 * a type preselected from the Want Types page that should skip picking
 * altogether. All three end at the same form, and all three place the new
 * want the same way — near wherever this character is standing, so it never
 * lands in the coordinate-origin spiral that catches wants nobody placed.
 *
 * `editingWant` lives here too: editing is opening the same form on a want
 * that already exists, and the two share every field below it.
 */
export interface AddWantFormApi {
  sidebar: { showForm: boolean; openForm: () => void; closeForm: () => void; clearSelection: () => void };
  cursorManPos: { x: number; y: number } | null;
  canvasCenterX: number | undefined;
  canvasCenterY: number | undefined;
  wants: Want[];
  /** Wants known before a create, so the new one can be recognised. */
  prevWantIdsRef: React.MutableRefObject<Set<string>>;
  /** Where a want created near the character should land. */
  pendingCanvasPosRef: React.MutableRefObject<{ x: number; y: number } | null>;
  /** A seed opening the form suppresses the one-time selection restore. */
  suppressWantRestoreRef: React.MutableRefObject<boolean>;
  setDetailsDismissed: (v: boolean) => void;
  showNotification: (message: string) => void;
  fetchWants: () => Promise<void>;
  setFormSituation: (s: FormSituation) => void;

  /** A value picked on /thing, delivered once through the store. */
  storeSeed: WantSeed | null;
  consumeSeed: () => void;
  /** A type chosen from the Want Types page, delivered once through the store. */
  addTypeId: string | undefined;
  consumeAddType: () => void;
}

export function useAddWantForm(api: AddWantFormApi) {
  const { sidebar, storeSeed, consumeSeed, addTypeId, consumeAddType } = api;

  const apiRef = useRef(api);
  apiRef.current = api;

  const [editingWant, setEditingWant] = useState<Want | null>(null);
  const [ownerWant, setOwnerWant] = useState<Want | null>(null);
  const [initialFormTypeId, setInitialFormTypeId] = useState<string | undefined>(undefined);
  /** What a caller that knows the whole move wants the new want to declare. */
  const [initialFormParams, setInitialFormParams] = useState<Record<string, unknown> | undefined>(undefined);
  const [initialFormImports, setInitialFormImports] = useState<Record<string, string> | undefined>(undefined);
  const [initialFormItemType, setInitialFormItemType] = useState<'want-type' | 'recipe'>('want-type');
  const [wantSeed, setWantSeed] = useState<WantSeed | null>(null);
  // Ref to WantForm's imperative handle — used by the page's capture handler
  // to navigate the inventory picker without going through WantForm's props.
  const wantFormRef = useRef<WantFormHandle>(null);
  // Expose for E2E testing via CDP
  useEffect(() => { (window as never as Record<string, unknown>).__wantFormRef = wantFormRef; }, []);

  const handleCreateWant = useCallback((parentWant?: Want) => {
    const a = apiRef.current;
    const isSameType = a.sidebar.showForm && !initialFormTypeId && initialFormItemType === 'want-type' && ownerWant === (parentWant || null);

    if (isSameType) {
      a.sidebar.closeForm();
      a.setFormSituation('closed');
    } else {
      // No parent: place new want near the player's own character. Prefer the
      // live CursorMan position (canvas mode active); otherwise fall back to
      // this character's last-known canvas center, so wants created from list
      // mode (or before CursorMan has been positioned) still land near the
      // player instead of the coordinate origin's auto-placement spiral —
      // which is where "robot" and other never-explicitly-placed wants end up.
      if (!parentWant) {
        const px = a.cursorManPos?.x ?? a.canvasCenterX;
        const py = a.cursorManPos?.y ?? a.canvasCenterY;
        if (px !== undefined && py !== undefined) {
          a.prevWantIdsRef.current = new Set(a.wants.map(w => w.metadata?.id || w.id || '').filter(Boolean));
          a.pendingCanvasPosRef.current = { x: Math.round(px), y: Math.round(py) };
          console.debug('[AddWantPlacement] set pending pos', a.pendingCanvasPosRef.current, 'cursorManPos', a.cursorManPos, 'canvasCenter', { canvasCenterX: a.canvasCenterX, canvasCenterY: a.canvasCenterY });
        } else {
          console.debug('[AddWantPlacement] skip: no character position available yet');
        }
      }
      setInitialFormTypeId(undefined);
      setInitialFormParams(undefined);
      setInitialFormImports(undefined);
      setInitialFormItemType('want-type');
      setOwnerWant(parentWant || null);
      setEditingWant(null);
      a.setFormSituation('type-selection');
      a.sidebar.openForm();
    }
  }, [initialFormTypeId, initialFormItemType, ownerWant]);

  // A thing seeded from /thing: open Add Want in type-selection with the
  // seed, then clear the store so it fires once.
  useEffect(() => {
    if (!storeSeed) return;
    const a = apiRef.current;
    a.suppressWantRestoreRef.current = true;
    a.sidebar.clearSelection();
    // The seed can now come from the board as well as from /thing, and there
    // the character is still standing on the thing it was taken from — which
    // keeps the thing's detail sheet open over the form the seed just asked
    // for, so Add Want looked like it did nothing. clearSelection only lets go
    // of a selected *want*; the thing sheet is held by the cursor, and this is
    // the same dismissal closing it by hand performs.
    a.setDetailsDismissed(true);
    // Where it lands — the placement every other way of opening Add Want
    // already sets, and this one used to leave out, so a seeded want was
    // created with no cell and the server's own placement put it near the
    // origin, far from what it was made from. The seed's cell when it names
    // one; the character's otherwise, as the plain Add press does.
    const at = storeSeed.at
      ?? (a.cursorManPos ? { x: a.cursorManPos.x, y: a.cursorManPos.y } : null)
      ?? (a.canvasCenterX !== undefined && a.canvasCenterY !== undefined
        ? { x: a.canvasCenterX, y: a.canvasCenterY }
        : null);
    if (at) {
      a.prevWantIdsRef.current = new Set(a.wants.map(w => w.metadata?.id || w.id || '').filter(Boolean));
      a.pendingCanvasPosRef.current = { x: Math.round(at.x), y: Math.round(at.y) };
    }
    setWantSeed(storeSeed);
    setInitialFormTypeId(undefined);
    setInitialFormItemType('want-type');
    setOwnerWant(null);
    setEditingWant(null);
    a.setFormSituation('type-selection');
    a.sidebar.openForm();
    consumeSeed();
  }, [storeSeed, consumeSeed]);

  // A want type chosen from the Want Types page: open Add Want with that type
  // preselected, straight into the fields phase.
  useEffect(() => {
    if (!addTypeId) return;
    const a = apiRef.current;
    a.suppressWantRestoreRef.current = true;
    a.sidebar.clearSelection();
    setWantSeed(null);
    setEditingWant(null);
    setOwnerWant(null);
    setInitialFormItemType('want-type');
    setInitialFormTypeId(addTypeId);
    const decl = useAddWantTypeStore.getState();
    setInitialFormParams(decl.params ?? undefined);
    setInitialFormImports(decl.imports ?? undefined);
    // Where it lands. The same two refs the plain Add press sets, because the
    // placement is the same machinery: the cell goes into the create request,
    // and the id snapshot is how the board knows which want came out of it.
    // A caller that named a cell gets that cell; one that did not falls back
    // to the character, exactly as pressing Add does.
    const at = useAddWantTypeStore.getState().at
      ?? (a.cursorManPos ? { x: a.cursorManPos.x, y: a.cursorManPos.y } : null)
      ?? (a.canvasCenterX !== undefined && a.canvasCenterY !== undefined
        ? { x: a.canvasCenterX, y: a.canvasCenterY }
        : null);
    if (at) {
      a.prevWantIdsRef.current = new Set(a.wants.map(w => w.metadata?.id || w.id || '').filter(Boolean));
      a.pendingCanvasPosRef.current = { x: Math.round(at.x), y: Math.round(at.y) };
    }
    a.setFormSituation('fields');
    a.sidebar.openForm();
    // Choose the type the way a click on it does.
    //
    // initialTypeId is meant to do this, and does when the form was closed and
    // the props arrive together with isOpen — but a caller who opens the form
    // while it is already up, or twice for the same type, changes nothing the
    // form's own effect watches, and it sits on the picker with the type it
    // was asked for going nowhere. Saying it imperatively lands every time,
    // and lands in exactly the state picking it by hand leaves behind.
    requestAnimationFrame(() => wantFormRef.current?.selectType(addTypeId));
    consumeAddType();
  }, [addTypeId, consumeAddType]);

  const handleCreateNote = useCallback(async () => {
    const a = apiRef.current;
    try {
      const existingNames = new Set(a.wants.map(w => w.metadata?.name || ''));
      const name = generateUniqueWantName('note', 'want-type', existingNames);
      const { createWant } = useWantStore.getState();
      // 通常の Add Want と同じく、自分のキャラクターの居る位置に置く。
      // CursorMan が居ればその座標、無ければこのキャラクターの最後のキャンバス中心。
      // 座標ラベルが無いと原点付近の自動配置に流れてしまう。
      const px = a.cursorManPos?.x ?? a.canvasCenterX;
      const py = a.cursorManPos?.y ?? a.canvasCenterY;
      const canvasLabels = (px !== undefined && py !== undefined)
        ? { [CANVAS_LABEL_X]: String(Math.round(px)), [CANVAS_LABEL_Y]: String(Math.round(py)) }
        : {};
      await createWant({
        metadata: { name, type: 'note', labels: { 'mywant.io/type': 'note', ...canvasLabels } },
        spec: { params: { content: '' }, resetOnRestart: false },
      });
      a.showNotification(`✓ ノート "${name}" を作成しました`);
      await a.fetchWants();
    } catch (e: any) {
      a.showNotification(`✗ ノート作成失敗: ${e?.message ?? 'Unknown error'}`);
    }
  }, []);

  const handleEditWant = useCallback((w: Want) => {
    setEditingWant(w);
    apiRef.current.setFormSituation('fields');
    apiRef.current.sidebar.openForm();
  }, []);

  /** Everything a "close the modals" gesture has to put back. */
  const resetForm = useCallback(() => {
    setEditingWant(null);
    setOwnerWant(null);
    setWantSeed(null);
  }, []);

  return {
    editingWant, setEditingWant,
    ownerWant, setOwnerWant,
    initialFormTypeId, setInitialFormTypeId,
    initialFormParams, initialFormImports,
    initialFormItemType, setInitialFormItemType,
    wantSeed,
    wantFormRef,
    handleCreateWant, handleCreateNote, handleEditWant,
    resetForm,
  };
}
