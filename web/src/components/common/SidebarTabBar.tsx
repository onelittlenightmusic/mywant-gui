import React from 'react';
import { classNames } from '@/utils/helpers';
import { useMyCursorColor } from '@/hooks/useMyCursorColor';
import { useDarkMode } from '@/hooks/useDarkMode';
import { characterBadgeColor } from '@/design/characterColor';
import { CONTROL_TAB, CONTROL_ICON_CLASS } from '@/design/controls';
import { tabTrayClass, tabClass, tabIconClass, TAB_LABEL } from '@/design/tabs';

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
 * Each tab takes equal space, its icon over its word; the look — a tray with
 * the tab you are on set down in it as a card — is design/tabs.ts, shared with
 * SubTabBar and FormTabBar.
 */
export const SidebarTabBar: React.FC<SidebarTabBarProps> = ({
  tabs,
  activeTab,
  onTabChange,
  isBottom = false,
}) => {
  const dotColor = characterBadgeColor(useMyCursorColor(), useDarkMode());
  return (
    <div className={tabTrayClass(!!isBottom)}>
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
              tabClass(isActive),
            )}
          >
            <div className="relative">
              <Icon className={classNames(CONTROL_ICON_CLASS.md, 'flex-shrink-0', tabIconClass(isActive))} />
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
            <span className={TAB_LABEL}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
