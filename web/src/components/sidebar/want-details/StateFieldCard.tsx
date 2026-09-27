/** One state field, as its own labeled card — the standard way a scalar or shallow object is shown. Exported: also used by GlobalStateSidebar. */
import * as LucideIcons from 'lucide-react';
import React, { useEffect, useLayoutEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Edit, X, Plus, LucideIcon, ArrowUpFromLine, ArrowDownToLine, Trash2, Star } from 'lucide-react';
import { useCharacterStore } from '@/stores/characterStore';
import { useFieldNamingStore } from '@/stores/fieldNamingStore';
import { useCardOverlaySound } from '@/stores/cardOverlaySounds';
import { classNames } from '@/utils/helpers';
import { WantCard } from '@/components/dashboard/WantCard/WantCard';
import { getTypeStyle } from '@/components/forms/sections/ParameterGridSection';
import { DisplayCard } from '@/components/forms/CardPrimitives';
import { OverlayActionGrid } from '@/components/overlay';
import { useDataTypes, selfDescribedSubtype } from '@/hooks/useDataTypes';
import { useAuraNaming } from '@/hooks/useAuraNaming';
import { MarkBadges, useMarkJump } from '@/components/common/MarkButton';
import { useThingNames } from '@/hooks/useThingNames';
import { useWiringMarks } from '@/hooks/useWiringMarks';
import { StateDef } from '@/types/wantType';
import { ExposeEntry } from '@/components/forms/sections/ExposeSection';
import {
  DetailsSidebar,
  TabContent,
  TabSection,
  TabGrid,
  EmptyState,
  InfoRow,
  TabConfig
} from '../DetailsSidebar';
import { useCardGridNavigation } from '@/hooks/useCardGridNavigation';
import { useValueBounce } from '@/hooks/useValueBounce';
import { useTouchLongPress, longPressStyle } from '@/hooks/useTouchLongPress';



// Sort an object's entries by state_timestamps descending (most recently updated first).
// Keys without a timestamp are placed at the end in their original order.
export const sortStateEntries = (
  obj: Record<string, unknown>,
  stateDefs?: StateDef[],
  timestamps?: Record<string, string>,
): [string, unknown][] => {
  const entries = Object.entries(obj);
  entries.sort(([aKey], [bKey]) => {
    const aDefIdx = stateDefs ? stateDefs.findIndex(s => s.name === aKey) : -1;
    const bDefIdx = stateDefs ? stateDefs.findIndex(s => s.name === bKey) : -1;
    if (aDefIdx !== -1 && bDefIdx !== -1) return aDefIdx - bDefIdx;
    if (aDefIdx !== -1) return -1;
    if (bDefIdx !== -1) return 1;
    const aTs = timestamps?.[aKey] ? new Date(timestamps[aKey]).getTime() : 0;
    const bTs = timestamps?.[bKey] ? new Date(timestamps[bKey]).getTime() : 0;
    if (aTs !== bTs) return bTs - aTs;
    return aKey.localeCompare(bKey);
  });
  return entries;
};

// A {lat,lng} pair if the value is coordinate-shaped, else null.
function coordOf(v: unknown): { lat: number; lng: number } | null {
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.lat === 'number' && typeof o.lng === 'number') return { lat: o.lat, lng: o.lng };
  }
  return null;
}

// Great-circle distance in metres — for matching a named place by proximity
// rather than exact value (GPS jitter means the live reading never equals the
// one captured at name time).
function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
const PLACE_MATCH_RADIUS_M = 150;

/** Exported so the Global sidebar can render global state with the very same
 *  field cards the want's own state uses. */
