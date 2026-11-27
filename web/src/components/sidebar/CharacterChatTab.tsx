import React, { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import type { Character } from '@/types/character';
import type { Want, WantDetails } from '@/types/want';
import { useWantStore } from '@/stores/wantStore';
import { apiClient } from '@/api/client';
import { ChatTab } from './want-details/ChatTab';

/** The robot's character id — its chat is the robot want itself. */
const ROBOT_CHARACTER_ID = 'robot';

/**
 * A character's chat want: what was said to them, kept as a want.
 *
 * Every character is made with one (the engine's character_chat, named
 * chat-<id>, carrying character_id); the robot's is the robot want, which has a
 * coding agent inside it. A want the character was pointed at by hand (its aura
 * card) counts when it keeps a chat.
 */
export function chatWantOf(character: Pick<Character, 'id' | 'auraCardWantId'>, wants: Want[]): Want | null {
  const idOf = (w: Want) => w.metadata?.id || w.id;
  // A character acting as a robot (label robot=true) has a robot want for
  // its chat, carrying its character_id the same way.
  return wants.find(w => (w.metadata?.type === 'character_chat' || w.metadata?.type === 'robot')
      && (w.spec?.params as Record<string, unknown> | undefined)?.character_id === character.id)
    ?? (character.id === ROBOT_CHARACTER_ID ? wants.find(w => w.metadata?.type === 'robot') : undefined)
    ?? wants.find(w => idOf(w) === `chat-${character.id}`)
    ?? null;
}

/** How often the open chat is read again — a reply is the robot's to send. */
const POLL_MS = 2500;

/**
 * The character sheet's chat: the same chat the want's own Chat tab shows,
 * opened on the character rather than on the want behind them — a person is
 * talked to, not their want.
 *
 * Read on its own (apiClient.getWant) rather than through the store's selected
 * want, which belongs to the want panel: this sheet stands in that panel's
 * place, and the chat must not move what the want panel has selected.
 */
export const CharacterChatTab: React.FC<{ character: Character }> = ({ character }) => {
  const listed = useWantStore(s => chatWantOf(character, s.wants));
  const id = listed ? (listed.metadata?.id || listed.id) : undefined;
  const [details, setDetails] = useState<WantDetails | null>(null);

  useEffect(() => {
    setDetails(null);
    if (!id) return;
    let live = true;
    const read = () => {
      apiClient.getWant(id).then(w => { if (live) setDetails(w); }).catch(() => { /* the next read */ });
    };
    read();
    const t = setInterval(read, POLL_MS);
    return () => { live = false; clearInterval(t); };
  }, [id]);

  const want = (details ?? listed) as Want | null;
  if (!want) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="h-10 w-10 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">{character.name} has no chat yet</p>
      </div>
    );
  }
  return <ChatTab want={want} />;
};
