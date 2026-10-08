import { thingBackgroundSrc } from '@/utils/thingBackground';
import { create } from 'zustand';
import { openConnectionMenu } from '@/stores/connectionMenu';
import { subscribeWithSelector } from 'zustand/middleware';
import { useThingStore } from '@/stores/thingStore';
import { useWantStore } from '@/stores/wantStore';
import { apiClient } from '@/api/client';
import type { ThingUsage } from '@/types/thing';
import type { DataTypeInfo } from '@/hooks/useDataTypes';
import { useThingPlacementStore } from './thingPlacementStore';
import { useConstellationStore } from './constellationStore';

/** The picture this thing carries of its own — see ThingTile.picture. */
const ownPicture = (background: string | undefined, labels: Record<string, string>) =>
  background?.startsWith('@') ? thingBackgroundSrc(background, labels) : undefined;

/** Canvas coordinates for a thing ride on the value's own labels. */
export const THING_CANVAS_LABEL_X = 'mywant.io/canvas-x';
export const THING_CANVAS_LABEL_Y = 'mywant.io/canvas-y';
/**
 * The pin: the user's own answer to "is this thing on the board?", which beats
 * whatever the automatic rule would have decided. Absent means no answer was
 * given and the rule stands; "true" pins a thing on, "false" takes it off even
 * while a live want names it.
 */
export const THING_CANVAS_PIN_LABEL = 'mywant.io/canvas';
/**
 * The archive: a thing put away. Not the pin — an unpinned thing is only off
 * the board; an archived one is out of play (the server stops its motion and
 * no rule fires on it) and the board draws it only while the archive is shown.
 * The same label a want is archived with.
 */
export const THING_ARCHIVE_LABEL = 'mywant.io/archived';
/** Set while a thing moves; archiving stops it, as the bin always has. */
const THING_MOVING_LABEL = 'mywant.io/moving';

/** True if the thing's labels say it is archived. */
export function isThingArchived(labels: Record<string, string> | undefined): boolean {
  return labels?.[THING_ARCHIVE_LABEL] === 'true';
}

export interface ThingTile {
  /** Thing record id — the thing's own UUID. */
  id: string;
  value: string;
  subtype: string;
  icon: string;
  color: string;
  /** Live wants naming this value — one relation road each. */
  wantIDs: string[];
  /** Those of them that name it as one of several, drawn as a dashed road. */
  listWantIDs: string[];
  /** Placement the user dragged to, if any. Absent means auto-placed. */
  x?: number;
  y?: number;
  /** Put away — only ever true on an entry of `archivedTiles`. */
  archived?: boolean;
  /**
   * The thing's own picture, where its subtype keeps one on the thing (a
   * "@label" background): a shared photo, a page's screenshot, an album's
   * cover. A kind's shared file (a station's) is not a ball's: every station
   * would wear the same one.
   */
  picture?: string;
}

