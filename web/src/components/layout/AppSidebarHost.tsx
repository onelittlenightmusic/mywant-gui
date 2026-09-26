import React from 'react';
import { RightSidebar } from '@/components/layout/RightSidebar';
import { SwapTransition } from '@/components/common/SwapTransition';
import { useAppSidebarStore } from '@/stores/appSidebarStore';
import { PanelShell } from '@/components/sidebar/PanelIdentityRow';

/**
 * The single, app-root instance of the detail/summary RightSidebar. It lives in
 * the Layout (persistent across route changes) and renders whatever the current
 * page registered via useAppSidebar — so the fixed frosted/hatched sidebar frame
 * is defined once at the SPA root instead of remounting per page.
 *
 * Pages that manage their own sidebar (the want dashboard's canvas-coupled
 * WantDetailsSidebar) simply never register here, so this stays closed there.
 */
export const AppSidebarHost: React.FC = () => {
  const descriptor = useAppSidebarStore(s => s.descriptor);

  /**
   * A panel with no header bar still has to say what it is and offer a way out.
   * That is one row, and it is added here rather than inside each panel so that
   * every one of them has it in the same place — see PanelShell.
   */
  const shelled = !!descriptor?.chromeless && !descriptor?.ownIdentity;

  return (
    <RightSidebar
      isOpen={!!descriptor?.open}
      onClose={() => descriptor?.onClose?.()}
      title={descriptor?.title}
      titleIcon={descriptor?.titleIcon}
      titleIconClassName={descriptor?.titleIconClassName}
      titleIconStyle={descriptor?.titleIconStyle}
      headerActions={descriptor?.headerActions}
      chromeless={descriptor?.chromeless}
      claimsInputOnOpen={descriptor?.claimsInputOnOpen}
      backgroundStyle={descriptor?.backgroundStyle}
      // A shelled panel does its own scrolling, under a row that stays put. If
      // the frame scrolled too, the row would ride up out of the sidebar with
      // everything else and the close would be somewhere off the top.
      overflowHidden={descriptor?.overflowHidden ?? shelled}
      disableBackdropClick={descriptor?.disableBackdropClick}
      mobileForceBottom={descriptor?.mobileForceBottom}
      className={descriptor?.className}
    >
      {(() => {
        // Inside the swap, so the row travels with the panel it names — which
        // is what the two panels that already carried one did.
        const body = descriptor?.content ?? null;
        const inner = shelled ? (
          <PanelShell title={descriptor?.title ?? ''} onClose={() => descriptor?.onClose?.()}>
            {body}
          </PanelShell>
        ) : body;
        return descriptor?.contentKey ? (
          <SwapTransition swapKey={descriptor.contentKey} order={descriptor.contentOrder}>
            {inner}
          </SwapTransition>
        ) : inner;
      })()}
    </RightSidebar>
  );
};
