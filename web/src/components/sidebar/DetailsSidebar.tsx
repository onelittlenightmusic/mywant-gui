import React, { useState, useEffect } from 'react';
import { usePanelAtBottom } from '@/hooks/useDisplaySettings';
import { LucideIcon } from 'lucide-react';
import { classNames } from '@/utils/helpers';
import { useConfigStore } from '@/stores/configStore';
import { SidebarTabBar } from '@/components/common/SidebarTabBar';
import { useSidebarTabNav } from '@/hooks/useSidebarTabNav';

export interface TabConfig {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface DetailsSidebarProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  tabs: TabConfig[];
  defaultTab?: string;
  children: React.ReactNode;
  headerContent?: React.ReactNode;
  headerOverlay?: React.ReactNode;
  onTabChange?: (tabId: string) => void;
}

export const DetailsSidebar: React.FC<DetailsSidebarProps> = ({
  title,
  subtitle,
  badge,
  tabs,
  defaultTab,
  children,
  headerContent,
  headerOverlay,
  onTabChange,
}) => {
  const config = useConfigStore(state => state.config);
  const isBottom = usePanelAtBottom();
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || '');

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    onTabChange?.(tabId);
  };

  // Keyboard Tab / Gamepad L-R bumpers cycle through tabs
  useSidebarTabNav({
    tabs,
    activeTab,
    onTabChange: handleTabChange,
    enabled: tabs.length > 0,
  });

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      {/* Header overlay (e.g. ConfirmationBubble) */}
      {headerOverlay}

      {/* The entity's own card, above the tabs. Declared before the tab bar and
          carrying the same order-first as the content below, so that when the
          sheet docks to the bottom (and the content is re-ordered above the
          tabs) the card still leads. `headerContent` existed as a prop but was
          never rendered — this is where it belongs. */}
      {headerContent && (
        <div className={classNames('flex-shrink-0 px-3 pt-3', isBottom ? 'order-first' : '')}>
          {headerContent}
        </div>
      )}

      {/* Tab navigation — shared SidebarTabBar */}
      <SidebarTabBar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        isBottom={isBottom}
      />

      {/* Content */}
      <div className={classNames(
        "flex-1 overflow-y-auto overflow-x-hidden relative",
        isBottom ? "order-first" : ""
      )}>
        {children}
      </div>
    </div>
  );
};

// Common layout components for tabs
/**
 * A titled block of detail, and a place the roaming cursor can stop.
 *
 * The stop is what makes a panel navigable once it has been handed the keys.
 * Before it, every one of these panels offered the cursor exactly one target —
 * the card embedded at the top — so "go into the panel" arrived somewhere and
 * then had nowhere to go; the stick pushed and the cursor snapped back to the
 * same card. The want panel never had that problem because its field cards are
 * each a stop already (see CardPrimitives' DisplayCard, tagged the same way),
 * and these sections are that panel's read-only equivalent.
 *
 * Tagging the section rather than each row inside it is deliberate. The rows
 * are label/value pairs with nothing to activate, so a stop per row would be a
 * long walk through things that cannot be done anything with; the section is
 * the unit a reader actually moves between. Landing on one clicks it, which
 * does nothing here — the cursor simply parks, which is the highlight.
 */
export const TabSection: React.FC<{
  title: string;
  children: React.ReactNode;
  className?: string;
}> = ({ title, children, className }) => (
  <div
    className={classNames('bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 sm:p-4', className)}
    data-free-cursor-item
  >
    <h4 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white mb-2 sm:mb-3">{title}</h4>
    {children}
  </div>
);

export const TabGrid: React.FC<{
  children: React.ReactNode;
  columns?: number;
}> = ({ children, columns = 1 }) => (
  <div className={classNames(
    'space-y-2 sm:space-y-3',
    columns > 1 && 'md:grid md:gap-4 sm:gap-6 md:space-y-0',
    columns === 2 && 'md:grid-cols-2',
    columns === 3 && 'lg:grid-cols-3'
  )}>
    {children}
  </div>
);

export const TabContent: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => (
  <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
    {children}
  </div>
);

export const EmptyState: React.FC<{
  icon: LucideIcon;
  message: string;
}> = ({ icon: Icon, message }) => (
  <div className="text-center py-6 sm:py-8">
    <Icon className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400 dark:text-gray-600 mx-auto mb-3 sm:mb-4" />
    <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
  </div>
);

export const InfoRow: React.FC<{
  label: string;
  value: React.ReactNode;
}> = ({ label, value }) => (
  <div className="flex justify-between items-center text-xs sm:text-sm">
    <dt className="text-gray-600 dark:text-gray-400">{label}:</dt>
    <dd className="font-medium text-gray-900 dark:text-gray-200">{value}</dd>
  </div>
);