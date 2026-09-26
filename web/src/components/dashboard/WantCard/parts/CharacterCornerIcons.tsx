import React from 'react';
import { Want } from '@/types/want';
import { useCharacterStore } from '@/stores/characterStore';
import { DogEarFlags } from '@/components/common/DogEarFlags';
import { CharacterBadge } from '@/components/dashboard/CharacterBadge';

const TARGET_CATEGORIES = new Set(['drive', 'effect']);
const MAX_ICONS = 3;
const ICON_SIZE = 20;
const FLAG_SIZE = 18;

function characterIdsOf(want: Want): string[] {
  const current = want.state?.current?.characters;
  if (Array.isArray(current)) return current.filter((v): v is string => typeof v === 'string');
  const spec = want.spec?.params?.characters;
  if (Array.isArray(spec)) return spec.filter((v): v is string => typeof v === 'string');
  return [];
}

interface CharacterCornerIconsProps {
  want: Want;
  /** The want type's category (e.g. "drive", "effect") — determines whether this renders at all */
  category?: string;
  /** Hide when the card's top-right is occupied by something else (e.g. select-mode checkbox) */
  hidden?: boolean;
  /**
   * "icons" (default): full avatar-emoji badges, used on the roomier want card.
   * "flag": compact colored dog-ear triangles, used on the small canvas tile
   * where a full avatar badge would be too cramped.
   */
  variant?: 'icons' | 'flag';
}

/**
 * Top-right indicator of which characters a drive- or effect-category want
 * (e.g. going/gear/direction, aura/aura_erase) targets, up to MAX_ICONS.
 * Renders as stacked avatar-emoji badges on the want card, or as compact
 * colored corner flags on the canvas tile — see `variant`.
 */
export const CharacterCornerIcons: React.FC<CharacterCornerIconsProps> = ({ want, category, hidden = false, variant = 'icons' }) => {
  const characters = useCharacterStore(s => s.characters);

  if (hidden || !TARGET_CATEGORIES.has(category ?? '')) return null;

  const ids = characterIdsOf(want);
  if (ids.length === 0) return null;

  const matched = ids
    .slice(0, MAX_ICONS)
    .map(id => characters.find(c => c.id === id))
    .filter((c): c is NonNullable<typeof c> => !!c);

  if (matched.length === 0) return null;

  if (variant === 'flag') {
    return <DogEarFlags colors={matched.map(c => c.color)} size={FLAG_SIZE} />;
  }

  return (
    <div className="absolute top-1 right-1 z-10 pointer-events-none flex">
      {matched.map((character, i) => (
        <CharacterBadge
          key={character.id}
          title={character.name}
          avatar={character.avatar}
          color={character.color}
          shape={character.shape}
          size={ICON_SIZE}
          strokeWidth={1.5}
          fontSize={ICON_SIZE * 0.6}
          style={{
            marginLeft: i === 0 ? 0 : -ICON_SIZE * 0.35,
            zIndex: matched.length - i,
            // drop-shadow, not box-shadow: the badge's outline is a path, and a
            // box-shadow would trace the square box around a star.
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))',
          }}
        />
      ))}
    </div>
  );
};
