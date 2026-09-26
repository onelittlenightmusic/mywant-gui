import React from 'react';
import { useHeaderAtBottom } from '@/hooks/useDisplaySettings';
import { classNames } from '@/utils/helpers';
import { useConfigStore } from '@/stores/configStore';
import { useAppBackgroundUrl } from '@/hooks/useAppBackgroundStyle';
import { AppSidebarHost } from '@/components/layout/AppSidebarHost';
import { HandoverScrim } from '@/components/layout/HandoverScrim';
import { AppHeaderHost } from '@/components/layout/AppHeaderHost';
import { SeedFlightOverlay } from '@/components/common/SeedFlightOverlay';
import { useExtensionHooks } from '@/extensions/registry';
import { useSystemPauseSync } from '@/hooks/useSystemPauseSync';

interface LayoutProps {
  children: React.ReactNode;
  sidebarMinimized?: boolean;
  onSidebarMinimizedChange?: (minimized: boolean) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const config = useConfigStore(state => state.config);
  const isBottom = useHeaderAtBottom();
  const bgUrl = useAppBackgroundUrl();
  // App-wide, because a kata can complete from a want placed on any page.
  // What extensions keep running under the frame (the Kata menu's badge, …).
  useExtensionHooks('layoutHooks');
  // App-wide: the control pill in every page's header reads it.
  useSystemPauseSync();

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 flex isolate">
      {/* App-wide background image — one persistent, fixed full-viewport layer
          that lives in the Layout (which does NOT remount on route changes), so
          navigating between pages never re-renders/re-flashes it and every page
          shows it at the same scale/position. Pages keep their content on
          transparent surfaces so this shows through the gaps. */}
      {bgUrl && (
        <div
          aria-hidden
          className="fixed inset-0 pointer-events-none"
          style={{
            // Behind everything (-1): sits above the outer div's own background
            // color but below all content, so pages/header/sidebar paint over it
            // without needing to raise their own stacking (raising the content
            // wrapper to z-10 previously trapped the fixed header's z-[9001] in a
            // lower context, letting the sidebar cover it on mobile).
            zIndex: -1,
            backgroundImage: `url(${bgUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
      )}
      {/* App-root Header — persistent across routes; pages feed it via useAppHeader. */}
      <AppHeaderHost />
      <div
        className={classNames(
          "app-scroll-hide flex-1 flex flex-col relative min-w-0",
          isBottom ? "pb-16 sm:pb-20" : "pt-16 sm:pt-20"
        )}
        style={isBottom ? {} : { marginTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className={classNames(
          "flex-1 flex flex-col min-w-0",
          isBottom ? "pb-safe" : ""
        )} style={isBottom ? { paddingBottom: 'env(safe-area-inset-bottom)' } : {}}>
          {children}
        </div>
      </div>
      {/* App-root detail/summary sidebar shell — persistent across routes; pages
          feed it via useAppSidebar. Sits above the content wrapper's z-10. */}
      <AppSidebarHost />
      {/* The grey that says the panel above has the keys. Here rather than in
          each page for the same reason the panel itself is here: it is one
          statement about the whole app, and every page that drew its own got a
          slightly different one — or, mostly, none at all. */}
      <HandoverScrim />
      {/* Thing → Add Want shared-element ghost — lives at the app root so it
          survives the /thing → /dashboard route change. */}
      <SeedFlightOverlay />
    </div>
  );
};
