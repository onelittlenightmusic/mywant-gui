import React from 'react';
import { AchievementCard } from '@/components/dashboard/AchievementCard';
import { Trophy, Unlock, Lock } from 'lucide-react';
import { Achievement, LEVEL_COLORS, LEVEL_EMOJI, LEVEL_LABELS } from '@/types/achievement';
import { classNames } from '@/utils/helpers';
import { TabContent, TabSection, InfoRow } from './DetailsSidebar';

interface AchievementDetailsSidebarProps {
  achievement: Achievement | null;
  /** Card overlay actions. EntityCard greys out any action with no
   *  handler, so the embedded card needs these to be usable. */
  onUnlock?: (id: string) => void;
  onLock?: (id: string) => void;
  onDelete?: (id: string) => void;
}

/**
 * Everything the achievement card used to spell out inline — description,
 * agent, want, category, awarder, capability, earned date. The card keeps only
 * the medal and its level; actions live in the card's overlay grid.
 */
export const AchievementDetailsSidebar: React.FC<AchievementDetailsSidebarProps> = ({ achievement, onUnlock, onLock, onDelete }) => {
  if (!achievement) {
    return (
      <div className="text-center py-12">
        <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Select an achievement to view details</p>
      </div>
    );
  }

  const level = achievement.level ?? 1;
  const colors = LEVEL_COLORS[level] ?? LEVEL_COLORS[1];
  const emoji = LEVEL_EMOJI[level] ?? '🏅';
  const levelLabel = LEVEL_LABELS[level] ?? 'Bronze';
  const earnedDate = achievement.earnedAt ? new Date(achievement.earnedAt).toLocaleString() : '—';

  return (
    <div className="h-full overflow-y-auto">
      <TabContent>
          {/* The card itself, first. On a phone the detail sheet covers the
              page behind it, so the card that would normally be tapped is out
              of reach; embedding it keeps its actions (long-press overlay
              included) reachable from inside the sheet. `selected` matters:
              EntityCard closes an overlay opened on an unselected card. */}
          <div className="mb-3 h-32 sm:h-36">
            <AchievementCard
              achievement={achievement}
              selected
              keepFocus
              onUnlock={onUnlock}
              onLock={onLock}
              onDelete={onDelete}
              onView={() => {}}
            />
          </div>
        <div className={classNames('flex items-center gap-3 rounded-lg border-2 p-4', colors.border, colors.bg)}>
          <span className="text-4xl leading-none">{emoji}</span>
          <div className="min-w-0">
            <h3 className={classNames('font-semibold text-base leading-tight', colors.text)}>
              {achievement.title}
            </h3>
            <span className={classNames('inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium', colors.badge)}>
              {levelLabel}
            </span>
          </div>
        </div>

        {achievement.description && (
          <TabSection title="Description">
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {achievement.description}
            </p>
          </TabSection>
        )}

        <TabSection title="Awarded">
          <div className="space-y-2 sm:space-y-3">
            <InfoRow label="Agent" value={<span className="font-mono">{achievement.agentName}</span>} />
            {achievement.wantName && <InfoRow label="Want" value={achievement.wantName} />}
            {achievement.category && <InfoRow label="Category" value={achievement.category} />}
            {achievement.awardedBy && <InfoRow label="Awarded by" value={achievement.awardedBy} />}
            <InfoRow label="Earned" value={earnedDate} />
          </div>
        </TabSection>

        {achievement.unlocksCapability && (
          <TabSection title="Capability">
            <div className={classNames(
              'flex items-center gap-1.5 text-xs rounded px-2 py-1.5',
              achievement.unlocked
                ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                : 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800',
            )}>
              {achievement.unlocked
                ? <Unlock className="w-3 h-3 flex-shrink-0" />
                : <Lock className="w-3 h-3 flex-shrink-0" />}
              <span className="font-mono truncate">{achievement.unlocksCapability}</span>
              <span className="ml-auto flex-shrink-0">{achievement.unlocked ? 'unlocked' : 'locked'}</span>
            </div>
          </TabSection>
        )}

        <TabSection title="ID">
          <p className="text-xs text-gray-500 dark:text-gray-500 font-mono break-all">{achievement.id}</p>
        </TabSection>
      </TabContent>
    </div>
  );
};
