import React, { useEffect, useRef, useState } from 'react';
import { Type, Clock, Zap, Tag, CreditCard, Bot, Hash, Settings, Folder } from 'lucide-react';
import { ThingRecord, ThingEvent, MEMO_SOURCE_LABELS } from '@/types/thing';
import { useThingStore } from '@/stores/thingStore';
import { useWantTypeStore } from '@/stores/wantTypeStore';
import { useConfigStore } from '@/stores/configStore';
import { ThingCard } from '@/components/dashboard/ThingCard';
import { TabContent, InfoRow } from './DetailsSidebar';
import { SidebarTabBar } from '@/components/common/SidebarTabBar';
import { useSidebarFocusStore } from '@/stores/sidebarFocusStore';
import { usePanelTabs } from '@/hooks/usePanelTabs';
import { useCardGridNavigation } from '@/hooks/useCardGridNavigation';
import { handBackToGrid } from '@/stores/focusOwner';
import { useHeaderAtBottom } from '@/hooks/useDisplaySettings';
import { classNames } from '@/utils/helpers';
import { CardStatusRow, CardStatusItem } from './CardStatusRow';
import { useConstellationStore, membersById } from '@/stores/constellationStore';
import { type Mark } from '@/components/common/MarkButton';
import { LogCard } from '@/components/common/LogCard';
import { useThingNames } from '@/hooks/useThingNames';
import { ThemeOrderSection } from './ThemeOrderSection';

interface MemoDetailsSidebarProps {
  record: ThingRecord | null;
  /** Start a new want seeded from this value — the card's Add Want action.
   *  Without it the embedded card's overlay is missing that tile. */
  onAddWant?: (record: ThingRecord) => void;
  onDelete?: (record: ThingRecord) => void;
  /**
   * Where a themed line should start — the cell the character is standing on.
   * Absent on surfaces with nobody on them; see ThemeOrderSection.
   */
  getOrigin?: () => { x: number; y: number } | null;
  onArranged?: React.ComponentProps<typeof ThemeOrderSection>['onArranged'];
}

/** Icon per event source. */
function sourceIcon(source: string) {
  switch (source) {
    case 'want-param': return Zap;
    case 'aura-definition': return Tag;
    case 'card-name': return CreditCard;
    default: return Clock;
  }
}

/**
 * The thing's provenance: its type, plus a newest-first timeline of when
 * (and by which want / character) the value was named into its catalog.
 */
/** The three things there are to know about a thing. */
type ThingTab = 'settings' | 'constellation' | 'history';

