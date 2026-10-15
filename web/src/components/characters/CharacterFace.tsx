import React from 'react';
import type { Character } from '@/types/character';

/**
 * A character's face in a line of text — their picture when they have one
 * (Character.avatarImage), their emoji otherwise. Sized by the text around it
 * (1em), so it drops in wherever `{character.avatar}` was written.
 *
 * On the board a face is a CharacterBadge (the outline they chose, with this
 * inside); this is for the lists, menus and labels that only ever had the
 * emoji.
 */
export const CharacterFace: React.FC<{
  character: Pick<Character, 'avatar' | 'avatarImage'> | null | undefined;
  /** Shown when there is neither. */
  fallback?: string;
  className?: string;
}> = ({ character, fallback = '', className }) => {
  if (character?.avatarImage) {
    return (
      <img
        src={character.avatarImage}
        alt=""
        draggable={false}
        className={className}
        style={{ width: '1em', height: '1em', borderRadius: '50%', objectFit: 'cover', display: 'inline-block', verticalAlign: '-0.125em' }}
      />
    );
  }
  return <>{character?.avatar || fallback}</>;
};
