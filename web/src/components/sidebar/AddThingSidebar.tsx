import { BadgeNameLayout } from '@/components/common/BadgeNameLayout';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, Check, Pin, Save, Search, Type } from 'lucide-react';
import { useThingStore } from '@/stores/thingStore';
import { useThingTileStore } from '@/stores/thingTileStore';
import { ThingRecord } from '@/types/thing';
import { resolveLucideIcon } from '@/utils/subtypeIcons';
import { PanelActions, usePanelActionsPlacement, PANEL_ACTION_BUTTON } from '@/components/sidebar/PanelIdentityRow';
import { classNames } from '@/utils/helpers';
import { vividIconColor, iconEmbossFilter } from '@/components/dashboard/WantCardFace';
import { thingBackgroundSrc, kindBackgroundSrc, THING_BACKGROUND_SCRIM } from '@/utils/thingBackground';
import { useDarkMode } from '@/hooks/useDarkMode';
import { playSound } from '@/utils/sounds';
import { SidebarTabBar } from '@/components/common/SidebarTabBar';
import { usePanelTabs } from '@/hooks/usePanelTabs';
import { useSidebarFocusStore } from '@/stores/sidebarFocusStore';
import { useInputActions } from '@/hooks/useInputActions';
import {
  FREE_CURSOR_ITEM_ATTR, FREE_CURSOR_FOCUS_ONLY_ATTR,
  beginFreeCursorCarry, useFreeCursorCarrying,
} from '@/hooks/useFreeCursorNav';

/** How long A or Enter is held on a Pin card before it is picked up — A's own long press. */
const PICK_UP_HOLD_MS = 250;

interface AddMemoSidebarProps {
  /** Called with the new record's id once it is remembered. */
  onAdded?: (id: string) => void;
  onCancel?: () => void;
  /**
   * Where a thing pinned from here should land — the cell the character is
   * standing on. Asked for at the moment of pinning rather than passed as a
   * value, because the character keeps walking while the panel is open and
   * "the character's position" means the one it is at when you press.
   *
   * Absent on surfaces with no character on a board (the Thing page), where a
   * pin still works and the canvas places the thing itself.
   */
  getPinPosition?: () => { x: number; y: number } | null;
  /**
   * When set, this is the editor for an existing thing rather than the door in
   * for a new one: same panel, same picker, the current category already
   * chosen. Changing what kind of thing something is asks exactly the question
   * naming it asked, so it is answered in the same place rather than in a
   * second form that happens to look similar.
   *
   * The name is shown but not editable. A thing's id is its catalog and its
   * text joined, so renaming is a different operation from recategorising, and
   * offering both in one box would hide that.
   */
  record?: ThingRecord | null;
}

/**
 * AddThingSidebar — name something before any want asks for it.
 *
 * Values usually arrive by being typed into a want's field. This is the manual
 * door in: pick the category, write the name. It is what the first kata asks
 * for — a station, a city, a point on the map — so it has to be reachable
 * without deploying anything.
 *
 * Two tabs, because there are two ways a thing gets onto the board and both are
 * the same errand: Add names one that does not exist yet, Pin fetches one that
 * already does. Naming a value that is already remembered is the mistake this
 * panel used to invite — the only thing it offered was a name field, so the
 * shortest route to "put my station on the board" was to type it again.
 */
/**
 * The drag data a thing carries out of the Pin tab: its id, for a board to pin
 * it where it is dropped. Only a board reads it; this app has none of its own.
 */
export const THING_PIN_DRAG_TYPE = 'application/mywant-thing-pin';

/**
 * The drag data a category card carries out of the Add tab: the category, and
 * the name typed above it if there is one — JSON, `{ typeName, value }`. A board
 * names a thing of that kind (see defaultThingName for when nothing was typed)
 * and stands it where it is dropped.
 */
export const THING_TYPE_DRAG_TYPE = 'application/mywant-thing-type';

/**
 * What a thing is called when it was made without being named: its category,
 * numbered once that is taken ("station", "station 2", …). A name is still
 * required of every thing — it is what a want is handed — but asking for it
 * before the thing can exist is what made putting a station on the board a
 * typing exercise.
 */
