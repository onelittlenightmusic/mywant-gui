import { useEffect, useRef } from 'react';
import { useAppSidebarStore, type AppSidebarDescriptor } from '@/stores/appSidebarStore';

let seq = 0;

/**
 * Register a page's detail/summary sidebar with the app-root RightSidebar shell
 * (rendered once in Layout via AppSidebarHost). The page keeps owning its own
 * open/selection state and passes the rendered content + config here; the
 * persistent shell means navigating between pages never remounts the sidebar
 * frame.
 *
 * Pass the content already rendered for the current state — it's re-registered
 * on every render so it always reflects the latest page state.
 */
export function useAppSidebar(args: Omit<AppSidebarDescriptor, 'ownerId'>): void {
  const idRef = useRef<string>('');
  if (!idRef.current) idRef.current = `sidebar-${++seq}`;

  useEffect(() => {
    useAppSidebarStore.getState().set({ ownerId: idRef.current, ...args });
  });

  useEffect(
    () => () => useAppSidebarStore.getState().clearIfOwner(idRef.current),
    [],
  );
}
