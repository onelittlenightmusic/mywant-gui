import React from 'react';
import { Header } from '@/components/layout/Header';
import { useAppHeaderStore } from '@/stores/appHeaderStore';
import { useExtensionInteract } from '@/extensions/registry';
import { Slot } from '@/extensions/Slot';

/**
 * The single, app-root Header. Lives in the Layout (persistent across route
 * changes) and renders whatever the current page registered via useAppHeader —
 * so navigating only swaps the page's main content, never the header bar.
 * Renders nothing until a page has registered its config.
 *
 * The interact bubble is wired here (not per-page) so it's identically
 * available on every route — answered by whichever extension registered an
 * `interact` (see extensions/registry), and absent when none did. These props
 * always win over anything a page's useAppHeader call happens to set, since
 * the bubble must behave the same everywhere.
 */
export const AppHeaderHost: React.FC = () => {
  const props = useAppHeaderStore(s => s.props);
  const interact = useExtensionInteract();
  // Whatever is waiting on an answer said in the bubble sits over the header,
  // next to the one input box that can give it — see interactOverlay.
  const overlay = interact && <Slot name="interactOverlay" onSay={interact.handleInteractSubmit} />;
  if (!props) return overlay || null;
  return (
    <>
    {overlay}
    <Header
      {...props}
      onInteractSubmit={interact?.handleInteractSubmit}
      isInteractThinking={interact?.isSubmitting}
      hasUnreadReply={interact?.hasUnreadReply}
      onViewReply={interact?.handleViewReply}
    />
    </>
  );
};