export function defaultThingName(typeName: string): string {
  const { records, dataTypes } = useThingStore.getState();
  const key = dataTypes[typeName]?.memoKey;
  const taken = new Set(records.filter(r => r.catalogKey === key).map(r => r.value));
  if (!taken.has(typeName)) return typeName;
  for (let n = 2; ; n++) if (!taken.has(`${typeName} ${n}`)) return `${typeName} ${n}`;
}

export const AddThingSidebar: React.FC<AddMemoSidebarProps> = ({ onAdded, onCancel, getPinPosition, record }) => {
  const dataTypes = useThingStore(s => s.dataTypes);
  const addRecord = useThingStore(s => s.addRecord);
  const recategorize = useThingStore(s => s.recategorizeRecord);
  const editing = !!record;

  const [tab, setTab] = useState<'add' | 'pin'>('add');

  // Add and Pin are walked like any detail panel's tabs — L1/R1 on a gamepad,
  // Tab / Shift+Tab on a keyboard — from the same hook, with the same "who has
  // the keys" flag, so the first bumper press from outside brings the keys in
  // rather than silently skipping a tab. The editor has no tabs.
  const panelRef = useRef<HTMLDivElement>(null);
  const sidebarFocused = useSidebarFocusStore(s => s.focused);
  const setSidebarFocused = useSidebarFocusStore(s => s.setFocused);
  usePanelTabs({
    tabs: THING_PANEL_TABS,
    activeTab: tab,
    onTabChange: (id) => setTab(id as 'add' | 'pin'),
    enabled: !editing,
    scope: () => panelRef.current,
    focus: {
      hasFocus: () => sidebarFocused,
      takeFocus: () => setSidebarFocused(true),
    },
  });
  const [category, setCategory] = useState<string>(record?.typeName ?? '');
  const [value, setValue] = useState(record?.value ?? '');
  const [filter, setFilter] = useState('');
  const [saving, setSaving] = useState(false);

  // Re-seed when the panel is pointed at a different thing without unmounting.
  useEffect(() => {
    setCategory(record?.typeName ?? '');
    setValue(record?.value ?? '');
    setFilter('');
  }, [record?.id]);

  // Only subtypes are worth naming into: the primitives (string, number, …) are
  // what a value IS, not what it means.
  const categories = useMemo(
    () =>
      Object.entries(dataTypes)
        .filter(([, info]) => !!info.baseType)
        .map(([name, info]) => ({ name, ...info }))
        .filter(c => !filter || c.name.toLowerCase().includes(filter.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [dataTypes, filter]
  );

  // The name may be left empty — see defaultThingName.
  const canSave = !!category && !saving
    && (!editing || category !== record!.typeName);

  // ── Pin tab ────────────────────────────────────────────────────────────────
  const records = useThingStore(s => s.records);
  const ensureThings = useThingStore(s => s.ensureThings);
  const onCanvas = useThingTileStore(s => s.onCanvas);
  const ensureTiles = useThingTileStore(s => s.ensureTiles);
  const setPinned = useThingTileStore(s => s.setPinned);
  const isDark = useDarkMode();
  const [pinFilter, setPinFilter] = useState('');
  // Which one is mid-flight. The pin waits on a write and then a re-fetch, and
  // without a mark the card sits unchanged long enough to be pressed twice.
  const [pinning, setPinning] = useState<string | null>(null);

  // Things on either tab: the Add tab numbers an unnamed thing past the ones
  // already called that (see defaultThingName).
  useEffect(() => { ensureThings(); }, [ensureThings]);
  useEffect(() => {
    if (tab !== 'pin') return;
    ensureThings();
    ensureTiles();
  }, [tab, ensureThings, ensureTiles]);

  const pinnable = useMemo(() => {
    const q = pinFilter.trim().toLowerCase();
    return records
      .filter(r => !q || r.value.toLowerCase().includes(q) || r.typeName.toLowerCase().includes(q))
      // Already on the board first, so the tab opens showing what is out there
      // rather than making you hunt for the ones you cannot press.
      .sort((a, b) => {
        const ap = onCanvas.has(a.id), bp = onCanvas.has(b.id);
        if (ap !== bp) return ap ? -1 : 1;
        return a.value.localeCompare(b.value);
      });
  }, [records, pinFilter, onCanvas]);

  const pin = async (r: ThingRecord) => {
    if (onCanvas.has(r.id) || pinning) return;
    playSound('cardOpen');
    setPinning(r.id);
    // Null (no character on this surface) is not a position, and passing it
    // would place the thing at the origin rather than letting the canvas decide.
    const at = getPinPosition?.() ?? undefined;
    await setPinned(r.id, true, at);
    setPinning(null);
  };

  // A card has the keys — the cursor landed on it, or Tab reached it. Drawn,
  // because the cursor lands on these without pressing them (a press pins), so
  // the ring is the only sign of where A will go.
  const [focusedPin, setFocusedPin] = useState<string | null>(null);
  const pinGridRef = useRef<HTMLDivElement>(null);
  const carrying = useFreeCursorCarrying();
  const typeGridRef = useRef<HTMLDivElement>(null);
  /** The card the keys are on — a thing in the Pin tab or a category in the Add tab — if either. */
  const focusedCard = () => {
    const ae = document.activeElement as HTMLElement | null;
    if (!ae) return null;
    if (pinGridRef.current?.contains(ae) && ae.dataset.thingId) return ae;
    if (typeGridRef.current?.contains(ae) && ae.dataset.thingType) return ae;
    return null;
  };
  // Held, a card is picked up and carried out to the board on the cursor —
  // the pad's version of dragging it there (see beginFreeCursorCarry). It is
  // the card's own drag that is carried, so it lands wherever a mouse drop
  // of it would.
  const pickUp = (el: HTMLElement, skipConfirm: boolean) => {
    if (beginFreeCursorCarry(el, { skipConfirm })) playSound('buttonPress');
  };
  // Enter has no long press of its own, so the card times it: down starts the
  // clock, and a release before it runs out is an ordinary press.
  const enterHold = useRef<{ timer: ReturnType<typeof setTimeout> | null; fired: boolean }>({ timer: null, fired: false });
  useEffect(() => () => { if (enterHold.current.timer) clearTimeout(enterHold.current.timer); }, []);
  /** The key half of "hold to pick up", for a card that can be carried. */
  const enterHoldProps = {
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key !== 'Enter' || e.altKey || e.shiftKey || e.metaKey || e.ctrlKey) return;
      // Not the button's own click on Enter: the press is resolved on release
      // (onConfirm below), or becomes a pick-up if it is held.
      e.preventDefault();
      if (e.repeat) return;
      const el = e.currentTarget;
      enterHold.current.fired = false;
      if (enterHold.current.timer) clearTimeout(enterHold.current.timer);
      enterHold.current.timer = setTimeout(() => {
        enterHold.current.timer = null;
        enterHold.current.fired = true;
        pickUp(el, true);
      }, PICK_UP_HOLD_MS);
    },
    onKeyUp: (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key !== 'Enter' || !enterHold.current.timer) return;
      clearTimeout(enterHold.current.timer);
      enterHold.current.timer = null;
    },
  };

  useInputActions({
    enabled: !editing && !carrying,
    ignoreWhenInSidebar: false,
    onConfirm: () => {
      // The release of an Enter that was held long enough to pick up.
      if (enterHold.current.fired) { enterHold.current.fired = false; return; }
      const el = focusedCard();
      if (el?.dataset.thingType) { setCategory(el.dataset.thingType); return; }
      const r = el && records.find(x => x.id === el.dataset.thingId);
      if (r) void pin(r);
    },
    onConfirmLong: () => {
      const el = focusedCard();
      if (el) pickUp(el, false);
    },
  });

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const id = editing
      ? await recategorize(record!, category)
      : await addRecord(category, value.trim() || defaultThingName(category));
    setSaving(false);
    if (id) {
      if (!editing) setValue('');
      onAdded?.(id);
    }
  };

  // The editor is one question about one thing, so it keeps the panel it always
  // had: no tabs, no list of everything else.
  if (!editing && tab === 'pin') {
    return (
      <div ref={panelRef} className="h-full flex flex-col">
        <ThingPanelTabs tab={tab} onChange={setTab} />
        <div className="p-4 pb-2 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              autoFocus
              type="text"
              value={pinFilter}
              onChange={e => setPinFilter(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') onCancel?.(); }}
              placeholder="Search things..."
              className="w-full pl-7 pr-2 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
            Pinned things stand on the board where your character is, or where you drop them. Already-pinned
            ones are ticked.
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 pb-4">
          {pinnable.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
              {records.length === 0 ? 'Nothing remembered yet.' : `No results for "${pinFilter}"`}
            </p>
          ) : (
            <div ref={pinGridRef} className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 sm:gap-2">
              {pinnable.map(r => {
                const Icon = resolveLucideIcon(r.icon) ?? Type;
                const already = onCanvas.has(r.id);
                const busy = pinning === r.id;
                // The same picture the thing's own card is drawn over — its
                // kind's photograph, or its own (an album's cover, a page's
                // screenshot). See thingBackgroundSrc.
                const bg = thingBackgroundSrc(r.background, r.labels);
                const glyph = vividIconColor(r.color, !isDark);
                return (
                  <button
                    key={r.id}
                    type="button"
                    data-thing-id={r.id}
                    // The cursor lands here and stops; A pins. See
                    // FREE_CURSOR_FOCUS_ONLY_ATTR.
                    {...(!already ? { [FREE_CURSOR_ITEM_ATTR]: '', [FREE_CURSOR_FOCUS_ONLY_ATTR]: '' } : {})}
                    disabled={already || !!pinning}
                    onClick={() => void pin(r)}
                    onFocus={() => setFocusedPin(r.id)}
                    onBlur={() => setFocusedPin(p => (p === r.id ? null : p))}
                    {...enterHoldProps}
                    // Or dragged to where it should stand — as a want type is
                    // dragged out of Add Want. The board takes it by this type
                    // (THING_PIN_DRAG_TYPE) and pins it on the cell it is
                    // dropped on.
                    draggable={!already && !pinning}
                    onDragStart={e => {
                      e.dataTransfer.effectAllowed = 'copy';
                      e.dataTransfer.setData(THING_PIN_DRAG_TYPE, r.id);
                    }}
                    title={already ? `"${r.value}" is already on the canvas` : `Pin "${r.value}" where your character is — or drag it onto the canvas`}
                    className={classNames(
                      // The want type picker's card, at its size: one shape
                      // for every picker (BadgeNameLayout).
                      'relative w-full aspect-[2/1] rounded-lg overflow-hidden border shadow-sm transition-all focus:outline-none',
                      already
                        ? 'border-gray-200 dark:border-gray-700 opacity-55 cursor-not-allowed'
                        : 'border-gray-300/80 dark:border-black/60 hover:shadow-md hover:outline hover:outline-2 hover:outline-amber-400 hover:z-10',
                      busy && 'animate-pulse',
                      focusedPin === r.id && !already && 'ring-2 ring-amber-400 ring-offset-1 ring-offset-white dark:ring-offset-gray-900 z-10 scale-[1.03]',
                    )}
                    style={{ background: `${r.color}${isDark ? '26' : '1f'}` }}
                  >
                    {bg && (
                      <>
                        <img
                          src={bg}
                          alt=""
                          aria-hidden
                          draggable={false}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none"
                        />
                        <div className={THING_BACKGROUND_SCRIM} />
                      </>
                    )}
                    {/* Icon left, name right — the want type picker's card
                        (BadgeNameLayout). The glyph is the thing's own colour,
                        embossed, as on its card. */}
                    <BadgeNameLayout
                      badgeColor={r.color}
                      isDark={isDark}
                      name={r.value}
                      sub={
                        <span className="text-[8px] leading-none truncate max-w-full font-semibold" style={{ color: glyph }}>
                          {r.typeName}
                        </span>
                      }
                      badge={
                        <Icon
                          style={{ width: '58%', height: '58%', color: glyph, filter: iconEmbossFilter(!isDark) }}
                          strokeWidth={1.75}
                        />
                      }
                    />
                    {already && (
                      <div
                        className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center bg-white/70 dark:bg-black/50"
                        title="On the canvas"
                      >
                        <Check className="w-2.5 h-2.5" style={{ color: r.color }} strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    // A column: the name and the category heading stay put, and the category
    // cards take the rest of the panel's height, down to its bottom edge —
    // they were a box of fixed height that stopped partway down the screen.
    <div ref={panelRef} className="h-full flex flex-col">
      {!editing && <ThingPanelTabs tab={tab} onChange={setTab} />}
      <div className="p-4 flex-1 min-h-0 flex flex-col gap-4">
      {/* The name itself — first, because it is what the user came to write. */}
      <div className="flex-shrink-0">
        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
          Name
        </label>
        <input
          autoFocus={!editing}
          type="text"
          value={value}
          readOnly={editing}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') onCancel?.();
          }}
          placeholder={editing ? undefined : 'Optional — the category, if left empty'}
          className={classNames(
            'w-full px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-400',
            editing
              ? 'bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 cursor-default'
              : 'bg-white dark:bg-gray-800',
          )}
        />
      </div>

      {/* Category picker */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center gap-2 mb-1.5 flex-shrink-0">
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Category
          </label>
          <div className="ml-auto relative">
            <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
            <input
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter"
              className="w-28 pl-6 pr-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none"
            />
          </div>
        </div>

        {/* The scrolling is the wrapper's: a grid that scrolls itself in a
            column squeezes its rows, and the cards' 2:1 went with them. */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
        <div ref={typeGridRef} className="grid grid-cols-3 sm:grid-cols-4 content-start gap-1.5 sm:gap-2">
          {categories.map(c => {
            const Icon = resolveLucideIcon(c.icon) ?? Type;
            const selected = category === c.name;
            /*
             * The kind's own picture, behind the kind's own card — the same
             * photograph its things are drawn over, held back by the same
             * scrim, so what you are picking looks like what you will get.
             * See kindBackgroundSrc for why only the file form can be used here.
             */
            const bgFile = kindBackgroundSrc(c.background);
            const glyph = vividIconColor(c.color, !isDark);
            return (
              <button
                key={c.name}
                type="button"
                data-thing-type={c.name}
                onClick={() => setCategory(c.name)}
                // Or taken to the board: dragged, or held (A / Enter) and
                // carried on the cursor. It becomes a thing of this kind where
                // it is put down, named by what is typed above — or after its
                // kind, when nothing is. The editor has none of this: it is
                // re-filing one thing, not making another.
                {...(!editing ? {
                  [FREE_CURSOR_ITEM_ATTR]: '',
                  ...enterHoldProps,
                  draggable: true,
                  onDragStart: (e: React.DragEvent) => {
                    setCategory(c.name);
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData(THING_TYPE_DRAG_TYPE, JSON.stringify({ typeName: c.name, value: value.trim() }));
                  },
                  // Taken: the name was spent on it, so the field is ready for
                  // the next one.
                  onDragEnd: (e: React.DragEvent) => {
                    if (e.dataTransfer.dropEffect !== 'none') setValue('');
                  },
                } : {})}
                className={classNames(
                  // The want type picker's card, at its size (BadgeNameLayout).
                  'relative w-full aspect-[2/1] rounded-lg border shadow-sm transition-colors overflow-hidden',
                  selected
                    ? 'border-transparent'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
                )}
                style={selected ? { background: `${c.color}2e`, borderColor: c.color } : undefined}
                title={c.name}
              >
                {bgFile && (
                  <>
                    <img
                      src={bgFile}
                      alt=""
                      aria-hidden
                      draggable={false}
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none"
                    />
                    {/* The Thing card's scrim, not a flat wash: a kind should
                        look like its things, and the name below carries its own
                        weight and colour to stay readable over the picture. */}
                    <div className={THING_BACKGROUND_SCRIM} />
                  </>
                )}
                {/* Icon left, name right, over the picture. */}
                <BadgeNameLayout
                  badgeColor={c.color}
                  isDark={isDark}
                  name={c.name}
                  badge={
                    <Icon
                      style={{ width: '58%', height: '58%', color: glyph, filter: bgFile ? iconEmbossFilter(!isDark) : undefined }}
                      strokeWidth={1.75}
                    />
                  }
                />
                {selected && (
                  <Check
                    className="absolute top-0.5 right-0.5 z-20 w-2.5 h-2.5"
                    style={{ color: c.color }}
                    strokeWidth={3}
                  />
                )}
              </button>
            );
          })}
        </div>
        </div>
      </div>

      {/* The panel's primary action, drawn wherever this panel's shell draws
          actions — beside the close in a top-header layout, in a bar along the
          bottom when the header is down there. Add Want's submit follows the
          same rule through the same shell, which is the point: both panels
          open from the same board, and a button that moves in one and not the
          other reads as two different kinds of panel. See PanelActions. */}
      <PanelActions>
        <ThingActions save={save} canSave={canSave} editing={editing} onCancel={onCancel} />
      </PanelActions>
      </div>
    </div>
  );
};

/**
 * The panel's primary action — the same button Add Want ends with.
 *
 * Both forms open from the same board and sit in the same bar, so they are one
 * button in two panels: a block that fills the bar's height, the icon over a
 * small uppercase word, and the same greyed-out treatment when there is
 * nothing to press it for. The icon is this form's own (a bookmark; a thing is
 * a value you are keeping) and the word is this form's own — what differs
 * between them is what they do, not what they are.
 *
 * Its width is the one thing that follows the placement. A bar along the
 * bottom has a row to fill; the identity row has a title beside it and a close
 * after it, and a button that stretched there would push the name out.
 */
const ThingActions: React.FC<{
  save: () => void;
  canSave: boolean;
  editing: boolean;
  onCancel?: () => void;
}> = ({ save, canSave, editing, onCancel }) => {
  const placement = usePanelActionsPlacement();
  const inBar = placement === 'bar';
  const [focused, setFocused] = useState(false);
  return (
    <div className={classNames('flex items-stretch', inBar ? 'flex-1 justify-end' : '')}>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="px-3 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex-shrink-0"
        >
          Cancel
        </button>
      )}
      <button
        type="button"
        onClick={save}
        disabled={!canSave}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={classNames(
          PANEL_ACTION_BUTTON,
          !canSave
            ? 'bg-gray-400/30 cursor-not-allowed grayscale opacity-50'
            : focused
              ? 'bg-blue-500 text-white active:opacity-80'
              : 'bg-amber-500 text-white hover:brightness-110 active:opacity-80',
        )}
      >
        <div className="w-5 h-5 flex items-center justify-center">
          {editing ? <Save className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
        </div>
        <span className="text-white text-[9px] font-bold leading-none uppercase tracking-tighter hidden sm:block">
          {editing ? 'Save' : 'Remember'}
        </span>
      </button>
    </div>
  );
};

/** The two ways onto the board, in the order L1/R1 walk them. */
const THING_PANEL_TABS = [
  { id: 'add' as const, label: 'Add Thing', icon: Bookmark },
  { id: 'pin' as const, label: 'Pin Thing', icon: Pin },
];

/**
 * The two ways onto the board, side by side — on the tab bar every detail
 * panel wears (SidebarTabBar), so it looks and walks like theirs.
 */
const ThingPanelTabs: React.FC<{ tab: 'add' | 'pin'; onChange: (t: 'add' | 'pin') => void }> = ({ tab, onChange }) => (
  <SidebarTabBar
    tabs={THING_PANEL_TABS}
    activeTab={tab}
    onTabChange={(id) => onChange(id as 'add' | 'pin')}
  />
);
