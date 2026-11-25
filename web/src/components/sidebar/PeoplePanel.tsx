import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { MinimapTile } from '@/components/dashboard/WantMinimap';
import { CharacterBadge } from '@/components/dashboard/CharacterBadge';
import { CharacterDetailsSidebar, type CharacterSheetTab } from '@/components/sidebar/CharacterDetailsSidebar';
import { useCharacterStore } from '@/stores/characterStore';
import { usePeopleStore } from '@/stores/peopleStore';
import { hostPanelId, nativePanelPage, postToHost, useHostActs } from '@/lib/nativeHost';
import { apiClient } from '@/api/client';
import type { PanelSubject } from '@/extensions/registry';

/** The panel ids of the people's panels, on a panel page of their own. */
const PEOPLE_PANEL = 'people';
const CHARACTER_PANEL = 'character:';
/** The act a list on an app's sheet sends back to the page under it. */
const PICK_ACT = 'people-pick';

/**
 * A person chosen from the list: their sheet opens. On an app's sheet (a panel
 * page of its own), the choice goes back to the page underneath, which opens
 * the sheet — and turns its board's camera to them — as a press there would.
 */
function pickPerson(id: string): void {
  if (nativePanelPage) { postToHost({ type: 'card-act', act: PICK_ACT, kind: 'want', id }); return; }
  usePeopleStore.getState().openSheet(id, 'list');
}

/**
 * The header's People: everyone on this server, drawn as the want list's map
 * draws wants — a tile each in their colour, their face on it, their name
 * under it. A press opens their character sheet in the same panel; closing
 * the sheet comes back here.
 */
export const PeopleList: React.FC = () => {
  const sheet = usePeopleStore(s => s.sheet);
  const characters = useCharacterStore(s => s.characters);
  const myCharacterId = useCharacterStore(s => s.myCharacterId);
  const fetchCharacters = useCharacterStore(s => s.fetchCharacters);

  // Opened, read again: someone may have arrived since the page loaded.
  useEffect(() => { void fetchCharacters(); }, [fetchCharacters]);

  // Me first, then everybody else in the order the server keeps them.
  const people = [...characters].sort((a, b) => Number(b.id === myCharacterId) - Number(a.id === myCharacterId));
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-3 pt-1 pb-2 text-xs text-gray-500 dark:text-gray-400">
        <Users className="h-4 w-4 text-indigo-500" aria-hidden />
        {people.length} {people.length === 1 ? 'person' : 'people'}
      </div>
      <div className="grid grid-cols-3 gap-2 auto-rows-min px-3 pb-3 overflow-y-auto">
        {people.map(c => (
          <div key={c.id} className="flex flex-col gap-1 min-w-0">
            <MinimapTile
              background={`${c.color}33`}
              icon={<CharacterBadge avatar={c.avatar} image={c.avatarImage} color={c.color} shape={c.shape} size={30} />}
              selected={sheet?.characterId === c.id}
              title={c.name}
              onClick={() => pickPerson(c.id)}
              dataAttrs={{ 'data-minimap-item-id': `character:${c.id}` }}
            />
            <span className="text-[10px] leading-tight text-center truncate text-gray-700 dark:text-gray-300">
              {c.name}{c.id === myCharacterId ? ' (me)' : ''}
            </span>
          </div>
        ))}
        {people.length === 0 && (
          <p className="col-span-3 text-center text-xs text-gray-500 dark:text-gray-400 py-6">No characters yet</p>
        )}
      </div>
    </div>
  );
};

/** One person's sheet — the Characters page's, with its handlers — by id. */
export const CharacterSheet: React.FC<{ characterId: string; initialTab?: CharacterSheetTab }> = ({ characterId, initialTab }) => {
  const character = useCharacterStore(s => s.characters.find(c => c.id === characterId) ?? null);
  const myCharacterId = useCharacterStore(s => s.myCharacterId);
  const fetchCharacters = useCharacterStore(s => s.fetchCharacters);
  const setMyCharacter = useCharacterStore(s => s.setMyCharacter);
  const [editing, setEditing] = useState(false);
  useEffect(() => { setEditing(false); }, [characterId]);
  // Someone not read yet (a sheet's own page, just loaded): ask for them.
  useEffect(() => { if (!character) void fetchCharacters(); }, [character, fetchCharacters]);
  if (!character) return null;
  return (
    <CharacterDetailsSidebar
      character={character}
      isMyCursor={myCharacterId === character.id}
      editing={editing}
      onEditingChange={setEditing}
      onSave={async (id, patch) => { await apiClient.updateCharacter(id, patch); await fetchCharacters(); }}
      onSaveDisplay={async (id, display) => { await apiClient.setCharacterDisplay(id, display); await fetchCharacters(); }}
      onSetAsMyCursor={() => setMyCharacter(character.id)}
      initialTab={initialTab}
    />
  );
};

/** What the workspace's right-hand frame is handed for a person's panel. */
export interface PeoplePanel {
  id: string;
  title: string;
  content: React.ReactNode;
  onClose: () => void;
  claimsInput?: boolean;
  /** The panel page an app opens it as (its own sheet). */
  hostPanel: string;
  hostExtra?: Record<string, string>;
  subject?: PanelSubject;
}

/**
 * The people's panel for this page: the list, or the sheet of the one chosen
 * (or met for a talk) — from the store, or on a panel page of its own from its
 * address (`people`, `character:<id>`, `tab=chat`).
 *
 * The page underneath also hears a pick made on an app's sheet of the list.
 */
export function usePeoplePanel(): PeoplePanel | null {
  const listOpen = usePeopleStore(s => s.listOpen);
  const sheet = usePeopleStore(s => s.sheet);
  const characters = useCharacterStore(s => s.characters);

  useHostActs((act, _kind, id) => {
    if (act === PICK_ACT && id) usePeopleStore.getState().openSheet(id, 'list');
  }, !nativePanelPage);

  // On a panel page, the address says which.
  const panelId = hostPanelId();
  let sheetId: string | null = sheet?.characterId ?? null;
  let tab: CharacterSheetTab | undefined = sheet?.via === 'talk' ? 'chat' : undefined;
  let list = listOpen;
  if (panelId === PEOPLE_PANEL) { list = true; sheetId = sheet?.characterId ?? null; }
  else if (panelId?.startsWith(CHARACTER_PANEL)) {
    sheetId = panelId.slice(CHARACTER_PANEL.length);
    tab = new URLSearchParams(location.search).get('tab') === 'chat' ? 'chat' : undefined;
  } else if (panelId) return null;

  if (sheetId) {
    const c = characters.find(x => x.id === sheetId);
    return {
      id: sheetId,
      title: c?.name ?? '',
      claimsInput: sheet?.via !== 'talk',
      onClose: () => usePeopleStore.getState().closeSheet(),
      content: <CharacterSheet characterId={sheetId} initialTab={tab} />,
      hostPanel: `${CHARACTER_PANEL}${sheetId}`,
      hostExtra: tab ? { tab } : undefined,
      subject: c ? { kind: 'character', character: c } : undefined,
    };
  }
  if (list) {
    return {
      id: PEOPLE_PANEL,
      title: 'People',
      claimsInput: true,
      onClose: () => usePeopleStore.getState().setListOpen(false),
      content: <PeopleList />,
      hostPanel: PEOPLE_PANEL,
    };
  }
  return null;
}
