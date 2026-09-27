// First: extensions register before anything that asks what they added.
import '@/extensions/installed'
import { installSidebarFocusTracking } from '@/stores/sidebarFocusStore';
import { installCardOverlaySounds } from '@/stores/cardOverlaySounds';
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/index.css'
import { registerWantCardPlugin } from './components/dashboard/WantCard/plugins/registry'
import { loadRuntimeExtensions } from './extensions/runtime'
import { registerOverlayDesign } from './components/overlay/design'

// Expose globals for dynamically loaded external plugins
window.React = React
// Extensions add their own members in their setup (extensions/installed,
// imported above, has already run by now), so this merges rather than replaces.
window.__mywant = {
  ...(window.__mywant ?? {}),
  registerPlugin: registerWantCardPlugin,
  // A design for every overlay menu and dialog, from an extension written as a
  // plain script — see components/overlay/design.
  registerOverlayDesign,
  /**
   * Standard 3-section card layout for external JSX plugins.
   * top    — flex-shrink-0, anchored to card top
   * content — flex-1, fills remaining space
   * bottom  — flex-shrink-0, anchored to card bottom
   * centerContent — (optional) centers content within the middle section
   */
  createCardLayout: ({
    top,
    content,
    bottom,
    centerContent = false,
    className,
    style,
  }: {
    top?: React.ReactNode;
    content: React.ReactNode;
    bottom?: React.ReactNode;
    centerContent?: boolean;
    className?: string;
    style?: React.CSSProperties;
  }) =>
    React.createElement(
      'div',
      { className: `h-full flex flex-col${className ? ` ${className}` : ''}`, style },
      top != null && React.createElement('div', { className: 'flex-shrink-0' }, top as React.ReactNode),
      React.createElement(
        'div',
        {
          className: `flex-1 min-h-0 overflow-hidden${centerContent ? ' flex items-center justify-center' : ''}`,
        },
        content,
      ),
      bottom != null && React.createElement('div', { className: 'flex-shrink-0' }, bottom as React.ReactNode),
    ),
}

// Name this window so a page elsewhere can find it again: the bookmarklet's
// control pill warps back with window.open('', 'mywant-gui')
// (webext/build-standalone-overlay.js).
window.name = 'mywant-gui';

// Extensions installed beside the app register before the first render, as the
// built-in ones above already have. See extensions/runtime.
void loadRuntimeExtensions().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )

  // Keeps the sidebar-focus flag a reading of real DOM focus. See the store.
  installSidebarFocusTracking();
  installCardOverlaySounds();
})
