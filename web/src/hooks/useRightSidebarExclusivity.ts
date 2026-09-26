import { useState, useCallback } from 'react';

/**
 * Which one of the mutually exclusive right-hand panels is up.
 *
 * There used to be a 'summary' here as well, holding a per-page statistics
 * panel. The summary is part of the detail and global sidebars now — you reach
 * it by opening those — so nothing was left that could put the slot into that
 * state, and a state nothing can enter is not a state.
 */
export type SidebarType = 'details' | 'form' | 'batch' | 'global' | null;

export interface UseRightSidebarExclusivityReturn<T> {
  // State
  selectedItem: T | null;
  showForm: boolean;
  showBatch: boolean;
  showGlobal: boolean;
  activeSidebar: SidebarType;

  // Actions
  selectItem: (item: T | null) => void;
  clearSelection: () => void;
  openForm: () => void;
  closeForm: () => void;
  toggleForm: () => void;
  openBatch: () => void;
  closeBatch: () => void;
  openThing: () => void;
  closeMemo: () => void;
  toggleGlobal: () => void;
  closeAll: () => void;

  // Header actions (for Details sidebar)
  toggleHeaderAction?: ((action: 'refresh' | 'autoRefresh') => void) | null;
  registerHeaderActions?: (handlers: { handleRefresh: () => void; handleToggleAutoRefresh: () => void }) => void;
}

/**
 * Hook for managing mutually exclusive RightSidebar instances
 * Ensures only one of Details, Form, Batch, or Thing sidebars is visible at a time
 */
export function useRightSidebarExclusivity<T = any>(): UseRightSidebarExclusivityReturn<T> {
  const [activeSidebar, setActiveSidebar] = useState<SidebarType>(null);
  const [selectedItem, setSelectedItem] = useState<T | null>(null);
  const [headerActionHandlers, setHeaderActionHandlers] = useState<{ handleRefresh: () => void; handleToggleAutoRefresh: () => void } | null>(null);

  // Computed states for easier usage
  const showForm = activeSidebar === 'form';
  const showBatch = activeSidebar === 'batch';
  const showGlobal = activeSidebar === 'global';

  /**
   * Select an item to display in Details sidebar
   */
  const selectItem = useCallback(
    (item: T | null) => {
      setSelectedItem(item);
      if (item) {
        setActiveSidebar('details');
      } else {
        if (activeSidebar === 'details') {
          setActiveSidebar(null);
        }
      }
    },
    [activeSidebar]
  );

  /**
   * Clear selected item and close Details sidebar
   */
  const clearSelection = useCallback(() => {
    setSelectedItem(null);
    if (activeSidebar === 'details') {
      setActiveSidebar(null);
    }
  }, [activeSidebar]);

  /**
   * Open Form sidebar
   */
  const openForm = useCallback(() => {
    setActiveSidebar('form');
    setSelectedItem(null);
  }, []);

  /**
   * Close Form sidebar
   */
  const closeForm = useCallback(() => {
    if (activeSidebar === 'form') {
      setActiveSidebar(null);
    }
  }, [activeSidebar]);

  /**
   * Toggle Form sidebar
   */
  const toggleForm = useCallback(() => {
    if (activeSidebar === 'form') {
      setActiveSidebar(null);
    } else {
      setActiveSidebar('form');
      setSelectedItem(null);
    }
  }, [activeSidebar]);

  /**
   * Open Batch sidebar
   */
  const openBatch = useCallback(() => {
    setActiveSidebar('batch');
    setSelectedItem(null);
  }, []);

  /**
   * Close Batch sidebar
   */
  const closeBatch = useCallback(() => {
    if (activeSidebar === 'batch') {
      setActiveSidebar(null);
    }
  }, [activeSidebar]);

  /**
   * Open Thing sidebar
   */
  const openThing = useCallback(() => {
    setActiveSidebar('global');
    setSelectedItem(null);
  }, []);

  /**
   * Close Thing sidebar
   */
  const closeMemo = useCallback(() => {
    if (activeSidebar === 'global') {
      setActiveSidebar(null);
    }
  }, [activeSidebar]);

  /**
   * Toggle Thing sidebar
   */
  const toggleGlobal = useCallback(() => {
    if (activeSidebar === 'global') {
      setActiveSidebar(null);
    } else {
      setActiveSidebar('global');
      setSelectedItem(null);
    }
  }, [activeSidebar]);

  /**
   * Close all sidebars
   */
  const closeAll = useCallback(() => {
    setActiveSidebar(null);
    setSelectedItem(null);
  }, []);

  /**
   * Register header action handlers from Details sidebar
   */
  const registerHeaderActions = useCallback((handlers: { handleRefresh: () => void; handleToggleAutoRefresh: () => void }) => {
    setHeaderActionHandlers(handlers);
  }, []);

  /**
   * Execute header actions registered from Details sidebar
   */
  const toggleHeaderAction = useCallback((action: 'refresh' | 'autoRefresh') => {
    if (!headerActionHandlers) return;

    if (action === 'refresh') {
      headerActionHandlers.handleRefresh();
    } else if (action === 'autoRefresh') {
      headerActionHandlers.handleToggleAutoRefresh();
    }
  }, [headerActionHandlers]);

  return {
    // State
    selectedItem,
    showForm,
    showBatch,
    showGlobal,
    activeSidebar,

    // Actions
    selectItem,
    clearSelection,
    openForm,
    closeForm,
    toggleForm,
    openBatch,
    closeBatch,
    openThing,
    closeMemo,
    toggleGlobal,
    closeAll,

    // Header actions
    toggleHeaderAction,
    registerHeaderActions,
  };
}
