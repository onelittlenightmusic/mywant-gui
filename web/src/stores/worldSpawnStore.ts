import { create } from 'zustand';

/**
 * Why the character is being put somewhere. Carried with the position because
 * arriving is a different event depending on what brought you: clearing a stage
 * is an achievement and gets a fanfare, opening a world is just a journey.
 * Whoever consumes the spawn is the one that moved the character, so it is the
 * one that sounds — the same rule the footsteps and the collision knock follow.
 */
export type SpawnReason = 'stage' | 'world';

interface WorldSpawnStore {
  /** Grid position to teleport CursorMan to, or null when nothing is pending. */
  pendingSpawn: { x: number; y: number; reason: SpawnReason } | null;
  requestSpawn: (x: number, y: number, reason: SpawnReason) => void;
  clearSpawn: () => void;
}

/**
 * Same-tab bridge from WorldCardPlugin (deep in the WantCard tree, no access
 * to Dashboard's local cursorManPos state / wantCanvasRef) to Dashboard.tsx,
 * which owns the only imperative CursorMan-teleport path (WantCanvas's
 * syncCursorManPos ref method + the cursorManPos state that persists it).
 * Mirrors tabHopStore.ts's minimal local-zustand-bridge pattern.
 */
export const useWorldSpawnStore = create<WorldSpawnStore>((set) => ({
  pendingSpawn: null,
  requestSpawn: (x, y, reason) => set({ pendingSpawn: { x, y, reason } }),
  clearSpawn: () => set({ pendingSpawn: null }),
}));
