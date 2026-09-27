import type { WantCardPlugin } from '@/components/dashboard/WantCard/plugins/registry'

declare global {
  /**
   * What the page offers plugins loaded at runtime (custom want types' card
   * views and the like), on window.__mywant. An extension that accepts
   * plugins of its own adds members here by declaring this interface again
   * and assigning them in its setup (see extensions/registry).
   */
  interface MywantGlobals {
    registerPlugin: (plugin: WantCardPlugin) => void
    registerOverlayDesign: (design: import('@/components/overlay/design').OverlayDesign) => void
    createCardLayout: (opts: {
      top?: import('react').ReactNode
      content: import('react').ReactNode
      bottom?: import('react').ReactNode
      centerContent?: boolean
      className?: string
      style?: import('react').CSSProperties
    }) => import('react').ReactElement
  }

  interface Window {
    React: typeof import('react')
    __mywant: MywantGlobals
  }
}
