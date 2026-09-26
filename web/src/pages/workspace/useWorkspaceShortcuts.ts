import { useEffect, useRef } from 'react';
import { Want } from '@/types/want';

/**
 * The single-letter keys, and what they mean anywhere in the workspace.
 *
 * a add · s select mode · Ctrl/Cmd+A select all · q the suggestion box ·
 * x radar · l the list · c the canvas · g global · ? help.
 *
 * `s` is select mode's, plainly. It was the summary panel's until that panel
 * stopped existing as a panel — the summary is part of the detail and global
 * sidebars now, opened by opening those — and select mode is a mode you go in
 * and out of all day, so it takes the key rather than the Shift+S it had been
 * pushed onto.
 *
 * All of them are off while the Add Want form is open and while the caret is
 * in a field — a shortcut that fires mid-sentence is a bug, not a shortcut.
 *
 * Deliberately not the board's: `l` and `c` are how you get between the two
 * pages, so they have to work on both.
 *
 * Deliberately NOT on useInputActions' `shortcuts` channel, unlike the other
 * letter shortcuts in the app. The channel routes through _keyOwner, where a
 * focus-derived claim is enough to win — and the detail panel opens BY ITSELF
 * when the character walks onto a tile, so its card grid would be holding a
 * claim without the user ever asking for it. `l`, `c` and `g` are the way OUT
 * of wherever you are; a surface that took focus on its own must not be able
 * to take them with it. A modal that the user did open should win, and does
 * not here — that is the cost of staying outside, and it is the smaller one.
 *
 * The one real conflict the channel would have solved is solved directly
 * instead: `x` and `g` are also the batch bar's stop / group, so this hook
 * stops offering those two while the bar has a selection (hasBatchSelection).
 * Two components no longer answer one press, which is what the arbitration was
 * for — no listener has to out-shout the other.
 *
 * `s` is deliberately NOT among them any more. It used to be, back when it
 * meant "summary" here and "start" there and neither reading was the one the
 * press was about. Now it is the key that turns select mode on, and the key
 * that turns a mode on has to be the key that turns it off — a press meaning
 * "I am done picking" that instead STARTS the three wants you had picked is
 * the worst answer available. The bar's start moved to `r` to give it back
 * (see BatchActionBar).
 */
export interface WorkspaceShortcutsApi {
  sidebar: {
    showForm: boolean;
    openBatch: () => void;
    toggleGlobal: () => void;
  };
  isSelectMode: boolean;
  /**
   * Whether the batch bar is up with something selected — i.e. whether it is
   * currently claiming x / g. Not `isSelectMode`: entering select mode
   * without picking anything leaves the bar with no actions, and withholding
   * the letters then would just make them dead.
   */
  hasBatchSelection: boolean;
  canvasMode: boolean;
  selectedWant: Want | null;
  /** The wants the grid is currently showing — what "select all" means. */
  filteredWants: Want[];
  setSelectedWantIds: (ids: Set<string>) => void;
  setRadarMode: React.Dispatch<React.SetStateAction<boolean>>;
  setCanvasMode: (on: boolean) => void;
  onCreateWant: () => void;
  onToggleSelectMode: () => void;
}

/**
 * Put the cursor in the interact bubble, optionally with its first character
 * already typed.
 *
 * Deferred a frame: on the phone the same press can be what reveals the box,
 * and focusing a node that is not laid out yet does nothing.
 *
 * The character is written the way a person would type it rather than assigned
 * to `value`: the box is a controlled React input, and a plain assignment moves
 * the caret without telling React, so the next keystroke wipes it.
 */
function focusInteractInput(prefill: string): void {
  requestAnimationFrame(() => {
    const el = document.querySelector('[data-interact-input]') as HTMLInputElement | null;
    if (!el || el.offsetParent === null) return;
    el.focus();
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (!prefill) return;
    const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setValue?.call(el, el.value + prefill);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

export function useWorkspaceShortcuts(api: WorkspaceShortcutsApi) {
  // One listener for the life of the page: everything it needs is read at the
  // moment a key is pressed, so nothing here has to be re-bound.
  const apiRef = useRef(api);
  apiRef.current = api;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const a = apiRef.current;
      // Every shortcut is off while the Add Want form is open.
      if (a.sidebar.showForm) return;

      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      const plain = !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey;

      // Cmd/Ctrl+A first: checked before plain 'a' so the two never collide,
      // and preventDefault before the mode check so the browser's own
      // select-all never runs even when there is nothing to select.
      if (e.key.toLowerCase() === 'a' && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        if (a.isSelectMode) {
          const allWantIds = new Set(
            a.filteredWants.map(w => w.metadata?.id || w.id || '').filter(id => id !== ''),
          );
          a.setSelectedWantIds(allWantIds);
          if (allWantIds.size > 0) a.sidebar.openBatch();
        }
        return;
      }

      // x / g belong to the batch bar for as long as it has a selection to
      // act on. Withholding them here is the whole arbitration: two components
      // answering one press is the thing being removed, and the bar's own
      // handler no longer has to shout over this one.
      //
      // `s` is not withheld: it is how you leave the mode, and it has to keep
      // meaning that with things ticked — see the note at the top of the file.
      if (a.hasBatchSelection && plain && (e.key === 'x' || e.key === 'g')) return;

      if (e.key === 'a' && plain) {
        e.preventDefault();
        a.onCreateWant();
      } else if (e.key === 's' && plain) {
        e.preventDefault();
        a.onToggleSelectMode();
      } else if ((e.key === 'q' && plain) || e.key === '@' || (e.key === '/' && plain)) {
        e.preventDefault();
        // @ and / are q with the first character already typed.
        //
        // Both of them ARE the first character of something: @robot addresses
        // the agent, / runs a command. Typing one at the board meant nothing
        // before, so reaching the box with it costs no other gesture — and
        // arriving with the character already in the box is what the press was
        // for. Shift is allowed through for @, which is a shifted key on most
        // layouts.
        focusInteractInput(e.key === 'q' ? '' : e.key);
      } else if (e.key === 'x' && plain) {
        e.preventDefault();
        // Rotation/length guide entry moved to B/Escape/Space long-press (see
        // the rotation-guide useInputActions call on the board), so this is
        // just the plain radar-mode toggle now.
        if (!(a.canvasMode && a.selectedWant)) a.setRadarMode(prev => !prev);
      } else if (e.key === 'l' && plain) {
        e.preventDefault();
        a.setCanvasMode(false);
      } else if (e.key === 'c' && plain) {
        e.preventDefault();
        a.setCanvasMode(true);
      } else if (e.key === 'g' && plain) {
        e.preventDefault();
        a.sidebar.toggleGlobal();
      } else if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // The modal belongs to Header, which owns its state; pressing its own
        // button is how this reaches it.
        e.preventDefault();
        const helpBtn = document.querySelector('[data-header-btn-id="help"]') as HTMLButtonElement | null;
        helpBtn?.click();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
