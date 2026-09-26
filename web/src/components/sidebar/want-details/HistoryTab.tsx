/** The History tab — past parameter, state and log snapshots. */
import React, { useEffect, useLayoutEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useHeaderAtBottom } from '@/hooks/useDisplaySettings';
import { Bot, FileText, Database, History } from 'lucide-react';
import { Want } from '@/types/want';
import { useConfigStore } from '@/stores/configStore';
import { useSidebarFocusStore } from '@/stores/sidebarFocusStore';
import { WantCard } from '@/components/dashboard/WantCard/WantCard';
import { LogCard } from '@/components/common/LogCard';
import {
  DetailsSidebar,
  TabContent,
  TabSection,
  TabGrid,
  EmptyState,
  InfoRow,
  TabConfig
} from '../DetailsSidebar';
import { SubTabBar } from '../SubTabBar';
import { useScrollKeys } from '@/hooks/useScrollKeys';

import { HistorySubTab } from './shared';
import { NestedCard } from './NestedCard';
import { AgentsTab } from './AgentsTab';



// Helper function to render JSON as itemized list
const renderStateAsItems = (obj: any, depth: number = 0): React.ReactNode[] => {
  const items: React.ReactNode[] = [];

  if (obj === null || obj === undefined) {
    return [<span key="null" className="text-gray-600 dark:text-gray-400">null</span>];
  }

  if (typeof obj !== 'object') {
    return [<span key="value">{String(obj)}</span>];
  }

  // Skip the opening braces and format as items
  Object.entries(obj).forEach(([key, value], index) => {
    const isNested = value !== null && typeof value === 'object' && !Array.isArray(value);
    const isArray = Array.isArray(value);

    if (isNested || isArray) {
      items.push(
        <div key={key} className={`${depth > 0 ? 'ml-4' : ''} mb-2`}>
          <div className="font-medium text-gray-800 dark:text-gray-200 text-xs mb-1">{key}:</div>
          <div className="ml-3 space-y-1">
            {renderStateAsItems(value, depth + 1)}
          </div>
        </div>
      );
    } else {
      items.push(
        <div key={key} className={`${depth > 0 ? 'ml-4' : ''} text-xs text-gray-700 dark:text-gray-300 mb-1`}>
          <span className="font-medium text-gray-800 dark:text-gray-200">{key}:</span> <span className="text-gray-600 dark:text-gray-400">{String(value)}</span>
        </div>
      );
    }
  });

  return items;
};

// Each snapshot is a LogCard: the want's own type in the badge, when it was
// taken said the way the log says it, and the snapshot itself as the body.
// No index number — the order is the list's, not a fact about the entry.
const ParameterHistoryItem: React.FC<{ entry: any; wantType: string }> = ({ entry, wantType }) => (
  <LogCard wantType={wantType} title="Parameters" timestamp={entry.timestamp ?? null}>
    <NestedCard data={entry.stateValue || {}} />
  </LogCard>
);

