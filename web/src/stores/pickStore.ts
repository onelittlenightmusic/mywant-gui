import { create } from 'zustand';
import { moveFocusTo } from './focusOwner';
import { subtypeMatchScore } from '@/utils/wantSeed';
import { apiClient } from '@/api/client';
import { subscribeGUIState } from '@/api/guiStateStream';

/**
 * Pick mode: a parameter asking the board (or the thing list) for its value.
 *
 * A parameter card's pick button raises it. The keys go out to the board — the
 * focus owner 'pick' (focusOwner) — the board darkens, and only what the
 * parameter can take stands in front: the things of a subtype it accepts (a
 * route's `from`: the stations), and the wants offering a value for it. Walking
 * onto one and confirming, or tapping it, is not looking at it: it is the
 * answer — 国分寺 picked, `from` is 国分寺 — and the keys go back to the card
 * that asked. B / Escape goes back with nothing.
 *
 * Held as the GUI's state on the server (gui_state `pick`, and the answer as
 * `pick_choice`), not in the page: the card asking and the board answering can
 * be pages of their own — an app's sheet over its board, a phone's Thing tab —
 * and every page hears the GUI's state (guiStateStream). Each takes the mode
 * up as `pick` appears and puts it down as it goes; the page that asked hears
 * its answer and writes it into its card. What to do with the answer stays
 * with the card that asked (its resolver, kept in that page by request id).
 */
export interface PickRequest {
  id: string;
  /** The parameter asking, and what it is called on screen. */
  paramName: string;
  label: string;
  /** The subtypes it accepts (acceptedSubTypes) — a thing of one of these, or
   *  of the same catalog, answers. */
  subtypes: string[];
  /** Wants offering a value for it (the server's recommendations): picking
   *  one wires the two. By want id. */
  wantIds: string[];
  /** Who is asking, to show it: the want (or, in Add Want, the type being
   *  made) whose parameter it is. */
  asker?: { wantId?: string; wantType?: string; wantName?: string };
  /** The parameter's card, to show it empty: its kind and subtype. */
  param?: { type: string; hasEnum: boolean; subType?: string; required?: boolean };
  /** When it was asked (ms). One left on the server by a page that went
   *  away mid-pick is not taken up again past PICK_STALE_MS. */
  at: number;
}

const PICK_STALE_MS = 2 * 60_000;

export type PickChoice =
  | { kind: 'thing'; id: string; value: string }
  | { kind: 'want'; id: string };

interface PickStore {
  request: PickRequest | null;
}

export const usePickStore = create<PickStore>(() => ({ request: null }));

/** The answers this page is waiting for, by request id. */
const resolvers = new Map<string, (choice: PickChoice) => void>();
/** This page, among the GUI's pages: a request's id says who asked. */
const PAGE = Math.random().toString(36).slice(2, 8);
let seq = 0;

/**
 * This page's last write of the pick: until it lands, and for any snapshot
 * older than it (by the GUI state's seq), what the server says of the pick is
 * from before it — taken at its word, it would put the mode down (or take an
 * old one up) the moment it was raised.
 */
let writing = 0;
let writtenSeq = -1;

function write(pick: PickRequest | null, choice?: { id: string; choice: PickChoice | null }): void {
  writing++;
  apiClient.updateGUIState({ pick, pick_choice: choice ?? null }, undefined, { request: true })
    .then(r => { writtenSeq = Math.max(writtenSeq, r.seq); })
    .catch(() => {})
    .finally(() => { writing--; });
}

/** Raise pick mode for a parameter; `resolve` is given the answer. */
export function startPick(req: Omit<PickRequest, 'id' | 'at'>, resolve: (choice: PickChoice) => void): void {
  const request = { ...req, id: `${PAGE}-${++seq}`, at: Date.now() };
  resolvers.set(request.id, resolve);
  write(request);
  takeUp(request);
}

/** The answer: written for the page that asked, and the keys back to it. */
export function choosePick(choice: PickChoice): void {
  end(choice);
}

/** Back to the card with nothing. */
export function cancelPick(): void {
  end(null);
}

function end(choice: PickChoice | null): void {
  const req = usePickStore.getState().request;
  if (!req) return;
  write(null, { id: req.id, choice });
  putDown();
  answer(req.id, choice);
  // Back to the card that asked: the panel — in an app, beside this page,
  // which moveFocusTo hands them over to.
  moveFocusTo('panel');
}

/** The keys out to the board, then the mode: the move reads where they were. */
function takeUp(request: PickRequest): void {
  if (usePickStore.getState().request?.id === request.id) return;
  moveFocusTo('pick');
  usePickStore.setState({ request });
}

function putDown(): void {
  if (usePickStore.getState().request) usePickStore.setState({ request: null });
}

/** This page's card asked: it is told (null: nothing was picked). */
function answer(id: string, choice: PickChoice | null): void {
  const resolve = resolvers.get(id);
  if (!resolve) return;
  resolvers.delete(id);
  if (choice) resolve(choice);
}

// Every page follows the GUI's pick, however it was raised and wherever it
// was answered.
if (typeof window !== 'undefined') {
  subscribeGUIState(({ seq, state }) => {
    if (writing > 0 || seq < writtenSeq) return; // from before this page's own write
    const pick = (state.pick ?? null) as PickRequest | null;
    if (pick?.id && Date.now() - (pick.at ?? 0) < PICK_STALE_MS) takeUp(pick);
    else putDown();
    const made = state.pick_choice as { id?: string; choice?: PickChoice | null } | null | undefined;
    if (made?.id) answer(made.id, made.choice ?? null);
  });
}

type GetTypeInfo = (typeName: string) => { catalog?: string } & { name: string };

/** Whether a thing of `subtype` answers the request. */
export function pickTakesThing(req: PickRequest | null, subtype: string, getTypeInfo: GetTypeInfo): boolean {
  if (!req) return false;
  return req.subtypes.some(s => subtypeMatchScore(s, subtype, getTypeInfo as never) > 0);
}

/** Whether this want answers the request. */
export function pickTakesWant(req: PickRequest | null, wantId: string): boolean {
  return !!req && req.wantIds.includes(wantId);
}
