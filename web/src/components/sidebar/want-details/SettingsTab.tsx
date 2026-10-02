/** The Settings tab — the want's own YAML, edited as a form or as text. */
import React, { useEffect, useLayoutEffect, useState, useCallback, useMemo, useRef } from 'react';
import { usePanelAtBottom } from '@/hooks/useDisplaySettings';
import { Settings, AlertTriangle, Save, Edit, Check } from 'lucide-react';
import { Want, WhenSpec } from '@/types/want';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorDisplay } from '@/components/common/ErrorDisplay';
import { YamlEditor } from '@/components/forms/YamlEditor';
import { useConfigStore } from '@/stores/configStore';
import { formatDate, formatDuration } from '@/utils/helpers';
import { stringifyYaml } from '@/utils/yaml';
import { updateWantParameters, updateWantScheduling, updateWantLabels, updateWantDependencies } from '@/utils/wantUtils';
import { WantCard } from '@/components/dashboard/WantCard/WantCard';
import { ParameterGridSection } from '@/components/forms/sections/ParameterGridSection';
import { ExposeEntry } from '@/components/forms/sections/ExposeSection';
import { ImportSection } from '@/components/forms/sections/ImportSection';
import { LabelsSection } from '@/components/forms/sections/LabelsSection';
import { DependenciesSection } from '@/components/forms/sections/DependenciesSection';
import { SchedulingSection } from '@/components/forms/sections/SchedulingSection';
import { apiClient } from '@/api/client';
import {
  DetailsSidebar,
  TabContent,
  TabSection,
  TabGrid,
  EmptyState,
  InfoRow,
  TabConfig
} from '../DetailsSidebar';
import { useCardGridNavigation } from '@/hooks/useCardGridNavigation';
import { FormTab, FormTabBar, SETTINGS_FORM_TABS } from '@/components/forms/FormTabBar';

import { SECTION_CONTAINER_CLASS } from './shared';


