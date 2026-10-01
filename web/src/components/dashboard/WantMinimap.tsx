import React, { useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { useIconFont } from '@/hooks/useDisplaySettings';
import { useHeaderAtBottom } from '@/hooks/useDisplaySettings';
import { Want } from '@/types/want';
import { classNames } from '@/utils/helpers';
import { minimapSurfaceClass } from './minimapSurface';
import { useColorMode } from '@/hooks/useColorMode';
import { useWantTypeStore } from '@/stores/wantTypeStore';
import { useMinimapFocusStore } from '@/stores/minimapFocusStore';
import { WantNotifyBadge } from './WantNotifyBadge';
import { warpFreeCursorToElement } from '@/hooks/useFreeCursorNav';
import styles from './WantCard.module.css';
import { getStatusHexColor } from './WantCard/parts/StatusColor';
import { StatusChangeIcon } from './WantCard/parts/StatusChangeIcon';
import { wantTypeIconStyle } from './WantCardFace';
import {
  getCategoryBgLight,
  getCategoryBgDark,
  resolveWantIcon,
  type IconFamily,
} from './WantTypeVisuals';
import { useCharacterStore } from '@/stores/characterStore';

/** Where the panel's top stands when the header is along the top. */
const MINIMAP_TOP_EDGE = 'calc(env(safe-area-inset-top, 0px) + var(--header-height, 4rem) + var(--host-inset-top, 0px))';

// ── Existing minimap card components ─────────────────────────────────────────

interface WantMinimapProps {
  wants: Want[]; // Parent cards (filteredWants)
  drafts: Want[]; // Draft cards
  selectedWantId?: string;
  onWantClick: (wantId: string) => void;
  onWantDoubleClick?: (wantId: string) => void;
  onDraftClick: (draftId: string) => void;
  isOpen: boolean; // Mobile toggle control
  /**
   * A spatial map to show instead of the cards — the board's, on the canvas
   * page. Given the ref the panel steers it by, and the selection it shares
   * with the cards. The list has none, and draws the cards.
   */
  renderSpatial?: (
    ref: React.RefObject<SpatialMinimapNav>,
    shared: { selectedWantId?: string; onWantClick: (wantId: string) => void; onWantDoubleClick?: (wantId: string) => void },
  ) => React.ReactNode;
}

/** What the panel asks of a spatial map it holds. */
export interface SpatialMinimapNav {
  /** Take the keys over from the board; false when there is nothing to take them to. */
  enterNavFromCanvas(): boolean;
}

interface MinimapCardProps {
  want: Want;
  isSelected: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
}

interface MinimapDraftCardProps {
  want: Want;
  isSelected: boolean;
  onClick: () => void;
}

/**
 * Miniature version of a regular Want card
 */
const MinimapCard: React.FC<MinimapCardProps> = ({ want, isSelected, onClick, onDoubleClick }) => {
  const [isBlinking, setIsBlinking] = useState(false);
  const colorMode = useColorMode();
  const isDark = colorMode === 'dark';

  const wantTypes = useWantTypeStore(s => s.wantTypes);
  useWantTypeStore(s => s.typeIconMap);
  useWantTypeStore(s => s.categoryIconMap);
  const iconFont = useIconFont() as IconFamily;

  const matchedWantType = wantTypes.find(t => t.name === want.metadata?.type);
  const typeCategory = matchedWantType?.category ?? '';
  const typeName = want.metadata?.type ?? '';
  const isRecipeBased = want.metadata?.labels?.['recipe-based'] === 'true';

  const TypeIcon = resolveWantIcon(typeName, typeCategory, isRecipeBased, iconFont);

  const bgStyle: React.CSSProperties = {
    background: isDark
      ? getCategoryBgDark(typeCategory)
      : getCategoryBgLight(typeCategory),
    height: '40px',
    minHeight: '40px',
  };

  const handleClick = useCallback(() => {
    setIsBlinking(false);
    requestAnimationFrame(() => { setIsBlinking(true); });
    onClick();
  }, [onClick]);

  // Only the amber/yellow "needs attention" states (config_error, stopped,
  // waiting_user_action, suspended) still show a status icon — every other
  // status is silent now that the type icon itself is bigger.
  const showStatusIcon = getStatusHexColor(want.status) === '#f59e0b';

  return (
    <div
      className={classNames(
        'relative rounded border cursor-pointer transition-all duration-200 overflow-hidden',
        'flex items-center justify-center',
        'hover:border-blue-400 hover:shadow-md',
        isSelected ? 'border-blue-400 border-2' : 'border-white/20 dark:border-white/10',
        isBlinking && styles.minimapBlink,
      )}
      style={bgStyle}
      onClick={handleClick}
      onDoubleClick={onDoubleClick}
      onAnimationEnd={() => setIsBlinking(false)}
      title={want.metadata?.name || want.metadata?.id || want.id}
      data-free-cursor-item
      data-want-id={want.metadata?.id || want.id}
    >
      <TypeIcon
        width={21}
        height={21}
        // The want type's own colour and emboss, same as the want card's badge
        // and the child mini tiles — not a flat neutral tint.
        style={{ ...wantTypeIconStyle(typeName, typeCategory, isDark), flexShrink: 0 }}
      />
      {showStatusIcon && (
        <StatusChangeIcon status={want.status} size="xs" className="absolute bottom-0.5 right-0.5 z-10" />
      )}
      {/* Unread per-want alerts — the TOP-RIGHT corner, the same one the board
          tile pins it to, so a want's alert is in the same place wherever the
          want is drawn. The status icon moves to the bottom-right to clear it.
          overflow-hidden clips the corner, so it sits just inside. */}
      <WantNotifyBadge
        wantId={want.metadata?.id || want.id || ''}
        size={14}
        style={{ position: 'absolute', top: 1, right: 1, zIndex: 20 }}
      />
    </div>
  );
};

/**
 * Miniature version of a Draft Want card
 */
const MinimapDraftCard: React.FC<MinimapDraftCardProps> = ({ want, isSelected, onClick }) => {
  const current = want.state?.current || {};
  const phase = (current.phase as string) || '';
  const isThinking = (current.isThinking as boolean) ||
    phase === 'ideating' || phase === 'decomposing' || phase === 're_planning';
  const message = (current.goal_text as string) || (current.message as string) || want.metadata?.name || 'Draft Want';

  return (
    <div
      className={classNames(
        'rounded border-2 border-dashed cursor-pointer transition-all duration-200',
        'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700',
        'hover:border-blue-400 dark:hover:border-blue-300',
        isSelected ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/30' : 'border-gray-400 dark:border-gray-600',
        isThinking && 'animate-pulse',
      )}
      style={{ height: '40px', minHeight: '40px' }}
      onClick={onClick}
      title={message}
      data-free-cursor-item
    />
  );
};

export interface WantMinimapRef {
  /**
   * Focus the minimap panel — one shared entry point regardless of mode, so
   * Dashboard's L1/R1 handler doesn't need to know which kind of minimap is
   * currently rendered. Canvas mode: spatial nearest-mini-tile-by-row (see
   * CanvasSpatialMinimapRef; `gridY` required there). List mode: just clicks
   * the first mini-card (same click path a mouse would use, so it gets the
   * same isBlinking flash for free) — `gridY` is ignored. Returns false
   * (no-op) if the panel isn't visible or has nothing to focus.
   */
  enterNav(gridY?: number): boolean;
}

/**
 * WantMinimap Component
 * Displays miniature versions of Want cards and Draft cards.
 * When in canvas mode, also renders a spatial overview map at the bottom.
 *
 * Fixed position on the right side, matches WantGrid layout (3 columns)
 */

export const WantMinimap = forwardRef<WantMinimapRef, WantMinimapProps>(({
  wants,
  drafts,
  selectedWantId,
  onWantClick,
  onWantDoubleClick,
  onDraftClick,
  isOpen,
  renderSpatial,
}, ref) => {
  const isHeaderBottom = useHeaderAtBottom();


  const isCanvasMode = !!renderSpatial;

  // The frame, in the character's own colour — the same colour the board's frame
  // and the detail panel's are drawn in.
  const minimapFocused = useMinimapFocusStore(s => s.focused);
  const focusColor = useCharacterStore(s => s.getMyCharacter())?.color ?? '#38bdf8';

  const spatialRef = useRef<SpatialMinimapNav>(null);
  const listGridRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => ({
    enterNav: (gridY?: number) => {
      // Only accept the handoff if the minimap panel is actually visible —
      // on narrow screens it's translated off-screen unless explicitly
      // opened (isOpen), so silently "handing off" to it there would just
      // make CursorMan/focus vanish with nothing visible to interact with.
      const panelVisible = isOpen || window.innerWidth >= 1024;
      if (!panelVisible) return false;
      // gridY is ignored in canvas mode now — the keys move the camera rather
      // than landing on a want, so there is no row to start from. Kept in the
      // signature for the list-mode branch's callers.
      if (isCanvasMode) return spatialRef.current?.enterNavFromCanvas() ?? false;
      const grid = listGridRef.current;
      if (!grid) return false;
      // Land on the mini-card matching whichever want is currently
      // keyboard/gamepad-focused in the main list (not just always the
      // first one), so the jump reads as "this same want, now on the
      // minimap" rather than resetting focus to an arbitrary card.
      const focusedListId = document
        .querySelector('[data-keyboard-nav-selected="true"]')
        ?.getAttribute('data-keyboard-nav-id');
      const matched = focusedListId
        ? grid.querySelector<HTMLElement>(`[data-want-id="${CSS.escape(focusedListId)}"]`)
        : null;
      const target = matched ?? grid.querySelector<HTMLElement>('[data-free-cursor-item]');
      if (!target) return false;
      target.click();
      // Visually relocate the free-roaming cursor (CursorMan) onto this same
      // mini-card, with its highlight frame animating the move — otherwise
      // the click alone changes selection state but the cursor icon itself
      // stays wherever it last was.
      warpFreeCursorToElement(target);
      return true;
    },
  }), [isOpen, isCanvasMode]);

  return (
    <div
      className={classNames(
        "fixed right-0 w-full sm:w-[480px] border-l transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
        minimapSurfaceClass(isCanvasMode),
        // Out of the header, not in from the side.
        //
        // It used to arrive from the right edge, which is a direction nothing
        // opened it from — the button that does is in the header, at the top or
        // the bottom depending on the layout. Sliding along the axis the header
        // is on makes the panel come from the control, the way the pad and the
        // menus do.
        "lg:translate-y-0 lg:translate-x-0",
        // Shut, it travels its own height AND the distance it stands off the
        // edge (--minimap-edge, below). By its height alone it stopped that
        // far short, under the header — hidden by the header where there is
        // one, a translucent band across the top where an app frames the page
        // and there is none.
        isOpen
          ? "translate-y-0"
          : classNames(
            isHeaderBottom ? "translate-y-[calc(100%_+_var(--minimap-edge))]" : "translate-y-[calc(-100%_-_var(--minimap-edge))]",
            "lg:translate-y-0",
          ),
        "z-30"
      )}
      // The one stable handle on this panel, for the same reason the detail
      // panel carries data-sidebar: things outside React need to ask "is this
      // inside the minimap?" — the free cursor, so it cannot reach out of a
      // surface that holds the keys and click something behind it.
      data-minimap-panel="true"
      style={{
        // Under the header as tall as it is (no longer a fixed 4rem), and
        // under a framing app's bar along the top (lib/nativeHost).
        top: isHeaderBottom ? 'env(safe-area-inset-top, 0px)' : MINIMAP_TOP_EDGE,
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + var(--host-inset-bottom, 0px))',
        display: 'flex',
        flexDirection: 'column',
        ['--minimap-edge' as string]: isHeaderBottom
          ? 'calc(env(safe-area-inset-bottom, 0px) + var(--host-inset-bottom, 0px))'
          : MINIMAP_TOP_EDGE,
      }}
    >
      {/* The frame that says the keys are here.
          Its own absolutely-positioned layer above everything the panel draws,
          for the reason RightSidebar's must be: the content paints its own
          backgrounds over any decoration on the wrapper, and an outward shadow
          would be clipped by the panel's bounds. Same 3px inset ring and inner
          glow the board and the detail panel wear, in the same character
          colour — one signal, drawn one way, wherever the keys went. */}
      {minimapFocused && (
        <div
          className="absolute inset-0 pointer-events-none z-50"
          style={{ boxShadow: `inset 0 0 0 3px ${focusColor}, inset 0 0 24px ${focusColor}55` }}
        />
      )}

      {/* Canvas mode: only the spatial minimap, filling the whole panel */}
      {isCanvasMode ? (
        renderSpatial(spatialRef, { selectedWantId, onWantClick, onWantDoubleClick })
      ) : (
        /* List mode: card grid as before */
        <div ref={listGridRef} className="grid grid-cols-3 gap-2 auto-rows-min">
          {wants.map(want => {
            const wantId = want.metadata?.id || want.id || '';
            return (
              <MinimapCard
                key={wantId}
                want={want}
                isSelected={selectedWantId === wantId}
                onClick={() => onWantClick(wantId)}
                onDoubleClick={onWantDoubleClick ? () => onWantDoubleClick(wantId) : undefined}
              />
            );
          })}

          {drafts.map(draft => {
            const draftId = draft.metadata?.id || draft.id || '';
            return (
              <MinimapDraftCard
                key={draftId}
                want={draft}
                isSelected={selectedWantId === draftId}
                onClick={() => onDraftClick(draftId)}
              />
            );
          })}

          <div
            className="rounded border border-dashed border-gray-300 bg-gray-100 dark:border-gray-700 dark:bg-gray-800 opacity-50"
            style={{ height: '40px' }}
            title="Add Want (placeholder)"
          />
        </div>
      )}
    </div>
  );
});
WantMinimap.displayName = 'WantMinimap';
