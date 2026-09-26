import React from 'react';
import { NotebookPen } from 'lucide-react';
import { WantCardPluginProps, registerWantCardPlugin } from '../registry';
import { WantCardLayout } from '../../WantCardLayout';

interface WorkLogRecentEntry {
  ts: string;
  field: string;
  event: 'initial' | 'change' | string;
  previous_value: unknown;
  new_value: unknown;
}

const formatValue = (v: unknown): string => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try { return JSON.stringify(v); } catch { return String(v); }
};

const formatTime = (iso: string): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const WorkLogContentSection: React.FC<WantCardPluginProps> = ({ want }) => {
  const entries = (want.state?.current?.recent_entries as WorkLogRecentEntry[] | undefined) ?? [];
  const totalLogged = want.state?.current?.total_logged as number | undefined;
  const pendingCount = want.state?.current?.pending_count as number | undefined;

  const content = (
    <div className="h-full flex flex-col px-2 py-1.5 gap-1.5 overflow-hidden">
      <div className="flex items-center justify-between flex-shrink-0 text-gray-400 dark:text-gray-500">
        <span className="flex items-center gap-1">
          <NotebookPen className="w-3 h-3" />
          {totalLogged ?? 0} logged
        </span>
        {!!pendingCount && <span className="text-amber-500 dark:text-amber-400">{pendingCount} pending</span>}
      </div>

      {entries.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-gray-400 dark:text-gray-600 italic">No changes logged yet</span>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1">
          {entries.map((entry, i) => (
            <div
              key={`${entry.ts}-${entry.field}-${i}`}
              className="flex flex-col rounded bg-gray-50 dark:bg-gray-800/60 px-1.5 py-1 leading-tight"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-semibold text-gray-700 dark:text-gray-200 truncate">{entry.field}</span>
                <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">{formatTime(entry.ts)}</span>
              </div>
              <div className="font-medium text-gray-800 dark:text-gray-100 truncate">
                {formatValue(entry.new_value)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return <WantCardLayout content={content} />;
};

registerWantCardPlugin({
  types: ['work_log'],
  ContentSection: WorkLogContentSection,
  hideFinalResult: true,
});