interface ThingTileStore {
  tiles: ThingTile[];
  loading: boolean;
  /** True once a fetch has completed, so cards can ask without each starting one. */
  loaded: boolean;
  /** Ids currently drawn on the board — what the pin control reads. */
  onCanvas: Set<string>;
  /**
   * Every archived thing, ready to draw when the board shows its archive —
   * whether or not it was ever placed. Never part of `tiles` or `onCanvas`.
   */
  archivedTiles: ThingTile[];
  /** Ids of the archived things — what the archive control reads. */
  archived: Set<string>;
  /**
   * Put a thing away, or take it back out. Archiving also stops it moving; the
   * pin and the coordinates are left alone, so taking it out returns it to
   * where it stood.
   */
  setArchived: (id: string, archived: boolean) => Promise<void>;
  /** The same for a whole selection at once. */
  setArchivedMany: (ids: string[], archived: boolean) => Promise<void>;
  fetchTiles: () => Promise<void>;
  /** Fetch once, for surfaces that only read (the Thing page's pins). */
  ensureTiles: () => void;
  /** Persist a dragged position onto the thing's labels. */
  setPosition: (id: string, x: number, y: number) => Promise<void>;
  /**
   * Move tiles to where the server says they now are — one tick of thing
   * motion, applied to the board.
   *
   * The counterpart of setPosition, and deliberately not it: setPosition is a
   * user putting something down, so it writes the labels and asks what the
   * thing was set beside. This is the board being told where things went. The
   * labels are already written — that is what produced the frame — and a thing
   * carried past another one by its own motion has not been placed beside
   * anything.
   */
  applyMoves: (moves: Array<{ id: string; x: number; y: number }>) => void;
  /**
   * Put a thing on the board, or take it off, and remember that it was asked for.
   *
   * `at` is where the pin should land it — the cell the character is standing
   * on, for a pin made from a form rather than from the board. Without it the
   * thing goes wherever auto-placement puts it, which is what the Thing page's
   * pin has always done.
   */
  setPinned: (id: string, pinned: boolean, at?: { x: number; y: number }) => Promise<void>;
  /** The same answer given for a whole selection at once. */
  setPinnedMany: (ids: string[], pinned: boolean, at?: { x: number; y: number }) => Promise<void>;
  /**
   * Take a thing off the board that the SERVER has already taken off — a bin
   * swallowed it where the board could not see (see useIntersectionEffects).
   *
   * The write half of setPinned without the write: the labels are already what
   * they need to be, and asking for them again would be a round trip to
   * confirm what the message that arrived was telling us. Without this the tile
   * sat beside the bin it had just gone into until the next want poll happened
   * to trigger a refetch.
   */
  removeFromCanvas: (id: string) => void;
  /**
   * The server has archived a thing (a bin swallowed it) — move its tile into
   * the archive here too, without a round trip. See removeFromCanvas.
   */
  markArchived: (id: string) => void;
  /**
   * Put a whole set of things at cells that were worked out together — what
   * lining a theme up produces.
   *
   * Not a loop over setPosition. That one asks, of every thing it moves, what
   * it was set down beside, and a line puts each thing beside the last: laying
   * out ten stations that way would raise nine "what do you want to call this
   * group?" prompts for an arrangement the user has already named. An
   * arrangement says where things go, not who belongs with whom.
   *
   * Anything not already on the board is pinned on by being placed, since a
   * line with gaps in it is not the line that was asked for.
   *
   * Returns where those things stood before, so the arrangement can be taken
   * back. An arrangement moves everything at once and is easy to regret, and
   * "put it back" has to mean the board as it actually was — including the
   * things that were not on it at all.
   */
  arrangeMany: (cells: Map<string, { x: number; y: number }>) => Promise<ThingPlacementSnapshot>;
  /** Put the board back the way a snapshot found it. The other half of arrangeMany. */
  restorePlacement: (before: ThingPlacementSnapshot) => Promise<void>;
}

/**
 * What a thing's three canvas labels said, verbatim — absent means the label
 * was not there.
 *
 * Raw label values rather than parsed coordinates because absence is the whole
 * point: a thing with no x/y is one the canvas places itself, and a thing with
 * no pin is one nobody has answered for. Writing "0" or "false" back over
 * either would be a different board from the one we found.
 */
export interface ThingCanvasLabels {
  x?: string;
  y?: string;
  pin?: string;
}

export type ThingPlacementSnapshot = Map<string, ThingCanvasLabels>;

