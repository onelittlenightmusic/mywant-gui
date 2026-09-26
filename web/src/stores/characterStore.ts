import { create } from 'zustand';
import { Character, auraTargetKey, auraTargetKeyFor } from '@/types/character';
import { apiClient } from '@/api/client';
import { notify } from '@/stores/noticeStore';

const MY_CHAR_KEY   = 'mywant_my_character_id';
const MY_COLOR_KEY  = 'mywant_cursor_color';

const DEFAULT_CURSOR_COLOR_LIGHT = '#1565c0';
const DEFAULT_CURSOR_COLOR_DARK  = '#00e5ff';

interface CharacterStore {
  characters: Character[];
  /** null = use default human SVG design */
  myCharacterId: string | null;
  /** color used when myCharacterId is null (default human design) */
  myDefaultCursorColor: string;

  fetchCharacters: () => Promise<void>;
  setMyCharacter: (id: string | null) => void;
  setMyDefaultCursorColor: (color: string) => void;
  getMyCharacter: () => Character | null;
  /** Marks (or, with value === '', clears) an aura-default pick for my character.
   *  wantId names the want being marked; wantType is what the mark is stored
   *  against, so it stays valid across redeploys and in other installs.
   *  mode 'set' (default) applies the value to the target when an aura covering
   *  it activates; 'endorse' only records that the value is the good one. */
  setAuraDefault: (wantId: string, wantType: string, section: string, key: string, value: string, mode?: 'set' | 'endorse') => Promise<void>;
  /** Defines a catalog entry: gives `value` (a scalar or object) the name `name`
   *  in the namespace `kind` (e.g. kind 'station', name '会社最寄り'), signed by
   *  my character. Unlike a binding, a definition isn't applied to a want — it's
   *  a named thing others reference. An empty name clears it. */
  /** wantId is the want whose value is being named — recorded on the thing event. */
  setAuraDefinition: (kind: string, name: string, value: unknown, wantId?: string) => Promise<void>;
  /** Removes my character's catalog-name definition (kind, name) — the 🏷 tag a
   *  field's value carries. Only clears my own; other characters' names stay. */
  clearAuraDefinition: (kind: string, name: string) => Promise<void>;
  /** Toggles a want as my character's aura card (bookmarks it, or clears it if already set to this want). */
  toggleAuraCardWant: (wantId: string) => Promise<void>;
}

function getStoredColor(): string {
  return localStorage.getItem(MY_COLOR_KEY) || DEFAULT_CURSOR_COLOR_LIGHT;
}

/**
 * A server write failed after the local state was already updated optimistically
 * — the UI is now showing something the server rejected. Say it out loud in the
 * robot's bubble: a console.error alone is how a refused write looks exactly
 * like a successful one. The optimistic value is left in place; the next SSE
 * refresh reconciles it.
 */
function reportAuraWriteFailure(op: string, label: string, err: unknown) {
  console.error(`[characterStore] ${op} failed:`, err);
  notify(
    `${label}を保存できませんでした: ${err instanceof Error ? err.message : String(err)}`,
  );
}

