import { create } from 'zustand';
import type { HeaderProps } from '@/components/layout/Header';

/**
 * The current page's Header configuration, fed to the single app-root Header
 * (Layout → AppHeaderHost). Hoisting the Header out of each page means route
 * changes only swap the page's main content — the Header instance stays mounted,
 * so it never re-renders wholesale and its measured --header-height stays stable
 * (no navigation layout shift).
 */
interface AppHeaderStore {
  props: HeaderProps | null;
  set: (props: HeaderProps) => void;
}

export const useAppHeaderStore = create<AppHeaderStore>((set) => ({
  props: null,
  set: (props) => set({ props }),
}));
