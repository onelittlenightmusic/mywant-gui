/**
 * The handful of names and constants several of WantDetailsSidebar's tabs
 * need in common — declared once here so none of them import from another
 * tab's own file just to get a shared type.
 */
export type TabType = 'settings' | 'results' | 'wiring' | 'history' | 'versions' | 'chat';
/**
 * What a caller may ask to open, which still includes the two tabs that merged
 * into Wiring: a saved gui_state, a link, or another tab in another window can
 * be holding either name, and neither should open nothing.
 */
export type RequestedTab = TabType | 'expose' | 'import';
export const normalizeTab = (t: RequestedTab): TabType => (t === 'expose' || t === 'import' ? 'wiring' : t);

// Unified section container styling for all metadata/state sections
export const SECTION_CONTAINER_CLASS = 'border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-900 overflow-hidden p-2 sm:p-4';

// SubTabBar moved to ./SubTabBar so the character sheet can wear the same
// bar — see the note there.

// Sub-tab types and lists — declared at module scope so both WantDetailsSidebar
// (for the common sub-tab (B+L1/R1) handler) and the individual tab components can use them.
// ---------------------------------------------------------------------------
export type HistorySubTab = 'outputs' | 'state' | 'log' | 'agents';
export const HISTORY_SUB_TAB_LIST: HistorySubTab[] = ['outputs', 'state', 'log', 'agents'];
