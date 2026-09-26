import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, Check, Folder, Plus, Trash2, Undo2, X } from 'lucide-react';
import { ThingRecord } from '@/types/thing';
import { Constellation } from '@/types/constellation';
import { labelsById, useThingStore } from '@/stores/thingStore';
import { membersById, useConstellationStore } from '@/stores/constellationStore';
import { CONSTELLATION_COLORS } from '@/types/constellation';
import { useThingTileStore } from '@/stores/thingTileStore';
import { reorderIds, sortThings, stepIds } from '@/utils/thingOrder';
import { lineUp, type LayoutAxis } from '@/utils/thingLayout';
import { playSound } from '@/utils/sounds';
import { classNames } from '@/utils/helpers';
import { resolveLucideIcon } from '@/utils/subtypeIcons';
import { DisplayCard, INDIGO_SCHEME } from '@/components/forms/CardPrimitives';
import { OverlayActionGrid, OverlayItem } from '@/components/common/OverlayActionGrid';
import { MarkBadges, useMarkJump } from '@/components/common/MarkButton';
import { useCardGridNavigation } from '@/hooks/useCardGridNavigation';
import { useInputActions } from '@/hooks/useInputActions';
import { handBackToGrid } from '@/stores/focusOwner';
import { useReorderableGroup } from '@/components/reorderable/useReorderableGroup';
import { ReorderableGhost } from '@/components/reorderable/ReorderableGhost';
import { useTouchLongPress, longPressStyle } from '@/hooks/useTouchLongPress';
import { useCharacterStore, getDefaultCursorColor } from '@/stores/characterStore';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useCardOverlaySound } from '@/stores/cardOverlaySounds';
import { Slot } from '@/extensions/Slot';
import type { ThingPlacementSnapshot } from '@/stores/thingTileStore';

interface ThemeOrderSectionProps {
  record: ThingRecord;
  /**
   * The cell a themed line should start from — where the character is standing.
   *
   * Read at the moment of the press rather than taken as a value, so a walking
   * character does not re-render the panel. Absent on surfaces with nobody on
   * them (the Thing page), where the line falls back to where the theme
   * already is.
   */
  getOrigin?: () => { x: number; y: number } | null;
  /**
   * Told when a theme has been lined up, with where its things stood before —
   * so a board can show the result and ask whether to keep it. Absent where
   * there is no board to ask on.
   */
  onArranged?: (review: { theme: string; axis: LayoutAxis; before: ThingPlacementSnapshot }) => void;
  /**
   * Whether the panel this section lives in has the keys.
   *
   * The rings and the arrow walk are lit by it, exactly as the want panel's
   * field grids are: a section that lights up on its own would be taking the
   * keys off the board while the character is still standing out there.
   */
  isActive?: boolean;
}

/**
 * The themes this thing belongs to, in the order the user put them in, and what
 * can be done to them from here.
 *
 * A theme is a constellation — a handful of values the user named as one thing
 * — and its order is a second thing they get to say about it: these are the
 * stations of the Chuo line, and this is the order they come in. Both live on
 * the members' own labels (see utils/thingOrder), so the order is knowledge
 * about the things rather than a setting of this panel, and the Thing page can
 * read exactly the same order without being told about it.
 *
 * The members are drawn as cards rather than as a list, in the same idiom as a
 * want's field cards: a grid the arrows walk, a ring saying where you are, and
 * everything a card can do behind its own action overlay. A member of a theme
 * is a thing you operate on, which is what a card is for — and it means the two
 * panels are worked the same way rather than each having its own manners.
 */
