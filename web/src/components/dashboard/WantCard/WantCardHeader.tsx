import React, { useState, useEffect } from 'react';
import { Bot, Clock, X, Tag, Folder, RectangleHorizontal, Square, Maximize } from 'lucide-react';
import { apiClient } from '@/api/client';
import { Want } from '@/types/want';
import { StatusChangeIcon } from './parts/StatusChangeIcon';
import { resolveIconForFamily, getCategoryHexColor } from '@/components/dashboard/WantTypeVisuals';
import { getBackgroundToneColor } from '@/utils/backgroundStyles';
import { wantTypeIconStyle, cardInkVars } from '@/components/dashboard/WantCardFace';
import { useWantTypeStore } from '@/stores/wantTypeStore';
import { useCharacterStore } from '@/stores/characterStore';
import { useDarkMode } from '@/hooks/useDarkMode';
import { openWantApp } from '@/utils/wantUtils';
import { SubjectSays } from '@/components/sidebar/PanelIdentityRow';
import { extensionSlot } from '@/extensions/registry';

// ── Props ────────────────────────────────────────────────────────────────────

/**
 * Header of a *maximized* want card.
 *
 * The same head the corner card and the card in a panel wear — the want's
 * tile with its name, and what it is saying beside it (SubjectSays) — on the
 * card's own colours, with no band of its own; and the maximized card's own
 * controls (Wide, Max, Close) at its right end, in it rather than a row of
 * tiles beside it. In an app's frame (hostFramed) the app draws Max and Close
 * over its corner: the room is left for them.
 *
 * The compact card has no header any more — its type and status live in the
 * badge pill drawn on the card face.
 */
export interface WantCardHeaderProps {
  want: Want;
  isSelectMode?: boolean;
  isFullScreen?: boolean;
  /** User-defined groups this want belongs to (chips in the header). */
  groupNames?: string[];
  onCollapse?: () => void;
  /** Whether the card is drawn wide (see WantCard's getTargetRect). */
  isWide?: boolean;
  /** Widen or narrow the card. Left out where the screen has no room to widen. */
  onToggleWide?: () => void;
  /** Offer Max: the want on its own page (/w/:id) in a new tab, as "Open w" does. */
  showMax?: boolean;
  /** In an app's native card frame: its own Max and Close are drawn over the
   *  head's right end, so none here, and room left for them. */
  hostFramed?: boolean;
}

/** A round control in the head, as the app's own card buttons are. */
const HEAD_BUTTON = 'flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-white/70 dark:bg-gray-800/70 hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 shadow-sm backdrop-blur transition-colors duration-150 focus:outline-none';

// ── Component ────────────────────────────────────────────────────────────────

