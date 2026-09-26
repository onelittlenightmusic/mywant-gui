import React from 'react';
import { Check } from 'lucide-react';
import { Character } from '@/types/character';
import { classNames } from '@/utils/helpers';

interface CharacterMultiSelectProps {
  characters: Character[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

/**
 * Multi-select chip picker for a "character_ids" array parameter (e.g. the
 * `characters` param on drive-category want types). Adapted from
 * CharacterSelect's single-select dropdown into an inline toggleable chip
 * list, since drive wants commonly target more than one character at once.
 */
export const CharacterMultiSelect: React.FC<CharacterMultiSelectProps> = ({
  characters,
  selectedIds,
  onChange,
  disabled = false,
}) => {
  const toggle = (id: string) => {
    if (disabled) return;
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(x => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  if (characters.length === 0) {
    return <p className="text-[10px] text-gray-400 dark:text-gray-500 italic">No characters yet</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5" onClick={e => e.stopPropagation()}>
      {characters.map(c => {
        const selected = selectedIds.includes(c.id);
        return (
          <button
            key={c.id}
            type="button"
            disabled={disabled}
            onClick={() => toggle(c.id)}
            className={classNames(
              'flex items-center gap-1 pl-1.5 pr-2 py-1 rounded-full text-[10px] font-medium border transition-all',
              selected
                ? 'bg-white dark:bg-gray-800'
                : 'bg-gray-100 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-indigo-400 dark:hover:border-indigo-500',
              disabled && 'opacity-40 cursor-not-allowed',
            )}
            style={selected ? { borderColor: c.color, color: c.color } : undefined}
          >
            <span
              className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] flex-shrink-0"
              style={{ backgroundColor: c.color + '33', border: `1px solid ${c.color}` }}
            >
              {c.avatar}
            </span>
            <span className="truncate max-w-[80px]">{c.name}</span>
            {selected && <Check className="w-2.5 h-2.5 flex-shrink-0" />}
          </button>
        );
      })}
    </div>
  );
};
