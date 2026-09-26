import React from 'react';
import { classNames } from '@/utils/helpers';
import { useMyCursorColor } from '@/hooks/useMyCursorColor';
import { useDarkMode } from '@/hooks/useDarkMode';
import { characterBadgeColor } from '@/design/characterColor';
import { CONTROL_TAB, CONTROL_ICON_CLASS } from '@/design/controls';

/**
 * A single tab definition for SidebarTabBar.
 * `icon` is a Lucide (or compatible) component — NOT a JSX element.
 */
export interface SidebarTab {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: number | null;
}

interface SidebarTabBarProps {
  tabs: SidebarTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  /**
   * When true (bottom header mode), the active-indicator bar appears at the
   * top edge instead of the bottom, and the border is on the top.
   */
  isBottom?: boolean;
}

/**
 * Unified tab bar for all detail sidebars (WantDetails, WantTypeDetails, RecipeDetails).
 *
 * Design spec (matches WantDetailsSidebar):
 * - Full-width flex row; each tab takes equal space (flex-1)
 * - Icon (3.5×3.5 → 4×4 on sm) stacked above label text
 * - Active: white/gray-800 bg, blue text, thin indicator bar at bottom/top
 * - Inactive: muted text, subtle hover bg
 * - Font: 9px–10px, bold, uppercase, tight tracking
 */
export const SidebarTabBar: React.FC<SidebarTabBarProps> = ({
  tabs,
  activeTab,
  onTabChange,
  isBottom = false,
}) => {
  const dotColor = characterBadgeColor(useMyCursorColor(), useDarkMode());
  return (
    <div className={classNames(
      'flex flex-shrink-0 border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50',
      isBottom ? 'border-t' : 'border-b',
    )}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            data-robot-target="sidebar_tab"
            data-robot-id={tab.id}
            className={classNames(
              // The third strip to take the floor — the same one the form and
              // sub tabs took. It was 18px on a phone and 42 on a desktop, the
              // wrong way round, and being the panel's own top-level tabs it was
              // the one people met first. See design/controls.ts.
              CONTROL_TAB,
              'flex-1 flex flex-col items-center justify-center gap-0.5 px-1 sm:px-2 transition-all relative min-w-0',
              isActive
                ? 'text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-800/30',
            )}
          >
            <div className="relative">
              <Icon className={classNames(CONTROL_ICON_CLASS.md, 'flex-shrink-0')} />
              {/* Just a dot — "this tab has something", not how many — in the
                  viewer's character colour, the same "for you" mark the board's
                  alert badge and the menu's attention dot wear. It was a blue
                  numbered pill, which read as a notification count from another
                  app's design language. */}
              {tab.badge != null && tab.badge > 0 && (
                <span
                  aria-hidden
                  className="absolute -top-1 -right-2 block w-2 h-2 rounded-full ring-2 ring-gray-50 dark:ring-gray-900"
                  style={{ background: dotColor }}
                />
              )}
            </div>
            <span className="hidden sm:block text-[10px] font-bold uppercase tracking-tighter truncate w-full text-center">
              {tab.label}
            </span>
            {isActive && (
              <div className={classNames(
                'absolute h-0.5 bg-blue-600 dark:bg-blue-400 left-0 right-0',
                isBottom ? 'top-0' : 'bottom-0',
              )} />
            )}
          </button>
        );
      })}
    </div>
  );
};