export const ThingDetailsSidebar: React.FC<MemoDetailsSidebarProps> = ({ record, onAddWant, onDelete, getOrigin, onArranged }) => {
  const [activeTab, setActiveTab] = useState<ThingTab>('settings');
  /**
   * Whether this panel has the keys — the same flag the want panel uses, and
   * the same rule: it is set by focus arriving anywhere inside (the root's
   * onFocus below, which is what handOverToSidebar's A/Enter lands on), and
   * cleared when the keys go back to the board.
   *
   * The thing panel used to answer this question for itself — its Themes grid
   * simply took DOM focus when the tab opened — so the board and the panel
   * disagreed about who was being typed at, and which tab you were on changed
   * the answer. One flag, both panels.
   */
  const sidebarFocused = useSidebarFocusStore(s => s.focused);
  const setSidebarFocused = useSidebarFocusStore(s => s.setFocused);
  /**
   * The tab bar, and the two ways to walk it that are not a click.
   *
   * Declared here rather than beside the bar itself because the panel returns
   * early when nothing is selected, and hooks cannot be called after that. The
   * badges belong to the bar and are added where it is drawn.
   */
  const THING_TABS: ReadonlyArray<{ id: ThingTab }> = [
    { id: 'settings' }, { id: 'constellation' }, { id: 'history' },
  ];
  // Same L1/R1 and Tab as the want panel, from the same hook — a detail panel
  // is walked the same way whatever it is about. No `focus` half: this panel
  // has no card grid to hand the keys to yet, so every press switches.
  const panelRef = useRef<HTMLDivElement>(null);
  usePanelTabs({
    tabs: THING_TABS,
    activeTab,
    onTabChange: (id) => setActiveTab(id as ThingTab),
    enabled: !!record,
    // Tab belongs to this panel while the focus is anywhere in it — including
    // the Themes tab's own card grid, which holds it once that tab is open.
    scope: () => panelRef.current,
    // And the first bumper press from outside spends itself coming in, exactly
    // as it does next door.
    focus: {
      hasFocus: () => sidebarFocused,
      takeFocus: () => setSidebarFocused(true),
    },
  });
  // Where the tab bar goes, and therefore which way the panel is stacked —
  // the same question the want panel asks (see useHeaderAtBottom).
  const isBottom = useHeaderAtBottom();
  const constellations = useConstellationStore((s) => s.constellations);
  const constellationsByMember = React.useMemo(() => membersById(constellations, 'thing'), [constellations]);
  const eventsByRecord = useThingStore((s) => s.eventsByRecord);
  const eventsLoading = useThingStore((s) => s.eventsLoading);
  const fetchEventsForRecord = useThingStore((s) => s.fetchEventsForRecord);

  useEffect(() => {
    if (record) fetchEventsForRecord(record);
  }, [record, fetchEventsForRecord]);

  /**
   * History is a walk now, not just a scroll: each firing is a LogCard, and
   * the arrows step between them. Up out of the top hands the keys back to the
   * board, and Y on the focused card follows its mark to the want that named
   * the value — the same journey the card's own badge makes.
   */
  const events = record ? eventsByRecord[record.id] : undefined;
  const [historyFocus, setHistoryFocus] = useState(-1);
  const [historyFollow, setHistoryFollow] = useState<number | null>(null);
  const [historyFocusReq, setHistoryFocusReq] = useState(0);
  useEffect(() => { setHistoryFocus(-1); }, [activeTab, record]);
  // Land the ring on the first firing when the tab takes the keys (or when the
  // firings finish loading after it did) — the counter is how the grid hook is
  // told to focus card 0 and pull DOM focus onto itself so its arrows are live.
  useEffect(() => {
    if (activeTab === 'history' && sidebarFocused && (events?.length ?? 0) > 0 && historyFocus < 0) {
      setHistoryFocusReq((n) => n + 1);
    }
  }, [activeTab, sidebarFocused, events?.length, historyFocus]);
  const { gridProps: historyGridProps } = useCardGridNavigation({
    count: events?.length ?? 0,
    cols: 1,
    isActive: !!record && sidebarFocused && activeTab === 'history',
    focusedIndex: historyFocus,
    setFocusedIndex: setHistoryFocus,
    focusRequest: historyFocusReq,
    onYButton: (i) => setHistoryFollow(i),
    // Nothing sits above the list, so up off the top is the way out.
    onExitTop: () => { setHistoryFocus(-1); handBackToGrid(); },
  });

  if (!record) {
    return (
      <div className="text-center py-12">
        <Type className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Select a value to view its history</p>
      </div>
    );
  }

  const recordGroups = constellationsByMember.get(record.id) ?? [];

  // The card's pill, in words (see components/sidebar/CardStatusRow): how often
  // this value has been used. The constellations it belongs to used to be pills
  // here too; they have their own section below now, which names them and says
  // what order they come in, so a pill would only repeat the heading.
  const pillItems: CardStatusItem[] = [
    ...(record.count > 0 ? [{
      key: 'count',
      icon: <Hash className="w-3.5 h-3.5 text-gray-500" />,
      label: `Used ${record.count}×`,
    }] : []),
  ];

  return (
    <div className="h-full flex flex-col" ref={panelRef} onFocus={() => setSidebarFocused(true)}>
      {/* The thing's own card, and it stays.
          The rows below spell out what the card already shows at a glance — its
          type, its colour, its glyph — so leading with the card means the panel
          opens on the same object the user just clicked, rather than on a table
          about it. That only holds while it is on screen: a history long enough
          to scroll used to carry the card away, and what was left was a table
          about nothing in particular. It is also where focus lands when the
          panel is handed the keys, and a scrolled-off landing spot is not one.
          Pinned the way the want panel pins its card — a fixed block above a
          body that scrolls under it.

          order-first, in the pair with the tab body below: when the sheet docks
          to the bottom the body is re-ordered above the tab bar, and a card
          left in plain DOM order would sink beneath it. See WantDetailsSidebar,
          which arranges its three rows the same way. */}
      {/* No top padding: the identity row above (supplied by the host) already
          carries it, exactly as it does in the want panel where the two sit in
          one block. */}
      <div className={classNames('flex-shrink-0 px-3', isBottom ? 'order-first' : '')}>
        <div className="h-32 sm:h-36" data-sidebar-primary="true" tabIndex={-1}>
          {/* selected: EntityCard closes any overlay opened on a card that is
              not selected (see its effect on `selected && showActions`), so an
              unselected embed would open on long-press and shut again in the
              same frame. This card IS the subject of the sidebar, so saying so
              is also accurate. */}
          <ThingCard
            record={record}
            selected
            keepFocus
            onView={() => {}}
            onAddWant={onAddWant}
            onDelete={onDelete}
            className="h-full w-full"
          />
        </div>
      </div>

      {/* Three things to know about a thing, and they are not one page.
          What it is, who it belongs with, and what it has been used for were a
          single scroll, so reading the history meant scrolling past the themes
          and the themes' own cards could not be reached without passing the
          details. The want panel next door has always been tabbed; this is the
          same panel about a different object. */}
      <SidebarTabBar
        tabs={THING_TABS.map(t => (
          t.id === 'settings' ? { id: t.id, label: 'Settings', icon: Settings }
          : t.id === 'constellation' ? { id: t.id, label: 'Themes', icon: Folder, badge: recordGroups.length || null }
          : { id: t.id, label: 'History', icon: Clock, badge: events?.length ?? null }
        ))}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as ThingTab)}
        isBottom={isBottom}
      />

      {/* Everything the card is not. min-h-0 so this can actually shrink: a
          flex child's floor is its content, and without it the body grows to
          fit the history and pushes the pinned card off the top instead of
          scrolling. scroll-pt so a programmatic scroll-into-view (the History
          grid taking focus) stops short of the top edge and never tucks its
          first card under the pinned card above. */}
      <div className={classNames('flex-1 min-h-0 overflow-y-auto scroll-pt-6', isBottom ? 'order-first' : '')}>
      <TabContent>
        {activeTab === 'settings' && (
          <>
            {pillItems.length > 0 && <CardStatusRow items={pillItems} />}
            {/* No "Details" box: three rows under a heading in a tab already
                named Settings is a compartment around nothing. */}
            <div className="space-y-2 sm:space-y-3">
              <InfoRow label="Type" value={record.typeName} />
              <InfoRow label="Catalog" value={<span className="font-mono">{record.catalogKey}</span>} />
              <InfoRow label="Firings" value={events ? events.length : '…'} />
            </div>
          </>
        )}

        {activeTab === 'constellation' && (
          // No wrapping "Themes" box: each theme is its own coloured card, and
          // an outer titled compartment around the lot only nested a heading
          // over headings. The rows carry the tab now. ThemeOrderSection draws
          // its own empty state — the themes to join — so it always renders.
          <ThemeOrderSection record={record} getOrigin={getOrigin} onArranged={onArranged} isActive={sidebarFocused} />
        )}

        {activeTab === 'history' && (
          // No wrapping "History" box: the tab already says History, and the
          // titled compartment only pushed the first LogCard down far enough
          // that focusing the list scrolled it up under the pinned card above.
          eventsLoading && !events ? (
            <p className="text-xs text-gray-400">Loading…</p>
          ) : !events || events.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              No recorded history yet. New firings appear here as this value is named from wants.
            </p>
          ) : (
            <div {...historyGridProps} className="space-y-2 outline-none pt-1 pr-1.5">
              {events.map((ev, i) => (
                <MemoEventCard
                  key={`${ev.at}-${i}`}
                  ev={ev}
                  fallbackColor={record.color}
                  isFocused={historyFocus === i}
                  onFocusRequest={() => setHistoryFocus(i)}
                  followRequest={historyFollow === i}
                  onFollowRequestConsumed={() => setHistoryFollow(null)}
                />
              ))}
            </div>
          )
        )}
      </TabContent>
      </div>
    </div>
  );
};

