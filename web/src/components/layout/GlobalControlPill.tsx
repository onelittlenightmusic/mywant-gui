import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Activity, PauseOctagon, Pause, Play, Bell, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAttentionStore } from '@/stores/attentionStore';
import { useMarkJumpStore } from '@/stores/markJumpStore';
import type { AttentionItem } from '@/api/client';
import { classNames } from '@/utils/helpers';
import { Tooltip } from '@/components/ui/Tooltip';
import { useSystemPauseStore } from '@/stores/systemPauseStore';
import { usePrefersReducedMotion } from '@/components/ui/originReveal';
import { playSound } from '@/utils/sounds';

/**
 * The global control pill: the controls that mean the same thing on every tab.
 *
 *   status  — running or paused, as a sign rather than a button
 *   toggle  — pause everything / play again (the emergency stop)
 *   bell    — the hamburger menu's attention dot
 *   bubble  — saying something (the interact bubble), handed in by the header
 *
 * Other sites' pill (pill.js) also leads with a warp back here; in the GUI
 * there is nowhere to warp to, so it is not drawn at all.
 *
 * The same pill is drawn on other sites by the extension and the bookmarklet
 * (webext-src/pill.js), in the same place, so an emergency stop is one press
 * away wherever the user is. The two are kept looking alike by hand: pill.js
 * cannot import this, so change both together.
 *
 *
 * On a phone the header has no room for four cells, so the pill shrinks to one
 * round cell — the status sign, still carrying the attention dot — and a tap
 * opens the whole pill over the title, where a second tap reaches the stop.
 * Tapping the status sign again shrinks it back, as do a tap elsewhere and
 * Escape.
 *
 * The round cell IS the pill, just narrow: one element whose width runs
 * between its height and its full width, so the frame is whole at every
 * moment of the change and nothing is laid over anything. (A clip-path over a
 * second copy was tried first — it cut the ring, which is drawn outside the
 * box, and the two copies never quite lined up.) The frame is a border, inside
 * the box, for the same reason.
 */
export interface GlobalControlPillProps {
  isBottom: boolean;
  /** Something in the menu wants attention. */
  attention: boolean;
  attentionColor?: string;
  /** What the bell does here — opens the menu, where the dot's entry is. */
  onBell?: () => void;
  onPointerDown?: () => void;
  /** Phone width: draw the shrunk pill (see above). */
  compact?: boolean;
  /**
   * The talking cell, built by the header, which owns what it needs (the
   * robot provider, the narrow-screen overlay): the inline interact bubble on
   * a wide screen, the character button that opens the overlay otherwise.
   */
  bubble?: React.ReactNode;
  /**
   * The cell the header's Select cursor is on ('pill-pause', 'pill-attention',
   * 'pill-bell', 'pill-talk'), ringed the way the header's own cells are.
   */
  focusedCell?: string;
}