function numberLabel(labels: Record<string, string> | undefined, key: string): number | undefined {
  const raw = labels?.[key];
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/** The pin as three states: on, off, or never answered. */
function pinLabel(labels: Record<string, string> | undefined): boolean | undefined {
  const raw = labels?.[THING_CANVAS_PIN_LABEL];
  if (raw === undefined) return undefined;
  return raw === 'true';
}

/**
 * The four cells that count as "beside". Diagonals are not beside: a thing set
 * down on a corner is passing another one, not joining it, and a rule that
 * fires on eight neighbours fires by accident.
 */
const BESIDE: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * What a thing is called — the half worth naming a constellation after.
 *
 * Asked of the record rather than cut out of the id: an id is a UUID now and
 * says nothing about the thing. Falls back to the id so a group formed before
 * the record loaded still gets a name rather than an empty one.
 */
function thingValue(id: string): string {
  const record = useThingStore.getState().records.find(r => r.id === id);
  return (record?.value ?? id).replace(/\//g, '-'); // a group name may not contain '/'
}

/**
 * Putting a thing down beside another says they belong together, so it makes
 * the constellation that says so.
 *
 * Only ever additive. Moving a thing away from its neighbours does not take it
 * out of anything: the constellation is a name the user gave to a handful of
 * values, and a name is not undone by rearranging the board.
 */
/**
 * Propose that these two things belong together, joining first if one of them
 * already belongs somewhere.
 *
 * The asking half of the rule below, split out because there are two ways to
 * say "these two go together" and only one of them is about adjacency. Setting
 * a thing down beside another is the board noticing; running the connect
 * skill's wire from one to the other is a person stating it outright (see
 * pages/canvas/useCanvasConnect). Both arrive at the same question, which is
 * the whole reason the prompt lives in a store.
 *
 * Returns whether there was anything to ask. False means the two already share
 * a constellation — which is an answer, and the caller is the one placed to say
 * so out loud.
 */
export async function proposeConstellationFor(
  joiningId: string,
  anchorId: string,
  /**
   * Everyone the question is about, when there are more than two.
   *
   * A wire tied through three things is one group and one want, and it used to
   * be chopped into consecutive pairs before it got here — which asked twice
   * about a thing said once. The pair above still anchors the bubble; these
   * are who it acts on.
   */
  members?: string[],
): Promise<boolean> {
  // The general menu (see connectionMenu), with two things' own second half:
  // a want made of them, which the prompt offers itself for things.
  return openConnectionMenu({
    joiningId, anchorId, members, kind: 'thing', suggested: thingValue(anchorId),
  });
}

async function joinWhoeverItLandedBeside(id: string, x: number, y: number) {
  const positions = useThingPlacementStore.getState().positions;
  const occupant = new Map<string, string>();
  positions.forEach((p, tid) => { if (tid !== id) occupant.set(`${p.x},${p.y}`, tid); });
  const beside = BESIDE
    .map(([dx, dy]) => occupant.get(`${x + dx},${y + dy}`))
    .filter((n): n is string => !!n);
  if (beside.length === 0) return;

  // Any constellation, not just the thing-only ones: a thing set down beside
  // a member of a mixed group is being set down beside that group.
  await useConstellationStore.getState().fetchConstellations();
  const groups = useConstellationStore.getState().constellations;
  const mine = groups.filter(g => g.members.includes(id));
  // Already sharing a constellation with something it is now beside: the move
  // rearranged the sky, it did not change who belongs with whom. Asked of every
  // neighbour, not just the one that becomes the anchor — landing between two
  // members of your own group is still landing among your own.
  if (beside.some(n => mine.some(g => g.members.includes(n)))) return;

  // The Fliction spark that marks the join happens only once the user has
  // actually said yes, inside the prompt.
  await proposeConstellationFor(id, beside[0]);
}

/**
 * The cell a pin should actually use, starting from where it was asked for.
 *
 * The character's own cell first — pinning something puts it underfoot, and
 * standing on a thing is simply being at it. Only if that cell is already
 * spoken for does it walk outward, because two things given identical
 * coordinates are honoured literally by the canvas and stack into one tile.
 *
 * Occupancy is read from what the board has published (thing placements) and
 * from the wants that carry canvas labels. Auto-placed wants are not in that
 * list; a pin can still land under one, and the user can drag it off.
 */
function freeCellNear(at: { x: number; y: number }, alsoTaken: Set<string>): { x: number; y: number } {
  const key = (x: number, y: number) => `${x},${y}`;
  const taken = new Set(alsoTaken);
  useThingPlacementStore.getState().positions.forEach(p => taken.add(key(p.x, p.y)));
  for (const w of useWantStore.getState().wants) {
    const labels = w.metadata?.labels;
    const x = numberLabel(labels, THING_CANVAS_LABEL_X);
    const y = numberLabel(labels, THING_CANVAS_LABEL_Y);
    if (x !== undefined && y !== undefined) taken.add(key(x, y));
  }
  const ox = Math.round(at.x), oy = Math.round(at.y);
  for (let ring = 0; ring < 16; ring++) {
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        if (taken.has(key(ox + dx, oy + dy))) continue;
        return { x: ox + dx, y: oy + dy };
      }
    }
  }
  return { x: ox, y: oy };
}

