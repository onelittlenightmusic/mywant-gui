import React, { useState, useEffect, useRef } from 'react';
import { AgentResponse } from '@/types/agent';
import { useAgentStore } from '@/stores/agentStore';
import { useUIStore } from '@/stores/uiStore';

import { classNames } from '@/utils/helpers';
import { useDashboardNav } from '@/hooks/useDashboardNav';
import { useGridCols } from '@/hooks/useGridCols';
import { useRightSidebarExclusivity } from '@/hooks/useRightSidebarExclusivity';

// Components
import { useAppHeader } from '@/hooks/useAppHeader';
import { useAppSidebar } from '@/hooks/useAppSidebar';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { AgentGrid } from '@/components/dashboard/AgentGrid';
import { AgentDetailsSidebar } from '@/components/sidebar/AgentDetailsSidebar';
import { ConfirmDeleteModal } from '@/components/modals/ConfirmDeleteModal';
import { useCardOverlayStore, entityCardId } from '@/stores/cardOverlayStore';

export const AgentsPage: React.FC = () => {
  const toggleCardOverlay = useCardOverlayStore(s => s.toggleCardOverlay);
  const {
    agents,
    loading,
    error,
    fetchAgents,
    deleteAgent,
    clearError
  } = useAgentStore();

  // UI State
  const sidebar = useRightSidebarExclusivity<AgentResponse>();
  const [editingAgent, setEditingAgent] = useState<AgentResponse | null>(null);
  const [deleteAgentState, setDeleteAgentState] = useState<AgentResponse | null>(null);
  const [filteredAgents, setFilteredAgents] = useState<AgentResponse[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);
  const cols = useGridCols(gridRef);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilters, setTypeFilters] = useState<('do' | 'monitor' | 'think')[]>([]);

  // Load initial data
  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // Clear errors after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  // Handlers
  const handleCreateAgent = () => {
    setEditingAgent(null);
    sidebar.openForm();
  };

  const handleEditAgent = (agent: AgentResponse) => {
    setEditingAgent(agent);
    sidebar.openForm();
  };

  const handleViewAgent = (agent: AgentResponse) => {
    sidebar.selectItem(agent);
  };

  const handleDeleteAgentConfirm = async () => {
    if (deleteAgentState) {
      try {
        await deleteAgent(deleteAgentState.name);
        setDeleteAgentState(null);
      } catch (error) {
        console.error('Failed to delete agent:', error);
      }
    }
  };

  const handleCloseModals = () => {
    sidebar.closeForm();
    setEditingAgent(null);
    setDeleteAgentState(null);
  };

  // Keyboard / gamepad navigation — sound + ESC integrated
  const currentAgentIndex = sidebar.selectedItem
    ? filteredAgents.findIndex(agent => agent.name === sidebar.selectedItem?.name)
    : -1;

  useDashboardNav({
    itemCount: filteredAgents.length,
    currentIndex: currentAgentIndex,
    onNavigate: (index) => {
      if (filteredAgents[index]) {
        sidebar.selectItem(filteredAgents[index]);
      }
    },
    onClose: sidebar.selectedItem
      ? () => sidebar.clearSelection()
      : undefined,
    // Shift+Enter / gamepad Start opens the focused card's action overlay.
    onContextMenu: () => {
      const current = sidebar.selectedItem;
      if (current) toggleCardOverlay(entityCardId('agent', current.name || 'Unnamed Agent'));
    },
    enabled: !sidebar.showForm && filteredAgents.length > 0,
    cols,
  });

  // Stats calculation
  const stats = {
    total: agents.length,
    doAgents: agents.filter(a => a.type === 'do').length,
    monitorAgents: agents.filter(a => a.type === 'monitor').length,
    totalCapabilities: agents.reduce((acc, agent) => acc + agent.capabilities.length, 0)
  };

  useAppSidebar({
    open: !!sidebar.selectedItem,
    title: sidebar.selectedItem?.name ?? '',
    onClose: () => sidebar.clearSelection(),
    // A detail panel opens on its subject's card and takes the host's
    // identity row — one name, one close, in the same place on every page.
    chromeless: true,
    content: sidebar.selectedItem ? (
      <AgentDetailsSidebar
        agent={sidebar.selectedItem}
        onEdit={handleEditAgent}
        onDelete={setDeleteAgentState}
      />
    ) : null,
  });

  useAppHeader({
    onCreateWant: handleCreateAgent,
    title: 'Agents',
    createButtonLabel: 'Add Agent',
    itemCount: agents.length,
    itemLabel: 'agent',
  });

  return (
    <>
      {/* Main content area with sidebar-aware layout */}
      <main className="flex-1 flex overflow-hidden bg-transparent lg:mr-[480px] mr-0">
        {/* Left content area - main dashboard */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-3 sm:p-6 pb-24">
            {/* Error message */}
            {error && <ErrorBanner message={error} onDismiss={clearError} />}

            {/* Agent Grid */}
            <AgentGrid
              agents={agents}
              loading={loading}
              searchQuery={searchQuery}
              typeFilters={typeFilters}
              selectedAgent={sidebar.selectedItem}
              onViewAgent={handleViewAgent}
              onEditAgent={handleEditAgent}
              onDeleteAgent={setDeleteAgentState}
              onGetFilteredAgents={setFilteredAgents}
              gridRef={gridRef}
            />
          </div>
        </div>
      </main>

      {/* Detail/summary sidebar is rendered by the app-root shell (Layout →
          AppSidebarHost); registered via useAppSidebar above. */}

      {/* Modals */}
      <ConfirmDeleteModal
        isOpen={!!deleteAgentState}
        onClose={handleCloseModals}
        onConfirm={handleDeleteAgentConfirm}
        want={null}
        loading={loading}
        title="Delete Agent"
        message={`Are you sure you want to delete the agent "${deleteAgentState?.name}"? This action cannot be undone.`}
      />
    </>
  );
};