export const useCharacterStore = create<CharacterStore>((set, get) => ({
  characters: [],
  myCharacterId: localStorage.getItem(MY_CHAR_KEY) || null,
  myDefaultCursorColor: getStoredColor(),

  fetchCharacters: async () => {
    try {
      const list = await apiClient.listCharacters();
      set({ characters: list });
    } catch { /* ignore */ }
  },

  setMyCharacter: (id) => {
    if (id === null) {
      localStorage.removeItem(MY_CHAR_KEY);
    } else {
      localStorage.setItem(MY_CHAR_KEY, id);
    }
    set({ myCharacterId: id });
  },

  setMyDefaultCursorColor: (color) => {
    localStorage.setItem(MY_COLOR_KEY, color);
    set({ myDefaultCursorColor: color });
  },

  getMyCharacter: () => {
    const { characters, myCharacterId } = get();
    if (!myCharacterId) return null;
    return characters.find(c => c.id === myCharacterId) || null;
  },

  setAuraDefault: async (wantId, wantType, section, key, value, mode = 'set') => {
    const { myCharacterId, characters } = get();
    if (!myCharacterId || !wantType) return;
    const targetKey = auraTargetKey(wantType, section, key);

    // Optimistic local update so the flag moves instantly.
    set({
      characters: characters.map(c => {
        if (c.id !== myCharacterId) return c;
        const auraDefaults = { ...(c.auraDefaults ?? {}) };
        if (value) {
          auraDefaults[targetKey] = {
            target: { kind: 'wantType', name: wantType, path: `${section}/${key}` },
            value,
            mode,
            by: myCharacterId,
          };
        } else {
          delete auraDefaults[targetKey];
        }
        return { ...c, auraDefaults };
      }),
    });

    try {
      const updated = await apiClient.setCharacterAuraDefault(myCharacterId, wantId, section, key, value, mode);
      set({ characters: get().characters.map(c => c.id === myCharacterId ? updated : c) });
    } catch (err) {
      reportAuraWriteFailure('setAuraDefault', 'aura のデフォルト値', err);
    }
  },

  setAuraDefinition: async (kind, name, value, wantId) => {
    const { myCharacterId, characters } = get();
    if (!myCharacterId || !kind || !name) return;
    const targetKey = auraTargetKeyFor(kind, name, '');

    // Optimistic local update.
    set({
      characters: characters.map(c => {
        if (c.id !== myCharacterId) return c;
        const auraDefaults = { ...(c.auraDefaults ?? {}) };
        auraDefaults[targetKey] = {
          target: { kind, name, path: '' },
          value,
          by: myCharacterId,
        };
        return { ...c, auraDefaults };
      }),
    });

    try {
      const updated = await apiClient.setCharacterAuraDefinition(myCharacterId, kind, name, value, wantId);
      set({ characters: get().characters.map(c => c.id === myCharacterId ? updated : c) });
    } catch (err) {
      reportAuraWriteFailure('setAuraDefinition', `名前「${name}」`, err);
    }
  },

  clearAuraDefinition: async (kind, name) => {
    const { myCharacterId, characters } = get();
    if (!myCharacterId || !kind || !name) return;
    const targetKey = auraTargetKeyFor(kind, name, '');

    // Optimistic local removal so the tag disappears instantly.
    set({
      characters: characters.map(c => {
        if (c.id !== myCharacterId) return c;
        const auraDefaults = { ...(c.auraDefaults ?? {}) };
        delete auraDefaults[targetKey];
        return { ...c, auraDefaults };
      }),
    });

    try {
      // An empty value clears the definition (see setCharacterAuraDefinition).
      const updated = await apiClient.setCharacterAuraDefinition(myCharacterId, kind, name, '');
      set({ characters: get().characters.map(c => c.id === myCharacterId ? updated : c) });
    } catch (err) {
      reportAuraWriteFailure('clearAuraDefinition', `名前「${name}」の削除`, err);
    }
  },

  toggleAuraCardWant: async (wantId) => {
    const { myCharacterId, characters } = get();
    if (!myCharacterId) return;
    const mine = characters.find(c => c.id === myCharacterId);
    const next = mine?.auraCardWantId === wantId ? '' : wantId;

    // Optimistic local update so the star/badge moves instantly.
    set({
      characters: characters.map(c =>
        c.id === myCharacterId ? { ...c, auraCardWantId: next || undefined } : c
      ),
    });

    try {
      const updated = await apiClient.setCharacterAuraCard(myCharacterId, next);
      set({ characters: get().characters.map(c => c.id === myCharacterId ? updated : c) });
    } catch (err) {
      reportAuraWriteFailure('toggleAuraCardWant', 'aura カードの選択', err);
    }
  },
}));

/**
 * How fast MY character's movement should be drawn — 1 normally, 2 or 3 when
 * they have asked for it (see Character.move_speed).
 *
 * A plain function rather than a hook: the canvas moves the character from a
 * rAF loop and from imperative DOM writes, where a re-render is neither wanted
 * nor available, and it is read at the moment a step starts rather than
 * subscribed to. Nobody without a character keeps the normal pace.
 */
export function myMoveSpeed(): number {
  const me = useCharacterStore.getState().getMyCharacter();
  const n = me?.move_speed ?? 1;
  return n >= 1 && n <= 3 ? n : 1;
}

/** Default cursor color for the current display mode */
export function getDefaultCursorColor(isDark: boolean): string {
  const stored = localStorage.getItem(MY_COLOR_KEY);
  if (stored) return stored;
  return isDark ? DEFAULT_CURSOR_COLOR_DARK : DEFAULT_CURSOR_COLOR_LIGHT;
}
