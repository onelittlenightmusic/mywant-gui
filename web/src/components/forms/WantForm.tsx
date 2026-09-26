import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useHeaderAtBottom } from '@/hooks/useDisplaySettings';
import { Save, Plus, Heart, Bot, FolderOpen, Crown } from 'lucide-react';
import { Want, CreateWantRequest, UpdateWantRequest, WhenSpec } from '@/types/want';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { MarkButton } from '@/components/common/MarkButton';
import { ErrorDisplay } from '@/components/common/ErrorDisplay';
import { FormYamlToggle } from '@/components/common/FormYamlToggle';
import { RightSidebar } from '@/components/layout/RightSidebar';
import { PanelShell, PANEL_ACTION_BUTTON } from '@/components/sidebar/PanelIdentityRow';
import { YamlEditor } from './YamlEditor';
import { LabelAutocomplete } from './LabelAutocomplete';
import { LabelSelectorAutocomplete } from './LabelSelectorAutocomplete';
import { WantInventoryPicker, WantInventoryPickerRef, WantSlot } from './WantInventoryPicker';
import { RecommendationSelector } from '@/components/interact/RecommendationSelector';
import { LabelsSection } from './sections/LabelsSection';
import { DependenciesSection } from './sections/DependenciesSection';
import { SchedulingSection } from './sections/SchedulingSection';
import { validateYaml, stringifyYaml } from '@/utils/yaml';
import { generateUniqueWantName, isValidWantName } from '@/utils/nameGenerator';
import { classNames } from '@/utils/helpers';
import { apiClient, type ParamRecommendation } from '@/api/client';
import { getBackgroundStyle } from '@/utils/backgroundStyles';
import { useWantStore } from '@/stores/wantStore';
import { useWantTypeStore } from '@/stores/wantTypeStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { ApiError } from '@/types/api';
import { Recommendation, ConfigModifications } from '@/types/interact';
import { useInputActions } from '@/hooks/useInputActions';
import { CANVAS_LABEL_X, CANVAS_LABEL_Y } from '@/utils/wantPlacement';
import { ParameterGridSection } from './sections/ParameterGridSection';
import { ExposeSection, ExposeEntry } from './sections/ExposeSection';
import { ImportSection } from './sections/ImportSection';
import { useConfigStore } from '@/stores/configStore';
import { useDataTypes } from '@/hooks/useDataTypes';
import { resolveLucideIcon } from '@/utils/subtypeIcons';
import { wantTypesForSeeds, seedParamValues } from '@/utils/wantSeed';
import type { WantSeed, SeedThing } from '@/stores/wantSeedStore';
import { seedThings } from '@/stores/wantSeedStore';
import { useSeedFlightStore } from '@/stores/seedFlightStore';
import { WantCardFace, wantTypeIconStyle } from '@/components/dashboard/WantCardFace';
import { useColorMode } from '@/hooks/useColorMode';
import { MENU_COLORS, menuTintBg } from '@/utils/menuColors';
import { FormTab, FormTabBar, FORM_TABS } from './FormTabBar';
import { ParameterDef } from '@/types/wantType';
import { playSound } from '@/utils/sounds';
import { useSidebarFocusStore } from '@/stores/sidebarFocusStore';
import { resignFocus } from '@/stores/focusOwner';

type WFTab = FormTab | 'add';
const WF_TABS: WFTab[] = [...FORM_TABS, 'add'];

export interface WantFormHandle {
  navigateInventory: (dir: 'up' | 'down' | 'left' | 'right') => void;
  confirmInventory: () => void;
  showInventoryContextMenu: () => void;
  /** Programmatically select a want type by ID (e.g. from CLI). */
  selectType: (typeId: string) => void;
  /** Programmatically submit the form (deploy). */
  triggerDeploy: () => void;
}

interface WantFormProps {
  isOpen: boolean;
  onClose: () => void;
  editingWant?: Want | null;
  ownerWant?: Want | null;
  initialTypeId?: string;
  /**
   * What the caller already knows the want should declare — parameters and
   * imports, merged over the type's defaults when a type is chosen.
   *
   * For the board's own suggestion this is the wire itself: an offer says "a
   * reminder fed by that route's departure", and that sentence is a want spec.
   * Handing over only the type would leave the reader to rebuild the half that
   * was already worked out.
   */
  initialParams?: Record<string, unknown>;
  initialImports?: Record<string, string>;
  initialItemType?: 'want-type' | 'recipe';
  mode?: 'create' | 'edit' | 'recommendation';
  recommendations?: Recommendation[];
  selectedRecommendation?: Recommendation | null;
  onRecommendationSelect?: (rec: Recommendation) => void;
  onRecommendationDeploy?: (recId: string, modifications?: ConfigModifications) => void;
  /** Authoritative form situation owned by Dashboard — drives input routing */
  formSituation?: 'closed' | 'type-selection' | 'fields' | 'select-mode' | 'batch-action';
  /** Called when WantForm transitions between phases (type selected / back) */
  onSituationChange?: (sit: 'type-selection' | 'fields') => void;
  /** Canvas grid position to stamp on the new want at creation time (canvas mode only) */
  canvasPlacementPos?: { x: number; y: number } | null;
  /** Thing chosen as the starting point — filters the type picker to types
   *  that accept its subtype and pre-fills the matching parameter. */
  seed?: WantSeed | null;
  /** Back-to-thing control shown in seeded mode. */
  onBackToThing?: () => void;
}


