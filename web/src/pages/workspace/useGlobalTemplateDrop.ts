import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import { useWantStore } from '@/stores/wantStore';

/**
 * Dropping onto the page rather than onto anything in particular.
 *
 * Two arrivals end up here. A want type or recipe dragged out of the sidebar
 * is a template, and in list mode dropping one anywhere creates it; on the
 * canvas the board itself takes the drop, so this only paints the drop hint.
 * A want dragged out of its parent is the other, and dropping it on open
 * ground is how it stops being a child.
 *
 * Touch has no drag events, so the same drop is reconstructed from touchend:
 * the element under the finger is asked whether it is the canvas, and if it
 * is, told where the finger was in a CustomEvent WantCanvas listens for.
 */
export interface GlobalTemplateDropApi {
  canvasMode: boolean;
  /** Create a want from a template dropped in list mode. */
  onTemplateDropped: (templateId: string, templateType: 'want-type' | 'recipe') => void | Promise<void>;
  /** Detach a want from its parent when dropped on open ground. */
  onUnparentWant: (wantId: string) => void | Promise<void>;
}

export function useGlobalTemplateDrop(api: GlobalTemplateDropApi) {
  const { draggingTemplate, setDraggingTemplate, touchPos, setTouchPos } = useWantStore();
  const { canvasMode } = api;

  // `onTemplateDropped` / `onUnparentWant` are defined further down in
  // Dashboard than this hook is called, so they are read through a mirror
  // rather than captured — same arrangement the canvas controllers use.
  const apiRef = useRef(api);
  apiRef.current = api;

  const [isGlobalDragOver, setIsGlobalDragOver] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  const handleGlobalDragEnter = useCallback((e: React.DragEvent) => {
    const isTemplate = draggingTemplate || e.dataTransfer.types.includes('application/mywant-template');
    if (isTemplate) {
      e.preventDefault();
      setDragCounter(prev => {
        const next = prev + 1;
        if (next === 1) setIsGlobalDragOver(true);
        return next;
      });
    }
  }, [draggingTemplate]);

  const handleGlobalDragOver = useCallback((e: React.DragEvent) => {
    const isTemplate = draggingTemplate || e.dataTransfer.types.includes('application/mywant-template');
    const isWant = e.dataTransfer.types.includes('application/mywant-id');
    if (isTemplate || isWant) {
      e.preventDefault();
      e.dataTransfer.dropEffect = isTemplate ? 'copy' : 'move';
    }
  }, [draggingTemplate]);

  const handleGlobalDragLeave = useCallback((e: React.DragEvent) => {
    const isTemplate = draggingTemplate || e.dataTransfer.types.includes('application/mywant-template');
    if (isTemplate) {
      setDragCounter(prev => {
        const next = Math.max(0, prev - 1);
        if (next === 0) setIsGlobalDragOver(false);
        return next;
      });
    }
  }, [draggingTemplate]);

  const handleGlobalDrop = useCallback((e: React.DragEvent) => {
    const templateData = e.dataTransfer.getData('application/mywant-template');
    const draggedWantId = e.dataTransfer.getData('application/mywant-id');

    if (templateData || draggedWantId) {
      e.preventDefault();
      setIsGlobalDragOver(false);
      setDragCounter(0);

      if (templateData && !apiRef.current.canvasMode) {
        try {
          const t = JSON.parse(templateData);
          if (t.id && t.type) apiRef.current.onTemplateDropped(t.id, t.type);
        } catch (err) {}
      } else if (draggedWantId) {
        apiRef.current.onUnparentWant(draggedWantId);
      }
    }
  }, []);

  // Global touch end handler for template drop
  useEffect(() => {
    const handleGlobalTouchEnd = (e: TouchEvent) => {
      if (!draggingTemplate || !touchPos) return;

      const touch = e.changedTouches[0];
      const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);

      // Check if dropped over canvas (look for data-want-canvas="true")
      const canvasEl = targetEl?.closest('[data-want-canvas="true"]');

      if (canvasEl && canvasMode) {
        // We need to calculate grid coordinates.
        // We use a CustomEvent to communicate with WantCanvas.
        const dropEvent = new CustomEvent('mywant:template-touch-drop', {
          detail: {
            template: draggingTemplate,
            clientX: touch.clientX,
            clientY: touch.clientY
          }
        });
        canvasEl.dispatchEvent(dropEvent);
      }

      setDraggingTemplate(null);
      setTouchPos(null);
    };

    if (draggingTemplate && touchPos) {
      window.addEventListener('touchend', handleGlobalTouchEnd);
      return () => window.removeEventListener('touchend', handleGlobalTouchEnd);
    }
  }, [draggingTemplate, touchPos, canvasMode, setDraggingTemplate, setTouchPos]);

  return {
    isGlobalDragOver,
    dragCounter,
    handleGlobalDragEnter,
    handleGlobalDragOver,
    handleGlobalDragLeave,
    handleGlobalDrop,
  };
}
