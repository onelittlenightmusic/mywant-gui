import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAttentionStore } from '@/stores/attentionStore';
import { useMarkJumpStore } from '@/stores/markJumpStore';
import type { AttentionItem } from '@/api/client';
import { classNames } from '@/utils/helpers';
import { useOverlayDesign } from '@/components/overlay';
import { useDarkMode } from '@/hooks/useDarkMode';
import {
  controlPillIcon, controlPillVars, ensureControlPillCss, CONTROL_PILL_LABELS, type ControlPillIcon,
} from '@/shared/controlPill';
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
 * (mywant-guiex's webext-src/pill.js), in the same place, so an emergency stop
 * is one press away wherever the user is. Both draw it from shared/controlPill
 * — the stylesheet, the icons, the words and the overlay design's values — so
 * they look alike by construction; what is here is only this host's: where the
 * pill sits in the header, how it opens on a phone, and what each cell does.
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
// The shared pill's stylesheet, once, before the first paint of the header.
if (typeof document !== 'undefined') ensureControlPillCss(document);

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

  // Drawn from the shared pill (shared/controlPill): the same elements, classes,
  // icons and words the browser extension draws on every other page, in the
  // overlay design this person picked — its values set on the pill as custom
  // properties.
  const design = useOverlayDesign();
  const isDark = useDarkMode();
  const designVars = controlPillVars(design.portable) as React.CSSProperties;
  // Cells hidden inside the shrunk pill are out of reach of Tab, too.
  const hiddenTab = shrunk ? -1 : undefined;
  const focus = (id: string) => focusedCell === id && 'mwp-focus';
  const icon = (name: ControlPillIcon) => (
    <span className="mwp-icon" dangerouslySetInnerHTML={{ __html: controlPillIcon(name) }} />
  );

  const dot = (style?: React.CSSProperties) => attention && (
    <span aria-hidden className="mwp-dot" style={{ ...(attentionColor ? { background: attentionColor } : {}), ...style }} />
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
      {icon(paused ? 'paused' : 'activity')}
      <span className="mwp-label">{!known ? CONTROL_PILL_LABELS.unknown : paused ? CONTROL_PILL_LABELS.paused : CONTROL_PILL_LABELS.running}</span>
    </>
  );
  const called = attentionItems.length > 0;
  const statusClass = classNames('mwp-cell mwp-status mwp-start', !known && 'is-unknown', paused && 'is-paused', called && 'is-called');

  const pill = (
    <div
      role="group"
      aria-label="Global control"
      data-global-control-pill
      className={classNames(
        'mwp-pill', isDark && 'mwp-dark', paused && 'mwp-paused',
        compact
          ? classNames('absolute left-0 inset-y-0 z-10', open ? 'shadow-lg' : 'shadow-sm')
          : 'flex self-stretch flex-shrink-0 -my-1 sm:-my-2',
      )}
      style={{ ...designVars, ...(compact ? { width: open && fullW ? fullW : shrunkW, transition: motion } : {}) }}
    >
      <div ref={rowRef} className="mwp-row">
        {/* Status — a sign. On a phone it is also what opens and shrinks the
            pill, so there it is a button. */}
        {compact ? (
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            // No tap click here: the air of the pill opening or shrinking is
            // this button's sound, and the two together land as one thud.
            aria-expanded={open}
            aria-label={`Global control: ${!known ? 'unknown' : paused ? 'paused' : 'running'}${called ? ', needs you' : ''}${attention ? ', something new' : ''}`}
            className={classNames(statusClass, 'aspect-square !min-w-0 !px-0', shrunk && 'mwp-end')}
          >
            {statusSign}
            {/* Inside the circle's curve — the pill clips its corners now. */}
            {shrunk && dot({ top: '18%', right: '18%' })}
          </button>
        ) : (
          <div role="status" aria-live="polite" className={statusClass}>
            {statusSign}
          </div>
        )}

        <div
          className="mwp-group"
          style={compact ? { opacity: open ? 1 : 0, transition: cellsMotion } : undefined}
        >
          {/* Toggle — pause everything, or play again. */}
          <Tooltip label={paused ? 'Resume everything' : 'Pause everything'} below={!isBottom}>
            <button
              type="button"
              onClick={() => { void toggle(); }}
              onPointerDown={onPointerDown}
              disabled={!known || busy}
              tabIndex={hiddenTab}
              aria-label={paused ? 'Resume all wants' : 'Pause all wants'}
              data-header-btn-id="global-pause"
              className={classNames('mwp-cell mwp-toggle mwp-divided', paused && 'is-paused', focus('pill-pause'))}
            >
              {icon(paused ? 'play' : 'pause')}
              <span className="mwp-label">{paused ? CONTROL_PILL_LABELS.play : CONTROL_PILL_LABELS.pause}</span>
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
                className={classNames('mwp-cell mwp-alert mwp-divided', focus('pill-attention'))}
              >
                {icon('alert')}
                <span className="mwp-label">{CONTROL_PILL_LABELS.alert}</span>
                <span className="mwp-count">{attentionItems.length}</span>
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
              className={classNames('mwp-cell mwp-divided', !bubble && 'mwp-end', focus('pill-bell'))}
            >
              {icon('bell')}
              <span className="mwp-label">{CONTROL_PILL_LABELS.news}</span>
              {dot()}
            </button>
          </Tooltip>
          {/* Talking — the header's interact bubble, or on a narrow screen the
              character that opens it. Last, so it has the rounded end to itself. */}
          {bubble && (
            <div className={classNames('mwp-talk mwp-divided mwp-end', focus('pill-talk'))}>
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