export const StateFieldCard: React.FC<{
  name: string;
  value: unknown;
  stateDefs?: StateDef[];
  exposes?: ExposeEntry[];
  imports?: Record<string, string>;
  onGoToExpose?: (key?: string) => void;
  onGoToImport?: (key?: string) => void;
  isFocused?: boolean;
  activated?: boolean;
  onActivationConsumed?: () => void;
  /** Set for fields added via the add-field UI — adds Delete/Edit actions to the overlay. */
  onDelete?: () => void;
  onEdit?: () => void;
  /**
   * The two presses the card answers while it is the focused one, routed here
   * by the grid because the grid is what the input is handed to (see
   * useCardGridNavigation): X names this value, Y follows its first mark.
   * Consumed the same way `activated` is.
   */
  nameRequest?: boolean;
  onNameRequestConsumed?: () => void;
  followRequest?: boolean;
  onFollowRequestConsumed?: () => void;
  /** subType declared via the add-field UI's subtype picker (fallback below self-description). */
  declaredSubType?: string;
  /** Click handler: only requests keyboard/gamepad-style focus (the isFocused ring) — does NOT open the action overlay (that stays right-click/gamepad-confirm only). Lets the free-roaming cursor visibly focus this card when it snaps here. */
  onFocusRequest?: () => void;
  /** Owning want's id and type, plus which state section this field lives in —
   *  together they address an aura mark on this field. The id names the want
   *  being marked; the type is what the mark is stored against. Omitted (as in
   *  the derived-field editor's preview cards) means no aura action. */
  wantId?: string;
  wantType?: string;
  section?: string;
}> = ({ name, value, stateDefs, exposes, imports, onGoToExpose, onGoToImport, isFocused, activated, onActivationConsumed, onDelete, onEdit, nameRequest, onNameRequestConsumed, followRequest, onFollowRequestConsumed, declaredSubType, onFocusRequest, wantId, wantType, section }) => {
  const { getTypeInfo, fieldTypeMap } = useDataTypes();
  const [showOverlay, setShowOverlay] = useState(false);
  // The same open/close a want card's actions make. Sounded from the state
  // rather than from any of the ways in — see useCardOverlaySound.
  useCardOverlaySound(showOverlay);
  // Touch equivalent of the right-click below: iOS Safari never raises
  // contextmenu for a long press on an ordinary element, so on a phone this
  // card's actions had no way in at all. It also takes focus, so a touch leaves
  // the card in the same state the gamepad's Start would.
  const longPress = useTouchLongPress(() => {
    onFocusRequest?.();
    setShowOverlay(true);
  });
  // Bounces the value when it changes live (SSE want_changed → refetch → new prop).
  const bounceKey = useValueBounce(value);
  const characters = useCharacterStore(s => s.characters);
  const myCharacterId = useCharacterStore(s => s.myCharacterId);
  const setAuraDefinition = useCharacterStore(s => s.setAuraDefinition);
  const clearAuraDefinition = useCharacterStore(s => s.clearAuraDefinition);

  useEffect(() => {
    if (activated) {
      setShowOverlay(true);
      onActivationConsumed?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activated]);
  const sd = stateDefs?.find(s => s.name === name);
  const isObjectValue = value !== null && typeof value === 'object' && !Array.isArray(value);
  const type = sd?.type ?? (Array.isArray(value) ? 'array' : typeof value === 'boolean' ? 'bool' : typeof value === 'number' ? 'int' : isObjectValue ? 'object' : 'string');
  // Self-described subtype (value's own `type` field, e.g. { lat, lng, type: "location_coordinate" })
  // takes precedence over the declared stateDef subType, which falls back to fieldTypeMap
  // (covers predefined fields not in stateDefs API response).
  const effectiveSubType = selfDescribedSubtype(value) || declaredSubType || sd?.subType || fieldTypeMap[name] || null;
  const subTypeInfo = effectiveSubType ? getTypeInfo(effectiveSubType) : null;
  const subTypeIcon = subTypeInfo?.icon ? ((LucideIcons as Record<string, unknown>)[subTypeInfo.icon] as LucideIcon | undefined) ?? null : null;
  const subTypeColor = subTypeInfo?.color;
  const { scheme, BgIcon } = getTypeStyle(type, false, subTypeIcon);

  // Naming this value into its catalog (the X key and the card's Aura action)
  // — create, rename and delete all live in this one flow. Shared with the
  // parameter cards via useAuraNaming.
  const aura = useAuraNaming({
    value,
    subType: effectiveSubType,
    notifyTarget: wantId ? { targetType: 'want_card', targetId: wantId } : undefined,
    wantId,
  });

  // A want tile's X (see WantCard) raises a naming request for its final-result
  // *source* field — which is this card. When the request targets us, focus this
  // card (the existing per-card focus) and open the same unified Aura editor,
  // then consume it. Lets the whole-want X and the per-field X share one flow.
  // X: name this value. Y: go to the first thing it turned out to be.
  // Both arrive from the grid (see useCardGridNavigation's onButtonX/onYButton)
  // and are consumed on arrival, exactly as `activated` is.
  useEffect(() => {
    if (!nameRequest) return;
    onNameRequestConsumed?.();
    aura.open();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameRequest]);
  useEffect(() => {
    if (!followRequest) return;
    onFollowRequestConsumed?.();
    if (marks[0]) jumpToMark(marks[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followRequest]);

  const namingRequest = useFieldNamingStore(s => s.request);
  const consumeNaming = useFieldNamingStore(s => s.consume);
  useEffect(() => {
    if (!namingRequest || !wantId || namingRequest.wantId !== wantId) return;
    if (namingRequest.field.split('.')[0] !== name) return;
    onFocusRequest?.();
    aura.open();
    consumeNaming();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namingRequest, wantId, name]);
  const displayVal = (() => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'string') return value || '""';
    if (typeof value === 'number') return String(value);
    if (Array.isArray(value)) return value.length === 0 ? '[]' : `[ ${value.length} items ]`;
    const keys = Object.keys(value as object);
    return keys.length === 0 ? '{}' : `{ ${keys.slice(0, 2).join(', ')}${keys.length > 2 ? ', …' : ''} }`;
  })();
  const valueColorClass = (() => {
    if (effectiveSubType === 'percentage') {
      const n = typeof value === 'number' ? value : parseFloat(String(value));
      if (!isNaN(n)) {
        if (n >= 80) return 'text-red-600 dark:text-red-400';
        if (n >= 70) return 'text-orange-500 dark:text-orange-400';
      }
    } else if (type === 'bool') {
      if (displayVal === 'true') return 'text-green-600 dark:text-green-400';
      if (displayVal === 'false') return 'text-red-600 dark:text-red-400';
    }
    return null;
  })();

  const isExposed = exposes?.some(e => e.currentState === name) ?? false;
  const isImported = imports ? Object.values(imports).includes(name) : false;
  // The corner marks: what this value IS (a thing), and where it goes or comes
  // from (a want, or the global card it passes through).
  const { marks: thingMarks } = useThingNames(value, effectiveSubType);
  const wiringMarks = useWiringMarks(name, { exposes, imports, wantId });
  // Drawn in this order and followed in this order: Y takes the first, which is
  // the value's own identity before it is anyone else's wiring.
  const marks = [...thingMarks, ...wiringMarks];
  const jumpToMark = useMarkJump();

  const overlayItems = [
    // A single "Aura" action, mirroring the X key: name this value, or rename /
    // delete the name it already has. There is no separate endorse mark.
    ...(aura.nameable ? [{
      icon: <Star className="w-4 h-4 text-white" />,
      label: 'Aura',
      title: aura.myNamedDef
        ? `Rename or delete the name "${aura.myNamedDef.name}"`
        : `Name this ${aura.catalogKind}`,
      onClick: () => { setShowOverlay(false); aura.open(); },
      tone: 'caution' as const, off: !aura.myNamedDef,
      delay: 0,
    }] : []),
    // Expose/Import only exist for a want's own fields — the Global sidebar
    // renders these same cards with no want behind them, so an action with no
    // handler must not sit there dead.
    ...(onGoToExpose ? [{
      icon: <ArrowUpFromLine className="w-4 h-4 text-white" />,
      label: 'Expose',
      title: isExposed ? 'View expose settings' : 'Expose this field',
      onClick: () => { setShowOverlay(false); onGoToExpose?.(name); },
      tone: 'special' as const, off: !isExposed,
      delay: 0,
    }] : []),
    ...(onGoToImport ? [{
      icon: <ArrowDownToLine className="w-4 h-4 text-white" />,
      label: 'Import',
      title: isImported ? 'View import settings' : 'Import into this field',
      onClick: () => { setShowOverlay(false); onGoToImport?.(name); },
      tone: 'info' as const, off: !isImported,
      delay: 30,
    }] : []),
    ...(onEdit ? [{
      icon: <Edit className="w-4 h-4 text-white" />,
      label: 'Edit',
      title: 'Edit this field',
      onClick: () => { setShowOverlay(false); onEdit(); },
      tone: 'primary' as const,
      delay: 60,
    }] : []),
    ...(onDelete ? [{
      icon: <Trash2 className="w-4 h-4 text-white" />,
      label: 'Delete',
      title: 'Delete this field',
      onClick: () => { setShowOverlay(false); onDelete(); },
      tone: 'danger' as const,
      delay: 90,
    }] : []),
    {
      icon: <X className="w-4 h-4 text-white" />,
      label: 'Close',
      title: 'Close',
      onClick: () => setShowOverlay(false),
      tone: 'cancel' as const,
      delay: 120,
    },
    // Stagger by position rather than by the literal above, so the optional
    // items (Aura/Edit/Delete) don't leave gaps in the fan-out animation.
  ].map((item, i) => ({ ...item, delay: i * 30 }));

  return (
    <div
      className="relative"
      draggable
      style={longPressStyle}
      onDragStart={(e) => {
        // Lets the derived-field editor accept this field via drag-drop.
        e.dataTransfer.setData('application/mywant-field', name);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      // Takes the focus as well as opening the actions — the same state the
      // touch long-press above and the gamepad's Start both leave the card in.
      // Right-click was the one door that opened the overlay without saying
      // which card it belonged to.
      onContextMenu={(e) => { e.preventDefault(); onFocusRequest?.(); setShowOverlay(true); }}
      {...longPress.handlers}
    >
      <DisplayCard
        className={classNames(
          'relative rounded-lg sm:rounded-xl p-1.5 shadow-sm h-14',
          scheme.cardBg,
          isFocused ? 'mw-card-focus bg-white dark:bg-gray-800' : '',
        )}
        onClick={onFocusRequest}
        showFocusBar={isFocused}
        BgIcon={BgIcon}
        bgIconColor={subTypeColor ? '' : scheme.bgIconColor}
        inkColor={subTypeColor || scheme.color}
        bgIconStyle={subTypeColor ? { color: subTypeColor } : undefined}
        showBgIcon={true}
        headerLeft={
          <span className="text-[11px] font-semibold card-ink truncate leading-none">{name}</span>
        }
      >
        {(() => {
          const bigFont = displayVal.length <= 8;
          // overflow-visible (not hidden) so the bounce can grow upward past the
          // value box without being clipped by the key/header above; the span's
          // own max-w/min-w keeps long values truncated at rest so nothing spills
          // horizontally out of the card.
          return (
            <div className="h-full flex items-end justify-end overflow-visible">
              <span
                // Remounting on each change (key) restarts the CSS bounce; the
                // animation only applies once a real update has occurred.
                key={bounceKey}
                className={classNames(
                  'italic text-right leading-none font-mono origin-bottom-right max-w-full min-w-0',
                  bigFont ? 'text-2xl font-medium' : 'text-[11px] truncate',
                  valueColorClass ?? (bigFont ? 'text-gray-700 dark:text-gray-300' : 'text-gray-600 dark:text-gray-400'),
                  bounceKey > 0 ? 'animate-value-bounce' : '',
                )}
                title={displayVal}
              >
                {displayVal}
              </span>
            </div>
          );
        })()}
      </DisplayCard>

      {aura.editorNode}

      {/* What this value also is, in the corner it has always been said in.
          The expose badge used to be the only thing that lived here and it said
          only that the field was exposed; it now says who to, and stands beside
          the thing this value turned out to be. Always visible, above the
          overlay. */}
      <MarkBadges marks={marks}>
        {/* Nothing wired yet: the way to wire it. Not a mark — there is nowhere
            to go — so it opens the card's own actions. */}
        {wiringMarks.length === 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowOverlay(true); }}
            className="w-5 h-5 flex items-center justify-center rounded-full bg-gray-200/60 dark:bg-gray-700/60 hover:bg-gray-300/80 dark:hover:bg-gray-600/80 transition-colors opacity-50 hover:opacity-100"
            title="Expose or import this field"
          >
            <Plus className="w-2.5 h-2.5 text-gray-500 dark:text-gray-400" />
          </button>
        )}
      </MarkBadges>

      {/* Context overlay — visible on hover */}
      {showOverlay && (
        <OverlayActionGrid
          items={overlayItems}
          cols={4}
          onClose={() => setShowOverlay(false)}
          showLabel={true}
          className="absolute inset-0 z-20 rounded-lg overflow-hidden"
          backdropClassName="absolute inset-0 bg-black/55 rounded-lg"
          ignoreWhenInSidebar={false}
        />
      )}
    </div>
  );
};

