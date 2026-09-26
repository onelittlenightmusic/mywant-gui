import { useEffect } from 'react';
import type { HeaderProps } from '@/components/layout/Header';
import { useAppHeaderStore } from '@/stores/appHeaderStore';

/**
 * Register a page's Header config with the app-root Header (Layout →
 * AppHeaderHost). Re-registers on every render so the header always reflects the
 * page's latest state. Never clears on unmount — the next page always overwrites
 * it, which avoids an empty-header flash mid-navigation.
 */
export function useAppHeader(props: HeaderProps): void {
  useEffect(() => {
    useAppHeaderStore.getState().set(props);
  });
}
