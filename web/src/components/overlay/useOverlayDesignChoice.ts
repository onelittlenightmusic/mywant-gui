import { useEffect, useState } from 'react';
import { apiClient } from '@/api/client';
import { useCharacterStore } from '@/stores/characterStore';
import type { CharacterDisplay } from '@/types/character';
import {
  listOverlayDesigns, onOverlayDesignRegistered, currentOverlayDesignId, setLocalOverlayDesign, withOverlayDesign,
  type OverlayDesign,
} from './design';

export interface OverlayDesignChoice {
  /** Every design installed — the built-in grid, and any a custom or an extension added. */
  designs: OverlayDesign[];
  /** The design chosen (grid when none). */
  current: string;
  /**
   * Choose one: saved on my character's display, with its portable values —
   * or kept in this browser when there is no character (see design.ts).
   */
  choose: (id: string) => Promise<void>;
  saving: boolean;
  /** Whether the choice is kept on a character (false: in this browser). */
  onCharacter: boolean;
}

/**
 * Picking an overlay design — for any screen that offers the choice.
 *
 * The choice is my character's, like the rest of how the app looks, and is
 * stored on its display (ext.overlay: the id and the design's portable values,
 * which the browser extension reads). A design installed later — a design
 * custom loaded after the first paint — joins the list when it registers.
 */
export function useOverlayDesignChoice(): OverlayDesignChoice {
  const me = useCharacterStore(s => s.characters.find(c => c.id === s.myCharacterId) ?? null);
  const [, bump] = useState(0);
  useEffect(() => onOverlayDesignRegistered(() => bump(n => n + 1)), []);
  const [saving, setSaving] = useState(false);

  const choose = async (id: string) => {
    if (saving) return;
    if (!me) { setLocalOverlayDesign(id); return; }
    const display: CharacterDisplay = { ...(me.display ?? {}), ext: withOverlayDesign(me.display ?? {}, id) };
    setSaving(true);
    try {
      const saved = await apiClient.setCharacterDisplay(me.id, display);
      useCharacterStore.setState(s => ({
        characters: s.characters.map(c => (c.id === me.id ? { ...c, display: saved?.display ?? display } : c)),
      }));
    } finally {
      setSaving(false);
    }
  };

  return {
    designs: listOverlayDesigns(),
    current: currentOverlayDesignId(me?.display, !!me),
    choose,
    saving,
    onCharacter: !!me,
  };
}
