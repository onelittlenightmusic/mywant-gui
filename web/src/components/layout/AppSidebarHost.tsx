import React from 'react';
import { RightSidebar } from '@/components/layout/RightSidebar';
import { SwapTransition } from '@/components/common/SwapTransition';
import { useAppSidebarStore } from '@/stores/appSidebarStore';
import { PanelShell } from '@/components/sidebar/PanelIdentityRow';
import { useThingStore } from '@/stores/thingStore';
import { useWantStore } from '@/stores/wantStore';
import { nativePanelPage, postToHost, useHostSheet, hostSheetsOn, iconName, HostFramedPanel } from '@/lib/nativeHost';

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
  const asSheet = hostSheetsOn() && !!descriptor?.open && !!descriptor?.hostRoute;
  useHostSheet(
    asSheet ? descriptor?.hostRoute ?? null : null,
    descriptor?.title ?? '',
    iconName(descriptor?.titleIcon as { displayName?: string } | undefined, ''),
    () => {
      descriptor?.onClose?.();
      // What the sheet's own page changed — a thing added, a want edited —
      // was changed there, so this page reads it again.
      void useThingStore.getState().fetchThings();
      void useWantStore.getState().fetchWants();
    },
  );

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
    // Nothing at all while closed: a form's panel page draws its form itself
    // (RightSidebar), and an empty page over it would hide it.
    if (!descriptor?.open) return null;
    return (
      // Its end clears the sheet's rounded corners, the home indicator, and
      // the app's shrunk tab bar and pill kept over the sheet.
      <div className="fixed inset-0 z-[60] overflow-auto bg-white dark:bg-gray-900"
        style={{ ...descriptor?.backgroundStyle, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)' }}>
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
