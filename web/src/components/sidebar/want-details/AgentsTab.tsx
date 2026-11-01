/** The Agents tab — which agent capabilities ran, and what they did. */
import React from 'react';
import { Bot } from 'lucide-react';
import { Want } from '@/types/want';
import { shortWhen } from '@/utils/outputSummary';
import { HistoryCard } from './HistoryCard';

/** What became of a run, in the history's words. */
const STATUS: Record<string, { word: string; ink: string }> = {
  running:               { word: '実行中', ink: 'text-sky-600 dark:text-sky-400' },
  achieved:              { word: '完了',   ink: 'text-emerald-600 dark:text-emerald-400' },
  achieved_with_warning: { word: '完了(注意)', ink: 'text-amber-600 dark:text-amber-400' },
  failed:                { word: '失敗',   ink: 'text-red-600 dark:text-red-400' },
  terminated:            { word: '中止',   ink: 'text-gray-500 dark:text-gray-400' },
};

const Status: React.FC<{ status: string }> = ({ status }) => {
  const s = STATUS[status] ?? { word: status, ink: 'text-gray-500 dark:text-gray-400' };
  return <span className={`font-semibold ${s.ink}`}>{s.word}</span>;
};

export const AgentsTab: React.FC<{ want: Want }> = ({ want }) => {
  const agentHistory = want.history?.agentHistory ?? [];
  // Those running now lead the line — the history says what ran before.
  const running = [...new Set([...(want.current_agent ? [want.current_agent] : []), ...(want.running_agents ?? [])])]
    .filter(name => !agentHistory.some(e => e.agent_name === name && e.status === 'running'));
  const past = [...agentHistory].reverse();
  const count = running.length + past.length;

  if (count === 0) {
    return (
      <div className="text-center py-10 text-gray-400 dark:text-gray-500">
        <Bot className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-xs">No agent information available</p>
      </div>
    );
  }

  return (
    <>
      {running.map((name, i) => (
        <HistoryCard key={`run-${name}`} kind="agent" last={i === count - 1} title={name} meta={<Status status="running" />} />
      ))}
      {past.map((event, i) => (
        <HistoryCard
          key={event.execution_id || i}
          kind="agent"
          last={running.length + i === count - 1}
          title={event.agent_name}
          when={event.timestamp ? shortWhen(event.timestamp) : undefined}
          meta={<Status status={event.status} />}
        >
          {(event.agent_type || event.activity || event.error) && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-400">
              {event.agent_type && (
                <span className="px-1.5 py-px rounded bg-gray-100 dark:bg-gray-700 font-medium">{event.agent_type}</span>
              )}
              {event.activity && <span>{event.activity}</span>}
              {event.error && <span className="w-full text-red-600 dark:text-red-400 break-words">{event.error}</span>}
            </div>
          )}
        </HistoryCard>
      ))}
    </>
  );
};