export const WantForm = forwardRef<WantFormHandle, WantFormProps>(function WantForm({
  isOpen,
  onClose,
  editingWant,
  ownerWant = null,
  initialTypeId,
  initialParams,
  initialImports,
  initialItemType = 'want-type',
  mode = 'create',
  recommendations = [],
  selectedRecommendation = null,
  onRecommendationSelect,
  onRecommendationDeploy,
  formSituation,
  onSituationChange,
  canvasPlacementPos,
  seed,
  onBackToThing,
}, ref) {
  const { wants, createWant, updateWant, fetchWants, loading, error } = useWantStore();
  const { wantTypes, selectedWantType, fetchWantTypes, getWantType } = useWantTypeStore();
  const { recipes, fetchRecipes } = useRecipeStore();
  const { getTypeInfo } = useDataTypes();

  // Who owns the keys while this form is open.
  //
  // The same three props the details sidebar passes its parameter grid, and for
  // the same reason: clicking a card has to announce that focus has entered the
  // panel. That flag is what makes the grid claim the exclusive input capture
  // slot and hands the stick to the panel (see sidebarFocusStore / stickOwner).
  // Without it the board kept both, so its roaming cursor went on snapping to
  // whatever stop it liked while somebody was typing — and typing into a
  // parameter was impossible, because focus was pulled out from under it. The
  // details sidebar never had the problem; it had these props.
  const sidebarDetailFocused = useSidebarFocusStore(s => s.focused);
  const setSidebarDetailFocused = useSidebarFocusStore(s => s.setFocused);
  const sidebarFocusRequest = useSidebarFocusStore(s => s.request);
  // Whatever this form took, it gives back when it closes. Closing the form is
  // not one of the paths that releases the flag (handleCloseModals does not
  // touch it), so a claim left standing would outlive the panel that made it
  // and the board would never get its arrows back. Tracked rather than released
  // unconditionally: this component stays mounted while shut, and letting a
  // closed form call exit() would take the keys off whichever panel is
  // legitimately holding them.
  const claimedKeysRef = useRef(false);
  const claimKeys = useCallback(() => {
    claimedKeysRef.current = true;
    setSidebarDetailFocused(true);
  }, [setSidebarDetailFocused]);
  useEffect(() => {
    if (isOpen || !claimedKeysRef.current) return;
    claimedKeysRef.current = false;
    resignFocus('panel');
  }, [isOpen]);
  useEffect(() => () => {
    if (claimedKeysRef.current) resignFocus('panel');
  }, []);

  const inventoryPickerRef = useRef<WantInventoryPickerRef>(null);
  const submitTriggerRef = useRef<(() => void) | null>(null);

  // Refs for form fields navigation
  // Expose inventory navigation to Dashboard so it can route arrow keys directly
  // from its own situation-based handler, independent of focus state.
  useImperativeHandle(ref, () => ({
    navigateInventory:        (dir) => { inventoryPickerRef.current?.navigate(dir); },
    confirmInventory:         ()    => { inventoryPickerRef.current?.confirmFocused(); },
    showInventoryContextMenu: ()    => { inventoryPickerRef.current?.showContextMenuForFocused(); },
    selectType:               (typeId) => {
      setSelectedTypeId(typeId);
      setType(typeId);
      setSelectedItemType('want-type');
      const existingNames = new Set(wants?.map(w => w.metadata?.name) || []);
      setName(generateUniqueWantName(typeId, 'want-type', existingNames, ''));
      setActiveFormTab('params');
    },
    triggerDeploy:            ()    => { submitTriggerRef.current?.(); },
  }));

  const colorMode = useColorMode();

  // Seed-flight landing pads. The thing ghost lands on the seed chip while the
  // form is still choosing a type; once a type is picked, the type ghost lands
  // on the header card and the thing ghost flies on to the parameter it fills.
  const seedChipRef = useRef<HTMLDivElement>(null);
  const typeCardRef = useRef<HTMLDivElement>(null);
  const reportFlightTarget = useSeedFlightStore((s) => s.reportTarget);
  const flightPending = useSeedFlightStore((s) => s.flights.some((f) => f.kind === 'thing' && !f.targetRect));
  useEffect(() => {
    if (!seed || !flightPending) return;
    // Wait out the sidebar's slide-in (--motion-base = 280ms) so the measured
    // rect is the chip's resting position, not a mid-flight one.
    const t = setTimeout(() => {
      const el = seedChipRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      reportFlightTarget('thing', { top: r.top, left: r.left, width: r.width, height: r.height });
    }, 340);
    return () => clearTimeout(t);
  }, [seed, flightPending, reportFlightTarget]);

  /** Takes a suggestion. A remembered value is just written down; a value a
   *  deployed want is holding is wired instead — the provider exposes the
   *  field and this want imports it, so it follows when that value moves. */
  const applyRecommendation = useCallback(async (rec: ParamRecommendation) => {
    // A remembered value is just written down. A value a want is holding gets
    // connected — the server decides how, and hands back what to put in the form.
    if (!rec.sourceId || !rec.sourceField) {
      setParams(prev => ({ ...prev, [rec.paramName]: rec.value }));
      return;
    }
    try {
      const applied = await apiClient.applyParamRecommendationPending(rec);
      setParams(prev => ({ ...prev, [applied.paramName]: applied.value }));
      if (applied.import) {
        setImports(prev => ({ ...prev, [applied.import!.globalKey]: applied.import!.localKey }));
      }
    } catch {
      // The wiring failed; the value on its own is still better than nothing.
      setParams(prev => ({ ...prev, [rec.paramName]: rec.value }));
    }
  }, []);

  const changeButtonRef = useRef<HTMLButtonElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const labelsSectionRef = useRef<HTMLButtonElement>(null);
  const dependenciesSectionRef = useRef<HTMLButtonElement>(null);
  const schedulingSectionRef = useRef<HTMLButtonElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const exampleMenuRef = useRef<HTMLDivElement>(null);

  const [showExampleMenu, setShowExampleMenu] = useState(false);

  // UI state
  const [editMode, setEditMode] = useState<'form' | 'yaml'>('form');
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [wantTypeLoading, setWantTypeLoading] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null); // Selected want type or recipe ID

  const flightsPending = useSeedFlightStore((s) => s.flights.some((f) => !f.targetRect));
  useEffect(() => {
    if (!selectedTypeId || !flightsPending) return;
    const t = setTimeout(() => {
      const el = typeCardRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        reportFlightTarget('type', { top: r.top, left: r.left, width: r.width, height: r.height });
      }
      // The thing's new home is the parameter the seed filled; fall back to
      // the type header when that parameter is not on screen. With several
      // things seeded it is the first one that flies — the chip it leaves from
      // is the first chip.
      const filled = seed ? seedParamValues(selectedWantType, seedThings(seed), getTypeInfo) : {};
      const pname = seed ? (Object.keys(filled).find(k => filled[k] === seed.value) ?? null) : null;
      const pel = pname ? document.querySelector(`[data-param-key="${pname}"]`) : null;
      const pr = (pel ?? typeCardRef.current)?.getBoundingClientRect();
      if (pr) reportFlightTarget('thing', { top: pr.top, left: pr.left, width: pr.width, height: pr.height });
    }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTypeId, flightsPending]);

  const [selectedItemType, setSelectedItemType] = useState<'want-type' | 'recipe'>('want-type');

  // What this want could be filled with, asked before it exists. The server
  // ranks live want state above remembered things; the form only offers
  // them, never writes without a tap.
  const [paramRecs, setParamRecs] = useState<Record<string, ParamRecommendation[]>>({});
  useEffect(() => {
    if (!selectedTypeId || selectedItemType !== 'want-type') { setParamRecs({}); return; }
    let cancelled = false;
    apiClient.getParamRecommendations(selectedTypeId)
      .then((recs) => {
        if (cancelled) return;
        const byParam: Record<string, ParamRecommendation[]> = {};
        for (const r of recs) {
          const list = byParam[r.paramName] ?? (byParam[r.paramName] = []);
          if (list.length < 3 && !list.some(x => String(x.value) === String(r.value))) list.push(r);
        }
        setParamRecs(byParam);
      })
      .catch(() => { if (!cancelled) setParamRecs({}); });
    return () => { cancelled = true; };
  }, [selectedTypeId, selectedItemType]);
 // Type of selected item
  const [userNameSuffix, setUserNameSuffix] = useState(''); // User-provided name suffix for auto generation
  const [activeFormTab, setActiveFormTab] = useState<WFTab>('params');
  const [addButtonFocused, setAddButtonFocused] = useState(false);

  // Recommendation mode state
  const [selectedRecId, setSelectedRecId] = useState<string | null>(null);
  const isRecommendationMode = mode === 'recommendation';

  // Cycle through form tabs including the Add button as the final stop
  const navigateTab = useCallback((forward: boolean) => {
    setActiveFormTab(prev => {
      const idx = WF_TABS.indexOf(prev);
      const next = forward
        ? (idx + 1) % WF_TABS.length
        : (idx - 1 + WF_TABS.length) % WF_TABS.length;
      return WF_TABS[next];
    });
  }, []);

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [using, setUsing] = useState<Array<Record<string, string>>>([]);
  const [when, setWhen] = useState<WhenSpec[]>([]);
  const [exposes, setExposes] = useState<ExposeEntry[]>([]);
  const [imports, setImports] = useState<Record<string, string>>({});
  const [globalStateKeys, setGlobalStateKeys] = useState<string[]>([]);

  // Owner selection state — initialised from ownerWant prop, editable in metadata tab
  const [selectedOwner, setSelectedOwner] = useState<Want | null>(ownerWant ?? null);
  const [ownerSearchQuery, setOwnerSearchQuery] = useState('');
  const [ownerDropdownOpen, setOwnerDropdownOpen] = useState(false);

  // YAML state
  const [yamlContent, setYamlContent] = useState('');

  // Sync selectedOwner when ownerWant prop changes or form opens
  useEffect(() => {
    setSelectedOwner(ownerWant ?? null);
    setOwnerSearchQuery('');
  }, [ownerWant, isOpen]);

  // Fetch want types and recipes on component mount
  useEffect(() => {
    if (isOpen) {
      if (wantTypes.length === 0) {
        fetchWantTypes();
      }
      if (recipes.length === 0) {
        fetchRecipes();
      }
      fetchWants();
    }
  }, [isOpen, wantTypes.length, recipes.length, fetchWantTypes, fetchRecipes, fetchWants]);

  // Fetch global state keys for the Import tab datalist
  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/v1/global-state')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.state) setGlobalStateKeys(Object.keys(data.state));
      })
      .catch(() => {/* ignore */});
  }, [isOpen]);

  // Filter out system want types (custom_target, draft, owner)
  const userFacingWantTypes = useMemo(() => {
    return wantTypes.filter(wt => !wt.system_type);
  }, [wantTypes]);

  /** Every thing this form was seeded with — one, or a whole board selection. */
  const seeds: SeedThing[] = useMemo(() => (seed ? seedThings(seed) : []), [seed]);

  // Seeded from things: only want types with a parameter to spare for each of
  // them, exact subtype matches first.
  const seededTypes = useMemo(
    () => (seeds.length > 0 ? wantTypesForSeeds(userFacingWantTypes, seeds.map(s => s.subtype), getTypeInfo).all : []),
    [seeds, userFacingWantTypes, getTypeInfo],
  );

  // Keyboard shortcut: / to focus search
  useEffect(() => {
    if (!isOpen || editMode !== 'form') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input (except for the target search box)
      const target = e.target as HTMLElement;
      const isInputElement =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // If typing in an input, skip (the search input will handle ESC itself)
      if (isInputElement) return;

      // Handle / to open search and focus
      if (e.key === '/' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        // Focus search input
        setTimeout(() => {
          inventoryPickerRef.current?.focusSearch();
        }, 0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, editMode]);

  // Handle arrow key navigation for form fields based on DOM order
  const handleArrowKeyNavigation = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;

    // Find all focusable form elements within this container
    const currentTarget = e.currentTarget || (e as any).target;
    const container = currentTarget?.closest('.focusable-container');
    if (!container) return;

    const focusableElements = Array.from(container.querySelectorAll('.focusable-section-header')) as HTMLElement[];
    const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement);

    if (currentIndex === -1) {
      // If none focused, focus the first one on ArrowDown
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
  };

  // Convert form data to want object
  const formToWantObject = () => {
    // Filter out using entries with empty keys
    const validUsing = using.filter(item => Object.keys(item)[0]?.trim());
    // Filter out when entries with neither every nor fromGlobalParam
    const validWhen = when.filter(item => item.every?.trim() || item.fromGlobalParam?.trim());

    const ownerName = selectedOwner?.metadata?.name || '';
    const ownerId = selectedOwner?.metadata?.id || selectedOwner?.id || '';
    const ownerReferences = (selectedOwner && ownerName && ownerId)
      ? [{ apiVersion: 'v1', kind: 'Want', name: ownerName, id: ownerId, controller: true, blockOwnerDeletion: true }]
      : (isEditing && editingWant?.metadata?.ownerReferences?.length ? editingWant.metadata.ownerReferences : undefined);

    const canvasLabels = (!isEditing && canvasPlacementPos != null)
      ? { [CANVAS_LABEL_X]: String(Math.round(canvasPlacementPos.x)), [CANVAS_LABEL_Y]: String(Math.round(canvasPlacementPos.y)) }
      : {};
    return {
      metadata: {
        name: name.trim(),
        type: type.trim(),
        ...((Object.keys(labels).length > 0 || Object.keys(canvasLabels).length > 0) ? { labels: { ...labels, ...canvasLabels } } : {}),
        ...(ownerReferences && { ownerReferences }),
      },
      spec: {
        ...(Object.keys(params).length > 0 && { params }),
        ...(validUsing.length > 0 && { using: validUsing }),
        ...(validWhen.length > 0 && { when: validWhen }),
        ...(exposes.length > 0 && { exposes }),
        ...(Object.keys(imports).length > 0 && { imports }),
      }
    };
  };

  // Convert want object to form data
  const wantObjectToForm = (want: Want) => {
    setName(want.metadata?.name || '');
    setType(want.metadata?.type || 'sequence');
    setLabels(want.metadata?.labels || {});
    setParams(want.spec?.params || {});
    setUsing(want.spec?.using || []);
    setWhen(want.spec?.when || []);
    setExposes(want.spec?.exposes || []);
    setImports(want.spec?.imports || {});
  };

  // Update YAML when form data changes
  useEffect(() => {
    if (editMode === 'form') {
      const wantObject = formToWantObject();
      console.log('Updating YAML - wantObject:', wantObject, 'using state:', using);
      setYamlContent(stringifyYaml(wantObject));
    }
  }, [name, type, labels, params, using, when, exposes, imports, editMode, ownerWant]);

  // Initialize form when sidebar opens/closes
  useEffect(() => {
    if (!isOpen) {
      resetForm();
    } else if (initialTypeId && !editingWant) {
      setSelectedTypeId(initialTypeId);
      setSelectedItemType(initialItemType);
      setType(initialTypeId);
      const existingNames = new Set(wants?.map(w => w.metadata?.name) || []);
      setName(generateUniqueWantName(initialTypeId, initialItemType, existingNames, ''));
    }
  }, [isOpen, initialTypeId]);

  // Initialize form when editing
  useEffect(() => {
    if (editingWant) {
      setIsEditing(true);
      wantObjectToForm(editingWant);
      
      // Initialize selector state from want type/recipe
      const wType = editingWant.metadata?.type || '';
      if (wType) {
        // Try to determine if it's a recipe or want-type
        const isRecipe = recipes.some(r => r.recipe?.metadata?.custom_type === wType);
        setSelectedTypeId(wType);
        setSelectedItemType(isRecipe ? 'recipe' : 'want-type');
      }

      // Auto-switch to Labels tab if editing want has labels; otherwise stay on Params
      const hasLabels = Object.keys(editingWant.metadata?.labels || {}).length > 0;
      if (hasLabels) setActiveFormTab('labels');
      setYamlContent(stringifyYaml({
        metadata: editingWant.metadata,
        spec: editingWant.spec
      }));
    }
  }, [editingWant, recipes]);

  const resetForm = () => {
    setIsEditing(false);
    setEditMode('form');
    setName('');
    setType('');
    setLabels({});
    setParams({});
    setUsing([]);
    setWhen([]);
    setExposes([]);
    setSelectedTypeId(null);
    setSelectedItemType('want-type');
    setUserNameSuffix('');
    setYamlContent(stringifyYaml({
      metadata: { name: '', type: '' },
      spec: {}
    }));
    setValidationError(null);
    setApiError(null);
    setActiveFormTab('params');
  };

  // Close example menu on outside click
  useEffect(() => {
    if (!showExampleMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (exampleMenuRef.current && !exampleMenuRef.current.contains(e.target as Node)) {
        setShowExampleMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExampleMenu]);

  // Update form when want type is selected
  useEffect(() => {
    if (type && !isEditing) {
      setWantTypeLoading(true);
      getWantType(type).finally(() => {
        setWantTypeLoading(false);
      });
    }
  }, [type, isEditing, getWantType]);

  // Populate parameters from want type examples when selectedWantType changes
  useEffect(() => {
    // Skip if editing, or if a recipe is selected (recipe params handled separately)
    if (selectedItemType === 'recipe') {
      return;
    }

    if (selectedWantType && !isEditing && type === selectedWantType.metadata.name) {
      // Only declared defaults become real values. An `example` says "a value
      // like this goes here" — filling it in made every parameter look answered,
      // hid the suggestions (which only offer themselves on empty parameters),
      // and let a want deploy carrying the example verbatim. Examples are shown
      // as placeholder text instead (see ParameterGridSection).
      let base: Record<string, unknown> = {};
      if (selectedWantType.parameters && selectedWantType.parameters.length > 0) {
        selectedWantType.parameters.forEach(param => {
          if (param.default !== undefined) base[param.name] = param.default;
        });
      }
      // Seed prefill: the things that started this flow fill a parameter each.
      if (seed) {
        Object.assign(base, seedParamValues(selectedWantType, seedThings(seed), getTypeInfo));
      }
      // Over the defaults, because a caller that named a value meant it — and
      // a declaration like {fromGlobalParam: …} is not a value the reader
      // could reasonably be asked to type back in.
      if (initialParams) base = { ...base, ...initialParams };
      setParams(base);
      // Switch to params tab if type has params
      if (Object.keys(base).length > 0) setActiveFormTab('params');
    }
    // getTypeInfo is intentionally excluded: useDataTypes returns a fresh
    // reference each render, and including it would re-run this effect on every
    // render — resetting the user's parameter edits back to the seed value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWantType, isEditing, type, selectedItemType, seed, initialParams]);

  // The imports half of the same declaration.
  useEffect(() => {
    if (isEditing || !initialImports) return;
    setImports(prev => ({ ...prev, ...initialImports }));
  }, [initialImports, isEditing]);

  // Populate parameters from recipe definition when a recipe is selected
  useEffect(() => {
    if (selectedItemType === 'recipe' && !isEditing && type) {
      const selectedRecipe = recipes.find(r => r.recipe?.metadata?.custom_type === type);
      const paramDefs = selectedRecipe?.recipe?.parameters ?? [];
      if (paramDefs.length > 0) {
        const defaultsMap = Object.fromEntries(
          paramDefs.filter(p => p.default !== undefined).map(p => [p.name, p.default])
        );
        setParams(defaultsMap);
        setActiveFormTab('params');
      } else {
        setParams({});
      }
    }
  }, [selectedItemType, type, recipes, isEditing]);

  const validateForm = (): boolean => {
    if (!name.trim()) {
      setValidationError('Want name is required');
      return false;
    }
    if (!type.trim()) {
      setValidationError('Want type or recipe is required');
      return false;
    }
    setValidationError(null);
    return true;
  };

  // Keep submitTriggerRef pointing at the latest handleSubmit closure
  submitTriggerRef.current = () => handleSubmit(null);

  const handleSubmit = async (e: React.FormEvent | null) => {
    e?.preventDefault();
    setApiError(null);
    setIsSubmitting(true);
    playSound('cardOpen');

    try {
      // Handle recommendation deployment differently
      if (isRecommendationMode && selectedRecId && onRecommendationDeploy) {
        const modifications: ConfigModifications = {
          parameterOverrides: params,
          disableWants: [] // Could add UI for this later
        };
        await onRecommendationDeploy(selectedRecId, modifications);
        onClose();
        resetForm();
        setIsSubmitting(false);
        return;
      }

      let wantRequest: CreateWantRequest | UpdateWantRequest;

      console.log('handleSubmit - editMode:', editMode, 'form state using:', using, 'labels:', labels, 'params:', params);

      if (editMode === 'yaml') {
        // Parse YAML to want object
        if (!yamlContent.trim()) {
          setValidationError('YAML content is required');
          setIsSubmitting(false);
          return;
        }

        const yamlValidation = validateYaml(yamlContent);
        if (!yamlValidation.isValid) {
          setValidationError(`Invalid YAML: ${yamlValidation.error}`);
          setIsSubmitting(false);
          return;
        }

        wantRequest = yamlValidation.data as CreateWantRequest | UpdateWantRequest;
      } else {
        // Use form data
        if (!validateForm()) {
          setIsSubmitting(false);
          return;
        }
        wantRequest = formToWantObject();
        console.log('handleSubmit - form mode, wantRequest:', wantRequest);
      }

      console.log('handleSubmit - final wantRequest:', wantRequest);

      if (isEditing && editingWant?.metadata?.id) {
        await updateWant(editingWant.metadata.id, wantRequest as UpdateWantRequest);
        onClose();
        resetForm();
      } else {
        await createWant(wantRequest as CreateWantRequest);

        // Refresh at 500ms intervals for 10 seconds to capture status transitions quickly
        fetchWants().catch(console.error);
        const fastRefreshEnd = Date.now() + 10000;
        const fastRefreshInterval = setInterval(() => {
          if (Date.now() >= fastRefreshEnd) {
            clearInterval(fastRefreshInterval);
            return;
          }
          fetchWants().catch(console.error);
        }, 500);

        // Close sidebar after successful deployment
        onClose();
        resetForm();
      }
    } catch (error) {
      console.error('Failed to save want:', error);
      setApiError(error as ApiError);
    } finally {
      setIsSubmitting(false);
    }
  };


  // ── Gamepad input for Add Want sidebar ───────────────────────────────────────
  // When Dashboard passes formSituation, use it as the authoritative source.
  // It is set synchronously by Dashboard before WantForm re-renders, so it is
  // never stale.  Fall back to internal computation when prop is absent.
  const isTypeSelectionPhase = formSituation
    ? formSituation === 'type-selection'
    : (isOpen && !selectedTypeId && editMode === 'form');

  // Notify Dashboard when the phase transitions (type selected / back / reset).
  useEffect(() => {
    if (!onSituationChange || !isOpen) return;
    onSituationChange(selectedTypeId ? 'fields' : 'type-selection');
  }, [selectedTypeId, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-focus the primary element when the active tab changes.
  // 'add': the submit button is always mounted (part of headerActions,
  // unconditional on activeFormTab), so it can be focused synchronously in a
  // layout effect — no need to wait for anything to mount. This matters
  // because gamepad A-button confirms read document.activeElement directly
  // (see handleGamepadConfirm below): a deferred setTimeout(...50) here left
  // a ~50ms window where activeFormTab was already 'add' but DOM focus
  // hadn't moved yet, so a fast A-press right after landing on the Add tab
  // would read the PREVIOUS element and silently do nothing, even though the
  // Add button would visibly show focused moments later. Keyboard Tab never
  // hit this race (the browser moves focus synchronously on Tab keydown),
  // which is why Enter always worked while gamepad A intermittently didn't.
  useLayoutEffect(() => {
    if (!selectedTypeId) return;
    if (activeFormTab === 'add') {
      addButtonRef.current?.focus();
    } else if (document.activeElement === addButtonRef.current) {
      // Focus must be exclusive to whichever tab is active: leaving 'add' for
      // any other tab has nothing else claim DOM focus (params/labels/etc.
      // manage their own focus independently, only when the user interacts
      // with something inside them), so document.activeElement was staying
      // on the Add button indefinitely. That let a stray A-press after
      // switching tabs silently re-submit the form (it still read
      // document.activeElement === the Add button) instead of doing nothing
      // or acting on the newly active tab, and made the Add button's
      // native :focus ring stay visibly lit while a different tab was shown.
      addButtonRef.current?.blur();
    }
  }, [activeFormTab, selectedTypeId]);

  // 'name': the input is conditionally rendered per-tab, so a microtask delay
  // remains here to give it a chance to mount before focusing.
  useEffect(() => {
    if (!selectedTypeId) return;
    if (activeFormTab === 'name') {
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
    // 'params': auto-highlighted by ParameterGridSection (isActive prop drives it)
  }, [activeFormTab, selectedTypeId]);

  // Confirm action: type phase → select focused item; params phase → Enter/click on active element
  const handleGamepadConfirm = useCallback(() => {
    if (isTypeSelectionPhase) {
      inventoryPickerRef.current?.confirmFocused();
    } else {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return;
      if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') {
        el.click();
      } else {
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      }
    }
  }, [isTypeSelectionPhase]);

  // Cancel action: params phase → Escape on active input or close form; type phase → close form
  const handleGamepadCancel = useCallback(() => {
    const el = document.activeElement as HTMLElement | null;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    } else {
      onClose();
    }
  }, [onClose]);

  // Dashboard owns arrow-key routing during type-selection phase via wantFormRef.
  // Fields phase: L/R Bumper / Tab cycles form tabs; confirm/cancel as before.
  useInputActions({
    enabled: isOpen && editMode === 'form',
    captureInput: !isTypeSelectionPhase,
    ignoreWhenInputFocused: false,
    ignoreWhenInSidebar: false,
    onConfirm: handleGamepadConfirm,
    onCancel: handleGamepadCancel,
    onTabForward:  !isTypeSelectionPhase ? () => navigateTab(true)  : undefined,
    onTabBackward: !isTypeSelectionPhase ? () => navigateTab(false) : undefined,
    // onContextMenu is intentionally absent here: during type-selection, Dashboard owns
    // captureInput and routes Gamepad Start / Shift+Enter → wantFormRef.showInventoryContextMenu().
    // During fields phase there is no context menu action.
  });

  // Tab badge counts — shown on each tab button
  const tabBadges = useMemo((): Record<FormTab, string | number | null> => {
    const unfilledRequired = selectedWantType?.parameters
      ? selectedWantType.parameters.filter(p => p.required && params[p.name] === undefined).length
      : 0;
    return {
      name: (!name.trim() && !!selectedTypeId) ? '!' : null,
      params: unfilledRequired > 0 ? `★${unfilledRequired}` : null,
      labels: Object.keys(labels).length > 0 ? Object.keys(labels).length : null,
      schedule: when.length > 0 ? when.length : null,
      deps: using.length > 0 ? using.length : null,
      expose: exposes.length > 0 ? exposes.length : null,
      import: Object.keys(imports).length > 0 ? Object.keys(imports).length : null,
      yaml: null,
    };
  }, [selectedWantType, params, name, selectedTypeId, labels, when, using, imports]);

  const isTypeSelected = !!type;
  const shouldGlowButton = isTypeSelected && !isEditing && selectedTypeId;
  const config = useConfigStore(state => state.config);
  const isBottom = useHeaderAtBottom();

  const allExamples = useMemo(() => {
    const recipeExamples = selectedItemType === 'recipe'
      ? (recipes.find(r => r.recipe?.metadata?.custom_type === type)?.recipe?.examples ?? [])
      : [];
    const wantTypeExamples = selectedItemType === 'want-type'
      ? (selectedWantType?.examples ?? [])
      : [];
    return [
      ...wantTypeExamples.map((ex, i) => ({
        key: `wt-${i}`, name: ex.name, description: ex.description,
        onLoad: () => { setParams(ex.want?.spec?.params || {}); setExposes(ex.want?.spec?.exposes || []); setImports(ex.want?.spec?.imports || {}); },
      })),
      ...recipeExamples.map((ex, i) => ({
        key: `re-${i}`, name: ex.name, description: ex.description,
        onLoad: () => setParams(prev => ({ ...prev, ...ex.params })),
      })),
    ];
  }, [selectedItemType, type, recipes, selectedWantType]);

  // Return ParameterDef[] from recipe parameters for the grid card format.
  const recipeParamDefs = useMemo((): ParameterDef[] | undefined => {
    if (selectedItemType !== 'recipe') return undefined;
    const selectedRecipe = recipes.find(r => r.recipe?.metadata?.custom_type === type);
    return selectedRecipe?.recipe?.parameters ?? undefined;
  }, [selectedItemType, type, recipes]);

  const headerAction = (
    <div className="flex items-stretch gap-0">
      {!isEditing && !!selectedTypeId && allExamples.length > 0 && (
        <div ref={exampleMenuRef} className="relative flex items-stretch">
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowExampleMenu(v => !v)}
            className={classNames(
              "flex flex-col items-center justify-center gap-0.5 px-3 h-full transition-all duration-150 focus:outline-none",
              showExampleMenu
                ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
            )}
            title="Load example"
          >
            <FolderOpen className="w-4 h-4" />
            <span className="text-[9px] font-bold uppercase tracking-tighter hidden sm:block">Example</span>
          </button>
          {showExampleMenu && (
            <div className="absolute bottom-full left-0 mb-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 min-w-48 max-h-48 overflow-y-auto">
              {allExamples.map(ex => (
                <button
                  key={ex.key}
                  type="button"
                  onClick={() => { ex.onLoad(); setShowExampleMenu(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{ex.name}</p>
                  {ex.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{ex.description}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="flex items-center h-full px-2">
        <FormYamlToggle
          mode={editMode}
          onModeChange={setEditMode}
        />
      </div>
      <button
        ref={addButtonRef}
        type="submit"
        disabled={isSubmitting || (!isEditing && !isTypeSelected)}
        form="want-form"
        data-robot-target="form_deploy_btn"
        data-free-cursor-item

        onFocus={() => setAddButtonFocused(true)}
        onBlur={() => setAddButtonFocused(false)}
        className={classNames(
          PANEL_ACTION_BUTTON,
          isSubmitting || (!isEditing && !isTypeSelected)
            ? "bg-gray-400/30 cursor-not-allowed grayscale opacity-50"
            : isEditing
              ? "bg-indigo-600/90 text-white hover:brightness-110 active:opacity-80"
              : isRecommendationMode
                ? "bg-purple-600/90 text-white hover:brightness-110 active:opacity-80"
                : addButtonFocused
                  ? "bg-blue-500 text-white active:opacity-80"
                  : "bg-gray-700 text-white hover:bg-gray-600 active:opacity-80"
        )}
      >
        {isSubmitting ? (
          <LoadingSpinner size="sm" />
        ) : (
          <>
            <div className="w-5 h-5 flex items-center justify-center">
              {isEditing ? (
                <Save className="w-5 h-5" />
              ) : isRecommendationMode ? (
                <Plus className="w-5 h-5" />
              ) : (
                <span className="relative inline-flex flex-shrink-0">
                  <Heart className="w-4 h-4" />
                  <Plus className="w-2.5 h-2.5 absolute -top-1 -right-1" style={{ strokeWidth: 3 }} />
                </span>
              )}
            </div>
            <span className="text-white text-[9px] font-bold leading-none uppercase tracking-tighter hidden sm:block">
              {isRecommendationMode ? 'Deploy' : (isEditing ? 'Update' : 'Add')}
            </span>
          </>
        )}
      </button>
    </div>
  );

  // Get background style based on selected want type
  // Only show background when a type is selected (not during selection/re-selection)
  const backgroundStyle = (selectedTypeId && selectedWantType)
    ? getBackgroundStyle(selectedWantType.metadata.name).style
    : undefined;

  return (
    <RightSidebar
      isOpen={isOpen}
      onClose={onClose}
      /**
       * No title.
       *
       * Every other panel on this board stopped naming itself in a bar of its
       * own — the detail panels open on a card that already says what they are
       * (see PanelIdentityRow), and the frame above them is just the way out.
       * A form that still wore "New Want" was the only thing left with a
       * caption, and a caption is what a form's own first field says better.
       *
       * The header row stays because the submit lives in it; without a title
       * it is what the detail panels' row is — actions on one side, the close
       * on the other, nothing in the middle.
       */
      // Chromeless, and the row above the form does the header's job instead —
      // see the note on the title below. The frame's own bar is drawn at the
      // BOTTOM of the sidebar in this layout, which is where this form's close
      // used to sit while every detail panel's sat at the top.
      chromeless
      overflowHidden
      backgroundStyle={backgroundStyle}
      // Opening a form is going into it — including during type selection,
      // when nothing inside has taken DOM focus yet and the board would
      // otherwise still think the stick was its own.
      claimsInputOnOpen
    >
      <PanelShell title="" onClose={onClose} actions={headerAction}>
      <form id="want-form" onSubmit={handleSubmit} className="space-y-3 focusable-container h-full flex flex-col">

        {editMode === 'form' ? (
          <>
            {/* ── Phase 1: Type/Recipe selector or Recommendation selector ── */}
            {isRecommendationMode ? (
              <div className={classNames(
                selectedRecId && selectedRecommendation ? 'flex-shrink-0' : 'flex-1 min-h-0 flex flex-col'
              )}>
                {selectedRecId && selectedRecommendation ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRecId(null);
                      setSelectedTypeId(null);
                      setType('');
                      setName('');
                      setParams({});
                      setLabels({});
                      setUsing([]);
                      setWhen([]);
                    }}
                    className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-2 border-blue-300 dark:border-blue-600 rounded-lg hover:border-blue-400 dark:hover:border-blue-500 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <Bot className="w-5 h-5 text-blue-500" />
                      <div className="text-left">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">{selectedRecommendation.title}</h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{selectedRecommendation.approach}</p>
                      </div>
                    </div>
                    <span className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-100 text-blue-700 transition-colors">Change</span>
                  </button>
                ) : (
                  <RecommendationSelector
                    recommendations={recommendations}
                    selectedId={selectedRecId}
                    onSelect={(rec) => {
                      setSelectedRecId(rec.id);
                      onRecommendationSelect?.(rec);
                      if (rec.config?.wants?.length) {
                        const fw = rec.config.wants[0];
                        setName(fw.metadata?.name || '');
                        setType(fw.metadata?.type || '');
                        setLabels(fw.metadata?.labels || {});
                        setParams(fw.spec?.params || {});
                        setUsing(fw.spec?.using || []);
                        setWhen(fw.spec?.when || []);
                        setSelectedTypeId(fw.metadata?.type || null);
                      }
                    }}
                  />
                )}
              </div>
            ) : !selectedTypeId ? (
              /* Inventory picker (no type selected yet) */
              <div className="flex-1 min-h-0 flex flex-col">
                {seed && (() => {
                  const SeedIcon = resolveLucideIcon(seed.icon);
                  return (
                    <div className="px-1 pb-3 flex-shrink-0">
                      <div className="flex items-center gap-3">
                        <span className="text-xl sm:text-2xl font-bold text-gray-400 dark:text-gray-500 flex-shrink-0 select-none">With</span>
                      <div
                        ref={seedChipRef}
                        className="relative flex items-center gap-4 rounded-2xl p-4 sm:p-5 overflow-hidden bg-white dark:bg-gray-800 flex-1 min-w-0"
                        style={menuTintBg(MENU_COLORS.thing)}
                        title={`Starting from ${seed.subtype}: ${seed.value}`}
                      >
                        {/* Large icon badge, thing-card style — subtype colour, no ring. */}
                        <div
                          className="flex items-center justify-center rounded-2xl w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0"
                          style={{ backgroundColor: `${seed.color}3a` }}
                        >
                          {SeedIcon && <SeedIcon className="w-9 h-9 sm:w-11 sm:h-11" style={{ color: seed.color }} strokeWidth={1.75} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white truncate">
                              {seed.value}
                            </div>
                            {/* The seed is a thing, and this is the way back to
                                where it stands. Same mark, same press, as the
                                one a field or parameter card wears. */}
                            <MarkButton
                              mark={{ kind: 'thing', id: seed.sourceMemoId, name: seed.value, color: seed.color, icon: seed.icon }}
                              size={22}
                            />
                          </div>
                          <span
                            className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-medium"
                            style={{ color: seed.color, backgroundColor: `${seed.color}22` }}
                          >
                            {seed.subtype}
                          </span>
                        </div>
                        {onBackToThing && (
                          <button
                            type="button"
                            onClick={onBackToThing}
                            className="flex-shrink-0 self-start text-xs px-2.5 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 bg-white/60 dark:bg-gray-900/60"
                          >
                            ← Thing
                          </button>
                        )}
                      </div>
                      </div>
                      {/* The rest of a board selection. The first thing keeps
                          the big card — it is the one the picked tile flew to,
                          and the one a type's declared seed-param belongs to —
                          and the others line up under it as chips, so a
                          selection of five does not become five big cards with
                          the type picker pushed off the screen. */}
                      {seeds.length > 1 && (
                        <div className="mt-2 flex items-center gap-1.5 flex-wrap pl-[3.25rem]">
                          <span className="text-sm font-bold text-gray-400 dark:text-gray-500 flex-shrink-0 select-none">and</span>
                          {seeds.slice(1).map((sd, i) => {
                            const MoreIcon = resolveLucideIcon(sd.icon);
                            return (
                              <div
                                key={`${sd.sourceMemoId}-${i}`}
                                className="flex items-center gap-2 rounded-lg px-2 py-1 min-w-0 bg-white dark:bg-gray-800"
                                style={menuTintBg(MENU_COLORS.thing)}
                                title={`${sd.subtype}: ${sd.value}`}
                              >
                                <div
                                  className="flex items-center justify-center rounded-md w-6 h-6 flex-shrink-0"
                                  style={{ backgroundColor: `${sd.color}3a` }}
                                >
                                  {MoreIcon && <MoreIcon className="w-3.5 h-3.5" style={{ color: sd.color }} strokeWidth={1.75} />}
                                </div>
                                <span className="text-xs font-semibold text-gray-900 dark:text-white truncate">{sd.value}</span>
                                <MarkButton
                                  mark={{ kind: 'thing', id: sd.sourceMemoId, name: sd.value, color: sd.color, icon: sd.icon }}
                                  size={16}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-400">
                        …, I want… <span className="text-gray-400 dark:text-gray-500">choose a want type below.</span>
                      </p>
                    </div>
                  );
                })()}
                {!seed && (
                  <div className="px-1 pb-2 flex-shrink-0">
                    <p className="text-xl sm:text-2xl font-bold text-gray-600 dark:text-gray-300">
                      I want… <span className="text-sm font-normal text-gray-400 dark:text-gray-500">choose a want type below.</span>
                    </p>
                  </div>
                )}
                <div className="flex-1 min-h-0">
                  <WantInventoryPicker
                    ref={inventoryPickerRef}
                    wantTypes={seed ? seededTypes : userFacingWantTypes}
                    recipes={seed ? [] : recipes}
                    onSelect={(id, itemType) => {
                      setSelectedTypeId(id);
                      setSelectedItemType(itemType);
                      setType(id);
                      const existingNames = new Set(wants?.map(w => w.metadata?.name) || []);
                      setName(generateUniqueWantName(id, itemType, existingNames, userNameSuffix));
                      setActiveFormTab('params');
                    }}
                  />
                </div>
              </div>
            ) : (
              /* ── Phase 2: Type selected — compact slot + tab layout ── */
              (() => {
                const selWt = userFacingWantTypes.find(wt => wt.name === selectedTypeId);
                const selRec = recipes.find(r => r.recipe?.metadata?.custom_type === selectedTypeId);
                const slotTitle = selWt?.title || selRec?.recipe?.metadata?.name || selectedTypeId;
                const slotCategory = selWt?.category || selRec?.recipe?.metadata?.category;
                const noopNav = { onNavigateUp: () => {}, onNavigateDown: () => {} };
                const tabNav = {
                  ...noopNav,
                  onTab: () => navigateTab(true),
                  onTabBack: () => navigateTab(false),
                };

                return (
                  <>
                    {/* The sentence the form has been saying all along —
                        "With <thing> … I want <type>" — keeps its shape once a
                        type is chosen. Only the blank at the end gets filled;
                        the thing half does not move or change wording, so the
                        form reads as one continuing thought rather than two
                        screens. */}
                    {seeds.length > 0 && (
                      <div className="flex-shrink-0 flex items-center gap-2 px-1 pb-2 flex-wrap">
                        <span className="text-sm font-bold text-gray-400 dark:text-gray-500 flex-shrink-0 select-none">With</span>
                        {seeds.map((sd, i) => {
                          const SeedIcon = resolveLucideIcon(sd.icon);
                          return (
                            <React.Fragment key={`${sd.sourceMemoId}-${i}`}>
                              {i > 0 && <span className="text-sm font-bold text-gray-400 dark:text-gray-500 flex-shrink-0 select-none">+</span>}
                              <div
                                className="flex items-center gap-2 rounded-lg px-2 py-1 min-w-0 bg-white dark:bg-gray-800"
                                style={menuTintBg(MENU_COLORS.thing)}
                              >
                                <div
                                  className="flex items-center justify-center rounded-md w-6 h-6 flex-shrink-0"
                                  style={{ backgroundColor: `${sd.color}3a` }}
                                >
                                  {SeedIcon && <SeedIcon className="w-3.5 h-3.5" style={{ color: sd.color }} strokeWidth={1.75} />}
                                </div>
                                <span className="text-xs font-semibold text-gray-900 dark:text-white truncate">{sd.value}</span>
                                {/* The same way out, kept in the shortened chip. */}
                                <MarkButton
                                  mark={{ kind: 'thing', id: sd.sourceMemoId, name: sd.value, color: sd.color, icon: sd.icon }}
                                  size={16}
                                />
                              </div>
                            </React.Fragment>
                          );
                        })}
                        <span className="text-sm font-bold text-gray-400 dark:text-gray-500 flex-shrink-0 select-none">, I want…</span>
                      </div>
                    )}
                    {/* Chosen type header — the same card the picker grid shows,
                        not a different-looking slot. Keeping the card shape
                        across both phases is what lets the picked card fly here
                        rather than vanish and be replaced by something else. */}
                    <div
                      ref={typeCardRef}
                      className="relative flex-shrink-0 h-12 rounded-lg overflow-hidden border border-gray-300/80 dark:border-black/60 shadow-sm"
                    >
                      {/* The card IS the header — the type's own background runs
                          the full width with its name over it, rather than a
                          card-shaped icon sitting in a plain grey row. */}
                      <WantCardFace
                        typeName={selectedTypeId}
                        displayName={slotTitle}
                        category={slotCategory ?? ''}
                        theme={colorMode}
                        context="canvas"
                        iconSize={22}
                        showName={false}
                        iconStyle={wantTypeIconStyle(selectedTypeId, slotCategory ?? '', colorMode === 'dark')}
                        iconContainerStyle={{ left: 10, top: 0, bottom: 0, width: 34 }}
                        className="w-full h-full"
                      />
                      <div className="absolute inset-0 z-20 flex items-center gap-2 pl-[52px] pr-2">
                      <div className="flex-1 min-w-0">
                        <p
                          className={classNames(
                            'text-xs font-semibold truncate',
                            colorMode === 'dark' ? 'text-white' : 'text-gray-900',
                          )}
                          style={colorMode === 'dark' ? { textShadow: '0 1px 3px rgba(0,0,0,0.7)' } : undefined}
                        >
                          {slotTitle}
                        </p>
                        {slotCategory && (
                          <p
                            className={classNames(
                              'text-[10px] capitalize',
                              colorMode === 'dark' ? 'text-white/70' : 'text-gray-600',
                            )}
                            style={colorMode === 'dark' ? { textShadow: '0 1px 2px rgba(0,0,0,0.6)' } : undefined}
                          >
                            {slotCategory}
                          </p>
                        )}
                      </div>
                      {!isEditing && (
                        <button
                          ref={changeButtonRef}
                          type="button"
                          onClick={() => {
                            setSelectedTypeId(null);
                            setSelectedItemType('want-type');
                            setType('');
                            setName('');
                          }}
                          className="sidebar-focus-ring px-2 py-1 text-[10px] font-medium rounded-md bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex-shrink-0"
                        >
                          Change
                        </button>
                      )}
                      </div>
                    </div>

                    {/* ── Tab bar — order-2 when isBottom so content floats above ── */}
                    <div className={isBottom ? 'order-2' : ''}>
                      <FormTabBar
                        activeTab={activeFormTab}
                        onTabChange={(tab) => setActiveFormTab(tab)}
                        badges={tabBadges}
                        isBottom={isBottom}
                      />
                    </div>

                    {/* ── Tab content (scrollable) — order-1 when isBottom ── */}
                    <div className={classNames(
                      'flex-1 min-h-0 overflow-y-auto space-y-3 pr-0.5',
                      isBottom ? 'order-1' : ''
                    )}>

                      {/* NAME tab */}
                      {activeFormTab === 'name' && (
                        <div className="space-y-3 pt-1">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                              Want Name <span className="text-red-500">*</span>
                            </label>
                            <input
                              ref={nameInputRef}
                              type="text"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              className="sidebar-focus-ring w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 dark:text-gray-100 focus:border-blue-400 dark:focus:border-blue-500 transition-colors"
                              placeholder="Auto-generated or enter custom name"
                              required
                            />
                            {!isValidWantName(name) && name.trim() && (
                              <p className="mt-1 text-xs text-red-600">
                                Invalid characters — use only letters, numbers, hyphens, underscores.
                              </p>
                            )}
                          </div>

                          {/* Owner selector */}
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 flex items-center gap-1">
                              <Crown className="w-3 h-3 text-amber-500" />
                              Owner <span className="text-gray-400 font-normal">(optional)</span>
                            </label>
                            {selectedOwner ? (
                              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-900/20">
                                <Crown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                                <span className="text-xs text-amber-800 dark:text-amber-200 font-mono truncate flex-1">
                                  {selectedOwner.metadata?.name || selectedOwner.id}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => { setSelectedOwner(null); setOwnerSearchQuery(''); }}
                                  className="text-xs text-amber-600 dark:text-amber-400 hover:text-red-500 dark:hover:text-red-400 ml-1"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <div className="relative">
                                <input
                                  type="text"
                                  value={ownerSearchQuery}
                                  onChange={(e) => { setOwnerSearchQuery(e.target.value); setOwnerDropdownOpen(true); }}
                                  onFocus={() => setOwnerDropdownOpen(true)}
                                  onBlur={() => setTimeout(() => setOwnerDropdownOpen(false), 150)}
                                  placeholder="Search wants to set as owner…"
                                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 dark:text-gray-100 focus:border-blue-400 dark:focus:border-blue-500 transition-colors"
                                />
                                {ownerDropdownOpen && (
                                  <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg max-h-40 overflow-y-auto">
                                    {(wants ?? [])
                                      .filter(w => {
                                        const n = w.metadata?.name || '';
                                        return n && n !== name && n.toLowerCase().includes(ownerSearchQuery.toLowerCase());
                                      })
                                      .slice(0, 20)
                                      .map(w => (
                                        <button
                                          key={w.metadata?.id || w.id}
                                          type="button"
                                          onMouseDown={() => { setSelectedOwner(w); setOwnerSearchQuery(''); setOwnerDropdownOpen(false); }}
                                          className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 font-mono"
                                        >
                                          {w.metadata?.name || w.id}
                                        </button>
                                      ))
                                    }
                                    {(wants ?? []).filter(w => {
                                      const n = w.metadata?.name || '';
                                      return n && n !== name && n.toLowerCase().includes(ownerSearchQuery.toLowerCase());
                                    }).length === 0 && (
                                      <div className="px-3 py-2 text-xs text-gray-400">No wants found</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                        </div>
                      )}

                      {/* PARAMS tab — RPG-style grid cards */}
                      {activeFormTab === 'params' && (
                        <div className="pt-1">
                          <ParameterGridSection
                            parameters={params}
                            parameterDefinitions={recipeParamDefs ?? selectedWantType?.parameters}
                            stateDefs={selectedWantType?.state}
                            onChange={setParams}
                            isActive={activeFormTab === 'params'}
                            recommendations={paramRecs}
                            onApplyRecommendation={applyRecommendation}
                            sidebarDetailFocused={sidebarDetailFocused}
                            focusRequest={sidebarFocusRequest}
                            onDetailFocusEnter={claimKeys}
                          />
                        </div>
                      )}

                      {/* LABELS tab */}
                      {activeFormTab === 'labels' && (
                        <LabelsSection
                          ref={labelsSectionRef}
                          labels={labels}
                          onChange={setLabels}
                          isCollapsed={false}
                          onToggleCollapse={() => {}}
                          navigationCallbacks={tabNav}
                          hideHeader={true}
                        />
                      )}

                      {/* SCHEDULE tab */}
                      {activeFormTab === 'schedule' && (
                        <SchedulingSection
                          ref={schedulingSectionRef}
                          schedules={when}
                          onChange={setWhen}
                          isCollapsed={false}
                          onToggleCollapse={() => {}}
                          navigationCallbacks={tabNav}
                          hideHeader={true}
                        />
                      )}

                      {/* DEPS tab */}
                      {activeFormTab === 'deps' && (
                        <DependenciesSection
                          ref={dependenciesSectionRef}
                          dependencies={using}
                          onChange={setUsing}
                          isCollapsed={false}
                          onToggleCollapse={() => {}}
                          navigationCallbacks={tabNav}
                          hideHeader={true}
                        />
                      )}

                      {/* EXPOSE tab */}
                      {activeFormTab === 'expose' && (
                        <ExposeSection
                          exposes={exposes}
                          onExposesChange={setExposes}
                          stateDefs={selectedWantType?.state}
                        />
                      )}

                      {/* IMPORT tab */}
                      {activeFormTab === 'import' && (
                        <ImportSection
                          imports={imports}
                          onImportsChange={setImports}
                          stateDefs={selectedWantType?.state}
                          globalStateKeys={globalStateKeys}
                        />
                      )}
                    </div>
                  </>
                );
              })()
            )}
          </>
        ) : (
          <>
            {/* YAML Editor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Want Configuration (YAML)
              </label>
              <YamlEditor
                value={yamlContent}
                onChange={setYamlContent}
                placeholder="Enter want configuration in YAML format..."
              />
            </div>
          </>
        )}

        {/* Error Display */}
        {validationError && (
          <ErrorDisplay error={validationError} />
        )}

        {apiError && (
          <ErrorDisplay error={apiError} />
        )}

        {error && (
          <ErrorDisplay error={error} />
        )}

      </form>
      </PanelShell>
    </RightSidebar>
  );
});