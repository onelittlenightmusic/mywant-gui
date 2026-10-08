import React from 'react';
import { hasExtensionRoute } from '@/extensions/registry';
import { useNavigate } from 'react-router-dom';
import { useIconFont } from '@/hooks/useDisplaySettings';
import { Type, Trash2, Heart, Plus, Check, Folder, Pin, PinOff, Pencil, Navigation, Archive, ArchiveRestore, Copy } from 'lucide-react';
import { copyText } from '@/utils/clipboard';
import { notify } from '@/stores/noticeStore';
import { ThingRecord } from '@/types/thing';
import { classNames } from '@/utils/helpers';
import { EntityCard, EntityCardAction } from '@/components/common/EntityCard';
import { thingGlyphColor } from '@/utils/thingFace';
import { entityCardId } from '@/stores/cardOverlayStore';
import { resolveLucideIcon } from '@/utils/subtypeIcons';
import { WantIcon } from './WantIcon';
import { type IconFamily } from './WantTypeVisuals';
import { iconEmbossFilter, wantTypeIconStyle, vividIconColor } from './WantCardFace';
import { useWantTypeStore } from '@/stores/wantTypeStore';
import { requestThingEdit } from '@/stores/thingEditStore';
import { useConfigStore } from '@/stores/configStore';
import { useThingTileStore } from '@/stores/thingTileStore';
import { useMarkJumpStore } from '@/stores/markJumpStore';
import { useDarkMode } from '@/hooks/useDarkMode';
import { thingBackgroundSrc, THING_BACKGROUND_SCRIM } from '@/utils/thingBackground';

interface MemoCardProps {
  record: ThingRecord;
  selected?: boolean;
  /** Embedded in a sidebar: do not pull DOM focus (see EntityCard). */
  keepFocus?: boolean;
  /** Multi-select mode: show a checkbox affordance; onView toggles selection. */
  selectMode?: boolean;
  checked?: boolean;
  /** Groups this value belongs to (clickable chips in the bottom bar). */
  constellations?: { id: string; name: string; color?: string }[];
  /** Click a group chip to edit that group (enter select mode on its members). */
  onEditConstellation?: (group: { id: string; name: string }) => void;
  onView: (record: ThingRecord) => void;
  onDelete?: (record: ThingRecord) => void;
  /** Start a new want seeded from this value (thing → want type picker). */
  onAddWant?: (record: ThingRecord) => void;
  /** Passed through to the card shell — the canvas float card sizes itself this way. */
  className?: string;
}

