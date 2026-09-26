/** The Versions tab — the other wants in this one's series. */
import React, { useEffect, useLayoutEffect, useState, useCallback, useMemo, useRef } from 'react';
import { History } from 'lucide-react';
import { Want } from '@/types/want';
import { classNames } from '@/utils/helpers';
import { WantCardContent } from '@/components/dashboard/WantCardContent';
import { WantCard } from '@/components/dashboard/WantCard/WantCard';
import { StatusChangeIcon } from '@/components/dashboard/WantCard/parts/StatusChangeIcon';
import {
  DetailsSidebar,
  TabContent,
  TabSection,
  TabGrid,
  EmptyState,
  InfoRow,
  TabConfig
} from '../DetailsSidebar';



// ─── VersionsTab ─────────────────────────────────────────────────────────────

export const VersionsTab: React.FC<{ seriesWants: Want[]; currentWantId?: string }> = ({
  seriesWants,
  currentWantId,
}) => {
  const sorted = [...seriesWants].sort(
    (a, b) => (b.metadata?.version ?? 1) - (a.metadata?.version ?? 1)
  );

  if (sorted.length === 0) {
    return (
      <div className="text-center py-8 px-4">
        <History className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">No version history available</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto p-4 space-y-3">
      {sorted.map((want) => (
        <div
          key={want.metadata?.id}
          className={classNames(
            'rounded-lg border p-3 transition-colors',
            want.metadata?.id === currentWantId
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800',
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              v{want.metadata?.version ?? 1}
              {want.metadata?.id === currentWantId && (
                <span className="ml-2 text-blue-600 dark:text-blue-400">(current)</span>
              )}
            </span>
            <StatusChangeIcon status={want.status} size="md" showLabel={true} />
          </div>
          <WantCardContent
            want={want}
            isChild={true}
            onView={() => {}}
          />
        </div>
      ))}
    </div>
  );
};