export const WantCardHeader: React.FC<WantCardHeaderProps> = ({
  want,
  isSelectMode = false,
  isFullScreen = false,
  groupNames = [],
  onCollapse,
  isWide = false,
  onToggleWide,
  showMax = false,
  hostFramed = false,
}) => {
  const hasScheduling = !!(want.spec?.when && want.spec.when.length > 0);

  // Resolve the want type icon (same source as the want type picker).
  // Subscribe to icon maps so the icon re-renders if plugin types load later.
  const wantTypes = useWantTypeStore(s => s.wantTypes);
  useWantTypeStore(s => s.typeIconMap);
  useWantTypeStore(s => s.categoryIconMap);
  useWantTypeStore(s => s.typeToneColorMap);
  useWantTypeStore(s => s.categoryBgMap);
  const matchedWantType = wantTypes.find(t => t.name === want.metadata?.type);
  const typeCategory = matchedWantType?.category ?? '';
  const TypeIcon = resolveIconForFamily(typeCategory, want.metadata?.type ?? '', 'lucide');

  // Header background follows the want type's color style (same source as the
  // card body's tint) rather than a flat selection-only color.
  const isDarkMode = useDarkMode();
  const typeColor = getBackgroundToneColor(want.metadata?.type) ?? getCategoryHexColor(typeCategory, isDarkMode);
  // The tile and its speech, as a corner card's head draws them — when the
  // edition has them (the canvas extension); else the type and the name.
  const wearsHead = extensionSlot('panelIdentityMark').length > 0;

  // ── Card aura mark: pressing X on a card aura-marks the want's final-result
  // field (see WantCard's onButtonX / cardAuraMark). The server owns which field
  // that is, so we only ask it who has marked this card and show their colours.
  const wantId = want.metadata?.id;
  const characters = useCharacterStore(s => s.characters);
  const myCharacterId = useCharacterStore(s => s.myCharacterId);
  const [markNames, setMarkNames] = useState<{ name: string; color: string }[]>([]);
  useEffect(() => {
    if (!wantId || !myCharacterId) { setMarkNames([]); return; }
    let cancelled = false;
    apiClient.getCardAuraMark(myCharacterId, wantId)
      .then(r => { if (!cancelled) setMarkNames(r.names ?? []); })
      .catch(() => { if (!cancelled) setMarkNames([]); });
    return () => { cancelled = true; };
    // Refetch when the character roster changes (a name toggles a character record).
  }, [wantId, myCharacterId, characters]);

  return (
    <div
      className="relative z-10 flex-shrink-0 flex items-center justify-between"
      style={{ ...cardInkVars(typeColor, isDarkMode), paddingRight: hostFramed ? 104 : 8 }}
    >
      {/* The head: the tile, its name, what it is saying — takes the spare
          width, so what follows sits together at the right end. */}
      {wearsHead ? (
        <div className="flex-1 min-w-0"><SubjectSays subject={{ kind: 'want', want }} /></div>
      ) : (
      <div className="flex-1 flex items-center gap-2 min-w-0 py-2.5 pl-4">
        <TypeIcon
          className="w-3.5 h-3.5 flex-shrink-0"
          style={wantTypeIconStyle(want.metadata?.type ?? '', typeCategory, isDarkMode)}
        />
        <span className="text-xs text-gray-500 dark:text-gray-400">{want.metadata?.type}</span>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <span className="text-sm font-semibold card-ink truncate">
          {want.metadata?.name}
        </span>
      </div>
      )}

      {/* Right-side indicators */}
      <div className="flex items-center gap-2 flex-shrink-0 px-3">
        {/* Card name labels — the catalog name(s) this want's final-result value
            carries (X on the card names it). Shown in the authoring character's
            colour; display only. */}
        {markNames.map(({ name: defName, color }, i) => (
          <span
            key={`${defName}-${i}`}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-white text-[9px] sm:text-[10px] font-semibold flex-shrink-0 truncate max-w-[80px]"
            style={{ backgroundColor: color }}
            title={defName}
          >
            <Tag className="w-2 h-2 flex-shrink-0" /> {defName}
          </span>
        ))}

        {/* Group chips — user-defined groups this want belongs to. Same style as
            the thing card's group pill (indigo, in the header/badge area). */}
        {groupNames.map((gname) => (
          <span
            key={`grp-${gname}`}
            className="inline-flex items-center gap-0.5 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[8px] sm:text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex-shrink-0"
            title={`Group: ${gname}`}
          >
            <Folder className="w-2.5 h-2.5" />{gname}
          </span>
        ))}

        {/* Bot running indicator */}
        {(want.current_agent || (want.running_agents && want.running_agents.length > 0)) && (
          <div className="flex items-center">
            <Bot className="h-2 w-2 sm:h-3 sm:w-3 text-blue-600 dark:text-blue-400" />
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full animate-pulse ml-0.5" />
          </div>
        )}

        {/* Scheduling clock */}
        {hasScheduling && (
          <Clock className="h-2 w-2 sm:h-3 sm:w-3 text-amber-600 dark:text-amber-400" />
        )}

        {/* Status icon — bounces when the status changes (e.g. → achieved). */}
        {!isSelectMode && !isFullScreen && (
          <StatusChangeIcon status={want.status} size="sm" />
        )}
      </div>

      {/* The maximized card's own controls, round, in the head: Wide (as
          wide as the screen allows, and back — near YouTube's theatre-mode
          icons), Max (this want on its own page, as "Open w"), Close. */}
      {!hostFramed && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onToggleWide && (
            <button
              onClick={onToggleWide}
              className={HEAD_BUTTON}
              title={isWide ? '元の幅に戻す' : '横に広げる'}
              aria-label={isWide ? 'Narrow' : 'Wide'}
              aria-pressed={isWide}
            >
              {isWide ? <Square className="w-4 h-4" /> : <RectangleHorizontal className="w-4 h-4" />}
            </button>
          )}
          {showMax && (
            <button onClick={() => openWantApp(want)} className={HEAD_BUTTON} title="単独のページで開く（Open w）" aria-label="Max">
              <Maximize className="w-4 h-4" />
            </button>
          )}
          <button onClick={onCollapse} className={HEAD_BUTTON} title="Close (Esc)" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
