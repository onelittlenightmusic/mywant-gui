import React from 'react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

export interface StatItem {
  title: string;
  value: number;
  color: string;
  icon: React.ReactNode;
}

interface StatsPanelProps {
  items: StatItem[];
  /** Show the loading skeleton instead of items. Caller decides when (e.g. `loading && data.length === 0`). */
  showSkeleton: boolean;
  loadingCount: number;
  layout?: 'grid' | 'vertical';
  variant?: 'compact' | 'default';
}

const StatCard: React.FC<{ item: StatItem; variant: 'compact' | 'default' }> = ({ item, variant }) => {
  if (variant === 'compact') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2">
        <div className="flex items-center">
          <div className={`flex-shrink-0 p-2 rounded-full ${item.color}`}>
            {item.icon}
          </div>
          <div className="ml-3">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{item.title}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{item.value}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center">
        <div className={`flex-shrink-0 p-3 rounded-full ${item.color}`}>
          <div className="text-xl">
            {item.icon}
          </div>
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{item.title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{item.value}</p>
        </div>
      </div>
    </div>
  );
};

export const StatsPanel: React.FC<StatsPanelProps> = ({
  items,
  showSkeleton,
  loadingCount,
  layout = 'vertical',
  variant = 'default',
}) => {
  const gridClass = layout === 'vertical'
    ? 'flex flex-col gap-3'
    : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6';

  if (showSkeleton) {
    const skeletonPadding = variant === 'compact' ? 'px-4 py-2' : 'p-6';
    const skeletonHeight = variant === 'compact' ? 'h-10' : 'h-16';
    return (
      <div className={gridClass}>
        {[...Array(loadingCount)].map((_, i) => (
          <div key={i} className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${skeletonPadding}`}>
            <div className={`flex items-center justify-center ${skeletonHeight}`}>
              <LoadingSpinner size="md" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={gridClass}>
      {items.map((item, index) => (
        <StatCard key={index} item={item} variant={variant} />
      ))}
    </div>
  );
};
