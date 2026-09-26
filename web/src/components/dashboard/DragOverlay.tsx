import React from 'react';
import { useIconFont } from '@/hooks/useDisplaySettings';
import { Zap, Package } from 'lucide-react';
import { useWantStore } from '@/stores/wantStore';
import { useWantTypeStore } from '@/stores/wantTypeStore';
import { useConfigStore } from '@/stores/configStore';
import { useCharacterStore, getDefaultCursorColor } from '@/stores/characterStore';
import { useDarkMode } from '@/hooks/useDarkMode';
import { resolveWantIcon, type IconFamily } from '@/components/dashboard/WantTypeVisuals';
import { wantTypeIconStyle } from '@/components/dashboard/WantCardFace';
import { classNames } from '@/utils/helpers';
import { getBackgroundStyle, getBackgroundOverlayClass } from '@/utils/backgroundStyles';
import { ReorderableGhost } from '@/components/reorderable/ReorderableGhost';
import type { ReorderableGhostState } from '@/components/reorderable/useReorderableGroup';

interface DragOverlayProps {
  /** Want-reorder ghost state, owned by useReorderableGroup in Dashboard.tsx. */
  ghostState: ReorderableGhostState | null;
}

/**
 * Want-specific drag overlay: renders the generic reorder ghost
 * (ReorderableGhost) with want-shaped content (type icon badge, name,
 * category background) for mouse/Shift+Arrow/A+stick want reordering, and
 * separately the "drop to create" ghost for dragging a want-type/recipe
 * template from the palette onto the canvas (template mode, mouse-only,
 * unrelated to reordering — not part of the generic extraction).
 */
export const DragOverlay: React.FC<DragOverlayProps> = ({ ghostState }) => {
  // Per-field selectors — a selector-less useWantStore() re-rendered this
  // overlay on every store write, including the per-dragover ones.
  const wants = useWantStore(s => s.wants);
  const draggingTemplate = useWantStore(s => s.draggingTemplate);
  const isOverTarget = useWantStore(s => s.isOverTarget);
  const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 });

  const wantTypes = useWantTypeStore(s => s.wantTypes);
  useWantTypeStore(s => s.categoryBgMap);
  useWantTypeStore(s => s.typeIconMap);
  useWantTypeStore(s => s.categoryIconMap);
  const iconFont = useIconFont() as IconFamily;

  // Same color source as the free-roaming cursor / canvas CursorMan / the
  // destination indicator (WantGrid) — one consistent "this is what I'm
  // moving" color across the whole app instead of a fixed blue.
  const isDarkMode = useDarkMode();
  const getMyCharacter = useCharacterStore(s => s.getMyCharacter);
  const myDefaultCursorColor = useCharacterStore(s => s.myDefaultCursorColor);
  const cursorColor = getMyCharacter()?.color ?? myDefaultCursorColor ?? getDefaultCursorColor(isDarkMode);

  const want = ghostState ? wants.find(w => (w.metadata?.id === ghostState.id) || (w.id === ghostState.id)) : undefined;
  const isTemplateMode = !!draggingTemplate;

  const matchedType = wantTypes.find(t => t.name === want?.metadata?.type);
  const isRecipeBased = want?.metadata?.labels?.['recipe-based'] === 'true';
  const TypeIcon = want
    ? resolveWantIcon(want.metadata?.type ?? '', matchedType?.category ?? '', isRecipeBased, iconFont)
    : null;

  // The ghost's glyph and its badge take the want type's colour; the ghost's
  // outer frame stays the character's, since that is what says who is dragging.
  const typeGhostColor = (wantTypeIconStyle(want?.metadata?.type ?? '', matchedType?.category ?? '', isDarkMode).color as string) ?? cursorColor;

  const backgroundStyle = isTemplateMode
    ? getBackgroundStyle(draggingTemplate.id)
    : getBackgroundStyle(want?.metadata?.type);

  React.useEffect(() => {
    const handleDragOver = (e: DragEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    if (draggingTemplate) window.addEventListener('dragover', handleDragOver);
    return () => window.removeEventListener('dragover', handleDragOver);
  }, [draggingTemplate]);

  // Template drag overlay
  if (isTemplateMode) {
    const icon = draggingTemplate.type === 'want-type'
      ? <Zap className="w-5 h-5 text-blue-500" />
      : <Package className="w-5 h-5 text-green-500" />;

    const borderColor = draggingTemplate.type === 'want-type' ? 'border-blue-500' : 'border-green-500';

    return (
      <div
        className="fixed pointer-events-none z-[9999] transition-transform duration-200 ease-out"
        style={{
          left: mousePos.x,
          top: mousePos.y,
          transform: `translate(-50%, -50%) ${isOverTarget ? 'scale(0.6)' : 'scale(1)'}`,
        }}
      >
        <div
          className={classNames(
            `rounded-lg shadow-2xl border-2 ${borderColor} p-4 w-48 overflow-hidden transition-all duration-300 relative`,
            backgroundStyle.className,
            isOverTarget ? "opacity-90" : "opacity-100"
          )}
          style={backgroundStyle.style}
        >
          {backgroundStyle.hasBackgroundImage && (
            <div className={getBackgroundOverlayClass()}></div>
          )}
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              {icon}
              <h4 className="text-sm font-bold text-gray-900 truncate">
                {draggingTemplate.name}
              </h4>
            </div>
            <p className="text-xs text-gray-500">
              {draggingTemplate.type === 'want-type' ? 'Want Type' : 'Recipe'}
            </p>
            <p className="text-xs text-gray-400 mt-1">Drop to create</p>
          </div>
        </div>
      </div>
    );
  }

  if (!want) return null;

  return (
    <ReorderableGhost
      state={ghostState}
      color={cursorColor}
      scale={isOverTarget ? 0.6 : 1}
      className={backgroundStyle.className}
      style={backgroundStyle.style}
      renderContent={() => (
        <>
          {backgroundStyle.hasBackgroundImage && (
            <div className={getBackgroundOverlayClass()}></div>
          )}
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-1">
              {TypeIcon && (
                // Small circular badge behind the icon so it stays visible
                // regardless of the card's own background color/gradient —
                // matches the badge treatment WantCard already uses for
                // subtype icons.
                <span
                  className="flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0"
                  style={{ backgroundColor: `${typeGhostColor}30`, boxShadow: `0 0 0 1.5px ${typeGhostColor}55` }}
                >
                  <TypeIcon className="w-3.5 h-3.5" style={wantTypeIconStyle(want.metadata?.type ?? '', matchedType?.category ?? '', isDarkMode)} />
                </span>
              )}
              <h4 className="text-sm font-bold text-gray-900 truncate">
                {want.metadata?.name || 'Unnamed Want'}
              </h4>
            </div>
            <p className="text-xs text-gray-500">{want.metadata?.type || 'Unknown Type'}</p>
          </div>
        </>
      )}
    />
  );
};