/** One thing event as a LogCard. Exported so the Logs page's event list
 *  renders the same card instead of its own table — one thing history, one
 *  look. `showValue` leads with the value itself, which the Logs list needs
 *  because its events span every thing; inside a thing's own sidebar the value
 *  is the page you are already on, so the line leads with the want and the
 *  mark points there. */
export const MemoEventCard: React.FC<{
  ev: ThingEvent;
  fallbackColor: string;
  showValue?: boolean;
  isFocused?: boolean;
  onFocusRequest?: () => void;
  followRequest?: boolean;
  onFollowRequestConsumed?: () => void;
}> = ({ ev, fallbackColor, showValue = false, ...nav }) => {
  const wantTypes = useWantTypeStore((s) => s.wantTypes);
  // The thing this line names — only on the Logs page, where the line is about
  // a value; inside a thing's own panel that value is where you already are.
  const { marks: thingMarks } = useThingNames(showValue ? ev.value : null, ev.subtype);

  const wt = ev.wantType ? wantTypes.find((w) => w.name === ev.wantType) : undefined;
  const SIcon = sourceIcon(ev.source);
  const sourceLabel = MEMO_SOURCE_LABELS[ev.source] ?? ev.source;
  const wantName = wt?.title || ev.wantType || sourceLabel;
  const title = showValue ? ev.value : wantName;

  // Where the line points: the value's own tile on the Logs page, the want
  // that named it inside a thing's panel.
  const mark: Mark | null = showValue
    ? (thingMarks[0] ?? null)
    : (ev.wantId ? { kind: 'want', id: ev.wantId, name: wantName, wantType: ev.wantType } : null);

  return (
    <LogCard
      wantType={ev.wantType}
      fallbackIcon={SIcon}
      fallbackColor={fallbackColor}
      title={title}
      timestamp={ev.at}
      mark={mark}
      meta={
        <span className="flex items-center gap-1.5 flex-wrap">
          {showValue && ev.subtype && <span className="font-medium card-ink">{ev.subtype}</span>}
          {ev.wantType && <span className="font-mono truncate">{ev.wantType}</span>}
          <span className="inline-flex items-center gap-1"><SIcon className="w-3 h-3" />{sourceLabel}</span>
          {ev.characterName && <span className="inline-flex items-center gap-1"><Bot className="w-3 h-3" />{ev.characterName}</span>}
        </span>
      }
      {...nav}
    />
  );
};