export const GlobalControlPill: React.FC<GlobalControlPillProps> = ({
  isBottom, attention, attentionColor, onBell, onPointerDown, compact = false, bubble, focusedCell,
}) => {
  const ring = (id: string) => focusedCell === id && 'ring-2 ring-inset ring-sky-400';
  const [open, setOpen] = useState(false);
  const reduceMotion = usePrefersReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  // Shrunk width (the pill's height — the status cell is square) and full
  // width (the row of cells plus the border), both measured, never guessed:
  // the header's height and the cells' widths change with the breakpoint.
  const [shrunkW, setShrunkW] = useState(52);
  const [fullW, setFullW] = useState(0);
  useLayoutEffect(() => {
    if (!compact) return;
    const wrap = wrapRef.current;
    const row = rowRef.current;
    if (!wrap || !row) return;
    const measure = () => {
      setShrunkW(wrap.offsetHeight);
      setFullW(row.offsetWidth + 2);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    ro.observe(row);
    return () => ro.disconnect();
  }, [compact]);

  // One sound per change of state, whichever way it was asked for (the sign,
  // a tap elsewhere, Escape) — so it lives on the state, not on the handlers.
  // Not on mount, and not when widening the window unfolds it silently.
  const prevOpenRef = useRef(open);
  useEffect(() => {
    if (open === prevOpenRef.current) return;
    prevOpenRef.current = open;
    if (compact) playSound(open ? 'pillExpand' : 'pillShrink');
  }, [open, compact]);

  // Widening the window puts the whole pill back in the row.
  useEffect(() => { if (!compact) setOpen(false); }, [compact]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const paused = useSystemPauseStore(s => s.paused);
  const busy = useSystemPauseStore(s => s.busy);
  const toggle = useSystemPauseStore(s => s.toggle);
  const attentionItems = useAttentionStore(s => s.items);
  const navigate = useNavigate();
  const known = paused !== null;
  const shrunk = compact && !open;

  const cell = 'relative flex flex-col items-center justify-center gap-0.5 min-w-[40px] sm:min-w-[52px] px-1 sm:px-2 h-full transition-colors duration-150 focus:outline-none';
  const label = 'text-[9px] font-bold leading-none uppercase tracking-tighter hidden sm:block';
  const icon = 'h-5 w-5 sm:h-6 sm:w-6';
  // Cells hidden inside the shrunk pill are out of reach of Tab, too.
  const hiddenTab = shrunk ? -1 : undefined;

  const dot = (className: string) => attention && (
    <span
      aria-hidden
      className={classNames('absolute block w-2 h-2 rounded-full ring-2 ring-white dark:ring-gray-800', className)}
      style={{ background: attentionColor ?? '#ef4444' }}
    />
  );

  // Opening decelerates into place; shrinking is quicker and gets out of the
  // way. No overshoot — a frame that bulges past its contents and snaps back
  // is what read as rough.
  const motion = reduceMotion ? 'none' : open
    ? 'width 280ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 280ms ease'
    : 'width 200ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 200ms ease';
  const cellsMotion = reduceMotion ? 'none' : open
    ? 'opacity 180ms ease 70ms'
    : 'opacity 100ms ease';

  const statusSign = (
    <>
      {paused ? <PauseOctagon className={icon} /> : <Activity className={classNames(icon, known && 'animate-pulse')} />}
      <span className={label}>{!known ? '—' : paused ? 'Paused' : 'Running'}</span>
    </>
  );
  const statusTone = !known ? 'text-gray-400 dark:text-gray-500'
    : paused ? 'bg-amber-500 text-white'
    : 'text-emerald-600 dark:text-emerald-400';

  const pill = (
    <div
      role="group"
      aria-label="Global control"
      data-global-control-pill
      className={classNames(
        'rounded-full overflow-hidden bg-white dark:bg-gray-800 border',
        paused ? 'border-amber-500' : 'border-gray-300 dark:border-gray-700',
        compact
          ? classNames('absolute left-0 inset-y-0 z-10', open ? 'shadow-lg' : 'shadow-sm')
          : 'flex self-stretch flex-shrink-0 -my-1 sm:-my-2 shadow-sm',
      )}
      style={compact ? { width: open && fullW ? fullW : shrunkW, transition: motion } : undefined}
    >
      <div ref={rowRef} className="flex items-stretch h-full w-max">
        {/* Status — a sign. On a phone it is also what opens and shrinks the
            pill, so there it is a button. */}
        {compact ? (
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            // No tap click here: the air of the pill opening or shrinking is
            // this button's sound, and the two together land as one thud.
            aria-expanded={open}
            aria-label={`Global control: ${!known ? 'unknown' : paused ? 'paused' : 'running'}${attention ? ', something new' : ''}`}
            className={classNames(cell, 'aspect-square !min-w-0 !px-0', statusTone)}
          >
            {statusSign}
            {/* Inside the circle's curve — the pill clips its corners now. */}
            {shrunk && dot('top-[18%] right-[18%]')}
          </button>
        ) : (
          <div role="status" aria-live="polite" className={classNames(cell, 'pl-3 sm:pl-4', statusTone)}>
            {statusSign}
          </div>
        )}

        <div
          className="flex items-stretch"
          style={compact ? { opacity: open ? 1 : 0, transition: cellsMotion } : undefined}
        >
          {/* Toggle — a grid button, like the header's own cells. */}
          <Tooltip label={paused ? 'Resume everything' : 'Pause everything'} below={!isBottom}>
            <button
              type="button"
              onClick={() => { void toggle(); }}
              onPointerDown={onPointerDown}
              disabled={!known || busy}
              tabIndex={hiddenTab}
              aria-label={paused ? 'Resume all wants' : 'Pause all wants'}
              data-header-btn-id="global-pause"
              className={classNames(
                cell, 'border-l border-gray-200 dark:border-gray-700 disabled:opacity-50', ring('pill-pause'),
                paused
                  ? 'bg-emerald-600/90 text-white hover:brightness-110'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700',
              )}
            >
              {paused ? <Play className={icon} /> : <Pause className={icon} />}
              <span className={label}>{paused ? 'Play' : 'Pause'}</span>
            </button>
          </Tooltip>

          {/* Attention — only while something needs a person: an approval, a
              failed want, a tab run that failed or hit a login. Pressing it
              goes to the first of them (see goToAttention). */}
          {attentionItems.length > 0 && (
            <Tooltip label={attentionLabel(attentionItems[0], attentionItems.length)} below={!isBottom}>
              <button
                type="button"
                onClick={() => goToAttention(attentionItems[0], navigate)}
                onPointerDown={onPointerDown}
                tabIndex={hiddenTab}
                aria-label={`Needs you: ${attentionItems.length}`}
                data-header-btn-id="global-attention"
                className={classNames(cell, 'border-l border-gray-200 dark:border-gray-700 bg-amber-500 text-white hover:brightness-110', ring('pill-attention'))}
              >
                <AlertTriangle className={classNames(icon, 'rounded motion-safe:animate-[mwblink_1.6s_ease-in-out_infinite]')} />
                <span className={label}>Alert</span>
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold leading-4 text-center">
                  {attentionItems.length}
                </span>
              </button>
            </Tooltip>
          )}

          {/* Bell — the menu's attention dot, repeated where every tab has it. */}
          <Tooltip label={attention ? 'Something is waiting in the menu' : 'Nothing new'} below={!isBottom}>
            <button
              type="button"
              onClick={onBell}
              onPointerDown={onPointerDown}
              tabIndex={hiddenTab}
              aria-label={attention ? 'Notifications: something new' : 'Notifications: nothing new'}
              className={classNames(cell, 'border-l border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700', ring('pill-bell'))}
            >
              <Bell className={icon} />
              <span className={label}>News</span>
              {dot('top-1.5 right-1.5 sm:right-2')}
            </button>
          </Tooltip>
          {/* Talking — the header's interact bubble, or on a narrow screen the
              character that opens it. Last, so it has the rounded end to itself. */}
          {bubble && (
            <div className={classNames('flex items-stretch border-l border-gray-200 dark:border-gray-700 pr-1.5 sm:pr-2', ring('pill-talk'))}>
              {bubble}
            </div>
          )}


        </div>
      </div>
    </div>
  );

  if (!compact) return pill;

  // On a phone the pill holds a square of the row and grows over the title.
  return (
    <div
      ref={wrapRef}
      // A real width, not aspect-square: a width derived from a stretched
      // height counts as nothing while the row is being laid out, so the
      // header made no room for the pill and it spilled over its neighbours.
      className="relative self-stretch flex-shrink-0 -my-1 w-[52px]"
    >
      {pill}
    </div>
  );
};

/** What the attention button says about the first item, for its tooltip. */
function attentionLabel(item: AttentionItem, count: number): string {
  const what = item.kind === 'approval' ? '承認待ち'
    : item.kind === 'needs_human' ? (item.detail === 'captcha' ? 'CAPTCHA' : 'ログインが必要')
    : item.kind === 'web_failed' ? 'タブでの自動操作が失敗'
    : 'エラー';
  return `${what}: ${item.title}${count > 1 ? `（ほか${count - 1}件）` : ''}`;
}

/**
 * Warp to where an item is. A page (a tab run's URL) is brought forward by the
 * extension if it is here — bridge.js relays the ask, and the extension raises
 * the tab showing it or opens one — or opened in a new tab if not. An item
 * that lives in the GUI is gone to: the want on the board — for an approval,
 * the one asking, whose question is up on every page already
 * (PendingConfirmOverlay).
 */
export function goToAttention(item: AttentionItem, navigate: (to: string) => void): void {
  if (item.url) {
    if (document.documentElement.dataset.mywantExtension === 'true') {
      window.postMessage({ source: 'mywant-gui', type: 'MYWANT_WARP_TO', url: item.url }, window.location.origin);
    } else {
      window.open(item.url, '_blank', 'noopener');
    }
    return;
  }
  if (item.want_id) {
    useMarkJumpStore.getState().requestJump({ kind: 'want', id: item.want_id, name: item.title });
    navigate('/dashboard');
  }
}