export const ThemeOrderSection: React.FC<ThemeOrderSectionProps> = ({ record, getOrigin, onArranged, isActive = true }) => {
  const records = useThingStore((s) => s.records);
  const ensureThings = useThingStore((s) => s.ensureThings);
  const setThemeOrder = useThingStore((s) => s.setThemeOrder);
  const manualOrder = useThingStore((s) => s.manualOrder);
  const removeFromTheme = useThingStore((s) => s.removeFromTheme);
  const addToTheme = useThingStore((s) => s.addToTheme);
  const constellations = useConstellationStore((s) => s.constellations);
  const fetchConstellations = useConstellationStore((s) => s.fetchConstellations);
  // What each theme has turned out to BE. Looked up once for the panel rather
  // than per row: it is one index of every standing form, and the rows only
  // read their own name out of it.
  const arrangeMany = useThingTileStore((s) => s.arrangeMany);
  const ensureTiles = useThingTileStore((s) => s.ensureTiles);

  /** The theme being written right now, so its controls cannot be pressed twice. */
  const [busy, setBusy] = useState<string | null>(null);
  /**
   * Which theme is having members taken out of it, and which ones are marked.
   *
   * A mode rather than a card action that acts on the spot: taking a value out
   * of a theme is not undoable from here — the theme's order is what it would
   * have to be put back into, and that is gone with it. Marking is free; the
   * writing waits for the confirm.
   */
  const [removingFrom, setRemovingFrom] = useState<string | null>(null);
  const [marked, setMarked] = useState<Set<string>>(new Set());

  useEffect(() => {
    ensureThings();
    ensureTiles();
    void fetchConstellations('thing');
  }, [ensureThings, ensureTiles, fetchConstellations]);

  const myThemes = useMemo(
    () => membersById(constellations, 'thing').get(record.id) ?? [],
    [constellations, record.id],
  );

  /** Which row holds the keys, and where in it they landed. Starts at the top. */
  const [entry, setEntry] = useState<{ row: number; at: 'first' | 'last'; nonce: number }>(
    { row: 0, at: 'first', nonce: 0 },
  );

  const byId = useMemo(() => new Map(records.map((r) => [r.id, r])), [records]);
  const ctx = useMemo(() => ({ manualOrder, labels: labelsById(records) }), [manualOrder, records]);

  /** A theme's members, in its own order, as records we can draw. */
  const orderedMembers = useCallback(
    (theme: string, members: string[]): ThingRecord[] => {
      const known = members.map((id) => byId.get(id)).filter((r): r is ThingRecord => !!r);
      return sortThings(known, { key: 'theme', theme }, ctx);
    },
    [byId, ctx],
  );

  const arrange = useCallback(
    async (theme: string, members: string[], axis: LayoutAxis) => {
      const ids = orderedMembers(theme, members).map((r) => r.id);
      if (!ids.length) return;
      // Where the line starts. The character's cell when there is one; failing
      // that, wherever the theme already sits, so re-arranging from a surface
      // with nobody on it straightens the line where it is instead of dragging
      // it back to the middle of the board.
      const tiles = useThingTileStore.getState().tiles;
      const placed = ids.map((id) => tiles.find((t) => t.id === id)).find((t) => t?.x !== undefined && t?.y !== undefined);
      const origin = getOrigin?.()
        ?? (placed ? { x: placed.x as number, y: placed.y as number } : { x: 0, y: 0 });
      setBusy(theme);
      playSound('cardOpen');
      const before = await arrangeMany(lineUp(ids, { axis, origin }));
      setBusy(null);
      // The board gets the keys back so the user can see what the press did,
      // and answers for it there. Only where there IS a board: getOrigin is
      // handed to this panel by the surface with a character standing on one,
      // and the review is asked and answered beside that character.
      onArranged?.({ theme, axis, before });
    },
    [arrangeMany, getOrigin, onArranged, orderedMembers],
  );

  /** One place earlier or later — the card overlay's two move actions. */
  const move = useCallback(
    async (theme: string, members: string[], index: number, delta: -1 | 1) => {
      const ids = orderedMembers(theme, members).map((r) => r.id);
      const next = stepIds(ids, index, delta);
      if (next === ids) return;
      setBusy(theme);
      await setThemeOrder(theme, next);
      setBusy(null);
    },
    [orderedMembers, setThemeOrder],
  );

  /**
   * A card was dropped between two others. Same neighbour-based contract every
   * other reorderable grid commits with, so the drag engine did not have to
   * learn anything about themes.
   */
  const reorder = useCallback(
    async (theme: string, members: string[], id: string, previousId?: string, nextId?: string) => {
      const ids = orderedMembers(theme, members).map((r) => r.id);
      const next = reorderIds(ids, id, previousId, nextId);
      if (next.join(' ') === ids.join(' ')) return;
      setBusy(theme);
      await setThemeOrder(theme, next);
      setBusy(null);
    },
    [orderedMembers, setThemeOrder],
  );

  /** Enter or leave the remove mode. Leaving always drops the marks unwritten. */
  const toggleRemoving = useCallback((theme: string) => {
    setMarked(new Set());
    setRemovingFrom((cur) => (cur === theme ? null : theme));
  }, []);

  const toggleMark = useCallback((theme: string, id: string) => {
    // A card can ask to be taken out without the mode having been entered
    // first — that press is the user saying it, and the mode is where saying it
    // is collected up.
    setRemovingFrom(theme);
    setMarked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  /**
   * Write the removal: the marked members lose their membership.
   *
   * Stated as who goes rather than who stays. Saying who stays is the same
   * thing to look at and not the same thing to write — it is a reconcile, and a
   * reconcile rewrites the survivors, which here means resetting the order of
   * everyone who was not touched. See thingStore.removeFromTheme.
   *
   * The gaps this leaves in the remaining ranks are just gaps; they say the
   * same order. A theme nobody is left in stops existing, which is the server's
   * own rule rather than something decided here: a constellation lasts exactly
   * as long as some member still carries its label.
   */
  const commitRemoval = useCallback(
    async (theme: string) => {
      const going = [...marked];
      if (!going.length) return;
      setBusy(theme);
      await removeFromTheme(theme, going);
      // Membership is derived from the labels, so the list of themes is stale
      // the moment they change.
      await fetchConstellations('thing');
      setMarked(new Set());
      setRemovingFrom(null);
      setBusy(null);
    },
    [fetchConstellations, marked, removeFromTheme],
  );

  const addMembers = useCallback(
    async (theme: string, ids: string[]) => {
      if (!ids.length) return;
      setBusy(theme);
      await addToTheme(theme, ids);
      await fetchConstellations('thing');
      setBusy(null);
    },
    [addToTheme, fetchConstellations],
  );

  // Every thing constellation this thing is NOT already in — offered to join
  // whether or not it belongs to others. (A brand-new theme is still the Thing
  // page's job: pick a few values and name them together.)
  const myThemeNames = new Set(myThemes.map((t) => t.name));
  const joinable = constellations.filter((c) => c.kind === 'thing' && !myThemeNames.has(c.name));

  const joinSection = (heading: string) =>
    joinable.length > 0 && (
      <div>
        <div className="mb-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">{heading}</div>
        <div className="flex flex-wrap gap-1.5">
          {joinable.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={!!busy}
              onClick={() => void addMembers(c.name, [record.id])}
              title={`${c.name} に参加`}
              className={classNames(
                'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                'border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800',
                'disabled:opacity-40',
              )}
              style={c.color ? { borderColor: `${c.color}80`, color: c.color } : undefined}
            >
              <Folder className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{c.name}</span>
              <span className="text-gray-400">{c.members.length}</span>
            </button>
          ))}
        </div>
      </div>
    );

  if (myThemes.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-gray-500 dark:text-gray-400">まだどのテーマにも入っていません。</p>
        {joinSection('既存のテーマに参加')}
        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          Thing ページで複数選び、まとめて名前を付けると新しいテーマになります。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {myThemes.map((theme, idx) => (
        <ThemeRow
          key={theme.id}
          // Where the keys are, and how they got there. The themes are one walk,
          // not one walk each: down off the last card of a theme carries on into
          // the next one's first card, and up out of a theme's buttons goes back
          // to the last card of the one above. `entry` is that arrival — the row
          // it names takes the ring and the DOM focus, and every other row lets
          // go. The nonce is what makes arriving at a row you are already on
          // (the same row, a new direction) an arrival at all.
          entry={isActive && entry.row === idx ? entry : null}
          onExitBottom={idx < myThemes.length - 1
            ? () => setEntry({ row: idx + 1, at: 'first', nonce: Date.now() })
            : undefined}
          onExitTopBeyond={idx > 0
            ? () => setEntry({ row: idx - 1, at: 'last', nonce: Date.now() })
            : undefined}
          theme={theme}
          isActive={isActive}
          members={orderedMembers(theme.name, theme.members)}
          allRecords={records}
          onAdd={(ids) => void addMembers(theme.name, ids)}
          selfId={record.id}
          removing={removingFrom === theme.name}
          marked={marked}
          busy={busy === theme.name}
          onToggleRemoving={() => toggleRemoving(theme.name)}
          onArrange={(axis) => void arrange(theme.name, theme.members, axis)}
          onMove={(i, delta) => void move(theme.name, theme.members, i, delta)}
          onReorder={(id, prev, next) => void reorder(theme.name, theme.members, id, prev, next)}
          onToggleMark={(id) => toggleMark(theme.name, id)}
          onCommitRemoval={() => void commitRemoval(theme.name)}
        />
      ))}
      {joinSection('他のテーマに参加')}
    </div>
  );
};

