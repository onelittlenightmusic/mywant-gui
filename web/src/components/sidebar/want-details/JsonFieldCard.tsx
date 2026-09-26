/** A JSON-object-valued field, shown as its keys pilled together rather than nested. Exported: also used by GlobalStateSidebar. */
import * as LucideIcons from 'lucide-react';
import React, { useEffect, useLayoutEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Edit, X, Plus, LucideIcon, ArrowUpFromLine, Trash2 } from 'lucide-react';
import { useCardOverlaySound } from '@/stores/cardOverlaySounds';
import { classNames } from '@/utils/helpers';
import { WantCard } from '@/components/dashboard/WantCard/WantCard';
import { getTypeStyle } from '@/components/forms/sections/ParameterGridSection';
import { OverlayActionGrid } from '@/components/common/OverlayActionGrid';
import { useDataTypes, selfDescribedSubtype } from '@/hooks/useDataTypes';
import { MarkButton, MarkBadges, markKey } from '@/components/common/MarkButton';
import { useThingNames } from '@/hooks/useThingNames';
import { useWiringMarks } from '@/hooks/useWiringMarks';
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
import { useTouchLongPress, longPressStyle } from '@/hooks/useTouchLongPress';



// One key chip inside a JsonFieldCard — a miniature version of StateFieldCard,
// colored by its own value's type so e.g. a nested number reads differently
// from a string. Value itself isn't shown (just the field name) — this needs
// to fit several of these inside the outer card's own fixed height, and the
// full value is one click away via the card's own overlay anyway. The value
// is still available on hover via the title tooltip.
const MiniValuePill: React.FC<{ name: string; value: unknown }> = ({ name, value }) => {
  const { getTypeInfo } = useDataTypes();
  // A key inside an object can be a thing in its own right — the coordinate
  // under `from_resolved` is 自宅 — and the pill is the only place that value
  // is shown at all. The dot alone: there is no room here for a name, and the
  // outer card's own mark says what the whole field is.
  const { marks } = useThingNames(value, selfDescribedSubtype(value));
  const isObj = value !== null && typeof value === 'object' && !Array.isArray(value);
  const type = Array.isArray(value) ? 'array' : typeof value === 'boolean' ? 'bool' : typeof value === 'number' ? 'int' : isObj ? 'object' : 'string';
  // A nested self-descriptive object (e.g. { lat, lng, type: "location_coordinate" })
  // resolves its own icon/color from the catalog instead of the generic object styling.
  const selfType = isObj ? selfDescribedSubtype(value) : undefined;
  const subTypeInfo = selfType ? getTypeInfo(selfType) : null;
  const subTypeIcon = subTypeInfo?.icon ? ((LucideIcons as Record<string, unknown>)[subTypeInfo.icon] as LucideIcon | undefined) ?? null : null;
  const { scheme, BgIcon } = getTypeStyle(type, false, subTypeIcon);
  const displayVal = (() => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'string') return value || '""';
    if (typeof value === 'number') return String(value);
    if (Array.isArray(value)) return value.length === 0 ? '[]' : `[ ${value.length} ]`;
    const keys = Object.keys(value as object);
    return keys.length === 0 ? '{}' : '{…}';
  })();
  return (
    <div
      className={classNames('flex items-center gap-1 rounded-md px-1.5 py-0.5 min-w-[3.5rem] max-w-[7rem]', scheme.cardBg)}
      title={displayVal}
    >
      <BgIcon
        className={classNames('w-2.5 h-2.5 shrink-0', subTypeInfo ? '' : scheme.iconColor)}
        style={subTypeInfo ? { color: subTypeInfo.color } : undefined}
      />
      <span className="text-[9px] font-semibold text-gray-600 dark:text-gray-300 truncate leading-none">{name}</span>
      {marks.slice(0, 1).map((m) => (
        <MarkButton key={markKey(m)} mark={m} size={14} />
      ))}
    </div>
  );
};

