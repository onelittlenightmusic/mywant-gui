import { useConstellationStore } from '@/stores/constellationStore';
import { useConstellationPromptStore, type PromptAction } from '@/stores/constellationPromptStore';

/**
 * The one menu two tiles put together are asked in.
 *
 * Tying a wire between tiles, or setting one thing down beside another, is the
 * same question whatever the tiles are: what are these to each other? The
 * answers share a first half — they belong together, as a constellation to join
 * or a new one to name — and differ in the second, by what was put together:
 *
 *   thing → thing  a want made of them (the prompt's own choice)
 *   want  → want   a connection, a value flowing from one to the other
 *   want  ↔ thing  the value filling one of the want's parameters
 *
 * So there is one menu, and the pair decides its second half (`actions`). It
 * used to be three separate questions, and two wants tied together could only
 * ever be asked what flows between them — never that they are one group.
 *
 * Resolves whether the menu opened. With nothing to offer — every member
 * already in one group, and no action for the pair — it stays shut: saying it
 * again would only be the board agreeing with itself.
 */
export async function openConnectionMenu(opts: {
  /** The one put down (or the wire ended on) — what joins. */
  joiningId: string;
  /** What it was put beside — whose group the menu offers first. */
  anchorId: string;
  /** Everyone the question is about, in the order they were put together. */
  members?: string[];
  kind: 'thing' | 'want' | 'mixed';
  /** What the name field starts with. */
  suggested: string;
  /** Where members stand, when they are not things (see ConstellationPrompt.cells). */
  cells?: Record<string, { x: number; y: number }>;
  actions?: PromptAction[];
}): Promise<boolean> {
  const { joiningId, anchorId, kind, suggested, cells, actions } = opts;
  if (!joiningId || !anchorId || joiningId === anchorId) return false;
  const store = useConstellationStore.getState();
  // Read before deciding: the board may have been open a while, and joining
  // the wrong group is worse than one extra request.
  await store.fetchConstellations();
  const groups = useConstellationStore.getState().constellations;

  const all = opts.members?.length ? opts.members : [joiningId, anchorId];
  const alreadyOne = groups.some(g => all.every(id => g.members.includes(id)));
  if (alreadyOne && !actions?.length) return false;

  // The groups on offer: the ones of this kind, and any a member is already
  // in (a mixed group is of no single kind). The anchor's own group comes
  // pre-selected — the board has an opinion, and the user is confirming it.
  const offered = groups.filter(g =>
    g.kind === kind || g.kind === 'mixed' || all.some(id => g.members.includes(id)));
  const theirs = groups.find(g => g.members.includes(anchorId));
  useConstellationPromptStore.getState().ask({
    thingId: joiningId,
    anchorId,
    members: all,
    kind,
    cells,
    actions,
    suggested: suggested.replace(/\//g, '-'), // a group name may not contain '/'
    existingGroups: [...new Set(offered.map(g => g.name))],
    preselected: theirs?.name,
  });
  return true;
}