// Tab Components
export const SettingsTab: React.FC<{
  want: Want;
  isEditing: boolean;
  editedConfig: string;
  updateLoading: boolean;
  updateError: string | null;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onConfigChange: (value: string) => void;
  onWantUpdate?: () => void;
  updateWant: (id: string, request: any) => Promise<void>;
  /** Sub-tab controlled by the parent (WantDetailsSidebar) common sub-tab (B+L1/R1) handler */
  activeSettingsTab: FormTab;
  setActiveSettingsTab: (tab: FormTab) => void;
  /** Whether user is in detail-focus mode (L1/R1 or B+L1/R1 or card click) */
  sidebarDetailFocused: boolean;
  onDetailFocusEnter: () => void;
  /** Increments on every L1/R1 / B+L1/R1 press — forwarded to useCardGridNavigation for auto-focus */
  focusRequest?: number;
}> = ({
  want,
  isEditing,
  editedConfig,
  updateLoading,
  updateError,
  onEdit,
  onSave,
  onCancel,
  onConfigChange,
  onWantUpdate,
  updateWant,
  activeSettingsTab,
  setActiveSettingsTab,
  sidebarDetailFocused,
  onDetailFocusEnter,
  focusRequest,
}) => {
  const [localUpdateLoading, setLocalUpdateLoading] = useState(false);
  const [localUpdateError, setLocalUpdateError] = useState<string | null>(null);

  // F: Inline name editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(want.metadata?.name || '');
  const nameInputRef = useRef<HTMLInputElement>(null);

  // G: Saved indicator
  const [savedIndicator, setSavedIndicator] = useState(false);
  const showSaved = useCallback(() => {
    setSavedIndicator(true);
    setTimeout(() => setSavedIndicator(false), 1500);
  }, []);

  // activeSettingsTab / setActiveSettingsTab are now received as props — controlled
  // by WantDetailsSidebar so the common sub-tab (B+L1/R1) handler can drive all sub-tabs.

  const config = useConfigStore(state => state.config);
  const isBottom = usePanelAtBottom();

  // Section collapsed states (kept for compatibility, not used when hideHeader=true)
  const [isParametersCollapsed, setIsParametersCollapsed] = useState(true);
  const [isLabelsCollapsed, setIsLabelsCollapsed] = useState(true);
  const [isDependenciesCollapsed, setIsDependenciesCollapsed] = useState(true);
  const [isSchedulingCollapsed, setIsSchedulingCollapsed] = useState(true);

  // Section editing states to prevent polling from overwriting user input
  const [isEditingParameters, setIsEditingParameters] = useState(false);
  const [isEditingLabels, setIsEditingLabels] = useState(false);
  const [isEditingDependencies, setIsEditingDependencies] = useState(false);
  const [isEditingScheduling, setIsEditingScheduling] = useState(false);

  // Want type full definition for ParameterGridSection
  const [wantTypeDef, setWantTypeDef] = useState<import('@/types/wantType').WantTypeDetailResponse | null>(null);
  useEffect(() => {
    const typeName = want.metadata?.type;
    if (!typeName) { setWantTypeDef(null); return; }
    apiClient.getWantType(typeName).then(def => setWantTypeDef(def)).catch(() => setWantTypeDef(null));
  }, [want.metadata?.type]);

  // Global state keys — fetched once to power the ImportSection datalist
  const [globalStateKeys, setGlobalStateKeys] = useState<string[]>([]);
  useEffect(() => {
    fetch('/api/v1/global-state')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.state) setGlobalStateKeys(Object.keys(data.state));
      })
      .catch(() => {/* ignore */});
  }, []);

  // Form data states
  const [params, setParams] = useState<Record<string, unknown>>(want.spec?.params || {});
  const [labels, setLabels] = useState<Record<string, string>>(want.metadata?.labels || {});
  const [using, setUsing] = useState<Array<Record<string, string>>>(want.spec?.using || []);
  const [when, setWhen] = useState<WhenSpec[]>(want.spec?.when || []);
  const [exposes, setExposes] = useState<ExposeEntry[]>(want.spec?.exposes || []);
  const [imports, setImports] = useState<Record<string, string>>(want.spec?.imports || {});

  // Section refs for keyboard navigation
  const paramsSectionRef = useRef<HTMLButtonElement>(null);
  const labelsSectionRef = useRef<HTMLButtonElement>(null);
  const dependenciesSectionRef = useRef<HTMLButtonElement>(null);
  const schedulingSectionRef = useRef<HTMLButtonElement>(null);

  // Handler for parameter changes - saves to API
  const handleParametersChange = useCallback(async (newParams: Record<string, any>) => {
    if (!want.metadata?.id) return;

    const oldParams = params;
    setParams(newParams);
    setIsEditingParameters(true);

    try {
      await updateWantParameters(want.metadata.id, want, newParams, updateWant);
      onWantUpdate?.();
      showSaved();
    } catch (error) {
      setLocalUpdateError(error instanceof Error ? error.message : 'Failed to update parameters');
      setParams(oldParams); // Revert on error
    } finally {
      setIsEditingParameters(false);
    }
  }, [want, params, updateWant, onWantUpdate]);

  // Handler for expose changes - saves to API
  const handleExposesChange = useCallback(async (newExposes: ExposeEntry[]) => {
    if (!want.metadata?.id) return;
    const oldExposes = exposes;
    setExposes(newExposes);
    try {
      await updateWant(want.metadata.id, {
        metadata: want.metadata,
        spec: { ...want.spec, exposes: newExposes },
      });
      onWantUpdate?.();
      showSaved();
    } catch (error) {
      setLocalUpdateError(error instanceof Error ? error.message : 'Failed to update exposes');
      setExposes(oldExposes);
    }
  }, [want, exposes, updateWant, onWantUpdate]);

  // Handler for import changes - saves to API
  const handleImportsChange = useCallback(async (newImports: Record<string, string>) => {
    if (!want.metadata?.id) return;
    const oldImports = imports;
    setImports(newImports);
    try {
      await updateWant(want.metadata.id, {
        metadata: want.metadata,
        spec: { ...want.spec, imports: newImports },
      });
      onWantUpdate?.();
      showSaved();
    } catch (error) {
      setLocalUpdateError(error instanceof Error ? error.message : 'Failed to update imports');
      setImports(oldImports);
    }
  }, [want, imports, updateWant, onWantUpdate]);

  // Handler for label changes - saves to API
  const handleLabelsChange = useCallback(async (newLabels: Record<string, string>) => {
    if (!want.metadata?.id) return;

    const oldLabels = labels;
    setLabels(newLabels);
    setIsEditingLabels(true);

    try {
      await updateWantLabels(want.metadata.id, oldLabels, newLabels);
      onWantUpdate?.();
      showSaved();
    } catch (error) {
      setLocalUpdateError(error instanceof Error ? error.message : 'Failed to update labels');
      setLabels(oldLabels); // Revert on error
    } finally {
      setIsEditingLabels(false);
    }
  }, [want.metadata?.id, labels, onWantUpdate]);

  // Handler for dependency changes - saves to API
  const handleDependenciesChange = useCallback(async (newUsing: Array<Record<string, string>>) => {
    if (!want.metadata?.id) return;

    const oldUsing = using;
    setUsing(newUsing);
    setIsEditingDependencies(true);

    try {
      await updateWantDependencies(want.metadata.id, oldUsing, newUsing);
      onWantUpdate?.();
      showSaved();
    } catch (error) {
      setLocalUpdateError(error instanceof Error ? error.message : 'Failed to update dependencies');
      setUsing(oldUsing); // Revert on error
    } finally {
      setIsEditingDependencies(false);
    }
  }, [want.metadata?.id, using, onWantUpdate]);

  // Handler for scheduling changes - saves to API
  const handleSchedulingChange = useCallback(async (newWhen: WhenSpec[]) => {
    if (!want.metadata?.id) return;

    const oldWhen = when;
    setWhen(newWhen);
    setIsEditingScheduling(true);

    try {
      await updateWantScheduling(want.metadata.id, want, newWhen, updateWant);
      onWantUpdate?.();
      showSaved();
    } catch (error) {
      setLocalUpdateError(error instanceof Error ? error.message : 'Failed to update scheduling');
      setWhen(oldWhen); // Revert on error
    } finally {
      setIsEditingScheduling(false);
    }
  }, [want, when, updateWant, onWantUpdate]);

  // Handle arrow key navigation for form fields based on DOM order
  const handleArrowKeyNavigation = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;

    // Find the closest container that holds all sections
    const currentTarget = e.currentTarget || (e as any).target;
    const container = currentTarget?.closest('.focusable-container');
    if (!container) return;

    const focusableElements = Array.from(container.querySelectorAll('.focusable-section-header')) as HTMLElement[];
    const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement);

    if (currentIndex === -1) {
      if (e.key === 'ArrowDown' && focusableElements.length > 0) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        focusableElements[0].focus();
      }
      return;
    }

    if (e.key === 'ArrowDown' && currentIndex < focusableElements.length - 1) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      focusableElements[currentIndex + 1].focus();
    } else if (e.key === 'ArrowUp' && currentIndex > 0) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      focusableElements[currentIndex - 1].focus();
    }
  }, []);

  // Re-read the want's own fields whenever they actually change.
  //
  // Keyed on the values, not on a version stamp: this used to watch
  // metadata.updatedAt, which the engine always reports as 0, so the signal
  // never arrived and the form kept showing whatever the want held when it was
  // selected. Anything that changed a param elsewhere — the card's from/to
  // swap, another session, an agent — was invisible here until you switched
  // wants and back. The values are the fact; a stamp nobody maintains is not.
  //
  // Fields being edited are still left alone, so nothing typed is overwritten.
  const paramsKey = JSON.stringify(want.spec?.params ?? {});
  const labelsKey = JSON.stringify(want.metadata?.labels ?? {});
  const usingKey  = JSON.stringify(want.spec?.using ?? []);
  const whenKey   = JSON.stringify(want.spec?.when ?? []);
  useEffect(() => {
    if (!isEditingParameters) setParams(want.spec?.params || {});
    if (!isEditingLabels) setLabels(want.metadata?.labels || {});
    if (!isEditingDependencies) setUsing(want.spec?.using || []);
    if (!isEditingScheduling) setWhen(want.spec?.when || []);
    setExposes(want.spec?.exposes || []);
    setImports(want.spec?.imports || {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want.metadata?.id, paramsKey, labelsKey, usingKey, whenKey,
      isEditingParameters, isEditingLabels, isEditingDependencies, isEditingScheduling]);

  // Reset all states when switching to a different want
  // Note: activeSettingsTab is reset by WantDetailsSidebar's wantId effect.
  useEffect(() => {
    setIsEditingParameters(false);
    setIsEditingLabels(false);
    setIsEditingDependencies(false);
    setIsEditingScheduling(false);
    setIsParametersCollapsed(true);
    setIsLabelsCollapsed(true);
    setIsDependenciesCollapsed(true);
    setIsSchedulingCollapsed(true);
    setIsEditingName(false);
    setEditedName(want.metadata?.name || '');
  }, [want.metadata?.id]);

  return (
    <div className="h-full flex flex-col relative">
      {/* G: Saved indicator — absolute overlay, takes no layout space */}
      {savedIndicator && (
        <div className="absolute top-0.5 right-2 z-20 flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400 bg-white/90 dark:bg-gray-800/90 rounded px-1.5 py-0.5 pointer-events-none">
          <Check className="w-2.5 h-2.5" />
          <span>Saved</span>
        </div>
      )}

      {/* Sub-tab bar at TOP when !isBottom */}
      {!isBottom && (
        <FormTabBar
          activeTab={activeSettingsTab}
          onTabChange={setActiveSettingsTab}
          tabs={SETTINGS_FORM_TABS}
          badges={{
            name:     null,
            params:   Object.keys(params).length || null,
            labels:   Object.keys(labels).length || null,
            schedule: when.length || null,
            deps:     using.length || null,
            yaml:     null,
          }}
          isBottom={false}
        />
      )}

      {/* Form content area (all non-yaml tabs) */}
      {activeSettingsTab !== 'yaml' && (
      <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 focusable-container">
          <>
            {/* NAME / METADATA tab: metadata + timeline */}
            {activeSettingsTab === 'name' && (
          <div className="space-y-3 pt-1">
            {/* Metadata Section */}
            <div className={SECTION_CONTAINER_CLASS}>
              <h4 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white mb-2 sm:mb-4">Metadata</h4>
              <div className="space-y-2 sm:space-y-3">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm flex-shrink-0">Name:</span>
                  {isEditingName ? (
                    <input
                      ref={nameInputRef}
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      onBlur={async () => {
                        const trimmed = editedName.trim();
                        if (trimmed && trimmed !== want.metadata?.name && want.metadata?.id) {
                          try {
                            await updateWant(want.metadata.id, {
                              metadata: { ...want.metadata, name: trimmed },
                              spec: want.spec
                            });
                            onWantUpdate?.();
                            showSaved();
                          } catch {
                            setEditedName(want.metadata?.name || '');
                          }
                        }
                        setIsEditingName(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') nameInputRef.current?.blur();
                        if (e.key === 'Escape') { setEditedName(want.metadata?.name || ''); setIsEditingName(false); }
                      }}
                      autoFocus
                      className="font-medium text-xs sm:text-sm bg-white dark:bg-gray-800 border border-blue-400 dark:border-blue-500 rounded px-1.5 py-0.5 text-right min-w-0 flex-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  ) : (
                    <span
                      onClick={() => { setEditedName(want.metadata?.name || ''); setIsEditingName(true); }}
                      className="font-medium text-xs sm:text-sm cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 rounded px-1.5 py-0.5 -mr-1.5 transition-colors truncate"
                      title="Click to edit"
                    >
                      {want.metadata?.name || 'N/A'}
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm">Type:</span>
                  <span className="font-medium text-xs sm:text-sm">{want.metadata?.type || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm">ID:</span>
                  <span className="font-mono text-[10px] sm:text-xs break-all ml-4 text-right">{want.metadata?.id || want.id || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Timeline */}
            {want.stats && (
              <div className={SECTION_CONTAINER_CLASS}>
                <h4 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white mb-2 sm:mb-4">Timeline</h4>
                <div className="space-y-2 sm:space-y-3">
                  {want.stats.created_at && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm">Created:</span>
                      <span className="text-xs sm:text-sm">{formatDate(want.stats.created_at)}</span>
                    </div>
                  )}
                  {want.stats.started_at && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm">Started:</span>
                      <span className="text-xs sm:text-sm">{formatDate(want.stats.started_at)}</span>
                    </div>
                  )}
                  {want.stats.completed_at && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm">Achieved:</span>
                      <span className="text-xs sm:text-sm">{formatDate(want.stats.completed_at)}</span>
                    </div>
                  )}
                  {want.stats.started_at && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm">Duration:</span>
                      <span className="text-xs sm:text-sm">{formatDuration(want.stats.started_at, want.stats.completed_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error Information */}
            {want.status === 'failed' && want.state?.current?.error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 mr-3 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-base font-medium text-red-800 dark:text-red-300 mb-3">Error Details</h4>
                    <p className="text-sm text-red-600 dark:text-red-400 break-words leading-relaxed">
                      {typeof want.state.current.error === 'string' ? want.state.current.error : JSON.stringify(want.state.current.error)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
            )}

            {/* PARAMS tab */}
            {activeSettingsTab === 'params' && (
              <div className="pt-1">
                <ParameterGridSection
                  parameters={params}
                  parameterDefinitions={wantTypeDef?.parameters}
                  stateDefs={wantTypeDef?.state}
                  onChange={handleParametersChange}
                  // Showing is not the same as being handed the keys, which is
                  // the condition every other section here uses (see LABELS
                  // below). Without it the parameter grid activated the moment
                  // the panel appeared, and an active grid focuses itself — so
                  // simply landing on a tile took the input off the board and
                  // put it in the panel, when landing is only meant to bring
                  // the panel alongside.
                  isActive={activeSettingsTab === 'params' && sidebarDetailFocused}
                  sidebarDetailFocused={sidebarDetailFocused}
                  focusRequest={focusRequest}
                  onDetailFocusEnter={onDetailFocusEnter}
                />
              </div>
            )}

            {/* LABELS tab */}
            {activeSettingsTab === 'labels' && (
              <LabelsSection
                ref={labelsSectionRef}
                labels={labels}
                onChange={handleLabelsChange}
                isCollapsed={false}
                onToggleCollapse={() => {}}
                hideHeader={true}
                isActive={activeSettingsTab === 'labels' && sidebarDetailFocused}
                navigationCallbacks={{
                  onNavigateUp: (e) => e && handleArrowKeyNavigation(e),
                  onNavigateDown: (e) => e && handleArrowKeyNavigation(e),
                }}
              />
            )}

            {/* SCHEDULE tab */}
            {activeSettingsTab === 'schedule' && (
              <SchedulingSection
                ref={schedulingSectionRef}
                schedules={when}
                onChange={handleSchedulingChange}
                isCollapsed={false}
                onToggleCollapse={() => {}}
                hideHeader={true}
                navigationCallbacks={{
                  onNavigateUp: (e) => e && handleArrowKeyNavigation(e),
                  onNavigateDown: (e) => e && handleArrowKeyNavigation(e),
                }}
              />
            )}

            {/* DEPS tab */}
            {activeSettingsTab === 'deps' && (
              <DependenciesSection
                ref={dependenciesSectionRef}
                dependencies={using}
                onChange={handleDependenciesChange}
                isCollapsed={false}
                onToggleCollapse={() => {}}
                hideHeader={true}
                navigationCallbacks={{
                  onNavigateUp: (e) => e && handleArrowKeyNavigation(e),
                  onNavigateDown: (e) => e && handleArrowKeyNavigation(e),
                }}
              />
            )}

          </>
      </div>
      )}

      {/* YAML sub-tab content */}
      {activeSettingsTab === 'yaml' && (
        <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4">
          <div className="flex flex-col h-full">
            {!isEditing ? (
              <div className="flex flex-col flex-1">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">Configuration</h4>
                  <button
                    onClick={onEdit}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 shadow-sm text-xs font-medium rounded text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </button>
                </div>
                <div className="flex-1">
                  <YamlEditor
                    value={stringifyYaml({
                      metadata: want.metadata,
                      spec: want.spec
                    })}
                    onChange={() => {}}
                    readOnly={true}
                    height="100%"
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col flex-1">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">Edit Configuration</h4>
                  <div className="flex space-x-2">
                    <button
                      onClick={onCancel}
                      disabled={updateLoading}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 shadow-sm text-xs font-medium rounded text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={onSave}
                      disabled={updateLoading}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent shadow-sm text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {updateLoading ? (
                        <LoadingSpinner size="sm" className="mr-1" />
                      ) : (
                        <Save className="h-3 w-3 mr-1" />
                      )}
                      Save
                    </button>
                  </div>
                </div>

                {updateError && (
                  <div className="mb-4">
                    <ErrorDisplay error={updateError} />
                  </div>
                )}

                <div className="flex-1">
                  <YamlEditor
                    value={editedConfig}
                    onChange={onConfigChange}
                    readOnly={updateLoading}
                    height="100%"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub-tab bar at BOTTOM when isBottom */}
      {isBottom && (
        <FormTabBar
          activeTab={activeSettingsTab}
          onTabChange={setActiveSettingsTab}
          tabs={SETTINGS_FORM_TABS}
          badges={{
            name:     null,
            params:   Object.keys(params).length || null,
            labels:   Object.keys(labels).length || null,
            schedule: when.length || null,
            deps:     using.length || null,
            yaml:     null,
          }}
          isBottom={true}
        />
      )}
    </div>
  );
};
