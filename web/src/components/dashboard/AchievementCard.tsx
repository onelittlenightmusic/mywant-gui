import React from 'react';
import { Trash2, Unlock, Lock, Medal } from 'lucide-react';
import { Achievement, LEVEL_HEX, LEVEL_LABELS } from '@/types/achievement';
import { EntityCard, EntityCardAction } from '@/components/common/EntityCard';
import { entityCardId } from '@/stores/cardOverlayStore';
import { iconEmbossFilter } from './WantCardFace';
import { useDarkMode } from '@/hooks/useDarkMode';

interface AchievementCardProps {
  achievement: Achievement;
  selected?: boolean;
  /** Embedded in a sidebar: do not pull DOM focus (see EntityCard). */
  keepFocus?: boolean;
  onView: (achievement: Achievement) => void;
  onDelete?: (id: string) => void;
  onUnlock?: (id: string) => void;
  onLock?: (id: string) => void;
}

/**
 * The medal itself, on the shared card shell — menu-tinted surface, a
 * left-anchored icon badge, the title beside it. Agent, want, category,
 * capability and earned date all live in the details sidebar; every action is
 * a tile in the card's overlay grid.
 */
export const AchievementCard: React.FC<AchievementCardProps> = ({
  achievement, selected = false, keepFocus, onView, onDelete, onUnlock, onLock,
}) => {
  const isDark = useDarkMode();
  const level = achievement.level ?? 1;
  const levelLabel = LEVEL_LABELS[level] ?? 'Bronze';
  // A locked achievement is drawn in grey rather than faded: fading the card
  // would let the page background bleed through it.
  const ink = achievement.unlocked ? (LEVEL_HEX[level] ?? LEVEL_HEX[1]) : '#94a3b8';

  const actions: EntityCardAction[] = [
    achievement.unlocked
      ? {
          icon: <Unlock className="w-5 h-5 text-white" />,
          label: 'Lock',
          onClick: () => onLock?.(achievement.id),
          colorClass: 'bg-gray-500/90',
          disabled: !onLock,
          title: 'Lock achievement (deactivate capability)',
        }
      : {
          icon: <Lock className="w-5 h-5 text-white" />,
          label: 'Unlock',
          onClick: () => onUnlock?.(achievement.id),
          colorClass: 'bg-emerald-600/90',
          disabled: !onUnlock,
          title: 'Unlock achievement (activate capability)',
        },
    {
      icon: <Trash2 className="w-5 h-5 text-white" />,
      label: 'Delete',
      onClick: () => onDelete?.(achievement.id),
      colorClass: 'bg-rose-700/90',
      disabled: !onDelete,
      confirm: true,
    },
  ];

  return (
    <EntityCard
      navId={entityCardId('achievement', achievement.id)}
      title={achievement.title}
      selected={selected}
      keepFocus={keepFocus}
      onView={() => onView(achievement)}
      actions={actions}
      iconBadgeColor={ink}
      icon={
        <div className="flex flex-col items-center justify-center gap-0.5 w-full [&_svg]:!w-1/2 [&_svg]:!h-1/2">
          <Medal style={{ color: ink, filter: iconEmbossFilter(!isDark) }} strokeWidth={1.75} />
          <span
            className="text-[8px] sm:text-[10px] font-semibold leading-none text-center max-w-full truncate"
            style={{ color: ink }}
          >
            {levelLabel}
          </span>
        </div>
      }
    >
      {/* One pill for the card's own state, matching ThingCard's count pill. */}
      {achievement.unlocksCapability && (
        <div className="absolute top-1.5 left-1.5 z-20 flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/30 dark:bg-black/30 backdrop-blur-sm border border-white/20 dark:border-white/10 pointer-events-none">
          {achievement.unlocked
            ? <Unlock className="w-2.5 h-2.5 text-emerald-500" />
            : <Lock className="w-2.5 h-2.5 text-gray-500 dark:text-gray-400" />}
          <span className="text-[9px] sm:text-[10px] font-semibold leading-none text-gray-700 dark:text-gray-200 truncate max-w-[7rem]">
            {achievement.unlocksCapability}
          </span>
        </div>
      )}
    </EntityCard>
  );
};
