import type { ThingDefinition } from './thing';
import type { CharacterShapeId } from '@/shared/characterShapes';

export interface Character {
  id: string;
  name: string;
  avatar: string;        // emoji e.g. "🧙"
  color: string;         // hex e.g. "#6366f1"
  /**
   * The outline this person is drawn inside, wherever they appear — a
   * CharacterShapeId (see shared/characterShapes.ts). Unset means the circle
   * everybody was before shapes existed, so an old character needs no
   * migration.
   *
   * A fact about the person, like their colour and their avatar, not a
   * per-screen preference (CharacterDisplay): everyone sharing the board sees
   * them in the shape they chose.
   */
  shape?: CharacterShapeId;
  createdAt: number;     // Unix ms
  assignedDeviceIds: string[];
  /** Maps an AuraTarget key (see auraTargetKey) to the aura-default mark this
   *  character has set for it (aura-colored dog-ear flag/star, toggled via X).
   *  Keyed by target, not by want instance, so a mark survives redeploys and
   *  means the same thing in another install — use auraMarkFor to read one. */
  auraDefaults?: Record<string, AuraMark>;
  /** The want this character has bookmarked as their "aura card" — an ordinary
   *  want whose tile/card visually represents this character wherever it
   *  appears (dashboard grid or canvas), toggled via ★/X. One want per
   *  character; distinct from auraDefaults (a per-value mark within a want's
   *  own controls, not the whole want). */
  auraCardWantId?: string;
  /** Design-plugin id for want tiles this character owns (empty = inherit canvas design).
   *  Kept server-side as the `tile-design` label; answered here as it always was. */
  tile_design?: string;
  /** Design-plugin id for aura this character paints (empty = inherit canvas design).
   *  Kept server-side as the `aura-design` label. */
  aura_design?: string;
  /** The character's labels, as a want or a thing carries them. */
  labels?: Record<string, string>;
  /**
   * How fast this character's movement is ANIMATED on the canvas: 1 (or unset)
   * is the normal pace, 2 and 3 are the same motion at double and treble speed.
   *
   * It changes the drawing, not the walking — a step still moves one cell and
   * lands where it always did — so two people on the same board at different
   * speeds still agree about where everyone is.
   */
  move_speed?: number;
  /**
   * How fast this character ACTUALLY moves when driven (e.g. by a "going"
   * button they're standing on), in canvas grid cells per second.
   *
   * Unlike move_speed, this changes where a step lands — it's a real rate,
   * not an animation multiplier. 0 or unset falls back to the engine's
   * default pace.
   */
  speed?: number;
  /** How this person likes the app to look and sound — see CharacterDisplay. */
  display?: CharacterDisplay;
}

/**
 * One person's look-and-feel choices.
 *
 * These used to be the global Settings. They are per character because a
 * character IS a person here: two people share one server and one board, and
 * how loud the interface is, how tall its cards are and what colour the ground
 * is were never facts about the board. Every field is optional; absent means
 * the built-in default (see displayDefaults), so a character that has never
 * been to the settings tab looks exactly as it always did.
 */
export interface CharacterDisplay {
  header_position?: 'top' | 'bottom';
  color_mode?: 'light' | 'dark' | 'system';
  card_height?: 'sm' | 'md' | 'lg';
  system_font_size?: 'small' | 'medium' | 'large';
  sound_enabled?: boolean;
  card_opacity?: number;
  icon_font?: 'lucide' | 'lucide-thin' | 'heroicons-outline' | 'heroicons-solid';
  canvas_bg_color?: string;
  canvas_bg_url?: string;
  /**
   * The GUI extensions' own choices for this person, keyed by extension name —
   * the board's skin is ext.canvas.design. See utils/ext.
   */
  ext?: Record<string, unknown>;
}

/** Addresses what a mark is about. `kind`+`name` name a scope that exists
 *  identically in any install; `path` locates a point inside it, with a grammar
 *  owned by the kind. Two families of kind:
 *   - "wantType" (a BINDING): name is a want type, path is "<section>/<key>"
 *     (section current/goal/plan/internal, or "parameter"). The mark's value is
 *     applied to that field.
 *   - a catalog kind, e.g. "place"/"site" (a DEFINITION): name is the entry
 *     being defined, path is "" (whole object) or a sub-field. The mark's value
 *     *is* the definition that name resolves to; nothing is applied. */
export interface AuraTarget {
  kind: string;
  name: string;
  path: string;
}

/** The binding kind — marks on want-type fields. */
export const AURA_KIND_WANT_TYPE = 'wantType';

/** The catalog kind a location's coordinate is named into. A location want's
 *  finalResultField is `coordinate` (subType location_coordinate), which the
 *  server maps to this catalog — see cardNameKindValue in
 *  engine/server/handlers_characters.go. So an X-press on a location card
 *  defines a place, and that is what the map plots. */
