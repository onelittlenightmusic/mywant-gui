import { create } from 'zustand';
import { apiClient } from '@/api/client';
import {
  WantTypeListItem,
  WantTypeDefinition,
  WantTypeFilters,
} from '@/types/wantType';
import { setDynamicCategoryIconMap, setDynamicCategoryBgMap, setDynamicTypeIconMap } from '@/components/dashboard/WantTypeVisuals';
import { setDynamicTypeToneColorMap } from '@/utils/backgroundStyles';

interface WantTypeStore {
  // State
  wantTypes: WantTypeListItem[];
  selectedWantType: WantTypeDefinition | null;
  categories: string[];
  patterns: string[];
  loading: boolean;
  error: string | null;
  filters: WantTypeFilters;
  pendingRequest?: string; // Track pending want type request
  categoryIconMap: Record<string, string>; // category → Lucide icon name (from labels)
  categoryBgMap: { light: Record<string, string>; dark: Record<string, string> }; // category → gradient (from labels)
  typeIconMap: Record<string, string>; // type name → Lucide icon name (from labels['type-icon'])
  typeToneColorMap: Record<string, string>; // type name → hex tone color (from labels['type-tone-color'])

  // Actions
  fetchWantTypes: () => Promise<void>;
  getWantType: (name: string) => Promise<void>;
  setSelectedWantType: (wantType: WantTypeDefinition | null) => void;
  setFilters: (filters: Partial<WantTypeFilters>) => void;
  clearFilters: () => void;
  clearError: () => void;

  // Computed
  getFilteredWantTypes: () => WantTypeListItem[];
  getCategories: () => string[];
  getPatterns: () => string[];
}

export const useWantTypeStore = create<WantTypeStore>((set, get) => ({
  // Initial state
  wantTypes: [],
  selectedWantType: null,
  categories: [],
  patterns: [],
  loading: false,
  error: null,
  filters: {},
  pendingRequest: undefined,
  categoryIconMap: {},
  categoryBgMap: { light: {}, dark: {} },
  typeIconMap: {},
  typeToneColorMap: {},

  // Fetch all want types with optional filters
  fetchWantTypes: async () => {
    set({ loading: true, error: null });
    try {
      const { filters } = get();
      const response = await apiClient.listWantTypes(
        filters.category,
        filters.pattern
      );

      // Extract unique categories and patterns
      const categories = new Set<string>();
      const patterns = new Set<string>();
      // Build dynamic category maps from labels
      const iconMap:    Record<string, string> = {};
      const bgLight:    Record<string, string> = {};
      const bgDark:     Record<string, string> = {};
      const typeIconMap: Record<string, string> = {};
      const typeToneColorMap: Record<string, string> = {};

      response.wantTypes.forEach(wt => {
        categories.add(wt.category);
        patterns.add(wt.pattern);
        const cat = wt.category.toLowerCase();
        const iconName = wt.labels?.['category-icon'];
        if (iconName  && !iconMap[cat])  iconMap[cat]  = iconName;
        const bgL = wt.labels?.['category-bg-light'];
        if (bgL && !bgLight[cat]) bgLight[cat] = bgL;
        const bgD = wt.labels?.['category-bg-dark'];
        if (bgD && !bgDark[cat])  bgDark[cat]  = bgD;
        // Per-type icon: labels['type-icon'] overrides the category icon for this specific type.
        const typeIcon = wt.labels?.['type-icon'];
        if (typeIcon) typeIconMap[wt.name.toLowerCase()] = typeIcon;
        // Per-type tone color: labels['type-tone-color'] tints this type's 3D tile side faces.
        const toneColor = wt.labels?.['type-tone-color'];
        if (toneColor) typeToneColorMap[wt.name.toLowerCase()] = toneColor;
      });

      // Update module-level variables (for non-React callers) AND store state
      // (store state change triggers React re-renders in subscribed components)
      setDynamicCategoryIconMap(iconMap);
      setDynamicCategoryBgMap(bgLight, bgDark);
      setDynamicTypeIconMap(typeIconMap);
      setDynamicTypeToneColorMap(typeToneColorMap);

      // Sort deterministically by name to ensure consistent ordering across fetches
      const sortedWantTypes = [...response.wantTypes].sort((a, b) => {
        const nameA = a.name || '';
        const nameB = b.name || '';
        return nameA.localeCompare(nameB);
      });

      set({
        wantTypes: sortedWantTypes,
        categories: Array.from(categories).sort(),
        patterns: Array.from(patterns).sort(),
        categoryIconMap: iconMap,
        categoryBgMap: { light: bgLight, dark: bgDark },
        typeIconMap,
        typeToneColorMap,
        loading: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch want types';
      set({
        error: message,
        loading: false,
        wantTypes: [],
      });
    }
  },

  // Fetch detailed want type - prevent duplicate concurrent requests
  getWantType: async (name: string) => {
    const current = get();

    // Skip if there's already a pending request for this want type
    if (current.pendingRequest === name) {
      return;
    }

    set({ pendingRequest: name, error: null });
    try {
      const response = await apiClient.getWantType(name);
      set({
        selectedWantType: response,
        pendingRequest: undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch want type details';
      set({
        error: message,
        selectedWantType: null,
        pendingRequest: undefined,
      });
    }
  },

  // Set selected want type
  setSelectedWantType: (wantType: WantTypeDefinition | null) => {
    set({ selectedWantType: wantType });
  },

  // Update filters and refetch
  setFilters: (newFilters: Partial<WantTypeFilters>) => {
    const currentFilters = get().filters;
    set({ filters: { ...currentFilters, ...newFilters } });
    // Trigger refetch with new filters
    setTimeout(() => {
      get().fetchWantTypes();
    }, 0);
  },

  // Clear all filters
  clearFilters: () => {
    set({ filters: {} });
    setTimeout(() => {
      get().fetchWantTypes();
    }, 0);
  },

  // Clear error message
  clearError: () => {
    set({ error: null });
  },

  // Get filtered want types based on search term
  getFilteredWantTypes: () => {
    const { wantTypes, filters } = get();
    let filtered = wantTypes;

    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(
        wt =>
          wt.name.toLowerCase().includes(term) ||
          wt.title.toLowerCase().includes(term)
      );
    }

    return filtered;
  },

  // Get unique categories
  getCategories: () => {
    const { categories } = get();
    return categories;
  },

  // Get unique patterns
  getPatterns: () => {
    const { patterns } = get();
    return patterns;
  },
}));
