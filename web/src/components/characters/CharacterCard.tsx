import React from 'react';
import { Pencil, Trash2, MousePointer2, User } from 'lucide-react';
import { Character } from '@/types/character';
import { EntityCard, EntityCardAction } from '@/components/common/EntityCard';
import { entityCardId } from '@/stores/cardOverlayStore';

interface CharacterCardProps {
  character: Character;
  isFocused: boolean;
  /** Embedded in a sidebar: do not pull DOM focus (see EntityCard). */
  keepFocus?: boolean;
  isMyCursor?: boolean;
  /** Opens the character's details sidebar. */
  onClick: () => void;
  /** Opens the details sidebar in edit mode. */
  onEdit: () => void;
  onDelete: (id: string) => void;
  onSetAsMyCursor?: () => void;
}

export const CharacterCard: React.FC<CharacterCardProps> = ({
  character, isFocused, keepFocus, isMyCursor, onClick, onEdit, onDelete, onSetAsMyCursor,
}) => {
  // Name / avatar / colour / tile+aura design are all edited in the details
  // sidebar now — the card is just the avatar in the character's colour.
  const actions: EntityCardAction[] = [
    {
      icon: <MousePointer2 className="w-5 h-5 text-white" />,
      label: 'Cursor',
      onClick: () => onSetAsMyCursor?.(),
      tone: 'caution',
      disabled: !onSetAsMyCursor || isMyCursor,
      title: isMyCursor ? 'Already your CursorMan' : 'Set as my CursorMan',
    },
    {
      icon: <Pencil className="w-5 h-5 text-white" />,
      label: 'Edit',
      onClick: onEdit,
      tone: 'primary',
    },
    {
      icon: <Trash2 className="w-5 h-5 text-white" />,
      label: 'Delete',
      onClick: () => onDelete(character.id),
      tone: 'danger',
      confirm: true,
    },
  ];

  return (
    <EntityCard
      navId={entityCardId('character', character.id)}
      title={character.name}
      selected={isFocused}
      keepFocus={keepFocus}
      onView={onClick}
      actions={actions}
      iconBadgeColor={character.color}
      icon={<span className="text-4xl sm:text-5xl leading-none select-none">{character.avatar}</span>}
      titleIcon={<User className="h-2 w-2 sm:h-3.5 sm:w-3.5 flex-shrink-0" style={{ color: character.color }} />}
      badges={
        <>
          {character.assignedDeviceIds.length > 0 && (
            <span className="text-[8px] sm:text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
              {character.assignedDeviceIds.length}📱
            </span>
          )}
          {isMyCursor && (
            <MousePointer2 className="w-3 h-3 text-amber-500 flex-shrink-0" />
          )}
        </>
      }
    >
      {/* Status pill over the icon badge: my-CursorMan marker and how many
          devices this character is assigned to — the latter used to live in the
          bar that only appeared on focus. */}
      {(isMyCursor || character.assignedDeviceIds.length > 0) && (
        <div
          className="absolute top-1.5 left-1.5 z-20 flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-white/30 dark:bg-black/30 backdrop-blur-sm border border-white/20 dark:border-white/10 pointer-events-none"
          title={isMyCursor ? 'My CursorMan' : undefined}
        >
          {isMyCursor && <MousePointer2 className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />}
          {character.assignedDeviceIds.length > 0 && (
            <span className="text-[10px] sm:text-xs font-semibold text-gray-700 dark:text-gray-200">
              {character.assignedDeviceIds.length}📱
            </span>
          )}
        </div>
      )}
    </EntityCard>
  );
};
