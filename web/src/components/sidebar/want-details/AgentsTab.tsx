/** The Agents tab — which agent capabilities ran, and what they did. */
import React, { useEffect, useLayoutEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Bot } from 'lucide-react';
import { Want } from '@/types/want';
import { formatDate, classNames } from '@/utils/helpers';
import { WantCard } from '@/components/dashboard/WantCard/WantCard';
import {
  DetailsSidebar,
  TabContent,
  TabSection,
  TabGrid,
  EmptyState,
  InfoRow,
  TabConfig
} from '../DetailsSidebar';

import { SECTION_CONTAINER_CLASS } from './shared';

export const AgentsTab: React.FC<{ want: Want }> = ({ want }) => {
  const agentHistory = want.history?.agentHistory ?? [];
  const hasActivity = want.current_agent ||
    (want.running_agents && want.running_agents.length > 0) ||
    agentHistory.length > 0;

  const statusDot = (status: string) => classNames(
    'w-2 h-2 rounded-full flex-shrink-0',
    (status === 'achieved' || status === 'achieved_with_warning')   && 'bg-green-500',
    status === 'failed'     && 'bg-red-500',
    status === 'running'    && 'bg-blue-500 animate-pulse',
    status === 'terminated' && 'bg-gray-500',
  );

  const agentTypeBadge = (type: string) => classNames(
    'text-xs px-1.5 py-0.5 rounded font-medium',
    type === 'do'      && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    type === 'monitor' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    type === 'think'   && 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    !['do', 'monitor', 'think'].includes(type) && 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  );

  return (
    <div className="px-3 sm:px-4 pt-0 pb-3 sm:py-4 space-y-2">
      {/* Current Agent */}
      {want.current_agent && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4">
          <div className="flex items-center">
            <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400 mr-2" />
            <div>
              <h4 className="text-xs sm:text-sm font-medium text-blue-900 dark:text-blue-300">Current Agent</h4>
              <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-400">{want.current_agent}</p>
            </div>
            <div className="ml-auto">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      )}

      {/* Running Agents */}
      {want.running_agents && want.running_agents.length > 0 && (
        <div className={SECTION_CONTAINER_CLASS}>
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Running Agents</h4>
          <div className="space-y-2">
            {want.running_agents.map((agent, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">{agent}</span>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agent Execution Log — flat list, no outer wrapper */}
      {[...agentHistory].reverse().map((event, index) => (
        <div
          key={index}
          className="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-xs"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-gray-800 dark:text-gray-200">{event.agent_name}</span>
            <div className="flex items-center space-x-2">
              {event.agent_type && (
                <span className={agentTypeBadge(event.agent_type)}>{event.agent_type}</span>
              )}
              <div className={statusDot(event.status)} title={event.status} />
            </div>
          </div>
          {event.activity && (
            <div className="mb-1">
              <span className="inline-block bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded font-medium">
                {event.activity}
              </span>
            </div>
          )}
          <div className="text-gray-500 dark:text-gray-400 space-y-0.5">
            <div>{event.status} · {formatDate(event.timestamp)}</div>
            {event.error && (
              <div className="text-red-600 dark:text-red-400">Error: {event.error}</div>
            )}
          </div>
        </div>
      ))}

      {!hasActivity && (
        <div className="text-center py-8">
          <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No agent information available</p>
        </div>
      )}
    </div>
  );
};
