import { useHostPanel } from '@/lib/nativeHost';
import React, { useState } from 'react';
import { AlertTriangle, Activity, CheckCircle, XCircle, Bot, NotebookPen, MessageSquare } from 'lucide-react';
import { useAppHeader } from '@/hooks/useAppHeader';
import { RightSidebar } from '@/components/layout/RightSidebar';
import { ErrorHistory } from '@/components/error/ErrorHistory';
import { LogHistory } from '@/components/logs/LogHistory';
import { extensionLogTabs } from '@/extensions/registry';
import { ThingEventHistory } from '@/components/logs/ThingEventHistory';
import { NotificationHistory } from '@/components/logs/NotificationHistory';
import { useLogStore } from '@/stores/logStore';
import { useErrorHistoryStore } from '@/stores/errorHistoryStore';
import { useUIStore } from '@/stores/uiStore';
import { classNames } from '@/utils/helpers';
import { SidebarTabBar } from '@/components/common/SidebarTabBar';

type TabType = string;

const TABS = [
  { id: 'logs',          label: 'API Logs',      icon: Activity },
  { id: 'errors',        label: 'Errors',        icon: AlertTriangle },
  { id: 'notifications', label: 'Notifications', icon: MessageSquare },
  { id: 'events',        label: 'Thing Events',   icon: NotebookPen },
];

/** One statistic as a card — the six copies of this markup the summary used to
 *  carry differed only in icon, label and number. */
const StatCard: React.FC<{ icon: React.ElementType; tone: string; label: string; value: number }> = ({
  icon: Icon, tone, label, value,
}) => (
  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center">
    <Icon className={classNames('h-8 w-8 flex-shrink-0', tone)} />
    <div className="ml-3">
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
    </div>
  </div>
);

export const LogsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('logs');
  const [showSummary, setShowSummary] = useState(false);

  const { logs } = useLogStore();
  const { errors } = useErrorHistoryStore();

  // Calculate statistics
  const logSuccessCount = logs.filter(l => l.status === 'success').length;
  const logErrorCount = logs.filter(l => l.status === 'error').length;
  const errorResolvedCount = errors.filter(e => e.resolved).length;

  useAppHeader({
    title: 'Logs',
    onCreateWant: () => {},
    hideCreateButton: true,
  });

  // In an app on a phone, the summary is the app's own sheet (useHostPanel).
  const panelRoute = useHostPanel(showSummary ? '__summary' : null, () => { setShowSummary(true); });

  return (
    <>
      {/* Main content area */}
      <main className="flex-1 flex overflow-hidden bg-gray-50 dark:bg-gray-950 lg:mr-[480px] mr-0 relative">
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 pb-24">
            {/* Tab Navigation — the shared bar every sidebar uses, rather than
                this page's own hand-rolled strip. */}
            <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800">
              <SidebarTabBar
                tabs={[...TABS, ...extensionLogTabs()]}
                activeTab={activeTab}
                onTabChange={(id) => setActiveTab(id as TabType)}
              />
            </div>

            {/* Tab Content */}
            <div className="mt-6">
              {activeTab === 'errors' && <ErrorHistory />}
              {activeTab === 'logs' && <LogHistory />}
              {extensionLogTabs().map(t => activeTab === t.id && <t.component key={t.id} />)}
              {activeTab === 'notifications' && <NotificationHistory />}
              {activeTab === 'events' && <ThingEventHistory />}
            </div>
          </div>
        </div>
      </main>

      {/* Right Sidebar for Summary */}
      <RightSidebar
        isOpen={showSummary}
        onClose={() => setShowSummary(false)}
        title="Summary"
        hostRoute={panelRoute}
      >
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {activeTab === 'logs' ? 'API Logs' : 'Errors'} Statistics
            </h3>
            <div className="space-y-4">
              {(activeTab === 'logs'
                ? [
                    { icon: Activity, tone: 'text-gray-400 dark:text-gray-500', label: 'Total Logs', value: logs.length },
                    { icon: CheckCircle, tone: 'text-green-400', label: 'Success', value: logSuccessCount },
                    { icon: XCircle, tone: 'text-red-400', label: 'Errors', value: logErrorCount },
                  ]
                : [
                    { icon: AlertTriangle, tone: 'text-gray-400 dark:text-gray-500', label: 'Total Errors', value: errors.length },
                    { icon: CheckCircle, tone: 'text-green-400', label: 'Resolved', value: errorResolvedCount },
                    { icon: XCircle, tone: 'text-red-400', label: 'Unresolved', value: errors.length - errorResolvedCount },
                  ]
              ).map(({ icon: Icon, tone, label, value }) => (
                <StatCard key={label} icon={Icon} tone={tone} label={label} value={value} />
              ))}
            </div>
          </div>
        </div>
      </RightSidebar>
    </>
  );
};