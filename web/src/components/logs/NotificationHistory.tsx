/**
 * NotificationHistory — every notice the GUI spoke through the robot's bubble.
 *
 * The bubble is transient by design (6 seconds, then gone), which is fine while
 * you are watching and useless afterwards. This is the durable record: the
 * server stores it, so a notice raised on a phone is readable here too.
 *
 * Deliberately read-only apart from Clear — unlike RobotLogHistory there is
 * nothing to replay, because a notice describes something that already happened.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { MessageSquare, RefreshCw, Trash2, AlertCircle, MapPin } from 'lucide-react';
import { apiClient, NotificationEntry } from '@/api/client';
import { classNames } from '@/utils/helpers';

/** Errors are marked with ✗ at the call site (the bubble itself has no colour
 *  for severity), so that marker is the only signal available here. */
function isFailure(message: string): boolean {
  return message.startsWith('✗') || message.startsWith('Failed') || message.includes('できませんでした');
}

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })}`;
  } catch {
    return iso;
  }
}

export const NotificationHistory: React.FC = () => {
  const [entries, setEntries] = useState<NotificationEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { notifications } = await apiClient.getNotifications();
      setEntries(notifications ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const handleClear = async () => {
    if (!window.confirm('Clear all notifications?')) return;
    try {
      await apiClient.clearNotifications();
      setEntries([]);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to clear notifications');
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-blue-500" />
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Notifications
          </span>
          <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
            {entries.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchEntries}
            disabled={loading}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          >
            <RefreshCw className={classNames('h-3.5 w-3.5', loading ? 'animate-spin' : '')} />
            Refresh
          </button>
          {entries.length > 0 && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1 px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && entries.length === 0 && !error && (
        <div className="text-center py-16 text-gray-400 dark:text-gray-600">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No notifications yet.</p>
          <p className="text-xs mt-1">Anything the robot says about the app itself is recorded here.</p>
        </div>
      )}

      {/* Entries */}
      {entries.length > 0 && (
        <div className="space-y-1.5">
          {entries.map((entry) => {
            const failed = isFailure(entry.message);
            return (
              <div
                key={entry.id}
                className="flex items-start gap-3 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
              >
                <div className={classNames(
                  'mt-0.5 flex-shrink-0 p-1.5 rounded-lg',
                  failed
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                )}>
                  {failed ? <AlertCircle className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Full text, wrapped — the bubble truncates nothing and neither does this */}
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 break-words">
                    {entry.message}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-xs text-gray-400 dark:text-gray-600">
                      {formatWhen(entry.at)}
                    </span>
                    {entry.route && (
                      <span className="text-xs text-gray-400 dark:text-gray-600 font-mono">
                        {entry.route}
                      </span>
                    )}
                    {entry.targetId && (
                      <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-600 font-mono truncate max-w-[220px]">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {entry.targetId}
                      </span>
                    )}
                    {entry.characterId && (
                      <span className="text-xs text-gray-400 dark:text-gray-600">
                        {entry.characterId}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
