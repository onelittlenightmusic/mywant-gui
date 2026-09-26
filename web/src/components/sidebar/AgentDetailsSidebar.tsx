import React, { useState } from 'react';
import { AgentCard } from '@/components/dashboard/AgentCard';
import { Bot, Monitor, Zap, Settings, Eye, Code, Brain } from 'lucide-react';
import { AgentResponse } from '@/types/agent';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorDisplay } from '@/components/common/ErrorDisplay';
import { useAgentStore } from '@/stores/agentStore';
import { classNames } from '@/utils/helpers';
import {
  DetailsSidebar,
  TabContent,
  TabSection,
  TabGrid,
  EmptyState,
  InfoRow,
  TabConfig
} from './DetailsSidebar';

interface AgentDetailsSidebarProps {
  agent: AgentResponse | null;
  /** The embedded card's overlay actions. Without them Edit and Delete stay
   *  lit and do nothing at all, which is worse than being greyed out. */
  onEdit?: (agent: AgentResponse) => void;
  onDelete?: (agent: AgentResponse) => void;
}

type TabType = 'overview' | 'capabilities' | 'dependencies' | 'config';

export const AgentDetailsSidebar: React.FC<AgentDetailsSidebarProps> = ({
  agent, onEdit, onDelete
}) => {
  const { loading, error } = useAgentStore();
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const tabs: TabConfig[] = [
    { id: 'overview', label: 'Overview', icon: Eye },
    { id: 'capabilities', label: 'Capabilities', icon: Settings },
    { id: 'dependencies', label: 'Dependencies', icon: Bot },
    { id: 'config', label: 'Config', icon: Code }
  ];

  // Tab switching is now handled by useSidebarTabNav inside DetailsSidebar.

  const getTypeIcon = () => {
    if (!agent) return <Bot className="h-5 w-5" />;
    switch (agent.type) {
      case 'do':
        return <Zap className="h-4 w-4" />;
      case 'monitor':
        return <Monitor className="h-4 w-4" />;
      case 'think':
        return <Brain className="h-4 w-4" />;
      default:
        return <Bot className="h-4 w-4" />;
    }
  };

  const getTypeColor = () => {
    if (!agent) return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700';
    switch (agent.type) {
      case 'do':
        return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50';
      case 'monitor':
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/50';
      case 'think':
        return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800/50';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700';
    }
  };

  if (!agent) {
    return <EmptyState icon={Bot} message="Select an agent to view details" />;
  }

  const badge = (
    <div className={classNames(
      'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border',
      getTypeColor()
    )}>
      {getTypeIcon()}
      <span className="ml-2 capitalize">{agent.type} Agent</span>
    </div>
  );

  return (
    <DetailsSidebar
      headerContent={
        <div className="h-32 sm:h-36">
          <AgentCard
            agent={agent}
            selected
            keepFocus
            onView={() => {}}
            onEdit={(a) => onEdit?.(a)}
            onDelete={(a) => onDelete?.(a)}
          />
        </div>
      }
      title={agent.name}
      badge={badge}
      tabs={tabs}
      defaultTab="overview"
      onTabChange={(tabId) => setActiveTab(tabId as TabType)}
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <>
          {error && (
            <div className="p-6">
              <ErrorDisplay error={error} />
            </div>
          )}

          {activeTab === 'overview' && <OverviewTab agent={agent} />}
          {activeTab === 'capabilities' && <CapabilitiesTab agent={agent} />}
          {activeTab === 'dependencies' && <DependenciesTab agent={agent} />}
          {activeTab === 'config' && <ConfigurationTab agent={agent} />}
        </>
      )}
    </DetailsSidebar>
  );
};

// Tab Components
const OverviewTab: React.FC<{ agent: AgentResponse }> = ({ agent }) => (
  <TabContent>
    <TabGrid columns={2}>
      <TabSection title="Basic Information">
        <dl className="space-y-2">
          <InfoRow label="Name" value={agent.name} />
          <InfoRow label="Type" value={<span className="capitalize">{agent.type}</span>} />
          <InfoRow
            label="Status"
            value={
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                <span className="text-sm text-green-600 font-medium">Active</span>
              </div>
            }
          />
        </dl>
      </TabSection>

      <TabSection title="Statistics">
        <dl className="space-y-2">
          <InfoRow label="Capabilities" value={agent.capabilities?.length || 0} />
          <InfoRow label="Dependencies" value={agent.uses?.length || 0} />
        </dl>
      </TabSection>
    </TabGrid>
  </TabContent>
);

const CapabilitiesTab: React.FC<{ agent: AgentResponse }> = ({ agent }) => (
  <TabContent>
    {agent.capabilities && agent.capabilities.length > 0 ? (
      <div className="space-y-3">
        {agent.capabilities.map((capability, index) => (
          <div
            key={index}
            className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/50 rounded-lg p-3"
          >
            <div className="flex items-center">
              <Settings className="h-4 w-4 text-purple-600 dark:text-purple-400 mr-2" />
              <span className="text-sm font-medium text-purple-800 dark:text-purple-300">
                {capability}
              </span>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <EmptyState icon={Settings} message="No capabilities defined for this agent." />
    )}
  </TabContent>
);

const DependenciesTab: React.FC<{ agent: AgentResponse }> = ({ agent }) => (
  <TabContent>
    {agent.uses && agent.uses.length > 0 ? (
      <div className="space-y-3">
        {agent.uses.map((dependency, index) => (
          <div
            key={index}
            className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/50 rounded-lg p-3"
          >
            <div className="flex items-center">
              <Bot className="h-4 w-4 text-orange-600 dark:text-orange-400 mr-2" />
              <span className="text-sm font-medium text-orange-800 dark:text-orange-300">
                {dependency}
              </span>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <EmptyState icon={Bot} message="No dependencies defined for this agent." />
    )}
  </TabContent>
);

const ConfigurationTab: React.FC<{ agent: AgentResponse }> = ({ agent }) => (
  <TabContent>
    <TabSection title="Agent Configuration">
      <pre className="text-xs text-gray-800 dark:text-gray-200 overflow-auto whitespace-pre-wrap font-mono">
        {JSON.stringify(agent, null, 2)}
      </pre>
    </TabSection>
  </TabContent>
);