import React from 'react';
import { classNames } from '@/utils/helpers';
import { WantGrid } from '@/components/dashboard/WantGrid';

/**
 * The list page's body: the want grid, and the error line above it. What the
 * grid shows and what its presses do are handed in whole (`grid`).
 */
export const WantListView: React.FC<{
  error: string | null;
  onClearError: () => void;
  /** A detail panel or the Global panel is open: leave room under the grid
   *  for the phone's bottom sheet. */
  roomForSheet: boolean;
  grid: React.ComponentProps<typeof WantGrid>;
}> = ({ error, onClearError, roomForSheet, grid }) => (
  <div className={classNames(
    "p-3 sm:p-6 flex flex-col flex-1 min-h-full pb-24",
    roomForSheet ? "lg:pb-24 pb-[50vh]" : "pb-24"
  )}>
    {error && <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md flex items-center"><div className="ml-3"><p className="text-sm text-red-700 dark:text-red-300">{error}</p></div><button onClick={onClearError} className="ml-auto text-red-400 hover:text-red-600"><svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button></div>}
    <div className="flex-1 flex flex-col">
      <WantGrid {...grid} />
    </div>
  </div>
);