// A "card in card": a JSON-type derived field renders as a full-width card containing
// one MiniValuePill per key, mirroring the { (A) (B) } editor UI used to build it.
export const JsonFieldCard: React.FC<{
  name: string;
  value: Record<string, unknown>;
  exposes?: ExposeEntry[];
  onGoToExpose?: (key?: string) => void;
  onDelete?: () => void;
  onEdit?: () => void;
  /** subType declared via the add-field UI's subtype picker (fallback below self-description). */
  declaredSubType?: string;
  isFocused?: boolean;
  /** Set by the grid when Shift+Enter targets this card — opens the overlay. */
  activated?: boolean;
  onActivationConsumed?: () => void;
  /** Click handler: requests the isFocused ring only, like StateFieldCard. */
  onFocusRequest?: () => void;
}> = ({ name, value, exposes, onGoToExpose, onDelete, onEdit, declaredSubType, isFocused, activated, onActivationConsumed, onFocusRequest }) => {
  const { getTypeInfo } = useDataTypes();
  // `type` is self-descriptive-object metadata (picks the icon/subtype styling
  // below), not user data — showing it as its own pill is just noise, doubly
  // so now that this card is single-cell width instead of full-row.
  const entries = Object.entries(value).filter(([k]) => k !== 'type');
  const [showOverlay, setShowOverlay] = useState(false);
  useCardOverlaySound(showOverlay);
  // See StateFieldCard: contextmenu is unreachable by touch on iOS.
  const longPress = useTouchLongPress(() => {
    onFocusRequest?.();
    setShowOverlay(true);
  });

  useEffect(() => {
    if (activated) {
      setShowOverlay(true);
      onActivationConsumed?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activated]);

  const isExposed = exposes?.some(e => e.currentState === name) ?? false;
  const wiringMarks = useWiringMarks(name, { exposes });
  // Self-descriptive object subtype (see datatypes.yaml) takes precedence; falls
  // back to the subtype declared via the add-field UI's picker.
  const selfType = selfDescribedSubtype(value) || declaredSubType;
  const subTypeInfo = selfType ? getTypeInfo(selfType) : null;
  const subTypeIcon = subTypeInfo?.icon ? ((LucideIcons as Record<string, unknown>)[subTypeInfo.icon] as LucideIcon | undefined) ?? null : null;
  const subTypeColor = subTypeInfo?.color;
  // Same background-icon-badge treatment as scalar subtype fields (e.g. percentage) —
  // a circular colored badge (or faint watermark when no subtype) bottom-left of the card.
  const { BgIcon } = getTypeStyle('object', false, subTypeIcon);
  const overlayItems = [
    {
      icon: <ArrowUpFromLine className="w-4 h-4 text-white" />,
      label: 'Expose',
      title: isExposed ? 'View expose settings' : 'Expose this field',
      onClick: () => { setShowOverlay(false); onGoToExpose?.(name); },
      colorClass: isExposed ? 'bg-purple-600/90' : 'bg-purple-500/75',
      delay: 0,
    },
    ...(onEdit ? [{
      icon: <Edit className="w-4 h-4 text-white" />,
      label: 'Edit',
      title: 'Edit this field',
      onClick: () => { setShowOverlay(false); onEdit(); },
      colorClass: 'bg-blue-600/80',
      delay: 30,
    }] : []),
    ...(onDelete ? [{
      icon: <Trash2 className="w-4 h-4 text-white" />,
      label: 'Delete',
      title: 'Delete this field',
      onClick: () => { setShowOverlay(false); onDelete(); },
      colorClass: 'bg-red-600/80',
      delay: 60,
    }] : []),
    {
      icon: <X className="w-4 h-4 text-white" />,
      label: 'Close',
      title: 'Close',
      onClick: () => setShowOverlay(false),
      colorClass: 'bg-gray-600/75',
      delay: 90,
    },
  ];
  return (
    <div
      className={classNames(
        'relative h-14 overflow-hidden rounded-lg sm:rounded-xl p-2 sm:p-2.5 shadow-sm bg-amber-50/70 dark:bg-amber-900/15 border',
        isFocused
          ? 'mw-card-focus border-amber-200/60 dark:border-amber-800/40'
          : 'border-amber-200/60 dark:border-amber-800/40',
      )}
      style={longPressStyle}
      onClick={onFocusRequest}
      // Takes the focus as well as opening the actions — the same state the
      // touch long-press above and the gamepad's Start both leave the card in.
      // Right-click was the one door that opened the overlay without saying
      // which card it belonged to.
      onContextMenu={(e) => { e.preventDefault(); onFocusRequest?.(); setShowOverlay(true); }}
      {...longPress.handlers}
      data-free-cursor-item
    >
      <div className="absolute inset-0 overflow-hidden rounded-lg sm:rounded-xl pointer-events-none">
        {subTypeColor ? (
          <div
            className="absolute bottom-1 left-1.5 w-8 h-8 sm:w-11 sm:h-11 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${subTypeColor}30` }}
          >
            <BgIcon className="w-4 h-4 sm:w-6 sm:h-6" style={{ color: subTypeColor, opacity: 0.85 }} />
          </div>
        ) : (
          <BgIcon className="absolute bottom-1 left-1.5 w-7 h-7 sm:w-10 sm:h-10 opacity-[0.22] dark:opacity-[0.18] text-amber-500 dark:text-amber-400" />
        )}
      </div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[11px] font-semibold card-ink truncate">{name}</span>
      </div>
      {entries.length === 0 ? (
        <span className="text-[11px] text-gray-400 dark:text-gray-500 italic">{'{}'}</span>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {entries.map(([k, v]) => <MiniValuePill key={k} name={k} value={v} />)}
        </div>
      )}

      {/* The same corner marks the scalar field cards wear: where this field's
          value goes, and who reads it. */}
      {!showOverlay && (
        <MarkBadges marks={wiringMarks}>
          {wiringMarks.length === 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowOverlay(true); }}
              className="w-5 h-5 flex items-center justify-center rounded-full bg-gray-200/60 dark:bg-gray-700/60 hover:bg-gray-300/80 dark:hover:bg-gray-600/80 transition-colors opacity-50 hover:opacity-100"
              title="Field options"
            >
              <Plus className="w-2.5 h-2.5 text-gray-500 dark:text-gray-400" />
            </button>
          )}
        </MarkBadges>
      )}

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