/**
 * The things that are on the board, ready to draw.
 *
 * A thing stands on the same footing as a want, which means the same rule
 * decides whether it is there: a want is on the canvas because it has canvas
 * coordinates, and so is a thing. It carries them on its own labels, so a thing
 * you place stays where you put it whether or not anything points at it.
 *
 * A thing a live want names is drawn too, even unplaced — that is the road from
 * the want to the value it is about, and it is what the board is for. Everything
 * else lives on the Thing page until it is dragged onto the canvas.
 *
 * That rule is a guess at what the user wants to see, and the pin is where they
 * say otherwise: pinned things are drawn whether or not anything names them, and
 * an unpinned thing stays off the board even while a want names it. A guess only
 * applies until it is contradicted.
 */
export const useThingTileStore = create<ThingTileStore>()(
  subscribeWithSelector((set, get) => ({
    tiles: [],
    loading: false,
    loaded: false,
    onCanvas: new Set<string>(),
    archivedTiles: [],
    archived: new Set<string>(),

    ensureTiles: () => {
      const { loaded, loading } = get();
      if (loaded || loading) return;
      void get().fetchTiles();
    },

    fetchTiles: async () => {
      set({ loading: true });
      try {
        // One call. The type lookup, the usage relation and the labels all
        // arrive with each thing, so there is nothing left to join up here.
        const things = await apiClient.getThings().catch(() => []);

        const tiles: ThingTile[] = [];
        const archivedTiles: ThingTile[] = [];
        for (const t of things) {
          const labels = t.labels ?? {};
          const x = numberLabel(labels, THING_CANVAS_LABEL_X);
          const y = numberLabel(labels, THING_CANVAS_LABEL_Y);
          const named = (t.wantIDs?.length ?? 0) > 0;
          const pinned = pinLabel(labels);
          // Put away: kept apart, whatever its pin says, for a board that
          // shows its archive. No coordinates is fine — the board finds it a
          // cell for as long as it is shown and writes none.
          if (isThingArchived(labels)) {
            archivedTiles.push({
              id: t.id, value: t.value, subtype: t.subtype, icon: t.icon, color: t.color,
              wantIDs: t.wantIDs ?? [], listWantIDs: t.listWantIDs ?? [], x, y, archived: true,
              picture: ownPicture(t.background, labels),
            });
            continue;
          }
          // Taken off the board by hand. Coordinates are kept, so pinning it
          // back returns it to where it was rather than to an empty cell.
          if (pinned === false) continue;
          // Not pinned, not placed, nobody naming it: it exists, but it is not
          // on the board. Drawing every remembered value would bury the canvas
          // in things the user never put there.
          if (!pinned && x === undefined && y === undefined && !named) continue;
          tiles.push({
            id: t.id,
            value: t.value,
            subtype: t.subtype,
            icon: t.icon,
            color: t.color,
            wantIDs: t.wantIDs ?? [],
            listWantIDs: t.listWantIDs ?? [],
            x,
            y,
            picture: ownPicture(t.background, labels),
          });
        }
        set({
          tiles, archivedTiles, loading: false, loaded: true,
          onCanvas: new Set(tiles.map(t => t.id)),
          archived: new Set(archivedTiles.map(t => t.id)),
        });
      } catch {
        set({ loading: false });
      }
    },

    setPosition: async (id, x, y) => {
      const prev = get().tiles;
      // Where it was, so a move that goes nowhere can be told from a move.
      const before = prev.find(t => t.id === id);
      const moved = before?.x !== x || before?.y !== y;
      set({ tiles: prev.map(t => (t.id === id ? { ...t, x, y } : t)) });
      try {
        await apiClient.setThingLabel(id, THING_CANVAS_LABEL_X, String(x));
        await apiClient.setThingLabel(id, THING_CANVAS_LABEL_Y, String(y));
      } catch {
        set({ tiles: prev });
        return;
      }
      // Every way of moving a thing — dragged, or walked with Shift and the
      // arrows — lands here, so the rule only has to be written once.
      //
      // Only when it actually went somewhere. Shift is held for other reasons:
      // Shift+Enter opens a card's actions, and the Shift alone was enough to
      // pick a thing up and put it straight back down — which asked what to
      // call a constellation nobody had made, over a board where nothing had
      // moved. Setting a thing down where it already was says nothing about
      // what it belongs with.
      if (moved) await joinWhoeverItLandedBeside(id, x, y);
    },

    applyMoves: (moves) => {
      if (moves.length === 0) return;
      const next = new Map<string, { x: number; y: number }>();
      for (const m of moves) {
        // Real numbers: a thing in flight is between cells, and rounding here
        // would step it from square to square instead of sliding.
        if (Number.isFinite(m.x) && Number.isFinite(m.y)) next.set(m.id, { x: m.x, y: m.y });
      }
      const prev = get().tiles;
      // Nothing on the board changed hands: a thing can be in motion while
      // being off the canvas entirely, and every frame would otherwise re-run
      // the layout memo — and with it every constellation line — for a move
      // that draws nothing.
      let touched = false;
      const tiles = prev.map(t => {
        const cell = next.get(t.id);
        if (!cell || (t.x === cell.x && t.y === cell.y)) return t;
        touched = true;
        return { ...t, x: cell.x, y: cell.y };
      });
      if (touched) set({ tiles });
    },

    removeFromCanvas: (id) => {
      const { tiles, onCanvas } = get();
      if (!onCanvas.has(id) && !tiles.some(t => t.id === id)) return;
      const next = new Set(onCanvas);
      next.delete(id);
      set({ tiles: tiles.filter(t => t.id !== id), onCanvas: next });
    },

    markArchived: (id) => {
      const { tiles, onCanvas, archivedTiles, archived } = get();
      if (archived.has(id)) return;
      const tile = tiles.find(t => t.id === id);
      const nextOn = new Set(onCanvas); nextOn.delete(id);
      const nextArchived = new Set(archived); nextArchived.add(id);
      set({
        tiles: tiles.filter(t => t.id !== id),
        onCanvas: nextOn,
        archived: nextArchived,
        archivedTiles: tile ? [...archivedTiles, { ...tile, archived: true }] : archivedTiles,
      });
    },

    setArchived: async (id, archived) => get().setArchivedMany([id], archived),

    setArchivedMany: async (ids, archived) => {
      if (ids.length === 0) return;
      const wanted = new Set(ids);
      // The board answers before the write does, as the pin does.
      const { tiles, archivedTiles, onCanvas } = get();
      const nextArchived = new Set(get().archived);
      const nextOn = new Set(onCanvas);
      for (const id of ids) {
        if (archived) { nextArchived.add(id); nextOn.delete(id); } else nextArchived.delete(id);
      }
      set(archived
        ? {
            archived: nextArchived,
            onCanvas: nextOn,
            tiles: tiles.filter(t => !wanted.has(t.id)),
            archivedTiles: [
              ...archivedTiles.filter(t => !wanted.has(t.id)),
              ...tiles.filter(t => wanted.has(t.id)).map(t => ({ ...t, archived: true })),
            ],
          }
        : { archived: nextArchived, archivedTiles: archivedTiles.filter(t => !wanted.has(t.id)) });
      await Promise.all(ids.map(async id => {
        if (archived) {
          // Stopped as well as put away, or it would set off again the moment
          // it came back out.
          await apiClient.setThingLabel(id, THING_MOVING_LABEL, 'false').catch(() => {});
          await apiClient.setThingLabel(id, THING_ARCHIVE_LABEL, 'true').catch(() => {});
        } else {
          await apiClient.removeThingLabel(id, THING_ARCHIVE_LABEL).catch(() => {});
        }
      }));
      // The records too: the Thing list filters on their labels, and asking
      // here does not wait on the server's thing_changed to arrive.
      void useThingStore.getState().fetchThings();
      await get().fetchTiles();
    },

    setPinned: async (id, pinned, at) => get().setPinnedMany([id], pinned, at),

    setPinnedMany: async (ids, pinned, at) => {
      if (ids.length === 0) return;
      const wanted = new Set(ids);
      // Where each one lands, decided up front so a batch pinned at one cell
      // fans out instead of stacking. Only when a destination was asked for:
      // without one the canvas's own auto-placement still does the deciding.
      const cells = new Map<string, { x: number; y: number }>();
      if (pinned && at) {
        const claimed = new Set<string>();
        for (const id of ids) {
          const cell = freeCellNear(at, claimed);
          claimed.add(`${cell.x},${cell.y}`);
          cells.set(id, cell);
        }
      }
      // The board answers before the write does — a pin that waits on the
      // network reads as a control that did not take.
      const next = new Set(get().onCanvas);
      for (const id of ids) { if (pinned) next.add(id); else next.delete(id); }
      set({
        onCanvas: next,
        tiles: pinned ? get().tiles : get().tiles.filter(t => !wanted.has(t.id)),
      });
      // One write each, in parallel; a failure is left for the fetch below to
      // correct rather than rolling the whole selection back.
      await Promise.all(ids.map(async id => {
        // Coordinates before the pin, so the fetch that follows already sees
        // the thing where it was put rather than drawing it once at the
        // auto-placed cell and moving it on the next pass.
        const cell = cells.get(id);
        if (cell) {
          await apiClient.setThingLabel(id, THING_CANVAS_LABEL_X, String(cell.x)).catch(() => {});
          await apiClient.setThingLabel(id, THING_CANVAS_LABEL_Y, String(cell.y)).catch(() => {});
        }
        await apiClient.setThingLabel(id, THING_CANVAS_PIN_LABEL, pinned ? 'true' : 'false').catch(() => {});
      }));
      // A pinned thing needs its icon, colour and roads before it can be drawn,
      // and only a fetch knows those. Once for the whole batch.
      await get().fetchTiles();
    },

    arrangeMany: async (cells) => {
      if (cells.size === 0) return new Map();
      // Read the board before touching it, from the server rather than from
      // what this tab happens to hold: a tile dragged since the last fetch, or
      // moved by somebody else, is still where "put it back" has to return it.
      const before: ThingPlacementSnapshot = new Map();
      const things = await apiClient.getThings().catch(() => []);
      for (const t of things) {
        if (!cells.has(t.id)) continue;
        const labels = t.labels ?? {};
        before.set(t.id, {
          x: labels[THING_CANVAS_LABEL_X],
          y: labels[THING_CANVAS_LABEL_Y],
          pin: labels[THING_CANVAS_PIN_LABEL],
        });
      }

      const prev = get().tiles;
      // The line appears at once. Every tile already drawn slides to its place
      // before any write lands; the ones that were not on the board yet arrive
      // with the fetch at the end, which is the only thing that knows their
      // icon and colour.
      const next = new Set(get().onCanvas);
      cells.forEach((_, id) => next.add(id));
      set({
        onCanvas: next,
        tiles: prev.map(t => {
          const cell = cells.get(t.id);
          return cell ? { ...t, x: cell.x, y: cell.y } : t;
        }),
      });
      await Promise.all([...cells].map(async ([id, cell]) => {
        await apiClient.setThingLabel(id, THING_CANVAS_LABEL_X, String(cell.x)).catch(() => {});
        await apiClient.setThingLabel(id, THING_CANVAS_LABEL_Y, String(cell.y)).catch(() => {});
        await apiClient.setThingLabel(id, THING_CANVAS_PIN_LABEL, 'true').catch(() => {});
      }));
      await get().fetchTiles();
      return before;
    },

    restorePlacement: async (before) => {
      if (before.size === 0) return;
      // Set what was set, remove what was absent. Not a write of the old values
      // alone: arrangeMany pins everything it places, so a thing that was never
      // on the board would stay on it wearing its old coordinates.
      const put = async (id: string, key: string, value: string | undefined) => {
        if (value === undefined) await apiClient.removeThingLabel(id, key).catch(() => {});
        else await apiClient.setThingLabel(id, key, value).catch(() => {});
      };
      await Promise.all([...before].map(async ([id, labels]) => {
        await put(id, THING_CANVAS_LABEL_X, labels.x);
        await put(id, THING_CANVAS_LABEL_Y, labels.y);
        await put(id, THING_CANVAS_PIN_LABEL, labels.pin);
      }));
      await get().fetchTiles();
    },
  })),
);