const HEAD_BTN = 'p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:hover:bg-transparent';
/** Where the keys are, when they are on one of these rather than on a card. */
const HEAD_BTN_FOCUS = 'ring-2 ring-blue-400/60 bg-white dark:bg-gray-800';

/**
 * One theme: its name, what can be done to the whole of it, and its members as
 * a card grid.
 *
 * A component of its own because each theme's grid keeps its own focus, its own
 * drag and its own container — three hooks that cannot be called in a loop.
 */
const ThemeRow: React.FC<{
  theme: Constellation;
  members: ThingRecord[];
  /** Every thing there is, for the "add a member" picker. */
  allRecords: ThingRecord[];
  /** Put these things into the theme. */
  onAdd: (ids: string[]) => void;
  selfId: string;
  /** The panel has the keys — see the section's own prop of the same name. */
  isActive: boolean;
  /** Set while this row is the one holding the keys — see the section above. */
  entry?: { at: 'first' | 'last'; nonce: number } | null;
  /** Down off the last card, when there is a theme below to go to. */
  onExitBottom?: () => void;
  /** Up out of the row's buttons, when there is a theme above to go back to. */
  onExitTopBeyond?: () => void;
  removing: boolean;
  marked: Set<string>;
  busy: boolean;
  onToggleRemoving: () => void;
  onArrange: (axis: LayoutAxis) => void;
  onMove: (index: number, delta: -1 | 1) => void;
  onReorder: (id: string, previousId?: string, nextId?: string) => void;
  onToggleMark: (id: string) => void;
  onCommitRemoval: () => void;
}> = ({
  theme, members, allRecords, onAdd, selfId, isActive, entry, onExitBottom, onExitTopBeyond, removing, marked, busy,
  onToggleRemoving, onArrange, onMove, onReorder, onToggleMark, onCommitRemoval,
}) => {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [activatedIndex, setActivatedIndex] = useState<number | null>(null);
  const isDark = useDarkMode();

  // "Add a member": a mouse-only aside off the end of the row, in the same
  // spirit as the colour picker and the drag reorder — the arrow walk stays on
  // the member cards.
  const [addingOpen, setAddingOpen] = useState(false);
  const [addFilter, setAddFilter] = useState('');
  const addBoxRef = useRef<HTMLDivElement>(null);
  const memberIdSet = useMemo(() => new Set(members.map((m) => m.id)), [members]);
  const addCandidates = useMemo(() => {
    const q = addFilter.trim().toLowerCase();
    return allRecords
      .filter((r) => !memberIdSet.has(r.id))
      .filter((r) => !q || `${r.value} ${r.catalogKey}`.toLowerCase().includes(q))
      .slice(0, 40);
  }, [allRecords, memberIdSet, addFilter]);
  useEffect(() => {
    if (!addingOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!addBoxRef.current?.contains(e.target as Node)) setAddingOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAddingOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [addingOpen]);

  /**
   * The colour this theme is drawn in — its line on the board and its folder
   * marks, kept on the server as a label its members carry. A mouse-only
   * control, like the drag reorder in this same panel: the arrow walk stays on
   * the members, and picking a colour is a small aside off the folder icon
   * rather than a fourth stop on the walk.
   */
  const themeColor = theme.color;
  const setConstellationColor = useConstellationStore((s) => s.setConstellationColor);
  const [showPalette, setShowPalette] = useState(false);
  const getMyCharacter = useCharacterStore((s) => s.getMyCharacter);
  const myDefaultCursorColor = useCharacterStore((s) => s.myDefaultCursorColor);
  const cursorColor = getMyCharacter()?.color ?? myDefaultCursorColor ?? getDefaultCursorColor(isDark);

  /**
   * The row's own controls, as a step in the same walk as its cards.
   *
   * A theme is a row of buttons above a grid of cards, and the arrows now go
   * between the two: up off the top row of cards lands on the buttons, down
   * from the buttons goes back into the cards. -1 means the keys are in the
   * grid (or nowhere), which is where a row starts.
   */
  const jumpToMark = useMarkJump();
  /**
   * The row, for the one question its focus effects have to ask: are the keys
   * already in here? A row that is being walked must not be re-landed on, or
   * stood down, because a flag derived from focus blinked.
   */
  const rowRef = useRef<HTMLDivElement>(null);
  const hasKeys = () => !!rowRef.current?.contains(document.activeElement);
  const headerRef = useRef<HTMLDivElement>(null);
  const [headBtn, setHeadBtn] = useState(-1);
  const headButtonsRef = useRef<Array<HTMLButtonElement | null>>([]);
  /**
   * How many controls the header is showing right now.
   *
   * Two ways to line the theme up, and nothing else: taking members out is
   * asked for on the member itself, through its own action overlay (the same
   * press that marks it), so a row-level button for it was a second door to one
   * room. While that mode is on, arranging stands down and the row has no
   * controls at all — the confirm bar below is the whole of what to do next.
   */
  const headCount = removing ? 0 : 2;
  /**
   * Taking the focus, in the press itself.
   *
   * Synchronously, before React re-renders — because the grid releases DOM
   * focus when its focused card goes to -1, and if that release happens while
   * the focus is still inside the grid it lands on <body>. <body> is nowhere:
   * the panel's "I have the keys" flag is a reading of document.activeElement
   * (see installSidebarFocusTracking), so a single frame there reads as the
   * user having left the sidebar, and this row is told to stand down — ring
   * gone, keys handed back to the board, mid-walk.
   *
   * Moving the focus first means the grid's release finds the focus already
   * elsewhere and leaves it alone. The effect below is the retry, for the
   * button that was not in the DOM yet.
   */
  const focusHeadButton = (i: number) => {
    setHeadBtn(i);
    headButtonsRef.current[i]?.focus();
  };
  useEffect(() => {
    if (headBtn < 0) return;
    if (headButtonsRef.current[headBtn] === document.activeElement) return;
    headButtonsRef.current[headBtn]?.focus();
  }, [headBtn]);
  // And the same going back the other way: the grid takes the focus now, not a
  // frame later, so there is no gap where nothing in the row has it.
  const enterGrid = () => {
    setHeadBtn(-1);
    setFocusedIndex(0);
    gridRef.current?.focus();
  };

  const { gridRef, gridProps } = useCardGridNavigation({
    count: members.length,
    // One horizontal row: the members are laid left-to-right in reading order
    // and scroll sideways, so left/right walks them and up/down leaves the row.
    cols: Math.max(members.length, 1),
    isActive: isActive && headBtn < 0,
    focusedIndex,
    setFocusedIndex,
    // Shift+Enter / Start opens the focused card's actions — the binding every
    // other card grid uses. Confirm stays unbound: everything a member card can
    // do lives in that overlay, so there is no separate primary action.
    onContextMenu: (i) => setActivatedIndex(i),
    // Y goes to the thing this card IS — the same journey its mark makes when
    // pressed (see MarkButton), bound here because the grid is what input is
    // handed to while one of its cards is focused.
    onYButton: (i) => {
      const m = members[i];
      if (m) jumpToMark({ kind: 'thing', id: m.id, name: m.value, color: m.color, icon: m.icon });
    },
    // So the software D-pad prints "Jump" under Y while a member card here has
    // the ring.
    padHints: { y: 'Jump' },
    // Up off the top row is not the end of the walk any more: the row's own
    // buttons are above the cards, and that is where it goes. With no buttons
    // to go to (while marking), the step carries on to the theme above, or —
    // if this is the top one — out to the board, the same way Escape leaves
    // the Settings tab (handBackToGrid is the shared panel→board transition).
    onExitTop: () => {
      if (headCount > 0) { focusHeadButton(0); return; }
      if (onExitTopBeyond) { onExitTopBeyond(); return; }
      handBackToGrid();
    },
    // Down off the last card carries on into the next theme, when there is one.
    onExitBottom,
  });

  // Arrive. Both halves matter: the ring is what the arrows move (the grid's
  // own input is gated on having one), and the DOM focus is what makes THIS
  // row's claim on the keys live rather than a neighbour's — see
  // useInputActions' focusScope.
  const lastNonce = useRef<number | null>(null);
  useEffect(() => {
    if (!entry || members.length === 0) return;
    const asked = lastNonce.current !== entry.nonce;
    lastNonce.current = entry.nonce;
    // A fresh ask always lands. A re-run that is not one — isActive is a
    // dependency, and it is derived from where focus is — must not, or walking
    // from the cards up to the row's buttons was answered by dragging the ring
    // straight back down to the first card.
    if (!asked && hasKeys()) return;
    setHeadBtn(-1);
    setFocusedIndex(entry.at === 'last' ? members.length - 1 : 0);
    requestAnimationFrame(() => gridRef.current?.focus());
    // isActive is a dependency because arriving includes the panel being handed
    // the keys while this row was already the named one — the nonce does not
    // change for that, but the ring has to appear.
  }, [entry?.nonce, isActive, members.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // And let go when the keys have gone to another row, so two rows never both
  // draw a ring. Unless they are demonstrably in this one: `entry` goes null
  // whenever isActive blinks, and that is not somebody else taking them.
  useEffect(() => {
    if (entry) return;
    if (hasKeys()) return;
    setFocusedIndex(-1);
    setHeadBtn(-1);
  }, [entry]); // eslint-disable-line react-hooks/exhaustive-deps

  // The buttons themselves, while they hold the keys. captureInput with a
  // focusScope so this claim lives exactly as long as the focus is on one of
  // them (see useInputActions), and lets go the moment it is not.
  useInputActions({
    enabled: isActive && headBtn >= 0,
    captureInput: true,
    ignoreWhenInSidebar: false,
    focusScope: () => headerRef.current,
    onNavigate: (dir) => {
      if (headCount === 0) { enterGrid(); return; }
      if (dir === 'left')  focusHeadButton((headBtn - 1 + headCount) % headCount);
      if (dir === 'right') focusHeadButton((headBtn + 1) % headCount);
      if (dir === 'down')  enterGrid();
      // Above the buttons is the theme above; above the topmost row is the
      // board itself.
      if (dir === 'up') {
        setHeadBtn(-1);
        if (onExitTopBeyond) onExitTopBeyond();
        else handBackToGrid();
      }
    },
    onConfirm: () => headButtonsRef.current[headBtn]?.click(),
    // The row's controls are its outermost level: Escape/B from here hands the
    // keys back to the board through the shared transition, rather than diving
    // back into the grid (that is what Down is for). Matches how Escape leaves
    // every other detail tab.
    onCancel: () => { setHeadBtn(-1); handBackToGrid(); },
  });

  /**
   * Mouse drag reorder, on the same engine the want dashboard and the Thing
   * grid use.
   *
   * Its keyboard and gamepad bindings stand down inside a panel of their own
   * accord (useInputActions ignores presses made in a sidebar unless a handler
   * asks otherwise), which is what we want: in here the arrows walk the grid,
   * and moving a card by keyboard is the overlay's two move actions.
   */
  // Not while marking: the question on screen is who is in the theme, and a
  // drag that reorders what you are about to remove is answering a different
  // one.
  const dragEnabled = !removing && !busy;

  const reorderGroup = useReorderableGroup<ThingRecord>({
    items: members,
    getId: (r) => r.id,
    containerRef: gridRef,
    selectedId: members[focusedIndex]?.id ?? null,
    enabled: dragEnabled,
    onCommit: (id, previousId, nextId) => onReorder(id, previousId, nextId),
  });

  const ghostRecord = reorderGroup.ghost ? members.find((r) => r.id === reorderGroup.ghost?.id) : undefined;

  return (
    <div
      ref={rowRef}
      className={classNames(
        'rounded-lg border',
        // The whole row wears the theme's colour — a wash of it for the fill
        // and a firmer edge — so the tab reads as a stack of coloured themes
        // rather than a list with a coloured dot on each line.
        themeColor ? '' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800',
      )}
      style={themeColor ? { borderColor: `${themeColor}80`, backgroundColor: `${themeColor}14` } : undefined}
    >
      <div className="flex items-center gap-1 p-2" ref={headerRef}>
        {/* A theme is open. There is one panel, one theme's worth of members,
            and a chevron only ever hid them — while making the row's controls a
            place you had to unfold before you could walk to them. */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <div className="relative flex-shrink-0">
            <button
              type="button"
              className="flex items-center rounded p-0.5 -m-0.5 hover:bg-gray-200 dark:hover:bg-gray-700"
              onClick={() => setShowPalette((v) => !v)}
              title="テーマの色を選ぶ"
            >
              <Folder
                className="w-3.5 h-3.5"
                style={{ color: themeColor ?? '#6366f1' }}
                fill={themeColor ? themeColor : 'none'}
              />
            </button>
            {showPalette && (
              <>
                {/* Click-away, so the strip is a quick aside and not a mode. */}
                <div className="fixed inset-0 z-20" onClick={() => setShowPalette(false)} />
                <div className="absolute left-0 top-full mt-1 z-30 flex flex-wrap gap-1 p-1.5 w-[8.5rem] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
                  {CONSTELLATION_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={classNames(
                        'w-5 h-5 rounded-full border transition',
                        themeColor === c ? 'ring-2 ring-blue-400 ring-offset-1 dark:ring-offset-gray-800' : 'border-black/10 dark:border-white/20',
                      )}
                      style={{ backgroundColor: c }}
                      onClick={() => { void setConstellationColor(theme.name, 'thing', c); setShowPalette(false); }}
                      title={c}
                    />
                  ))}
                  {/* Back to the default blue starlight. */}
                  <button
                    type="button"
                    className={classNames(
                      'w-5 h-5 rounded-full border flex items-center justify-center text-gray-500 dark:text-gray-400',
                      !themeColor ? 'ring-2 ring-blue-400 ring-offset-1 dark:ring-offset-gray-800' : 'border-black/10 dark:border-white/20',
                    )}
                    onClick={() => { void setConstellationColor(theme.name, 'thing', null); setShowPalette(false); }}
                    title="自動（既定の星あかり）"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </>
            )}
          </div>
          <span
            className={classNames('text-sm font-medium truncate', themeColor ? '' : 'text-gray-900 dark:text-gray-100')}
            style={themeColor ? { color: themeColor } : undefined}
          >
            {theme.name}
          </span>
          <span className="text-[11px] text-gray-400 flex-shrink-0">{members.length}</span>
          {/* What this theme turned out to be. A constellation of two stations
              is a 線, and the mark is how that is said everywhere else on the
              board — on the line between them, on the form's own card — so the
              header says it with the same glyph rather than in words.

              After the count, before the arrange buttons: it is a fact about
              the theme, not something to press. */}
          <Slot name="themeMarks" themeName={theme.name} color={themeColor} />
        </div>
        {/* Arranging is about where the theme goes, and is not offered while the
            question on screen is who is in it. */}
        {!removing && (
          <>
            <button type="button" className={classNames(HEAD_BTN, headBtn === 0 && HEAD_BTN_FOCUS)} disabled={busy}
              ref={(el) => { headButtonsRef.current[0] = el; }}
              onFocus={() => setHeadBtn(0)}
              onClick={() => onArrange('row')}
              title={`Line ${theme.name} up left to right`}>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button type="button" className={classNames(HEAD_BTN, headBtn === 1 && HEAD_BTN_FOCUS)} disabled={busy}
              ref={(el) => { headButtonsRef.current[1] = el; }}
              onFocus={() => setHeadBtn(1)}
              onClick={() => onArrange('column')}
              title={`Line ${theme.name} up top to bottom`}>
              <ArrowDown className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      <div
        className={classNames('border-t', themeColor ? '' : 'border-gray-100 dark:border-gray-700/60')}
        style={themeColor ? { borderColor: `${themeColor}40` } : undefined}
      >
        {/* One row, scrolling sideways: the members sit left-to-right in their
            order and each takes a third of the width, so a theme of four or
            more is read by scrolling rather than by wrapping into a block.

            The padding lives on the scroll box, not on the frame around it:
            a focused card draws its ring as an outset box-shadow, and a
            horizontal scroller clips both axes, so without room inside the
            clip the ring was shaved off at the top, the bottom and either
            scroll edge. */}
        <div className="overflow-x-auto px-2 py-2">
          <div
            className="relative flex gap-2 outline-none"
            {...gridProps}
            onDragOver={reorderGroup.containerProps.onDragOver}
            onDragLeave={reorderGroup.containerProps.onDragLeave}
          >
            {/* Where the drop would land — the same floating bar the other
                reorderable grids draw, in the colour of whoever is dragging. */}
            {reorderGroup.indicator && (
              <div
                className="absolute w-1 rounded-full pointer-events-none z-50 transition-[left,top] duration-200 ease-out"
                style={{
                  left: reorderGroup.indicator.left,
                  top: reorderGroup.indicator.top,
                  height: reorderGroup.indicator.height,
                  backgroundColor: `${reorderGroup.indicator.color}99`,
                }}
              />
            )}
            {members.map((m, i) => {
              // Asked for only while dragging is on. getItemProps hands back a
              // draggable card whether or not the engine is enabled, so calling
              // it unconditionally left the cards pickable up in the middle of
              // deciding who to remove.
              const itemProps = dragEnabled ? reorderGroup.getItemProps(m, i) : null;
              return (
                <ThemeMemberCard
                  key={m.id}
                  member={m}
                  position={i + 1}
                  isSelf={m.id === selfId}
                  isFocused={focusedIndex === i}
                  activated={activatedIndex === i}
                  onActivationConsumed={() => setActivatedIndex(null)}
                  onFocusRequest={() => setFocusedIndex(i)}
                  marked={marked.has(m.id)}
                  canMoveEarlier={i > 0}
                  canMoveLater={i < members.length - 1}
                  busy={busy}
                  onMove={(delta) => onMove(i, delta)}
                  onToggleMark={() => onToggleMark(m.id)}
                  dragProps={itemProps}
                  isDragSource={!!itemProps?.isDragSource || reorderGroup.isKbDragSource(m.id)}
                />
              );
            })}

            {/* Add a member — the ＋ at the end of the row. */}
            {!removing && (
              <div ref={addBoxRef} className="relative flex-shrink-0 self-stretch">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => { setAddFilter(''); setAddingOpen((v) => !v); }}
                  title={`${theme.name} に thing を追加`}
                  className={classNames(
                    'flex h-full min-h-[3.5rem] w-14 flex-col items-center justify-center rounded-lg border border-dashed',
                    'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200',
                    'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500',
                    'hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40',
                    addingOpen && 'ring-2 ring-blue-400/60',
                  )}
                >
                  <Plus className="w-5 h-5" />
                </button>
                {addingOpen && (
                  <div className="absolute right-0 top-full z-50 mt-1 w-[min(15rem,calc(100vw-2rem))] rounded-lg border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-700 dark:bg-gray-900">
                    <input
                      autoFocus
                      value={addFilter}
                      onChange={(e) => setAddFilter(e.target.value)}
                      placeholder="thing を検索"
                      className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm outline-none focus:border-blue-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    />
                    <div className="mt-1 max-h-56 overflow-y-auto">
                      {addCandidates.length === 0 && (
                        <div className="px-2 py-3 text-xs text-gray-400">候補なし</div>
                      )}
                      {addCandidates.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => { onAdd([r.id]); setAddingOpen(false); }}
                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          <span className="truncate text-gray-900 dark:text-gray-100">{r.value}</span>
                          <span className="ml-auto flex-shrink-0 text-[10px] text-gray-400">{r.catalogKey}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {ghostRecord && (
          <ReorderableGhost
            state={reorderGroup.ghost}
            color={cursorColor}
            renderContent={() => (
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{ghostRecord.value}</span>
            )}
          />
        )}
      </div>

      {removing && (
        <div className="flex items-center gap-2 border-t border-gray-100 dark:border-gray-700/60 px-2 py-2">
          <span className="text-[11px] text-gray-500 dark:text-gray-400 flex-1">
            {marked.size === 0 ? '外すものを選んでください' : `${marked.size}件を ${theme.name} から外します`}
          </span>
          <button
            type="button"
            className="px-2.5 py-1 rounded-md text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            onClick={onToggleRemoving}
            disabled={busy}
          >
            キャンセル
          </button>
          <button
            type="button"
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold text-white bg-rose-600 hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100"
            onClick={onCommitRemoval}
            disabled={busy || marked.size === 0}
          >
            <Check className="w-3.5 h-3.5" /> 確定
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * One member of a theme, as a card.
 *
 * Built like a want's field card and for the same reasons: the header says
 * which one it is (here, its place in the order), the body says what it holds,
 * the thing's own glyph and colour sit behind it, and everything it can do is
 * behind the action overlay that right-click, a long press, or Shift+Enter
 * opens. Nothing here acts on a plain click — a click only says "this one".
 */
const ThemeMemberCard: React.FC<{
  member: ThingRecord;
  position: number;
  /** The thing whose panel this is. Marked so the theme can be read from it. */
  isSelf: boolean;
  isFocused: boolean;
  activated: boolean;
  onActivationConsumed: () => void;
  onFocusRequest: () => void;
  marked: boolean;
  canMoveEarlier: boolean;
  canMoveLater: boolean;
  busy: boolean;
  onMove: (delta: -1 | 1) => void;
  onToggleMark: () => void;
  /** Null when dragging is off — the card is then not pickable up at all. */
  dragProps: {
    draggable: true;
    onDragStart: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    onDragEnd: () => void;
  } | null;
  isDragSource: boolean;
}> = ({
  member, position, isSelf, isFocused, activated, onActivationConsumed, onFocusRequest,
  marked, canMoveEarlier, canMoveLater, busy, onMove, onToggleMark, dragProps, isDragSource,
}) => {
  const [showOverlay, setShowOverlay] = useState(false);
  // The card that IS the panel's thing wears the current character: their
  // avatar in the corner and a wash of their colour over the whole card, so
  // "this is where I am in the line" reads at a glance.
  const isDark = useDarkMode();
  const getMyCharacter = useCharacterStore((s) => s.getMyCharacter);
  const myDefaultCursorColor = useCharacterStore((s) => s.myDefaultCursorColor);
  const myChar = isSelf ? getMyCharacter() : null;
  const selfColor = myChar?.color ?? myDefaultCursorColor ?? getDefaultCursorColor(isDark);
  // The row scrolls sideways, so walking the arrows onto a card that is off the
  // edge has to bring it back into view — the ring alone is no use if it is
  // past the scrollport.
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isFocused) wrapRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [isFocused]);
  // The same open/close a want card's actions make.
  useCardOverlaySound(showOverlay);
  // iOS Safari never raises contextmenu for a long press on an ordinary
  // element, so without this the card's actions have no way in on a phone.
  const longPress = useTouchLongPress(() => { onFocusRequest(); setShowOverlay(true); });

  useEffect(() => {
    if (activated) { setShowOverlay(true); onActivationConsumed(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activated]);

  const Icon = resolveLucideIcon(member.icon) ?? undefined;

  const overlayItems: OverlayItem[] = [
    {
      // Left / right, not up / down: the members lie in a horizontal row now,
      // so "earlier" is the way the reading goes — to the left.
      icon: <ArrowLeft className="w-4 h-4 text-white" />,
      label: 'Earlier',
      title: 'ひとつ前へ',
      onClick: () => { setShowOverlay(false); onMove(-1); },
      colorClass: 'bg-blue-600/80',
      delay: 0,
      disabled: !canMoveEarlier || busy,
    },
    {
      icon: <ArrowRight className="w-4 h-4 text-white" />,
      label: 'Later',
      title: 'ひとつ後ろへ',
      onClick: () => { setShowOverlay(false); onMove(1); },
      colorClass: 'bg-blue-600/80',
      delay: 0,
      disabled: !canMoveLater || busy,
    },
    {
      // Marks, never writes. The confirm below the grid is the only thing that
      // takes anything out of a theme.
      icon: marked ? <Undo2 className="w-4 h-4 text-white" /> : <Trash2 className="w-4 h-4 text-white" />,
      label: marked ? 'Keep' : 'Remove',
      title: marked ? 'このまま残す' : 'テーマから外す（確定するまで実行されません）',
      onClick: () => { setShowOverlay(false); onToggleMark(); },
      colorClass: marked ? 'bg-gray-600/80' : 'bg-rose-600/80',
      delay: 0,
      disabled: busy,
    },
    {
      icon: <X className="w-4 h-4 text-white" />,
      label: 'Close',
      title: 'Close',
      onClick: () => setShowOverlay(false),
      colorClass: 'bg-gray-600/75',
      delay: 0,
    },
  ].map((item, i) => ({ ...item, delay: i * 30 }));

  return (
    <div
      ref={wrapRef}
      // A third of the row's width and never shrinking below it, so three cards
      // fill the panel and any beyond that are reached by scrolling — with a
      // hard floor so a narrow panel does not squeeze the value out entirely.
      className={classNames('relative w-1/3 shrink-0 min-w-[84px]', isDragSource && 'opacity-40')}
      style={longPressStyle}
      data-reorder-id={member.id}
      draggable={dragProps?.draggable ?? false}
      onDragStart={dragProps?.onDragStart}
      onDragOver={dragProps?.onDragOver}
      onDrop={dragProps?.onDrop}
      onDragEnd={dragProps?.onDragEnd}
      // Takes the focus as well as opening the actions, so the overlay always
      // says which card it belongs to.
      onContextMenu={(e) => { e.preventDefault(); onFocusRequest(); setShowOverlay(true); }}
      {...longPress.handlers}
    >
      <DisplayCard
        className={classNames(
          'relative rounded-lg sm:rounded-xl p-1.5 shadow-sm h-14',
          INDIGO_SCHEME.cardBg,
          isFocused ? 'mw-card-focus bg-white dark:bg-gray-800' : '',
          marked ? 'opacity-50' : '',
        )}
        onClick={onFocusRequest}
        showFocusBar={isFocused}
        BgIcon={Icon}
        bgIconColor=""
        bgIconStyle={{ color: member.color }}
        inkColor={member.color}
        headerLeft={
          <span className="text-[11px] font-semibold card-ink truncate leading-none tabular-nums">{position}</span>
        }
        headerRight={isSelf
          ? (myChar?.avatar
              ? <span className="text-sm leading-none" title={`${myChar.name}（あなたの Thing）`}>{myChar.avatar}</span>
              : <span className="w-2 h-2 rounded-full ring-1 ring-white/60 dark:ring-black/40" style={{ backgroundColor: selfColor }} title="あなたの Thing" />)
          : undefined}
        overlay={showOverlay && (
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
      >
        <div className="h-full flex items-end justify-end overflow-visible">
          <span
            className={classNames(
              'text-right leading-none max-w-full min-w-0 truncate text-xs font-medium',
              marked ? 'line-through text-gray-500' : 'text-gray-700 dark:text-gray-300',
            )}
            title={member.value}
          >
            {member.value}
          </span>
        </div>
        {/* The way out to the thing itself, the same mark a want's field and
            parameter cards wear, in the same corner. Those cards hold a value
            and have to work out whether it is a thing; this card IS one, so it
            says so directly. */}
        <MarkBadges marks={[{ kind: 'thing', id: member.id, name: member.value, color: member.color, icon: member.icon }]} />
      </DisplayCard>

      {/* A wash of the character's colour over the whole card — self only.
          Above the card face, below its action overlay (z-20) and marks
          (z-30), and inert so it changes nothing but the look. */}
      {isSelf && (
        <div
          className="pointer-events-none absolute inset-0 rounded-lg sm:rounded-xl"
          style={{ backgroundColor: selfColor, opacity: 0.14, zIndex: 15 }}
        />
      )}
    </div>
  );
};
