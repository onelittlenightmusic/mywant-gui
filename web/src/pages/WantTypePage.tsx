import { useState, useEffect, useRef, useCallback } from 'react';
import { notify } from '@/stores/noticeStore';
import { useWantTypeStore } from '@/stores/wantTypeStore';
import { useUIStore } from '@/stores/uiStore';
import { WantTypeListItem, ExampleDef, WantConfiguration } from '@/types/wantType';
import { useDashboardNav } from '@/hooks/useDashboardNav';
import { useGridCols } from '@/hooks/useGridCols';
import { useRightSidebarExclusivity } from '@/hooks/useRightSidebarExclusivity';
import { WantTypeGrid } from '@/components/dashboard/WantTypeGrid';
import { WantTypeDetailsSidebar } from '@/components/sidebar/WantTypeDetailsSidebar';
import { useAppSidebar } from '@/hooks/useAppSidebar';
import { useAppHeader } from '@/hooks/useAppHeader';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { downloadJSON } from '@/utils/helpers';
import { apiClient } from '@/api/client';
import { useCardOverlayStore, entityCardId } from '@/stores/cardOverlayStore';
import { useNavigate } from 'react-router-dom';
import { useAddWantTypeStore } from '@/stores/addWantTypeStore';

export default function WantTypePage() {
  const navigate = useNavigate();
  const openAddWantType = useAddWantTypeStore(s => s.open);
  const toggleCardOverlay = useCardOverlayStore(s => s.toggleCardOverlay);
  const {
    wantTypes,
    selectedWantType,
    loading,
    error,
    filters,
    fetchWantTypes,
    getWantType,
    setSelectedWantType,
    setFilters,
    clearFilters,
    clearError,
    getCategories,
    getPatterns,
    getFilteredWantTypes,
  } = useWantTypeStore();

  // UI State
  const sidebar = useRightSidebarExclusivity<WantTypeListItem>();
  const [filteredWantTypes, setFilteredWantTypes] = useState<WantTypeListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const gridRef = useRef<HTMLDivElement>(null);
  const cols = useGridCols(gridRef);

  // Notices speak through the robot's bubble (the app-wide RobotCursor), so this
  // page holds no notification state and renders no toast of its own. The wrapper
  // keeps the {message, type} call shape; severity, which a spoken bubble has no
  // colour for, is carried by the ✗ marker — the same convention as elsewhere.
  const setNotification = useCallback((n: { message: string; type: 'success' | 'error' }) => {
    notify(n.type === 'error' ? `✗ ${n.message}` : n.message);
  }, []);

  // Initial load
  useEffect(() => {
    fetchWantTypes();
  }, [fetchWantTypes]);

  // ?focus=<name> — auto-select a want type when opened from picker overlay.
  // Runs once after wantTypes are loaded.
  const focusAppliedRef = useRef(false);
  useEffect(() => {
    if (focusAppliedRef.current) return;
    if (wantTypes.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const focusName = params.get('focus');
    if (!focusName) return;
    const target = wantTypes.find(wt => wt.name === focusName);
    if (!target) return;
    focusAppliedRef.current = true;
    handleViewDetails(target);
    // Scroll the grid card into view after a short delay to let the sidebar render
    setTimeout(() => {
      const el = document.querySelector(`[data-want-type-name="${CSS.escape(focusName)}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantTypes]);

  // Handle view details
  const handleViewDetails = async (wantType: WantTypeListItem) => {
    sidebar.selectItem(wantType);
    await getWantType(wantType.name);
  };

  // Card overlay "Add Want" — open the Dashboard's Add Want form with this type
  // preselected, so parameters are configured before creating (like thing's Add
  // Want), instead of one-shot deploying the first example.
  const handleAddWantFromCard = (wantType: WantTypeListItem) => {
    openAddWantType(wantType.name);
    navigate('/dashboard');
  };

  // Card overlay "Download" — same JSON dump the sidebar button used to do.
  const handleDownloadFromCard = async (wantType: WantTypeListItem) => {
    try {
      const detail = await apiClient.getWantType(wantType.name);
      downloadJSON(`${wantType.name}.json`, detail);
    } catch (error) {
      setNotification({
        message: error instanceof Error ? error.message : 'Failed to download',
        type: 'error',
      });
    }
  };

  // Handle deploy example
  const handleDeployExample = async (example: ExampleDef) => {
    try {
      await apiClient.createWant({
        metadata: example.want.metadata,
        spec: example.want.spec
      });
      setNotification({
        message: `Deployed example: ${example.name}`,
        type: 'success'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to deploy example';
      setNotification({
        message: errorMessage,
        type: 'error'
      });
    }
  };

  // Handle search
  const handleSearch = (term: string) => {
    setSearchQuery(term);
    setFilters({ searchTerm: term });
  };

  const allFilteredWantTypes = getFilteredWantTypes();

  // Sync local state with all filtered want types
  useEffect(() => {
    setFilteredWantTypes(allFilteredWantTypes);
  }, [allFilteredWantTypes]);

  // Keyboard / gamepad navigation — replaces useKeyboardNavigation + useEscapeKey
  const currentWantTypeIndex = selectedWantType
    ? filteredWantTypes.findIndex(wt => wt.name === selectedWantType.metadata.name)
    : -1;

  useDashboardNav({
    itemCount: filteredWantTypes.length,
    currentIndex: currentWantTypeIndex,
    onNavigate: (index) => {
      if (index >= 0 && index < filteredWantTypes.length) {
        handleViewDetails(filteredWantTypes[index]);
      }
    },
    onClose: sidebar.selectedItem
      ? () => {
          sidebar.clearSelection();
          setSelectedWantType(null);
        }
      : undefined,
    // Shift+Enter / gamepad Start opens the focused card's action overlay.
    onContextMenu: () => {
      const current = filteredWantTypes[currentWantTypeIndex];
      if (current) toggleCardOverlay(entityCardId('want-type', current.name));
    },
    enabled: filteredWantTypes.length > 0,
    cols,
  });

  useAppSidebar({
    open: !!selectedWantType,
    title: selectedWantType?.metadata.name ?? '',
    onClose: () => {
      sidebar.clearSelection();
      setSelectedWantType(null);
    },
    // A detail panel opens on its subject's card and takes the host's
    // identity row — one name, one close, in the same place on every page.
    chromeless: true,
    content: selectedWantType ? (
      <WantTypeDetailsSidebar
        wantType={selectedWantType}
        onDeploy={handleAddWantFromCard}
        onDownload={handleDownloadFromCard}
        onDeployExample={handleDeployExample}
      />
    ) : null,
  });

  useAppHeader({
    onCreateWant: () => {},
    title: 'Want Types',
    itemCount: wantTypes.length,
    itemLabel: 'type',
  });

  return (
    <>
      {/* Main content area with sidebar-aware layout */}
      <main className="flex-1 flex overflow-hidden bg-transparent lg:mr-[480px] mr-0">
        {/* Left content area - main dashboard */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-3 sm:p-6 pb-24">
            {/* Error Message */}
            {error && <ErrorBanner message={error} onDismiss={clearError} />}

            {/* Want Types Grid */}
            <WantTypeGrid
              wantTypes={filteredWantTypes}
              selectedWantType={filteredWantTypes.find(wt => wt.name === selectedWantType?.metadata.name) || null}
              onViewDetails={handleViewDetails}
              onDeploy={handleAddWantFromCard}
              onDownload={handleDownloadFromCard}
              loading={loading}
              onGetFilteredWantTypes={setFilteredWantTypes}
              gridRef={gridRef}
            />
          </div>
        </div>
      </main>

      {/* Detail/summary sidebar is rendered by the app-root shell (Layout →
          AppSidebarHost); registered via useAppSidebar above. */}
    </>
  );
}