export const AURA_KIND_PLACE = 'place';

/** A named place someone has aura-marked, resolved for display: coordinates
 *  from the mark's value, colour from the character who authored it. */
export interface PlaceMark {
  name: string;
  lat: number;
  lng: number;
  color: string;
  characterId: string;
}

/**
 * Every named place, newest definition per name winning (a name is one entry
 * in the catalog, whoever last defined it). Definitions without usable
 * coordinates are skipped rather than plotted at 0,0.
 *
 * Read from the thing ledger, which is where names live. It used to walk each
 * character's auraDefaults — and those stopped carrying definitions when names
 * moved to the things they name (see thingStore.definitions), so the map went
 * quietly empty: every place anyone had ever named was still there, in the
 * store nothing was asking. The characters are still needed, but only for the
 * colour that says who named it.
 */
export function placeMarks(definitions: ThingDefinition[], characters: Character[]): PlaceMark[] {
  const colorOf = new Map(characters.map(c => [c.id, c.color]));
  const byName = new Map<string, { mark: PlaceMark; at: string }>();
  for (const def of definitions) {
    if (def.subtype !== AURA_KIND_PLACE) continue;
    const v = def.value as Record<string, unknown> | null | undefined;
    const lat = typeof v?.lat === 'number' ? v.lat : undefined;
    const lng = typeof v?.lng === 'number' ? v.lng : undefined;
    if (lat === undefined || lng === undefined) continue;
    if (lat === 0 && lng === 0) continue;
    if (!def.name) continue;
    const previous = byName.get(def.name);
    if (previous && previous.at > (def.at ?? '')) continue;
    byName.set(def.name, {
      at: def.at ?? '',
      mark: {
        name: def.name,
        lat,
        lng,
        // Whoever named it, in their own colour. A definition from a character
        // who has since been deleted keeps its place on the map in grey rather
        // than disappearing with them — the place was still named.
        color: (def.characterId && colorOf.get(def.characterId)) || '#64748b',
        characterId: def.characterId ?? '',
      },
    });
  }
  return [...byName.values()].map(e => e.mark);
}

/** One character's mark. For a binding, `value` is a scalar applied to the
 *  target field and `mode` governs whether it is written back ("set") or only
 *  recorded ("endorse"). For a definition, `value` is the object the target's
 *  name resolves to and `mode` is unused. `by` is the author's character id. */
export interface AuraMark {
  target: AuraTarget;
  value: unknown;
  mode?: 'set' | 'endorse';
  by?: string;
}

/** Canonical string form of an AuraTarget — the key marks are stored under.
 *  Mirrors AuraTarget.Key in engine/core/character_store.go: "|" separates the
 *  scope from the path because a path may itself contain "/". */
export function auraTargetKeyFor(kind: string, name: string, path: string): string {
  return `${kind}:${name}|${path}`;
}

/** Binding key: a want-type field addressed by section/key. */
export function auraTargetKey(wantType: string, section: string, key: string): string {
  return auraTargetKeyFor(AURA_KIND_WANT_TYPE, wantType, `${section}/${key}`);
}

/** The mark this character has set on one want type's section/key, if any.
 *  Card plugins pass their own want's type and the field they own. */
export function auraMarkFor(
  character: Character,
  wantType: string | undefined,
  section: string,
  key: string,
): AuraMark | undefined {
  if (!wantType) return undefined;
  return character.auraDefaults?.[auraTargetKey(wantType, section, key)];
}

export interface CharacterListResponse {
  characters: Character[];
  count: number;
}

/** A remote character's current canvas cursor position, returned by GET /api/v1/cursors */
export interface RemoteCursor {
  /** Whether somebody is publishing for this character right now. False means
   *  this is simply where they were left — see snapshotCursors. */
  live?: boolean;
  characterId: string;
  deviceId?: string;
  /** The sequence number of the write that put them HERE — see the server's
   *  cursorEntry.Seq. A broadcast carrying a seq this tab has already sent is
   *  an echo of its own work and says nothing it does not already know. */
  seq?: number;
  x: number;
  y: number;
  avatar?: string;
  color?: string;
  name?: string;
  lastSeen: number; // Unix ms
  /** Recent effect firings piggybacked on the cursor, so a rapid burst all
   *  survives one snapshot and each is replayed by nonce. */
  effects?: { type: string; nonce: number; x: number; y: number }[];
  effectType?: string;
  effectNonce?: number;
  /** Speech-bubble text this character is currently saying (see SAY_TTL_MS). */
  message?: string;
  /** Unix ms the message was first said — drives bubble expiry on the viewer. */
  messageAt?: number;
}
