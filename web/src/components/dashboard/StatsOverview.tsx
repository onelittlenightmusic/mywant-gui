import React from 'react';
import { ClipboardList, Play, CheckCircle, AlertCircle } from 'lucide-react';
import { Want } from '@/types/want';
import { StatsPanel } from './StatsPanel';

interface StatsOverviewProps {
  wants: Want[];
  loading: boolean;
  layout?: 'grid' | 'vertical';
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ wants, loading, layout = 'grid' }) => {
  const stats = {
    total: wants.length,
    running: wants.filter(w => w.status === 'reaching' || w.status === 'reaching_with_warning').length,
    completed: wants.filter(w => w.status === 'achieved' || w.status === 'achieved_with_warning').length,
    failed: wants.filter(w => w.status === 'failed').length,
  };

  return (
    <StatsPanel
      layout={layout}
      variant="compact"
      showSkeleton={loading && wants.length === 0}
      loadingCount={4}
      items={[
        {
          title: 'Total Wants',
          value: stats.total,
          color: 'bg-blue-100 dark:bg-blue-900/30',
          icon: <ClipboardList className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        },
        {
          title: 'Reaching',
          value: stats.running,
          color: 'bg-green-100 dark:bg-green-900/30',
          icon: <Play className="h-5 w-5 text-green-600 dark:text-green-400" />
        },
        {
          title: 'Achieved',
          value: stats.completed,
          color: 'bg-green-100 dark:bg-green-900/30',
          icon: <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
        },
        {
          title: 'Failed',
          value: stats.failed,
          color: 'bg-red-100 dark:bg-red-900/30',
          icon: <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
        }
      ]}
    />
  );
};
