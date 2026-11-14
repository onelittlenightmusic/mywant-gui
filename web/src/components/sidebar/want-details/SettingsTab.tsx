/** The Settings tab — the want's own YAML, edited as a form or as text. */
import React, { useEffect, useLayoutEffect, useState, useCallback, useMemo, useRef } from 'react';
import { usePanelAtBottom } from '@/hooks/useDisplaySettings';
import { classNames } from '@/utils/helpers';
import { FIELD_CARD_SURFACE, FIELD_CARD_LABEL } from '@/design/cards';
import { Settings, AlertTriangle, Save, Edit, Check } from 'lucide-react';
import { Want, WhenSpec } from '@/types/want';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorDisplay } from '@/components/common/ErrorDisplay';
import { YamlEditor } from '@/components/forms/YamlEditor';
import { MountWhenNear } from '@/components/common/MountWhenNear';
import { useConfigStore } from '@/stores/configStore';
import { formatDate, formatDuration } from '@/utils/helpers';
import { stringifyYaml } from '@/utils/yaml';
import { updateWantParameters, updateWantScheduling, updateWantLabels, updateWantDependencies } from '@/utils/wantUtils';
import { useWantStore } from '@/stores/wantStore';
import { WantCard } from '@/components/dashboard/WantCard/WantCard';
import { ParameterGridSection } from '@/components/forms/sections/ParameterGridSection';
import { ExposeEntry } from '@/components/forms/sections/ExposeSection';
import { ImportSection } from '@/components/forms/sections/ImportSection';
import { LabelsSection } from '@/components/forms/sections/LabelsSection';
import { playSound } from '@/utils/sounds';
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
import { FORM_TAB_META, FormTab, SETTINGS_FORM_TABS } from '@/components/forms/FormTabBar';
import { CountBadge } from '@/components/common/CountBadge';
import { TimingsSection } from './TimingsSection';
import { ArtMaker } from '@/components/sidebar/ArtMaker';
import { artOf, artContextOf } from '@/lib/art';

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
  /** Up from the top of a sub-tab: back to the panel's card, the step above
   *  every field (as the Results tab's fields go back to it). */
  onBackToCard?: () => void;
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
  onBackToCard,
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
  const [wantTypeDef, setWantTypeDef] = useState<import('@/types/wantType').WantTypeDetailResponse | null>(
    // Already read (landing on the want reads it), so the first draw has it.
    () => (want.metadata?.type && apiClient.cachedWantType(want.metadata.type)) || null);
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
      await updateWantParameters(want.metadata.id, want, newParams, useWantStore.getState().updateWantFields);
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
  /**
   * Off the bottom (or top) of one section's cards, onto the next (or the one
   * before), in the order they are drawn — parameters, labels, schedule,
   * dependencies: the sections whose cards the keys walk (timing, the name and
   * the YAML have none, and landing there left the keys nowhere) — and off the
   * top of the first back to the card.
   * A grid that kept the key at its last row left the keys and the pad on the
   * parameters with nowhere to go: the labels under them could not be reached.
   */
  // Which way the keys came into the section now active: from above (its
  // first card) or from below (its last row) — see useCardGridNavigation's entry.
  const [enteredFrom, setEnteredFrom] = useState<'top' | 'bottom' | undefined>(undefined);
  // The keys gone back to the card (or out of the panel): the next way in is
  // from the card, at the top, as it always was.
  useEffect(() => { if (!sidebarDetailFocused) setEnteredFrom(undefined); }, [sidebarDetailFocused]);
  const goSection = useCallback((from: FormTab, dir: 1 | -1) => {
    const walked: FormTab[] = ['params', 'labels', 'schedule', 'deps'];
    const shown = SETTINGS_FORM_TABS.filter(t => walked.includes(t));
    const to = shown[shown.indexOf(from) + dir];
    if (to) { playSound('gridMove'); setEnteredFrom(dir > 0 ? 'top' : 'bottom'); setActiveSettingsTab(to); }
    else if (dir < 0) onBackToCard?.();
  }, [setActiveSettingsTab, onBackToCard]);

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
    } else if (e.key === 'ArrowUp' && currentIndex === 0 && onBackToCard) {
      // The top section: up goes back to the card above them all.
      if (typeof e.preventDefault === 'function') e.preventDefault();
      onBackToCard();
    }
  }, [onBackToCard]);

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

  // The section with the keys, brought into view when it is moved to (B +
  // L1/R1, the robot) — not when a press inside it made it so, which would
  // jump the scroll under the pointer.
  const scrollRef = useRef<HTMLDivElement>(null);
  const pressedRef = useRef(false);
  useEffect(() => {
    if (pressedRef.current) { pressedRef.current = false; return; }
    const box = scrollRef.current;
    const el = box?.querySelector<HTMLElement>(`[data-settings-section="${activeSettingsTab}"]`);
    if (!box || !el) return;
    box.scrollTo({ top: el.offsetTop - box.offsetTop - 4, behavior: 'smooth' });
  }, [activeSettingsTab]);

  const counts: Partial<Record<FormTab, number>> = {
    params: Object.keys(params).length,
    labels: Object.keys(labels).length,
    schedule: when.length,
    deps: using.length,
  };
  const section = (tab: FormTab, body: React.ReactNode) => {
    const { label, icon: Icon } = FORM_TAB_META[tab];
    const active = activeSettingsTab === tab && sidebarDetailFocused;
    const count = counts[tab];
    return (
      <section
        key={tab}
        data-settings-section={tab}
        onPointerDownCapture={() => {
          if (activeSettingsTab !== tab) { pressedRef.current = true; setActiveSettingsTab(tab); }
        }}
        // In the sub-tabs' order (what B + L1/R1 walks), whatever the order here.
        style={{ order: SETTINGS_FORM_TABS.indexOf(tab) }}
        className={classNames('rounded-xl transition-shadow', active && 'ring-2 ring-blue-400/60 ring-offset-2 ring-offset-transparent')}
      >
        {/* No ground of its own: the panel's colour (the want's, as its card's)
            shows through, and what scrolls under it is blurred. A white band
            here stood out of a coloured panel as a strip laid on it. */}
        <h3
          // The robot presses a section's heading as it pressed its sub-tab.
          data-robot-target="settings_subtab"
          data-robot-id={tab}
          onClick={() => setActiveSettingsTab(tab)}
          className="sticky top-0 z-10 -mx-1 px-1 py-1.5 mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 backdrop-blur-md cursor-default"
        >
          <Icon className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{label}</span>
          {!!count && <CountBadge tone="info" size={14}>{count}</CountBadge>}
        </h3>
        {body}
      </section>
    );
  };

  return (
    <div className="h-full flex flex-col relative">
      {/* G: Saved indicator — absolute overlay, takes no layout space */}
      {savedIndicator && (
        <div className="absolute top-0.5 right-2 z-20 flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400 bg-white/90 dark:bg-gray-800/90 rounded px-1.5 py-0.5 pointer-events-none">
          <Check className="w-2.5 h-2.5" />
          <span>Saved</span>
        </div>
      )}

      {/* Every section in one scroll, in the sub-tabs' old order — no tabs to
          go through to see what is set. activeSettingsTab is now which
          section has the keys (B + L1/R1, the robot's settings-subtab): it is
          scrolled to and marked; a press in a section hands the keys to it. */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 sm:px-4 pb-6 focusable-container flex flex-col gap-5">
          <>
            {/* NAME / METADATA: metadata + timeline */}
            {section('name',
          <div className="space-y-3">
            {/* Metadata: each value a card of its own, as the fields are
                (design/cards.ts) — no box around them. */}
            <div className="grid grid-cols-2 gap-2">
              <div className={classNames('flex flex-col gap-1 rounded-lg sm:rounded-xl px-2 py-1.5 min-w-0', FIELD_CARD_SURFACE)}>
                <span className={FIELD_CARD_LABEL}>Name</span>
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
                        className="text-sm font-medium bg-white dark:bg-slate-800 border border-blue-400 dark:border-blue-500 rounded px-1.5 py-0.5 min-w-0 w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      <span
                        onClick={() => { setEditedName(want.metadata?.name || ''); setIsEditingName(true); }}
                        className="text-sm font-medium text-slate-900 dark:text-slate-100 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 transition-colors truncate"
                        title="Click to edit"
                      >
                        {want.metadata?.name || 'N/A'}
                      </span>
                    )}
              </div>
              <InfoRow label="Type" value={want.metadata?.type || 'N/A'} />
              <div className="col-span-2">
                <InfoRow label="ID" value={<span className="font-mono text-xs break-all">{want.metadata?.id || want.id || 'N/A'}</span>} />
              </div>
            </div>

            {/* Its picture on the board's floor, under its tile (lib/art). */}
            {want.metadata?.id && (
              <ArtMaker
                kind="want"
                id={want.metadata.id}
                value={want.metadata.name || want.metadata.type || ''}
                about={want.metadata.type || 'want'}
                context={artContextOf(want.state?.current as Record<string, unknown> | undefined)}
                current={artOf(want.metadata.labels)}
                onChanged={() => onWantUpdate?.()}
              />
            )}

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

            {/* PARAMS */}
            {section('params',
              <div>
                <ParameterGridSection
                  parameters={params}
                  parameterDefinitions={wantTypeDef?.parameters}
                  stateDefs={wantTypeDef?.state}
                  pickAsker={{ wantId: want.metadata.id, wantType: want.metadata.type, wantName: want.metadata.name }}
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
                  onExitTop={onBackToCard}
                  onExitBottom={() => goSection('params', 1)}
                  entry={enteredFrom}
                />
              </div>
            )}

            {/* TIMING: when it murmurs and notifies — only for a type that names its timings */}
            {!!wantTypeDef?.timings?.length && section('timing',
              <TimingsSection timings={wantTypeDef.timings} labels={labels} onChange={handleLabelsChange} />
            )}

            {/* LABELS */}
            {section('labels',
              <LabelsSection
                ref={labelsSectionRef}
                labels={labels}
                onChange={handleLabelsChange}
                isCollapsed={false}
                onToggleCollapse={() => {}}
                hideHeader={true}
                isActive={activeSettingsTab === 'labels' && sidebarDetailFocused}
                onExitTop={() => goSection('labels', -1)}
                onExitBottom={() => goSection('labels', 1)}
                entry={enteredFrom}
                navigationCallbacks={{
                  onNavigateUp: (e) => e && handleArrowKeyNavigation(e),
                  onNavigateDown: (e) => e && handleArrowKeyNavigation(e),
                }}
              />
            )}

            {/* SCHEDULE */}
            {section('schedule',
              <SchedulingSection
                ref={schedulingSectionRef}
                schedules={when}
                onChange={handleSchedulingChange}
                isCollapsed={false}
                onToggleCollapse={() => {}}
                hideHeader={true}
                isActive={activeSettingsTab === 'schedule' && sidebarDetailFocused}
                onExitTop={() => goSection('schedule', -1)}
                onExitBottom={() => goSection('schedule', 1)}
                entry={enteredFrom}
                navigationCallbacks={{
                  onNavigateUp: (e) => e && handleArrowKeyNavigation(e),
                  onNavigateDown: (e) => e && handleArrowKeyNavigation(e),
                }}
              />
            )}

            {/* DEPS */}
            {section('deps',
              <DependenciesSection
                ref={dependenciesSectionRef}
                dependencies={using}
                onChange={handleDependenciesChange}
                isCollapsed={false}
                onToggleCollapse={() => {}}
                hideHeader={true}
                isActive={activeSettingsTab === 'deps' && sidebarDetailFocused}
                onExitTop={() => goSection('deps', -1)}
                entry={enteredFrom}
                navigationCallbacks={{
                  onNavigateUp: (e) => e && handleArrowKeyNavigation(e),
                  onNavigateDown: (e) => e && handleArrowKeyNavigation(e),
                }}
              />
            )}

            {/* YAML: last, a fixed height in the scroll */}
            {section('yaml',
          <div className="flex flex-col h-80">
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
                  {/* Built only near being seen: see MountWhenNear. */}
                  <MountWhenNear className="h-full">
                    <WantYamlView want={want} />
                  </MountWhenNear>
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
            )}
          </>
      </div>

    </div>
  );
};

/** The want as YAML, read-only — worked out only once it is drawn (MountWhenNear). */
const WantYamlView: React.FC<{ want: Want }> = ({ want }) => (
  <YamlEditor
    value={stringifyYaml({ metadata: want.metadata, spec: want.spec })}
    onChange={() => {}}
    readOnly={true}
    height="100%"
  />
);
