import type React from 'react';
import type { LucideIcon } from 'lucide-react';
import type { AnyIconComponent } from '@/components/dashboard/WantTypeVisuals';
import { create } from 'zustand';

/**
 * Descriptor a page hands to the app-root RightSidebar shell. The shell (its
 * fixed frosted/hatched frame, open/close animation, focus trap) lives once in
 * the Layout so it persists across route changes — pages only supply the
 * content and config through this store. Mirrors the RightSidebar props a page
 * needs so the want dashboard's sidebar (with its icon/header-actions/mobile
 * behaviour) can ride the same frame.
 */
export interface AppSidebarDescriptor {
  /** Unique per provider instance so a stale page can only clear its own entry. */
  ownerId: string;
  open: boolean;
  /**
   * A route of this app that shows this panel on its own (see
   * lib/nativeHost, nativePanelPage). Framed by an app, a panel with one is
   * opened as the app's own sheet from it rather than drawn here.
   */
  hostRoute?: string;
  title?: string;
  titleIcon?: LucideIcon | AnyIconComponent;
  titleIconClassName?: string;
  titleIconStyle?: React.CSSProperties;
  headerActions?: React.ReactNode;
  /**
   * Draw no header bar — no title bar, no actions, no close of its own.
   *
   * For a detail panel, which says which thing it is by opening on that thing's
   * card. The want detail draws the want's own tile exactly as the board does,
   * and the frame used to say the name and the status underneath it: 41px and a
   * border to repeat what the 176px above had already shown.
   *
   * What replaces it is the slim identity row, supplied by the host (see
   * PanelShell) so that every detail panel's name and close land in the same
   * place. Set `ownIdentity` for the one panel that draws its own.
   */
  chromeless?: boolean;
  /**
   * This panel was asked for, so it arrives holding the input and B leaves it
   * by closing it.
   *
   * The form contract RightSidebar already draws the line at: a panel that
   * opens by itself because the character walked onto something must not take
   * the stick, and B in it means "back to the board with the card still
   * selected". A panel the user went and opened has no state behind it worth
   * going back to, so the same press cancels out of it outright. Add Thing is
   * the second kind and had no way to say so — the field is here rather than
   * inferred, because only the page that opened the panel knows which it is.
   */
  claimsInputOnOpen?: boolean;
  /**
   * This panel draws its own identity row, so the host must not add one.
   *
   * Only the want detail: its row is glued to the card inside a block that the
   * phone's bottom sheet re-orders, and lifting it out would leave the two to
   * be arranged separately. It renders the same PanelIdentityRow in the same
   * geometry, so it looks like all the others — it just builds it itself.
   */
  ownIdentity?: boolean;
  backgroundStyle?: React.CSSProperties;
  overflowHidden?: boolean;
  disableBackdropClick?: boolean;
  /** Mobile sheet appears at the bottom — the want dashboard passes this for its
   *  canvas so iPhone layout matches the existing implementation. */
  mobileForceBottom?: boolean;
  className?: string;
  onClose?: () => void;
  content: React.ReactNode;
  /** Identity of the current content (selected item id). When it changes while
   *  the sidebar stays open, the shell plays a directional swap animation. */
  contentKey?: string;
  /** The content's position in its source list — drives swap direction. */
  contentOrder?: number;
}

interface AppSidebarStore {
  descriptor: AppSidebarDescriptor | null;
  set: (d: AppSidebarDescriptor) => void;
  /** Clear only if the given owner still holds the slot (avoids a page's
   *  unmount cleanup wiping the next page's just-registered sidebar). */
  clearIfOwner: (ownerId: string) => void;
}

export const useAppSidebarStore = create<AppSidebarStore>((set) => ({
  descriptor: null,
  set: (d) => set({ descriptor: d }),
  clearIfOwner: (ownerId) =>
    set((s) => (s.descriptor?.ownerId === ownerId ? { descriptor: null } : s)),
}));
