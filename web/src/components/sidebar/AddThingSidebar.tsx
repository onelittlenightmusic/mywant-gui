import React, { useEffect, useMemo, useState } from 'react';
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
export const AddThingSidebar: React.FC<AddMemoSidebarProps> = ({ onAdded, onCancel, getPinPosition, record }) => {
  const dataTypes = useThingStore(s => s.dataTypes);
  const addRecord = useThingStore(s => s.addRecord);
  const recategorize = useThingStore(s => s.recategorizeRecord);
  const editing = !!record;

  const [tab, setTab] = useState<'add' | 'pin'>('add');
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

  const canSave = !!category && !!value.trim() && !saving
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

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const id = editing
      ? await recategorize(record!, category)
      : await addRecord(category, value);
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
      <div className="h-full flex flex-col">
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
            Pinned things stand on the board where your character is. Already-pinned
            ones are ticked.
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 pb-4">
          {pinnable.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
              {records.length === 0 ? 'Nothing remembered yet.' : `No results for "${pinFilter}"`}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
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
                    disabled={already || !!pinning}
                    onClick={() => void pin(r)}
                    title={already ? `"${r.value}" is already on the canvas` : `Pin "${r.value}" where your character is`}
                    className={classNames(
                      // Same card, a size down: flatter, so more of the list
                      // is in view without changing anything about how a thing
                      // is drawn on it.
                      'relative w-full aspect-[2.6/1] rounded-lg overflow-hidden border shadow-sm transition-all',
                      already
                        ? 'border-gray-200 dark:border-gray-700 opacity-55 cursor-not-allowed'
                        : 'border-gray-300/80 dark:border-black/60 hover:shadow-md hover:outline hover:outline-2 hover:outline-amber-400 hover:z-10',
                      busy && 'animate-pulse',
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
                    {/* Icon left, name right — the shape every card in the app
                        wears, and the same one the want type picker uses. The
                        glyph is the thing's own colour, embossed, exactly as on
                        its card: over a photograph a pale mark on a disc
                        disappears. */}
                    <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none">
                      <Icon
                        className="w-[22%] h-[44%]"
                        style={{ color: glyph, filter: iconEmbossFilter(!isDark) }}
                        strokeWidth={1.75}
                      />
                    </div>
                    <div className="absolute inset-y-0 left-[38%] right-0 flex flex-col items-start justify-center pr-1.5 gap-0.5 pointer-events-none">
                      <span className="text-[11px] font-semibold leading-tight text-left text-gray-800 dark:text-gray-100 line-clamp-2 max-w-full">
                        {r.value}
                      </span>
                      <span className="text-[9px] leading-none truncate max-w-full font-semibold" style={{ color: glyph }}>
                        {r.typeName}
                      </span>
                    </div>
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
    <div className="h-full overflow-y-auto">
      {!editing && <ThingPanelTabs tab={tab} onChange={setTab} />}
      <div className="p-4 space-y-4">
      {/* The name itself — first, because it is what the user came to write. */}
      <div>
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
          placeholder="The name of this value"
          className={classNames(
            'w-full px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-400',
            editing
              ? 'bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 cursor-default'
              : 'bg-white dark:bg-gray-800',
          )}
        />
      </div>

      {/* Category picker */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
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

        <div className="grid grid-cols-3 gap-1.5 max-h-[22rem] overflow-y-auto pr-0.5">
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
                onClick={() => setCategory(c.name)}
                className={classNames(
                  'relative flex flex-col items-center gap-1 px-1.5 py-2 rounded-lg border transition-colors overflow-hidden',
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
                {/* Above the picture: an absolutely-positioned sibling would
                    otherwise paint over these. */}
                <Icon
                  className="relative w-4 h-4"
                  style={{ color: glyph, filter: bgFile ? iconEmbossFilter(!isDark) : undefined }}
                  strokeWidth={1.75}
                />
                <span
                  className={classNames(
                    'relative text-[10px] leading-none truncate max-w-full',
                    bgFile ? 'font-semibold' : 'text-gray-600 dark:text-gray-300',
                  )}
                  style={bgFile ? { color: glyph } : undefined}
                >
                  {c.name}
                </span>
                {selected && (
                  <Check
                    className="absolute top-0.5 right-0.5 w-2.5 h-2.5"
                    style={{ color: c.color }}
                    strokeWidth={3}
                  />
                )}
              </button>
            );
          })}
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

/**
 * The two ways onto the board, side by side. Local to this panel: FormTabBar is
 * the want form's own tab set (Params, Labels, Schedule …) and its tab names are
 * that form's type, not a bar anything can borrow.
 */
const ThingPanelTabs: React.FC<{ tab: 'add' | 'pin'; onChange: (t: 'add' | 'pin') => void }> = ({ tab, onChange }) => (
  <div className="flex flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
    {([
      { id: 'add' as const, label: 'Add Thing', icon: Bookmark },
      { id: 'pin' as const, label: 'Pin Thing', icon: Pin },
    ]).map(({ id, label, icon: Icon }) => {
      const active = tab === id;
      return (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          data-robot-target="thing_panel_tab"
          data-robot-id={id}
          className={classNames(
            'flex-1 flex items-center justify-center gap-1.5 py-2 px-1 relative transition-colors min-w-0',
            active
              ? 'text-amber-600 dark:text-amber-400 bg-white dark:bg-gray-800'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-800/30',
          )}
        >
          <Icon className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-[11px] font-bold uppercase tracking-tight truncate">{label}</span>
          {active && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 dark:bg-amber-400" />}
        </button>
      );
    })}
  </div>
);
