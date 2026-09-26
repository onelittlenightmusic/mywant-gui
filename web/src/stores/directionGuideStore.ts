import { create } from 'zustand';

interface DirectionGuideStore {
  /** Want ID currently showing the large canvas picker, or null if closed */
  activeWantId: string | null;
  /** Live preview vector while dragging/nudging (grid-cell units) */
  previewDx: number;
  previewDy: number;
  /**
   * The webhook action the picked vector is sent as. A direction sets its
   * heading (`set`); a picture moves its pin (`pin`). Same picker, same grid,
   * same gesture — only what the vector means differs.
   */
  action: 'set' | 'pin';

  enter: (wantId: string, dx: number, dy: number, action?: 'set' | 'pin') => void;
  setPreview: (dx: number, dy: number) => void;
  clear: () => void;
}

/**
 * Bridges DirectionCardPlugin (which knows when it's inner-focused) and
 * WantCanvas (which knows the want's canvas position and owns the pointer
 * drag interaction) without prop-drilling through Dashboard/WantCard/the
 * plugin registry.
 */
export const useDirectionGuideStore = create<DirectionGuideStore>((set) => ({
  activeWantId: null,
  previewDx: 1,
  previewDy: 0,
  action: 'set',

  enter: (wantId, dx, dy, action = 'set') => set({ activeWantId: wantId, previewDx: dx, previewDy: dy, action }),
  setPreview: (dx, dy) => set({ previewDx: dx, previewDy: dy }),
  clear: () => set({ activeWantId: null }),
}));
