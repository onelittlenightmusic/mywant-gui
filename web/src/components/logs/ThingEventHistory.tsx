import React, { useEffect, useState } from 'react';
import { MemoEventCard } from '@/components/sidebar/ThingDetailsSidebar';
import { Clock, RefreshCw } from 'lucide-react';
import { apiClient } from '@/api/client';
import { ThingEvent } from '@/types/thing';
import { useDataTypes } from '@/hooks/useDataTypes';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

/** The thing provenance log, newest first — every value the system has named,
 *  with when and by which want / character. */
export const ThingEventHistory: React.FC = () => {
  const [events, setEvents] = useState<ThingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { getTypeInfo } = useDataTypes();

  const load = () => {
    setLoading(true);
    apiClient.getThingEvents({ limit: 500 })
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) {
    return <div className="flex justify-center py-16"><LoadingSpinner /></div>;
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 dark:text-gray-600">
        <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p>No things named yet. Values named from wants and cards appear here.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>
      {/* Same card the thing's own sidebar shows — this list used to be a table,
          so one thing history had two different looks depending on where you
          opened it. */}
      <div className="space-y-2">
        {events.map((ev, i) => (
          <MemoEventCard key={`${ev.at}-${i}`} ev={ev} fallbackColor={getTypeInfo(ev.subtype).color} showValue />
        ))}
      </div>
      <p className="mt-3 text-xs text-gray-400 text-right">{events.length} events</p>
    </div>
  );
};