/** Turn a hex like "#06b6d4" into an rgba tint. */
export const ThingCard: React.FC<MemoCardProps> = ({ record, selected = false, keepFocus, selectMode = false, checked = false, constellations = [], onEditConstellation, onView, onDelete, onAddWant, className }) => {
  const Icon = resolveLucideIcon(record.icon) ?? Type;
  const wantTypes = useWantTypeStore((s) => s.wantTypes);
  const iconFont = useIconFont() as IconFamily;
  const isDark = useDarkMode();
  const emboss = iconEmbossFilter(!isDark);

  // The pin: which things stand on the canvas is the user's call, and this is
  // where they make it. Read straight from the board's own store rather than
  // through props, so the answer is the same one the canvas is drawing —
  // wherever this card happens to be rendered.
  /**
   * Where this card's picture comes from, or nothing.
   *
   * The subtype names the source in the server's data type catalog
   * (DataTypeInfo.Background) and there are two forms, because there are two
   * genuinely different kinds of picture:
   *
   *   background: station            a file every station shares, shipped with
   *                                  the GUI at /resources/station.png
   *   background: "@album_art_url"   THIS thing's own picture, whose URL is
   *                                  kept as a label on the thing itself
   *
   * The second is what a kind needs when the picture is per instance — an
   * album's cover, a page's screenshot — and a label is the right home for it
   * because a thing's labels are already its own durable, server-kept notes
   * (thing-labels.yaml), already reach this card, and need no new store.
   *
   * The catalog says a NAME either way: it never spells out where the GUI keeps
   * its files, and it never holds a URL of its own.
   */
  const backgroundSrc = React.useMemo(
    () => thingBackgroundSrc(record.background, record.labels),
    [record.background, record.labels],
  );

  const onCanvas = useThingTileStore((s) => s.onCanvas.has(record.id));
  const requestJump = useMarkJumpStore((s) => s.requestJump);
  const navigate = useNavigate();
  const setPinned = useThingTileStore((s) => s.setPinned);
  const archived = useThingTileStore((s) => s.archived.has(record.id));
  const setArchived = useThingTileStore((s) => s.setArchived);
  const ensureTiles = useThingTileStore((s) => s.ensureTiles);
  React.useEffect(() => { ensureTiles(); }, [ensureTiles]);

  const actions: EntityCardAction[] = [
    // Where it is, when it is anywhere. The mark other cards wear is a dot
    // (see MarkButton) because those cards are showing a value and the dot
    // is what says it is a thing; this card IS the thing, so the same journey
    // is an action rather than a badge. Offered only when the thing is on the
    // board — the pin beside it is what puts it there.
    ...(onCanvas && hasExtensionRoute('/canvas') ? [{
      icon: <Navigation className="w-5 h-5 text-white" />,
      label: 'Go to',
      title: `盤面の "${record.value}" へ行く`,
      onClick: () => { requestJump({ kind: 'thing', id: record.id, name: record.value }); navigate('/canvas'); },
      tone: 'info' as const,
    }] : []),
    // An archived thing is out of play, so the pin is not offered on it:
    // taking it back out is the one thing to do with it.
    ...(archived ? [] : [{
      icon: onCanvas ? <PinOff className="w-5 h-5 text-white" /> : <Pin className="w-5 h-5 text-white" />,
      label: onCanvas ? 'Unpin' : 'Pin',
      title: onCanvas
        ? `Take "${record.value}" off the canvas`
        : `Put "${record.value}" on the canvas`,
      onClick: () => { void setPinned(record.id, !onCanvas); },
      tone: onCanvas ? 'caution' as const : 'muted' as const,
    }]),
    {
      icon: archived ? <ArchiveRestore className="w-5 h-5 text-white" /> : <Archive className="w-5 h-5 text-white" />,
      label: archived ? 'Unarchive' : 'Archive',
      title: archived
        ? `Take "${record.value}" back out of the archive`
        : `Put "${record.value}" away — it stops, and the board shows it only with the archive on`,
      onClick: () => { void setArchived(record.id, !archived); },
      tone: 'caution' as const,
    },
    ...(onAddWant ? [{
      icon: (
        <span className="relative inline-flex">
          <Heart className="w-5 h-5 text-white" />
          <Plus className="w-3 h-3 text-white absolute -top-1.5 -right-1.5" style={{ strokeWidth: 3 }} />
        </span>
      ),
      label: 'Add Want',
      title: `Start a new want from "${record.value}"`,
      onClick: () => onAddWant(record),
      tone: 'primary' as const,
    }] : []),
    {
      // What the thing is, to paste elsewhere: its value — the link itself for
      // a url or a photo shared from Google Photos, the words for anything
      // else. copyText, not navigator.clipboard: a phone on the LAN's plain
      // http has no clipboard API, and this has to work there too.
      icon: <Copy className="w-5 h-5 text-white" />,
      label: 'Copy',
      title: `Copy "${record.value}"`,
      onClick: () => {
        void copyText(record.value).then(ok => notify(ok ? `コピーしました：${record.value}` : 'コピーできませんでした'));
      },
      tone: 'info' as const,
    },
    {
      icon: <Pencil className="w-5 h-5 text-white" />,
      label: 'Edit',
      title: `Change what kind of thing "${record.value}" is`,
      // Opens the same sidebar that naming a thing uses. The card cannot open a
      // panel itself — it is drawn in the grid, in the detail sheet and on the
      // board, and none of those is the owner — so it asks by name and whoever
      // has a sidebar answers. See thingEditStore.
      onClick: () => requestThingEdit(record),
      tone: 'primary' as const,
    },
    ...(onDelete ? [{
      icon: <Trash2 className="w-5 h-5 text-white" />,
      label: 'Delete',
      onClick: () => onDelete(record),
      tone: 'danger' as const,
      confirm: true,
    }] : []),
  ];

  return (
    <EntityCard
      navId={entityCardId('thing', record.id)}
      className={className}
      title={record.value}
      selected={selected}
      keepFocus={keepFocus}
      onView={() => onView(record)}
      actions={actions}
      badgeShape="thing"
      iconBadgeColor={record.color}
      icon={
        <div className="flex flex-col items-center justify-center gap-0.5 w-full [&_svg]:!w-1/2 [&_svg]:!h-1/2">
          {/* The thing's own colour, lifted to read — the glyph is the object
              now, not a pale mark on a disc. See EntityCard's thing badge. */}
          <Icon style={{ color: vividIconColor(record.color, !isDark), filter: emboss }} strokeWidth={1.75} />
          <span
            className="text-[8px] sm:text-[10px] font-semibold leading-none text-center max-w-full truncate"
            style={{ color: vividIconColor(record.color, !isDark) }}
          >
            {record.typeName}
          </span>
        </div>
      }
      titleIcon={<Icon className="h-2 w-2 sm:h-3.5 sm:w-3.5 flex-shrink-0" style={{ color: record.color }} />}
      backgroundNode={backgroundSrc ? (
        /*
         * The picture this thing is drawn over — see backgroundSrc for where
         * it comes from.
         *
         * Failing quietly matters more than usual: the source is named in a
         * catalog anybody can add to, so a typo, a picture that was never
         * copied in, or a label nobody has written yet must leave the card
         * exactly as it was rather than showing a broken-image glyph.
         */
        <>
          <img
            src={backgroundSrc}
            alt=""
            draggable={false}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
            className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none"
          />
          {/* A scrim, so the centred glyph and the name in the bottom bar stay
              the card and the photograph behind them does not win.
              Lighter at both ends than the world thumbnail's, which this
              started as: a world card is a screenshot of a whole board and
              needs holding back, where this is one picture of one kind of
              thing and is most of why the card is worth looking at. The glyph
              and the title carry their own emboss and halo, so the scrim only
              has to take the edge off rather than cover the ends. */}
          <div className={THING_BACKGROUND_SCRIM} />
        </>
      ) : undefined}
    >
      {/* On the board, and says so. Without a mark the pin action is a control
          with no readout: nothing on the card would tell you which things are
          out there. While selecting it moves to the other corner rather than
          disappearing — a batch pin has to be able to show its own result. */}
      {onCanvas && (
        <div
          className={classNames(
            'absolute z-20 w-6 h-6 rounded-full flex items-center justify-center bg-white/40 dark:bg-black/40 backdrop-blur-sm border border-white/30 dark:border-white/10',
            // Top-right normally; while selecting, the checkbox has that corner
            // and the character marker has the top-left, so it takes the one
            // corner nothing else wants.
            selectMode ? 'bottom-1.5 right-1.5' : 'top-1.5 right-1.5',
          )}
          title="On the canvas"
        >
          <Pin className="w-3 h-3" style={{ color: record.color }} strokeWidth={2.5} />
        </div>
      )}
      {/* Put away, and says so — in the pin mark's corner, which an archived
          thing never wears. */}
      {archived && (
        <div
          className={classNames(
            'absolute z-20 w-6 h-6 rounded-full flex items-center justify-center bg-white/40 dark:bg-black/40 backdrop-blur-sm border border-white/30 dark:border-white/10',
            selectMode ? 'bottom-1.5 right-1.5' : 'top-1.5 right-1.5',
          )}
          title="Archived"
        >
          <Archive className="w-3 h-3 text-gray-600 dark:text-gray-300" strokeWidth={2.5} />
        </div>
      )}
      {/* Multi-select checkbox — top-right, filled when selected. */}
      {selectMode && (
        <div
          className={classNames(
            'absolute top-1.5 right-1.5 z-20 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors',
            checked
              ? 'bg-indigo-600 border-indigo-600 text-white'
              : 'bg-white/70 dark:bg-black/40 border-gray-400 dark:border-gray-500 text-transparent',
          )}
        >
          <Check className="w-3.5 h-3.5" strokeWidth={3} />
        </div>
      )}
      {/* What this value is used with — its constellations, how often it has been
          named, and the want types that name it — in one pill at the foot of the
          card. Bottom left, out of the way of the mark top-right, and where the
          other cards keep their fine print. */}
      {(record.topWantTypes.length > 0 || constellations.length > 0) && (
        <div className="absolute bottom-1.5 left-1.5 z-20 flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-white/30 dark:bg-black/30 backdrop-blur-sm border border-white/20 dark:border-white/10 pointer-events-none">
          {/* Groups come first and keep their own pointer events: these chips
              are the only way into group editing, so they had to come with the
              bar rather than go with it. */}
          {constellations.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={(e) => { e.stopPropagation(); onEditConstellation?.(g); }}
              onMouseDown={(e) => e.stopPropagation()}
              className="pointer-events-auto inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold bg-indigo-100/90 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800/80 transition-colors"
              title={onEditConstellation ? `Edit group: ${g.name}` : `Constellation: ${g.name}`}
            >
              <Folder
                className="w-2.5 h-2.5"
                style={g.color ? { color: g.color } : undefined}
              />{g.name}
            </button>
          ))}
          {record.count > 0 && (
            <span
              className="text-[10px] sm:text-xs font-semibold text-gray-700 dark:text-gray-200"
              title={`Used ${record.count}×`}
            >
              ×{record.count}
            </span>
          )}
          {record.topWantTypes.map((tc) => {
            const wt = wantTypes.find((w) => w.name === tc.type);
            const category = wt?.category ?? '';
            // Same vivid want-type colour the canvas tile / want-card pill uses.
            const color = wantTypeIconStyle(tc.type, category, isDark).color as string;
            return (
              <WantIcon
                key={tc.type}
                typeName={tc.type}
                category={category}
                iconFont={iconFont}
                size={18}
                iconStyle={{ color, filter: emboss }}
                className="flex-shrink-0"
              />
            );
          })}
        </div>
      )}
    </EntityCard>
  );
};
