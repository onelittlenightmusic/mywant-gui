import React, { useEffect, useRef, useState } from 'react';
import { Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWorldStore } from '@/stores/worldStore';
import { WorldSummary } from '@/types/world';
import { apiClient } from '@/api/client';
import { useAppHeader } from '@/hooks/useAppHeader';
import { useAppSidebar } from '@/hooks/useAppSidebar';
import { useDashboardNav } from '@/hooks/useDashboardNav';
import { useGridCols } from '@/hooks/useGridCols';
import { useRightSidebarExclusivity } from '@/hooks/useRightSidebarExclusivity';
import { WorldGrid } from '@/components/dashboard/WorldGrid';
import { WorldDetailsSidebar } from '@/components/sidebar/WorldDetailsSidebar';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { useCardOverlayStore, entityCardId } from '@/stores/cardOverlayStore';
import { useGuiStateFlushStore } from '@/stores/guiStateFlushStore';

export default function WorldsPage() {
  const toggleCardOverlay = useCardOverlayStore(s => s.toggleCardOverlay);
  const { worlds, loading, error, fetchWorlds } = useWorldStore();
  const [openingName, setOpeningName] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [exportingName, setExportingName] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // UI State — mirrors the want dashboard: grid focus drives the details sidebar
  const sidebar = useRightSidebarExclusivity<WorldSummary>();
  const gridRef = useRef<HTMLDivElement>(null);
  const cols = useGridCols(gridRef);

  useEffect(() => {
    fetchWorlds();
  }, [fetchWorlds]);

  // Creating a world is just opening a name that has no snapshot yet: the server
  // auto-saves the current wants under the outgoing world's name (or "default"),
  // clears them, and starts the new name empty. So there is no separate create
  // endpoint to call — see openWorld in handlers_worlds.go.
  const handleCreate = async () => {
    const name = window.prompt('New world name')?.trim();
    if (!name) return;
    if (worlds.some(w => w.name === name)) {
      setOpenError(`World "${name}" already exists — open it from its card instead.`);
      return;
    }
    setOpeningName(name);
    setOpenError(null);
    try {
      await apiClient.openWorld(name);
      navigate('/dashboard');
    } catch (err) {
      setOpenError(err instanceof Error ? err.message : `Failed to create world "${name}"`);
      setOpeningName(null);
    }
  };

  const handleOpen = async (world: WorldSummary) => {
    if (openingName) return;
    setOpeningName(world.name);
    setOpenError(null);
    try {
      // Same flush the world card does — the outgoing world is snapshotted
      // during the switch, and the dashboard's position write is debounced.
      await useGuiStateFlushStore.getState().flush?.();
      await apiClient.openWorld(world.name);
      navigate('/dashboard');
    } catch (err) {
      setOpenError(err instanceof Error ? err.message : `Failed to open world "${world.name}"`);
      setOpeningName(null);
    }
  };

  // Export downloads the world's snapshot YAML; the server re-snapshots the
  // current world first so a live edit isn't lost.
  const handleExport = async (world: WorldSummary) => {
    if (exportingName) return;
    setExportingName(world.name);
    setOpenError(null);
    try {
      const { blob, filename } = await apiClient.exportWorld(world.name);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setOpenError(err instanceof Error ? err.message : `Failed to export world "${world.name}"`);
    } finally {
      setExportingName(null);
    }
  };

  // Import stores an uploaded wants YAML as a new world (named after the file)
  // without opening it — the user opens it from its card when ready.
  const handleImportFile = async (file: File) => {
    const defaultName = file.name.replace(/\.(yaml|yml)$/i, '');
    const name = window.prompt('World name', defaultName)?.trim();
    if (!name) return;

    setIsImporting(true);
    setOpenError(null);
    try {
      const yaml = await file.text();
      try {
        await apiClient.importWorld(name, yaml);
      } catch (err: any) {
        if (err?.response?.status !== 409) throw err;
        if (!window.confirm(`World "${name}" already exists. Overwrite it?`)) return;
        await apiClient.importWorld(name, yaml, true);
      }
      await fetchWorlds();
    } catch (err) {
      setOpenError(err instanceof Error ? err.message : `Failed to import world "${name}"`);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && /\.(yaml|yml)$/i.test(file.name)) handleImportFile(file);
  };

  // Keep the selected world in sync with freshly fetched data
  const selectedWorld = sidebar.selectedItem
    ? worlds.find(w => w.name === sidebar.selectedItem?.name) ?? sidebar.selectedItem
    : null;

  // Keyboard / gamepad (CursorMan) navigation — same hook the want dashboard uses
  const currentIndex = selectedWorld
    ? worlds.findIndex(w => w.name === selectedWorld.name)
    : -1;

  useDashboardNav({
    itemCount: worlds.length,
    currentIndex,
    onNavigate: (index) => {
      if (worlds[index]) sidebar.selectItem(worlds[index]);
    },
    onClose: selectedWorld ? () => sidebar.clearSelection() : undefined,
    // Shift+Enter / gamepad Start opens the focused card's action overlay —
    // Open and Refresh live there rather than in the sidebar.
    onContextMenu: () => {
      if (selectedWorld) toggleCardOverlay(entityCardId('world', selectedWorld.name));
    },
    enabled: worlds.length > 0,
    cols,
  });

  useAppSidebar({
    open: !!selectedWorld,
    title: selectedWorld?.name ?? '',
    onClose: () => sidebar.clearSelection(),
    // A detail panel opens on its subject's card and takes the host's
    // identity row — one name, one close, in the same place on every page.
    chromeless: true,
    content: selectedWorld ? (
      <WorldDetailsSidebar
        world={selectedWorld}
        onRefresh={fetchWorlds}
        onOpen={handleOpen}
        onExport={handleExport}
        opening={openingName === selectedWorld.name}
        exporting={exportingName === selectedWorld.name}
        busy={!!openingName}
      />
    ) : null,
  });

  useAppHeader({
    onCreateWant: handleCreate,
    createButtonLabel: 'New World',
    createButtonIcon: Globe,
    title: 'Worlds',
    itemCount: worlds.length,
    itemLabel: 'world',
    onImport: () => fileInputRef.current?.click(),
    isImporting,
  });

  return (
    <main className="flex-1 flex overflow-hidden bg-transparent lg:mr-[480px] mr-0">
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 sm:p-6 pb-24">
          {error && <ErrorBanner message={error} onDismiss={() => {}} />}
          {openError && <ErrorBanner message={openError} onDismiss={() => setOpenError(null)} />}

          <WorldGrid
            worlds={worlds}
            selectedWorld={selectedWorld}
            onViewWorld={sidebar.selectItem}
            onOpenWorld={handleOpen}
            onRefresh={fetchWorlds}
            onExportWorld={handleExport}
            loading={loading}
            openingName={openingName}
            exportingName={exportingName}
            gridRef={gridRef}
          />

          <input
            ref={fileInputRef}
            type="file"
            accept=".yaml,.yml"
            onChange={handleFileInputChange}
            className="hidden"
          />
        </div>
      </div>
    </main>
  );
}