const StateHistoryItem: React.FC<{ state: any; wantType: string }> = ({ state, wantType }) => {
  const flightStatus = state.stateValue?.flight_status;
  const actionByAgent = state.stateValue?.action_by_agent;
  const isMonitorAgent = actionByAgent?.includes('Monitor');
  const agentBgColor = isMonitorAgent ? 'bg-green-100 dark:bg-green-900/30' : 'bg-blue-100 dark:bg-blue-900/30';
  const agentTextColor = isMonitorAgent ? 'text-green-700 dark:text-green-400' : 'text-blue-700 dark:text-blue-400';

  return (
    <LogCard
      wantType={wantType}
      title="State"
      timestamp={state.timestamp ?? null}
      meta={actionByAgent ? (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${agentBgColor} ${agentTextColor}`}>
          <Bot className="h-3 w-3 flex-shrink-0" />
          {flightStatus && <span className="font-medium">{flightStatus}</span>}
        </span>
      ) : undefined}
    >
      <NestedCard data={state.stateValue || {}} />
    </LogCard>
  );
};

const LogHistoryItem: React.FC<{ logEntry: any; wantType: string }> = ({ logEntry, wantType }) => {
  const logsText = logEntry.logs || '';
  const logLines = logsText.split('\n').filter((line: string) => line.trim().length > 0);

  return (
    <LogCard
      wantType={wantType}
      title="Log"
      timestamp={logEntry.timestamp ?? null}
      meta={`${logLines.length} line${logLines.length !== 1 ? 's' : ''}`}
    >
      <pre className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words font-mono max-h-64 overflow-auto rounded-md bg-gray-50 dark:bg-gray-900 px-2 py-1.5">
        {logsText}
      </pre>
    </LogCard>
  );
};

export const HistoryTab: React.FC<{
  want: Want;
  results: any;
  historySubTab: HistorySubTab;
  setHistorySubTab: (t: HistorySubTab) => void;
}> = ({ want, results, historySubTab, setHistorySubTab }) => {
  const config = useConfigStore(state => state.config);
  const isBottom = useHeaderAtBottom();

  /**
   * Up and down read the list, here for the same reason they do in the thing
   * panel: history is the one tab with nothing to walk, and without this a
   * long one had no bottom on a gamepad. See useScrollKeys.
   */
  const listRef = useRef<HTMLDivElement>(null);
  const panelHasKeys = useSidebarFocusStore(s => s.focused);
  useScrollKeys({
    target: () => listRef.current,
    enabled: panelHasKeys,
    scope: () => listRef.current?.closest<HTMLElement>('[data-sidebar="true"]') ?? null,
  });

  const hasParameterHistory = !!(want.history?.parameterHistory && want.history.parameterHistory.length > 0);
  const hasStateHistory = !!(want.history?.stateHistory && want.history.stateHistory.length > 0);
  const hasLogHistory = !!(want.history?.logHistory && want.history.logHistory.length > 0);
  const hasLogs = !!(results?.logs && results.logs.length > 0);

  const hasStateContent = hasParameterHistory || hasStateHistory;
  const hasLogContent = hasLogs || hasLogHistory;
  const hasAgentsContent = !!(
    want.current_agent ||
    (want.running_agents && want.running_agents.length > 0) ||
    (want.history?.agentHistory && want.history.agentHistory.length > 0)
  );

  const HISTORY_SUB_TABS = [
    { id: 'state'  as HistorySubTab, label: 'State',  icon: Database,  hasData: hasStateContent },
    { id: 'log'    as HistorySubTab, label: 'Log',    icon: FileText,  hasData: hasLogContent },
    { id: 'agents' as HistorySubTab, label: 'Agents', icon: Bot,       hasData: hasAgentsContent },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Sub-tab bar at TOP when header is at top */}
      {!isBottom && (
        <SubTabBar tabs={HISTORY_SUB_TABS} active={historySubTab} onChange={(id) => setHistorySubTab(id as HistorySubTab)} isBottom={false} />
      )}

      <div ref={listRef} className="flex-1 overflow-y-auto px-3 sm:px-4 pt-0.5 pb-3 space-y-2">
        {historySubTab === 'state' && (
          <>
            {want.history?.parameterHistory?.map((entry, index) => (
              <ParameterHistoryItem key={index} entry={entry} wantType={want.metadata.type} />
            ))}
            {want.history?.stateHistory?.slice().reverse().map((state, index) => (
              <StateHistoryItem key={index} state={state} wantType={want.metadata.type} />
            ))}
            {!hasStateContent && (
              <div className="text-center py-10 text-gray-400 dark:text-gray-500">
                <Database className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">No state history</p>
              </div>
            )}
          </>
        )}

        {historySubTab === 'log' && (
          <>
            {results?.logs?.map((log: string, index: number) => (
              <LogCard key={`execlog-${index}`} wantType={want.metadata.type} title="Execution log">
                <pre className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words font-mono max-h-64 overflow-auto rounded-md bg-gray-50 dark:bg-gray-900 px-2 py-1.5">
                  {log}
                </pre>
              </LogCard>
            ))}
            {want.history?.logHistory?.slice().reverse().map((logEntry, index) => (
              <LogHistoryItem key={`loghist-${index}`} logEntry={logEntry} wantType={want.metadata.type} />
            ))}
            {!hasLogContent && (
              <div className="text-center py-10 text-gray-400 dark:text-gray-500">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">No logs available</p>
              </div>
            )}
          </>
        )}

        {historySubTab === 'agents' && (
          <AgentsTab want={want} />
        )}
      </div>
      {/* Sub-tab bar at BOTTOM when header is at bottom */}
      {isBottom && (
        <SubTabBar tabs={HISTORY_SUB_TABS} active={historySubTab} onChange={(id) => setHistorySubTab(id as HistorySubTab)} isBottom={true} />
      )}
    </div>
  );
};
