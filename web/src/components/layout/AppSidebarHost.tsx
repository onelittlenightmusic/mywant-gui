import React from 'react';
import { RightSidebar } from '@/components/layout/RightSidebar';
import { SwapTransition } from '@/components/common/SwapTransition';
import { useAppSidebarStore } from '@/stores/appSidebarStore';
import { PanelShell } from '@/components/sidebar/PanelIdentityRow';
import { nativeHost, nativePanelPage, postToHost, useHostSheetStore, iconName, HostFramedPanel } from '@/lib/nativeHost';

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

  // Framed by an app on a phone, a panel that stands on a page of its own is
  // the app's sheet, opened from its route (lib/nativeHost) — not drawn here.
  const asSheet = nativeHost && !nativePanelPage && window.innerWidth < 640
    && !!descriptor?.open && !!descriptor?.hostRoute;
  const onCloseRef = React.useRef(descriptor?.onClose);
  onCloseRef.current = descriptor?.onClose;
  const sheetRoute = asSheet ? descriptor?.hostRoute ?? '' : '';
  const sheetTitle = descriptor?.title ?? '';
  const sheetIcon = iconName(descriptor?.titleIcon as { displayName?: string } | undefined, '');
  React.useEffect(() => {
    if (!sheetRoute) { useHostSheetStore.getState().clear(); return; }
    useHostSheetStore.getState().set(
      { route: sheetRoute, title: sheetTitle, icon: sheetIcon },
      () => onCloseRef.current?.(),
    );
  }, [sheetRoute, sheetTitle, sheetIcon]);

  // This page is such a panel, inside the app's sheet: when it closes itself
  // (a want deleted from it, say), the app is told, and lets the sheet go.
  const wasOpen = React.useRef(false);
  React.useEffect(() => {
    if (!nativePanelPage) return;
    if (descriptor?.open) wasOpen.current = true;
    else if (wasOpen.current) { wasOpen.current = false; postToHost({ type: 'sheet-done' }); }
  }, [descriptor?.open]);

  const content = (() => {
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
  })();

  // The panel page: the panel and nothing else, the whole page — the app's
  // sheet is its frame (its close included, so the panel's own is not drawn).
  if (nativePanelPage) {
    return (
      // Its end clears the sheet's rounded bottom corners and the home
      // indicator, so the last row is never cut off by the curve.
      <div className="fixed inset-0 overflow-auto bg-white dark:bg-gray-900"
        style={{ ...descriptor?.backgroundStyle, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}>
        <HostFramedPanel.Provider value={true}>
          {descriptor?.open ? content : null}
        </HostFramedPanel.Provider>
      </div>
    );
  }

  return (
    <RightSidebar
      isOpen={!!descriptor?.open && !asSheet}
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
      {content}
    </RightSidebar>
  );
};
