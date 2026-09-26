/** A named group of state fields (Current / Goal / Plan), each drawn as a StateFieldCard. */
import React, { useEffect, useLayoutEffect, useState, useCallback, useMemo, useRef } from 'react';
import { X, LucideIcon } from 'lucide-react';
import { WantCard } from '@/components/dashboard/WantCard/WantCard';
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

import { StateFieldCard } from './StateFieldCard';

export const StateSectionCards: React.FC<{
  entries: [string, unknown][];
  icon: LucideIcon;
  label: string;
  stateDefs?: StateDef[];
  exposes?: ExposeEntry[];
  imports?: Record<string, string>;
  onGoToExpose?: (key?: string) => void;
  onGoToImport?: (key?: string) => void;
  isActive?: boolean;
  /** Up on the top row leaves the grid — see useCardGridNavigation.onExitTop. */
  onExitTop?: () => void;
  /**
   * A card here took the focus by being clicked.
   *
   * The panel steers either its card or its body, never both (see the parent's
   * detailRegion), and until now only the arrow keys ever moved that between
   * them. A click put the ring on a field while the region stayed on the card,
   * so the field looked focused, this grid's input capture stayed switched off
   * — it is gated on isActive, which is the region — and Shift+Enter went to
   * whoever was still listening: the want card above. Saying so here moves the
   * region with the click.
   */
  onFieldFocused?: () => void;
  /** Owning want and the state section these entries came from — passed through
   *  to each field card so it can address an aura mark on itself. */
  wantId?: string;
  wantType?: string;
  section?: string;
  /**
   * A control for this section, on the header line it already has.
   *
   * Clearing the state used to sit in a band of its own at the foot of the
   * panel — 37px and a border for one button, next to the way out, which is
   * both the most expensive space in the panel and the worst neighbour for
   * something destructive. It belongs to the state it erases, so it lives on
   * that section's title row and costs nothing.
   */
  action?: React.ReactNode;
}> = ({ entries, icon: Icon, label, stateDefs, exposes, imports, onGoToExpose, onGoToImport, isActive = true, onExitTop, onFieldFocused, wantId, wantType, section, action }) => {
  const [navFocused, setNavFocused] = useState(-1);
  const [activatedIndex, setActivatedIndex] = useState<number | null>(null);
  // X and Y, held for whichever card is focused. Same shape as activatedIndex:
  // the grid receives the press (it owns the input slot) and the card acts.
  const [nameIndex, setNameIndex] = useState<number | null>(null);
  const [followIndex, setFollowIndex] = useState<number | null>(null);

  const { gridProps: navGridProps } = useCardGridNavigation({
    count: entries.length,
    cols: 2,
    isActive,
    focusedIndex: navFocused,
    setFocusedIndex: setNavFocused,
    // Shift+Enter / gamepad Start opens the focused field's action overlay —
    // the same binding every other card grid uses. Plain Enter is deliberately
    // unbound here: a field card's actions all live in that overlay, so there
    // is no separate "primary" action for confirm to run.
    onContextMenu: (i) => setActivatedIndex(i),
    onButtonX: (i) => setNameIndex(i),
    onYButton: (i) => setFollowIndex(i),
    onExitTop,
  });

  useEffect(() => {
    if (isActive && navFocused < 0 && entries.length > 0) setNavFocused(0);
    if (!isActive) setNavFocused(-1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="w-3 h-3 text-gray-400 dark:text-gray-500" />
        <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</span>
        <span className="text-[10px] text-gray-400 dark:text-gray-500">({entries.length})</span>
        {action && <div className="ml-auto flex items-center">{action}</div>}
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-2 gap-2 sm:gap-3 outline-none" {...navGridProps}>
        {entries.map(([k, v], i) => (
          <StateFieldCard key={k} name={k} value={v} stateDefs={stateDefs}
            exposes={exposes} imports={imports}
            nameRequest={nameIndex === i} onNameRequestConsumed={() => setNameIndex(null)}
            followRequest={followIndex === i} onFollowRequestConsumed={() => setFollowIndex(null)}
            onGoToExpose={onGoToExpose} onGoToImport={onGoToImport}
            wantId={wantId} wantType={wantType} section={section}
            isFocused={navFocused === i}
            activated={activatedIndex === i}
            onActivationConsumed={() => setActivatedIndex(null)}
            onFocusRequest={() => { setNavFocused(i); onFieldFocused?.(); }} />
        ))}
      </div>
    </div>
  );
};
