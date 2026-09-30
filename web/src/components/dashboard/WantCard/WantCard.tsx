import { openWebWant } from './plugins/types/WebFrameCardPlugin';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { useIconFont } from '@/hooks/useDisplaySettings';
import { useHeaderAtBottom } from '@/hooks/useDisplaySettings';
import { createPortal } from 'react-dom';
import { CheckSquare, Square, Plus, Hourglass, X as XIcon, RefreshCw, ExternalLink, Move, Tag, Star } from 'lucide-react';
import { Want, SelectModeProps } from '@/types/want';
import { useConstellationStore, membersById } from '@/stores/constellationStore';
import { WantCardContent } from '../WantCardContent';
import { classNames, suppressDragImage } from '@/utils/helpers';
import { getCardBackgroundStyle, resolveIconForFamily, type IconFamily } from '@/components/dashboard/WantTypeVisuals';
import { wantTypeIconStyle, cardInkVars } from '@/components/dashboard/WantCardFace';
import { useWantStore } from '@/stores/wantStore';
import { useCharacterStore } from '@/stores/characterStore';
import { useFieldNamingStore } from '@/stores/fieldNamingStore';
import { notify } from '@/stores/noticeStore';
import { apiClient } from '@/api/client';
import { useAuraNaming } from '@/hooks/useAuraNaming';
import { useConfigStore } from '@/stores/configStore';
import { useWantTypeStore } from '@/stores/wantTypeStore';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useCardOpacity } from '@/hooks/useCardOpacity';
import { useInputActions } from '@/hooks/useInputActions';
import styles from '../WantCard.module.css';

import { CorrelationOverlay } from './parts/CorrelationOverlay';
import { StackLayers } from './parts/StackLayers';
import { VersionBadge } from './parts/VersionBadge';
import { CharacterCornerIcons } from './parts/CharacterCornerIcons';
import { StatusChangeIcon } from './parts/StatusChangeIcon';
import { WantCardHeader } from './WantCardHeader';

import { QuickActionsOverlay } from './parts/QuickActionsOverlay';
import { buildDeleteConfirmConfig } from './parts/DeleteConfirmOverlay';
import { buildPlanApproveConfig } from './parts/PlanApproveOverlay';
import { buildOpenUrlConfig } from './parts/OpenUrlOverlay';
import { WantCardOverlay } from './parts/WantCardOverlay';
import { CardCursorMan } from '../CardCursorMan';
import { useCardInnerFocusStore, InnerFocusScope } from '@/stores/cardInnerFocusStore';
import { playSound } from '@/utils/sounds';
import { useLongPress } from './hooks/useLongPress';
import { useTouchReorder } from './hooks/useTouchReorder';
import { useCardOverlay } from './hooks/useCardOverlay';
import { useInnerFocusRing } from './hooks/useInnerFocusRing';
import { dropLabelOnWant } from './hooks/labelDrop';
import { CARD_BORDER_BASE, CARD_FOCUS_BASE, CARD_SHELL_BASE, CARD_SURFACE_BASE, CARD_FOCUS_RING, CARD_HOVER_RING, hoverRingVars } from './hooks/cardStyles';
import { useMyCursorColor } from '@/hooks/useMyCursorColor';
import { WantCardLayout } from './WantCardLayout';
import { RecipeSlideDeck, type RecipeSlideDeckHandle } from './parts/RecipeSlideDeck';
import { writeWantState } from '@/api/wantState';

// Persists iframe URLs across component remounts (canvas/list view switches)
const _iframeUrlMap = new Map<string, string>();

interface WantCardProps extends SelectModeProps {
  want: Want;
  children?: Want[];
  selected: boolean;
  selectedWant?: Want | null;
  onView: (want: Want) => void;
  onViewAgents?: (want: Want) => void;
  onViewResults?: (want: Want) => void;
  onViewChat?: (want: Want) => void;
  onEdit: (want: Want) => void;
  onDelete: (want: Want) => void;
  onSuspend?: (want: Want) => void;
  onResume?: (want: Want) => void;
  onArchive?: (want: Want) => void;
  onUnarchive?: (want: Want) => void;
  onShowReactionConfirmation?: (want: Want, action: 'approve' | 'deny') => void;
  className?: string;
  expandedParents?: Set<string>;
  onToggleExpand?: (wantId: string) => void;
  maximizedWantId?: string | null;
  /**
   * Which copy of this card this is: the grid's card (the default) or the one
   * embedded in the detail sidebar. The same want is on screen twice on the
   * dashboard, and only one of them should claim to be the one being operated
   * — see cardInnerFocusStore, which the scrim reads.
   */
  innerFocusScope?: InnerFocusScope;
  /**
   * Whether Enter/A on this card reaches the want's own controls.
   *
   * Off by default, because Enter has one meaning everywhere else: hand the
   * keys to the detail sidebar. Only the copy of the card inside that sidebar
   * turns this on, and only while it holds focus — by then you ARE inside, and
   * the next Enter is the one that goes further in.
   */
  confirmEntersInnerFocus?: boolean;
  onMaximizeChange?: (id: string | null) => void;
  onLabelDropped?: (wantId: string) => void;
  onWantDropped?: (draggedWantId: string, targetWantId: string) => void;
  onReorderDragOver?: (index: number, position: 'before' | 'after' | 'inside' | null) => void;
  onReorderDrop?: (draggedId: string, index: number, position: 'before' | 'after') => void;
  /** Reports this card as the drag source to useReorderableGroup (replaces
   * the old direct wantStore.setDraggingWant call) so the hook's local drag
   * state stays in sync — needed since WantCard composes its own "drop onto
   * a target want to connect them" nesting logic on top of the generic
   * before/after reorder instead of using the hook's bundled item props. */
  onReorderDragStart?: (id: string) => void;
  onReorderDragEnd?: () => void;
  index: number;
  isBeingProcessed?: boolean;
  onCreateWant?: (parentWant?: Want) => void;
  correlationRate?: number;
  correlationHighlights?: Map<string, number>;
  stackCount?: number;
  isBubbleOpen?: boolean;
  onOpenBalloon?: () => void;
  onCloseBalloon?: () => void;
  canvasMode?: boolean;
  onEnterMoveMode?: () => void;
  /** True while this card is the one being reordered via keyboard (Shift+Arrow)
   * or gamepad (A+stick) — mirrors the dimmed "picked up" look native HTML5
   * drag gives the dragged element for free (mouse drag needs no such prop). */
  isKbReorderSource?: boolean;
}

/** The expanded card: its margin to the screen's edge, and its usual width. */
const EXPAND_PAD = 16;
const EXPAND_MAX_W = 640;
/** Wide: the most it grows to, and how much wider than usual it must get to be offered. */
const WIDE_MAX_W = 1280;
const WIDE_MAX_ASPECT = 1.6;
const WIDE_MIN_GAIN = 120;

function wideExpandWidth(room: number, height: number): number {
  return Math.min(room, WIDE_MAX_W, height * WIDE_MAX_ASPECT);
}

export const WantCard: React.FC<WantCardProps> = ({
  want,
  children,
  selected,
  selectedWant,
  onView,
  onViewAgents,
  onViewResults,
  onViewChat,
  onEdit,
  onDelete,
  onSuspend,
  onResume,
  onArchive,
  onUnarchive,
  onShowReactionConfirmation,
  className,
  expandedParents,
  onToggleExpand,
  maximizedWantId,
  innerFocusScope = 'grid',
  confirmEntersInnerFocus = false,
  onMaximizeChange,
  onLabelDropped,
  onWantDropped,
  onReorderDragOver,
  onReorderDrop,
  onReorderDragStart,
  onReorderDragEnd,
  index,
  isSelectMode = false,
  selectedWantIds,
  isBeingProcessed = false,
  onCreateWant,
  correlationRate,
  correlationHighlights,
  stackCount = 0,
  isBubbleOpen = false,
  onOpenBalloon,
  onCloseBalloon,
  canvasMode = false,
  onEnterMoveMode,
  isKbReorderSource = false,
}) => {
  const wantId = want.metadata?.id || want.id;
  // Per-field selectors, NOT `useWantStore()`. A selector-less subscription
  // compares the whole state object, which zustand reallocates on every set(),
  // so every card re-rendered on every store write — including the ones fired
  // per dragover event and per poll tick. These four each re-render only when
  // their own slice changes; the three actions never change at all.
  const setIsOverTarget = useWantStore(s => s.setIsOverTarget);
  const highlightedLabel = useWantStore(s => s.highlightedLabel);
  const startWant = useWantStore(s => s.startWant);
  const stopWant = useWantStore(s => s.stopWant);
  const config = useConfigStore(state => state.config);
  const isHeaderBottom = useHeaderAtBottom();

  const overlay = useCardOverlay(wantId || null);

  // Touch reordering: the card's draggable attribute is HTML5 drag and drop and
  // never fires on a phone, so a held card could not be moved at all. The hold
  // arms this, and moving from there drags the card.
  //
  // These callbacks are useCallback'd rather than written inline because
  // useTouchReorder lists them in the dependency array of the effect that
  // registers its native touch listeners — inline arrows meant tearing down and
  // re-adding three listeners per card on every single render.
  const handleTouchDragStart = useCallback((id: string) => onReorderDragStart?.(id), [onReorderDragStart]);
  const handleTouchDragOver = useCallback(
    (i: number, position: 'before' | 'after' | 'inside' | null) => onReorderDragOver?.(i, position),
    [onReorderDragOver],
  );
  const handleTouchDrop = useCallback(
    (draggedId: string, i: number, position: 'before' | 'after') => onReorderDrop?.(draggedId, i, position),
    [onReorderDrop],
  );
  const handleTouchDragEnd = useCallback(() => onReorderDragEnd?.(), [onReorderDragEnd]);
  const closeQuickActions = overlay.closeQuickActions;
  const handleTouchDragBegin = useCallback(() => closeQuickActions(), [closeQuickActions]);
  const touchReorder = useTouchReorder({
    wantId: wantId || null,
    index,
    disabled: isBeingProcessed || isSelectMode,
    onDragStart: handleTouchDragStart,
    onDragOver: handleTouchDragOver,
    onDrop: handleTouchDrop,
    onDragEnd: handleTouchDragEnd,
    onDragBegin: handleTouchDragBegin,
  });

  const longPress = useLongPress(wantId || null, {
    disabled: isBeingProcessed || isSelectMode,
    onCommit: touchReorder.arm,
  });

  // Derive whether the plan approval overlay should be visible from current state.
  // The overlay is the *effect* of the state, not a separate source of truth.
  const planStatus = want.state?.current?.plan_status as string | undefined;
  const planApproved = want.state?.current?.plan_approved as boolean | undefined;
  const shouldShowPlanOverlay = planStatus === 'pending_approval' && planApproved !== true;
  useEffect(() => {
    if (shouldShowPlanOverlay) {
      // current says "needs approval" — show the overlay.
      overlay.setOverlay(
        buildPlanApproveConfig(
          async () => {
            overlay.clearOverlay();
            writeWantState(wantId || '', { plan_approved: true });
          },
          () => {
            overlay.clearOverlay();
            fetch(`/api/v1/wants/${wantId}`, { method: 'DELETE' }).catch(() => {});
          },
          () => {
            onView(want);
            onOpenBalloon?.();
          },
        )
      );
    } else if (overlay.activeOverlay?.type === 'plan-approve') {
      // current says "no longer pending" but the plan overlay is still showing
      // (e.g. server restart auto-approved the plan) — clear it.
      overlay.clearOverlay();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldShowPlanOverlay]);

  // Pending device action overlay (open-url written to want state by agent)
  const pendingDeviceAction = want.state?.current?.pending_device_action as { type: string; url: string } | undefined;
  useEffect(() => {
    if (pendingDeviceAction?.type === 'open-url') {
      console.log(`[TIMING] overlay triggered — pending_device_action arrived`);
      const clearAction = async () => {
        writeWantState(wantId || '', { pending_device_action: null });
      };
      overlay.setOverlay(
        buildOpenUrlConfig(
          async () => {
            overlay.clearOverlay();
            window.open(pendingDeviceAction.url, '_blank');
            await clearAction();
          },
          async () => {
            overlay.clearOverlay();
            await clearAction();
          },
          async () => {
            overlay.clearOverlay();
            setIframeUrl(pendingDeviceAction.url);
            await clearAction();
          },
        )
      );
    } else if (overlay.activeOverlay?.type === 'open-url') {
      overlay.clearOverlay();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingDeviceAction?.url]);

  const isExpanded = expandedParents?.has(wantId || '') ?? false;

  // Animated in-grid expansion state
  const [expandShowing, setExpandShowing] = useState(false);
  /**
   * Whether the card being blown up is the sidebar's embedded copy.
   *
   * A portal is rendered at the document root, so the DOM stops expressing
   * which surface it belongs to — and half this app answers "is this in the
   * panel?" by asking whether the panel contains it. Recorded when the expand
   * starts, while the card is still sitting in its real place, and stamped on
   * the portal so the answer travels with it. See isInSidebarSurface.
   */
  const fromSidebarRef = useRef(false);
  const [expandAnimated, setExpandAnimated] = useState(false);
  const [originRect, setOriginRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  // Prevents the external-maximization useEffect from re-triggering our own expand/collapse
  const ownActionRef = useRef(false);

  // Wide: as wide as the screen allows, up to a width that still reads as a
  // card — no wider than WIDE_MAX_W, nor than WIDE_MAX_ASPECT times its
  // height, so a tall-and-narrow window does not get a strip. Only offered
  // where that is worth a button (canWiden). Back to the usual width each time
  // the card is expanded.
  const [expandWide, setExpandWide] = useState(false);
  const getTargetRect = useCallback(() => {
    const room = window.innerWidth - EXPAND_PAD * 2;
    const height = window.innerHeight * 0.82;
    const w = Math.min(expandWide ? wideExpandWidth(room, height) : EXPAND_MAX_W, room);
    return {
      top: Math.max(EXPAND_PAD, window.innerHeight * 0.06),
      left: Math.max(EXPAND_PAD, (window.innerWidth - w) / 2),
      width: w,
      height,
    };
  }, [expandWide]);
  const canWiden = wideExpandWidth(window.innerWidth - EXPAND_PAD * 2, window.innerHeight * 0.82) >= EXPAND_MAX_W + WIDE_MIN_GAIN;

  const handleExpand = useCallback(() => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    fromSidebarRef.current = !!cardRef.current?.closest('[data-sidebar-primary="true"]');
    setOriginRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    setExpandShowing(true);
    setExpandAnimated(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setExpandAnimated(true)));
    onMaximizeChange?.(wantId || null);
  }, [onMaximizeChange, wantId]);

  const handleCollapse = useCallback(() => {
    // Give the focus back. The blown-up card is a portal to <body>, so
    // collapsing it unmounts whatever had focus and leaves it on <body> — the
    // nowhere state where the next press does nothing at all. Same rule the
    // inner-focus ring follows: whoever took the focus returns it, to the
    // sidebar's landing spot for the embedded copy or to the card itself.
    const home = cardRef.current?.closest<HTMLElement>('[data-sidebar-primary="true"]') ?? cardRef.current;
    if (home && (!document.activeElement || document.activeElement === document.body)) {
      requestAnimationFrame(() => home.focus());
    }
    ownActionRef.current = true;
    const rect = cardRef.current?.getBoundingClientRect();
    if (rect) setOriginRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    setExpandAnimated(false);
    setTimeout(() => { setExpandShowing(false); setOriginRect(null); setExpandWide(false); ownActionRef.current = false; }, 300);
    onMaximizeChange?.(null);
  }, [onMaximizeChange]);

  // External maximize trigger: keyboard / gamepad set this card as maximized (or collapsed it).
  // Mirror the click path so the animation always starts/ends at the card's actual rect.
  useEffect(() => {
    if (maximizedWantId === wantId) {
      if (!expandShowing) {
        const rect = cardRef.current?.getBoundingClientRect();
        fromSidebarRef.current = !!cardRef.current?.closest('[data-sidebar-primary="true"]');
        setOriginRect(rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : null);
        setExpandShowing(true);
        setExpandAnimated(false);
        requestAnimationFrame(() => requestAnimationFrame(() => setExpandAnimated(true)));
      }
    } else {
      if (expandShowing && !ownActionRef.current) {
        // Re-read card position in case it shifted since last expand.
        const rect = cardRef.current?.getBoundingClientRect();
        if (rect) setOriginRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
        setExpandAnimated(false);
        setTimeout(() => { setExpandShowing(false); setOriginRect(null); ownActionRef.current = false; }, 300);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maximizedWantId]);

  const isInnerFocusedRef = useRef(false);
  useEffect(() => {
    if (!expandShowing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // inner focus mode owns Escape — let captureInput handle it on keyup instead
      if (isInnerFocusedRef.current) return;
      e.preventDefault();
      handleCollapse();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expandShowing, handleCollapse]);
  const hasChildren = children && children.length > 0;

  const isHighlighted = highlightedLabel &&
    want.metadata?.labels &&
    want.metadata.labels[highlightedLabel.key] === highlightedLabel.value;

  const wantType = want.metadata?.type?.toLowerCase() || '';
  const isTargetWant = wantType.includes('target') ||
    wantType === 'owner' ||
    wantType.includes('approval') ||
    wantType.includes('system') ||
    wantType.includes('travel') ||
    hasChildren;

  const labels = want.metadata?.labels || {};
  // User-defined constellations this want belongs to (folder chips on the card).
  const allGroups = useConstellationStore((s) => s.constellations);
  const wantGroupNames = React.useMemo(() => {
    const id = want.metadata?.id || want.id;
    if (!id) return [] as string[];
    return (membersById(allGroups, 'want').get(id) ?? []).map((g) => g.name);
  }, [allGroups, want.metadata?.id, want.id]);
  const isRecipeBased = labels['recipe-based'] === 'true';
  const isControl = labels['user-control'] === 'true';
  const isFullScreen = labels['full-screen-display'] === 'true';
  const hasReactionQueue = Boolean(want.state?.current?.reaction_queue_id) && want.spec?.params?.require_reaction !== false;
  const isInteractive = want.state?.current?.interactive === true;
  const hasScheduling = !!(want.spec?.when && want.spec.when.length > 0);
  const wantTypeDisplay = want.metadata?.type || 'unknown';


  const [isDragOver, setIsDragOver] = useState(false);
  const [isDragOverWant, setIsDragOverWant] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const slideDeckRef = useRef<RecipeSlideDeckHandle>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** When the last click landed, to recognise the second one without waiting. */
  const lastClickAtRef = useRef(0);
  const [sliderActive, setSliderActive] = useState(false);
  const [isInnerFocused, setIsInnerFocused] = useState(false);
  isInnerFocusedRef.current = isInnerFocused;
  const [activeSlideWant, setActiveSlideWant] = useState<Want | null>(null);
  const [iframeUrl, _setIframeUrlRaw] = useState<string | null>(() => _iframeUrlMap.get(wantId || '') ?? null);
  const setIframeUrl = useCallback((url: string | null) => {
    if (url) _iframeUrlMap.set(wantId || '', url);
    else _iframeUrlMap.delete(wantId || '');
    _setIframeUrlRaw(url);
  }, [wantId]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Clear double-click timer on unmount
  useEffect(() => () => { if (clickTimerRef.current) clearTimeout(clickTimerRef.current); }, []);

  // Exit inner focus when the card loses selection
  useEffect(() => {
    if (!selected) setIsInnerFocused(false);
  }, [selected]);

  // Mouse-only path into inner focus (mirrors the Enter/A keyboard path below) —
  // lets plugins whose interactive control lives outside the card (e.g. the
  // direction want's canvas picker) be reached by click alone, selecting the
  // card first if it isn't already selected.
  const enterInnerFocus = useCallback(() => {
    if (!selected) onView(want);
    setIsInnerFocused(true);
  }, [selected, onView, want]);

  // Claim "this card is being operated" for as long as that is true, and let go
  // on every way out — including being unmounted mid-edit, which is what Escape
  // does here: it leaves inner focus and closes the detail sidebar in the same
  // beat, so the card can be gone before any "not any more" could run.
  //
  // One claim, not two. The input layer (which drops every key but Escape while
  // it stands) and the grey behind the card read this same store, so they cannot
  // end up disagreeing about whether the keys are still in here.
  useEffect(() => {
    if (!isInnerFocused) return;
    const id = wantId ?? null;
    useCardInnerFocusStore.getState().claim(id, innerFocusScope);
    return () => useCardInnerFocusStore.getState().release(id, innerFocusScope);
  }, [isInnerFocused, wantId, innerFocusScope]);

  /**
   * Going into the card's own controls, and coming back out.
   *
   * Sounded off the state rather than off each way in — Enter/A, a click on a
   * plugin's control, losing selection — for the same reason the menu is: there
   * are more doors than it is safe to remember, and the ones that got missed
   * were silent rather than obviously wrong.
   *
   * Same pair as everywhere else in the app: something committed on the way in
   * (confirmIn, a step deeper than handing a panel the keys), the release on
   * the way out.
   */
  const prevInnerFocusedRef = useRef(false);
  useEffect(() => {
    if (isInnerFocused === prevInnerFocusedRef.current) return;
    prevInnerFocusedRef.current = isInnerFocused;
    playSound(isInnerFocused ? 'confirmIn' : 'handoverOut');
  }, [isInnerFocused]);

  /**
   * Blowing the card up, and putting it back — the same pair, for the same
   * reason: it is a level deeper in, and then out again.
   *
   * Read from `maximizedWantId === wantId`, the one fact both routes into the
   * blown-up state converge on (this card's own expand/collapse, and an
   * external trigger setting it from the keyboard). It used to be sounded by
   * whoever owned that state instead, and there are two of those — the
   * dashboard, which did sound it, and the detail panel, which did not. So
   * maximising a card in the grid spoke and maximising the very same card
   * inside the panel was silent.
   */
  const isMaximized = !!wantId && maximizedWantId === wantId;
  const prevMaximizedRef = useRef(false);
  useEffect(() => {
    if (isMaximized === prevMaximizedRef.current) return;
    prevMaximizedRef.current = isMaximized;
    playSound(isMaximized ? 'cardMaximize' : 'cardMaximizeClose');
  }, [isMaximized]);

  // Where the caret goes when this card is operated, and how Tab and the
  // arrows walk from there. Declared by the plugin with data-inner-focus; a
  // card that declares nothing keeps the focus itself, as before.
  useInnerFocusRing(cardRef, isInnerFocused);

  // Escape leaves inner focus. Plugins that bind onCancel (the slider reverts,
  // for instance) consume it first and this never runs; this is the floor for
  // the ones that do not, so the way out never depends on the plugin.
  useInputActions({
    enabled: isInnerFocused,
    ignoreWhenInputFocused: false,
    ignoreWhenInSidebar: false,
    onCancel: () => setIsInnerFocused(false),
  });

  // For recipe-based target cards, track whether the current slide supports user-control.
  const currentSlideIsControl = activeSlideWant?.metadata?.labels?.['user-control'] === 'true';

  // The two things Enter/A can mean once the card itself has the keys, told
  // apart by timing the way a mouse tells a click from a double-click:
  //
  //   quick double  → make the card big
  //   deliberate    → go into the want's own controls (the slider takes the
  //                   arrows, the agent's box takes typing)
  //
  // Both on ONE binding on purpose. They were two hooks, each with its own
  // timer, and a hook that acts on the first press cannot leave room for a
  // second: entering the controls happened immediately, so the quick double
  // could never be read as one. Bound together, useInputActions holds the
  // single action for the double window and only then commits to it.
  //
  // Only where the card IS the thing being looked at: in the grid and on the
  // board Enter means "hand the keys to the detail panel", and the copy of the
  // card living inside that panel is where the controls actually are.
  const isNoteCard = wantType === 'note';
  // A web want: Enter/A opens its site in a new tab, the same as the card's
  // open button (openWebWant) — the page is the thing a web want is for, and
  // the pad and the keyboard had no way to reach it. Going into the live
  // frame stays the mouse's (the click over the frame); keys in a
  // cross-origin frame are the page's anyway, not the board's.
  const isWebCard = labels['form-type'] === 'web';
  const canInnerFocus = isControl || currentSlideIsControl || hasReactionQueue || isNoteCard;
  useInputActions({
    enabled: confirmEntersInnerFocus && !isInnerFocused,
    ignoreWhenInputFocused: false,
    ignoreWhenInSidebar: false,
    // Cards with nothing to go into leave this unbound, so their quick double
    // still maximises and a lone press does nothing rather than something odd.
    onConfirm: isWebCard ? () => openWebWant(want)
      : canInnerFocus ? () => setIsInnerFocused(true) : undefined,
    onDoubleConfirm: () => {
      if (maximizedWantId && maximizedWantId === wantId) handleCollapse();
      else handleExpand();
    },
  });

  // X/Square while a card is selected (outer focus only — inner-focused plugins
  // like SwitchCardPlugin bind X for their own per-value marking) no longer names
  // on the card. Instead it opens the shared Aura editor on the want's
  // final-result *source* field inside the detail sidebar (already open for the
  // selected want) — so pressing X on the whole want and pressing X on that
  // field are one and the same flow. ignoreWhenInSidebar so that once focus is
  // inside the sidebar, the field's own X owns it.
  const myCharacterId = useCharacterStore(s => s.myCharacterId);
  const requestFieldNaming = useFieldNamingStore(s => s.requestNaming);
  const finalResultField = want.spec?.finalResultField;
  /**
   * What a mark on this card is ABOUT.
   *
   * The want's answer unless its type nominated another field with
   * `aura_mark_field` — see the server's cardNameKindValue, which resolves the
   * same thing and is the authority. Read here too because the pill has to
   * show what is being named before the server is asked: a suggested name, and
   * the kind it would be named into.
   */
  const markField = (want.spec?.params?.aura_mark_field as string | undefined) || finalResultField;
  const markValue = markField
    ? (want.state?.current?.[markField] ?? (markField === finalResultField ? want.state?.final_result : undefined))
    : undefined;
  // The two preconditions (a character to sign the mark, a source field to name)
  // stay OUT of `enabled`: a disabled binding makes X a silent no-op, which is
  // indistinguishable from a broken build — the failure that hid the missing
  // character on the Fly deployment, where localStorage starts empty and every
  // visitor is the default cursor. X is always bound; the robot says why not.
  // Naming this want's result, as one act with two ways in: the X button, and
  // Add Aura on the overlay. One callback rather than two copies — they are the
  // same act, and a second implementation is a second thing to keep true.
  /**
   * The naming pill this card wears while a mark is being given a name.
   *
   * The same pill, keys and look every field card uses (useAuraNaming) — only
   * the write differs: `cardAuraName` hands the server the want and the name
   * and lets it resolve which field the mark is about, then snapshot the other
   * fields onto the thing as labels. That resolution has to be the server's:
   * it is the same code that answers what a mark already says about a card.
   */
  const cardAura = useAuraNaming({
    value: markValue,
    // No subType on purpose: the kind a name goes into is the server's to
    // resolve (cardNameKindValue reads it off the want type's own state defs),
    // and the type list this component has to hand is the trimmed one — it
    // carries labels and a category, not state definitions. What the card
    // loses by not knowing is only whether the pill should open as a rename:
    // the write itself asks the server, which knows.
    wantId: wantId ?? undefined,
    notifyTarget: wantId ? { targetType: 'want_card', targetId: wantId } : undefined,
    commit: async (name) => {
      if (!myCharacterId || !wantId) return;
      await apiClient.cardAuraName(myCharacterId, wantId, name);
    },
  });

  const addAura = useCallback(() => {
    if (!wantId) return;
    if (!myCharacterId) {
      notify('名前を付けるにはキャラクターが要ります。Characters ページで自分のカーソルを選んでください。',
             { targetType: 'want_card', targetId: wantId });
      return;
    }
    if (!markField) {
      notify('この want には名前を付けられるフィールドがありません。',
             { targetType: 'want_card', targetId: wantId });
      return;
    }
    /**
     * Named HERE, on the card, rather than by asking a field card to do it.
     *
     * It used to hand the job to the sidebar's card for the final-result field
     * (requestFieldNaming), which worked while a mark was always a name for
     * that field's value. A mark is now about whatever the type nominated and
     * carries a snapshot of the other fields with it, so there is no field card
     * that is the right place to type it — and on the canvas there may be no
     * sidebar open at all. The pill opens on the card the mark is about.
     */
    cardAura.open();
  }, [wantId, myCharacterId, markField, notify, cardAura]);

  useInputActions({
    enabled: selected && !isInnerFocused && !!wantId,
    ignoreWhenInputFocused: false,
    ignoreWhenInSidebar: true,
    onButtonX: addAura,
  });

  // Reset inner focus whenever the active slide changes so a freshly-navigated
  // slide doesn't inherit focus from the previous one.
  useEffect(() => {
    setIsInnerFocused(false);
  }, [activeSlideWant?.metadata?.id, activeSlideWant?.id]);

  // Slideshow navigation for recipe-based target cards:
  //   Opt+←/→  (keyboard)      → prev / next slide
  //   Right stick X (gamepad)  → prev / next slide
  //   Touch swipe on card      → handled locally by RecipeSlideDeck (disableTouchSwipe)
  // Disabled while a slide's inner controls are being operated (isInnerFocused).
  useInputActions({
    enabled: selected && isRecipeBased && !!hasChildren && !overlay.showQuickActions && !isInnerFocused,
    disableTouchSwipe: true,
    onSwipeNavigate: (dir) => {
      if (dir === 'right') slideDeckRef.current?.goRight();
      else                 slideDeckRef.current?.goLeft();
    },
  });

  useEffect(() => {
    const wId = want.metadata?.id || want.id;
    const selectedId = selectedWant?.metadata?.id || selectedWant?.id;
    const isNavSelected = selectedId === wId;

    if (isNavSelected && document.activeElement !== cardRef.current) {
      const target = document.activeElement as HTMLElement;
      const isFocusInInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      const isFocusInSidebar = !!target?.closest('[role="complementary"]') ||
        !!target?.closest('.right-sidebar');

      if (!isFocusInInput && !isFocusInSidebar) {
        cardRef.current?.focus();
      }
    }
  }, [selectedWant?.metadata?.id, selectedWant?.id, want.metadata?.id, want.id]);


  const handleContextMenu = (e: React.MouseEvent) => {
    if (isBeingProcessed || isSelectMode) return;
    e.preventDefault();
    overlay.setQuickActionsWantId(wantId || null);
    // Selecting the card, and only if it is not already the selected one.
    //
    // Right-click means "show me this card's actions" — it is not a step
    // further in, and Shift+Enter / Start, which mean exactly the same thing,
    // do not take one: they open the overlay and nothing else. Asking to view a
    // card that is already selected is the *second* click, the one that hands
    // input to the detail panel (see Dashboard's handleViewWant), so a
    // right-click on a highlighted card was popping its actions open and
    // simultaneously throwing focus into the sidebar behind them. Same guard
    // enterInnerFocus uses, for the same reason.
    if (!selected) onView(want);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (isBeingProcessed) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[role="button"]')) return;
    // Interacting with form controls inside a card (e.g. date picker, dropdowns)
    // should not trigger card selection — the user is operating the control, not the card.
    if (target.closest('select') || target.closest('input') || target.closest('textarea')) return;
    let element = target as HTMLElement | null;
    while (element && element !== e.currentTarget) {
      const cls = typeof element.className === 'string' ? element.className : (element.getAttribute?.('class') ?? '');
      if (cls.includes('group/menu')) {
        const menuDropdown = element.querySelector('[class*="opacity-100"][class*="visible"]');
        if (menuDropdown) return;
      }
      element = element.parentElement;
    }

    // Select mode: no debouncing needed
    if (isSelectMode) { onView(want); return; }

    // Act on the first click; let the second add to it.
    //
    // This used to hold the first click for 250 ms to see whether a second one
    // was coming, and that 250 ms was the entire wait between pressing a card
    // and its ring appearing — measured at ~260 ms, of which 250 was this. The
    // delay was not the network's and no amount of making the write to the
    // server asynchronous could touch it, because it sat in front of even
    // deciding that a click had happened.
    //
    // Nothing needed the wait. Selecting is what expanding starts from: a card
    // you are maximising is a card you are looking at, so doing the first
    // click's work and then the second's leaves the same end state as
    // discarding the first ever did. The only visible difference is that the
    // ring flashes on before the card blows up, which reads as the gesture
    // being followed rather than being guessed at.
    const sinceLast = performance.now() - lastClickAtRef.current;
    if (sinceLast < 250) {
      // Second click → double-click → expand, on top of the selection the
      // first one already made.
      lastClickAtRef.current = 0;
      handleExpand();
      return;
    }
    lastClickAtRef.current = performance.now();
    onView(want);
  };

  // Click handler for the maximized overlay — same guards as handleCardClick,
  // and the same double-click gesture, which now collapses: whatever maximised
  // the card should put it back, rather than sending the user hunting for a
  // close button or Escape.
  const handleExpandedOverlayClick = useCallback((e: React.MouseEvent) => {
    if (isBeingProcessed) return;
    // Selecting text is not clicking the card.
    //
    // A drag across a paragraph ends in a click event on whatever contains it,
    // and double-clicking a word — the ordinary way to select one — is a double
    // click. So reading a blown-up card and trying to copy a line out of it
    // opened the sidebar, or collapsed the card, and took the selection with it.
    // The maximized card is the one place in the app whose whole purpose is to
    // be read at length, which is exactly where copying a value out of it is
    // worth doing.
    //
    // Collapsing is still one Escape or one press of the header's close button
    // away, neither of which can be confused for reading.
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim() !== '') return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[role="button"]')) return;
    if (target.closest('select') || target.closest('input') || target.closest('textarea')) return;
    let element = target as HTMLElement | null;
    while (element && element !== e.currentTarget) {
      const cls = typeof element.className === 'string' ? element.className : (element.getAttribute?.('class') ?? '');
      if (cls.includes('group/menu')) {
        const menuDropdown = element.querySelector('[class*="opacity-100"][class*="visible"]');
        if (menuDropdown) return;
      }
      element = element.parentElement;
    }

    if (clickTimerRef.current !== null) {
      // Second click within 250 ms → double-click → collapse
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      handleCollapse();
      return;
    }

    // First click — wait 250 ms to distinguish single from double.
    //
    // The card on the list no longer waits (see handleCardClick), and this one
    // still does, because the two first clicks do not mean the same thing. On
    // the list it means "select this", which the second click builds on. Here
    // the card is already selected and it means "hand the keys to the panel" —
    // nothing the second click wants done first, and something worth not doing
    // by accident while reading. A maximised card is the one surface meant to
    // be read at length, where double-clicking a word to copy it is ordinary.
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      onView(want);
    }, 250);
  }, [isBeingProcessed, onView, want, handleCollapse]);

  const handleDragStart = (e: React.DragEvent) => {
    if (isSelectMode || isBeingProcessed) return;
    // A drag that starts on an interactive control (slider, button, input,
    // link) belongs to that control, not to card reordering. This replaces
    // the old blanket `!isControl || selected` draggable guard, which made
    // unfocused user-control cards impossible to reorder by direct drag —
    // now any card drags from its background, and control widgets stay safe.
    const origin = e.target as HTMLElement;
    if (origin.closest('button, input, select, textarea, a[href], [role="slider"], [contenteditable="true"], [data-no-card-drag]')) {
      e.preventDefault();
      return;
    }
    suppressDragImage(e);
    const id = want.metadata?.id || want.id;
    if (!id) return;
    onReorderDragStart?.(id);
    e.dataTransfer.setData('application/mywant-id', id);
    e.dataTransfer.setData('application/mywant-name', want.metadata?.name || '');
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    const isWantDrag = e.dataTransfer.types.includes('application/mywant-id');
    const isLabelDrag = e.dataTransfer.types.includes('application/json');
    const isTemplateDrag = e.dataTransfer.types.includes('application/mywant-template');

    if (isTemplateDrag) return;

    if (isWantDrag) {
      e.preventDefault();
      setIsDragOver(false);

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const edgeThreshold = rect.width * 0.2;

      let position: 'before' | 'after' | 'inside' | null = null;

      // A card mid-transition (deleting/initializing) is still a perfectly good
      // *position* to drop beside — it just can't accept a nesting drop. It used
      // to bail out of this handler entirely, which meant no preventDefault, and
      // per the HTML5 drag-and-drop spec an element that doesn't preventDefault
      // its dragover is not a drop target at all. The grid container skips
      // events originating inside a card, so the drop silently did nothing —
      // reordering appeared to randomly fail whenever a status was in flight.
      if (isTargetWant && !isBeingProcessed) {
        if (x < edgeThreshold) {
          position = 'before';
        } else if (x > rect.width - edgeThreshold) {
          position = 'after';
        } else {
          position = 'inside';
        }
      } else {
        position = x < rect.width / 2 ? 'before' : 'after';
      }

      if (onReorderDragOver) onReorderDragOver(index, position);

      if (position === 'inside') {
        e.dataTransfer.dropEffect = 'move';
        setIsOverTarget(true);
        if (!isDragOverWant) setIsDragOverWant(true);
      } else {
        setIsOverTarget(false);
        setIsDragOverWant(false);
        e.dataTransfer.dropEffect = 'move';
      }
    } else if (isLabelDrag) {
      e.preventDefault();
      setIsDragOverWant(false);
      setIsOverTarget(false);
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
    setIsDragOverWant(false);
    setIsOverTarget(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/mywant-template')) return;

    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setIsDragOverWant(false);
    setIsOverTarget(false);
    onReorderDragEnd?.();

    if (onReorderDragOver) onReorderDragOver(index, null);

    const draggedWantId = e.dataTransfer.getData('application/mywant-id');
    const tWantId = want.metadata?.id || want.id;

    if (!draggedWantId || !tWantId) return;
    if (draggedWantId === tWantId) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const edgeThreshold = rect.width * 0.2;

    // Mirrors handleDragOver: a card mid-transition accepts before/after
    // reorders but not a nesting drop.
    if (x < edgeThreshold) {
      if (onReorderDrop) onReorderDrop(draggedWantId, index, 'before');
      return;
    } else if (x > rect.width - edgeThreshold) {
      if (onReorderDrop) onReorderDrop(draggedWantId, index, 'after');
      return;
    } else if (isTargetWant && !isBeingProcessed) {
      if (onWantDropped) onWantDropped(draggedWantId, tWantId);
      return;
    }

    if (onReorderDrop) {
      onReorderDrop(draggedWantId, index, x < rect.width / 2 ? 'before' : 'after');
    }

    if (!isBeingProcessed) dropLabelOnWant(tWantId, e, onLabelDropped);
  };

  const cardHeightClass = {
    sm: 'h-[6rem] sm:h-[10rem]',
    md: 'h-[9rem] sm:h-[15rem]',
    lg: 'h-[18rem] sm:h-[30rem]',
  }[useDisplaySettings().card_height];

  // Resolve the same gradient/image background that the want type picker uses,
  // applied at 70% opacity over the card's base bg-white / dark:bg-gray-800.
  const isDarkMode = useDarkMode();
  const wantTypes = useWantTypeStore(s => s.wantTypes);
  useWantTypeStore(s => s.categoryBgMap);   // re-render when dynamic bg maps load
  useWantTypeStore(s => s.typeIconMap);     // re-render when dynamic icon maps load
  useWantTypeStore(s => s.categoryIconMap);

  // When the slide deck is active, track the currently-visible child want so the
  // background gradient/image follows the slide.
  // (activeSlideWant state is declared earlier, near isInnerFocused, because it is also
  //  needed by the keyboard handler that runs before this block.)
  const bgWant = (isRecipeBased && hasChildren && activeSlideWant) ? activeSlideWant : want;

  const matchedWantType = wantTypes.find(t => t.name === bgWant.metadata?.type);
  const typeCategory = matchedWantType?.category ?? '';
  const typeGradientStyle = getCardBackgroundStyle(
    bgWant.metadata?.type ?? '',
    typeCategory,
    isDarkMode ? 'dark' : 'light',
    'canvas',
  );
  const iconFont = useIconFont() as IconFamily;
  const TypeIcon = resolveIconForFamily(typeCategory, want.metadata?.type ?? '', iconFont);
  // Same vivid want-type colour the canvas tile paints its icon with, so the
  // compact pill's type icon matches the tile instead of a flat gray.
  const typeIconStyle = wantTypeIconStyle(want.metadata?.type ?? '', typeCategory, isDarkMode);
  const cardOpacity = useCardOpacity();

  const achievingPercentage = (want.state?.current?.achieving_percentage as number) ?? 0;
  const replayScreenshotUrl = want.state?.current?.replay_screenshot_url as string | undefined;
  // Web want types capture a page screenshot at Save time (see WebWantCard's
  // use of the same label, and cursorOverlayCore's Save flow) — carried on
  // the want TYPE definition, not the deployed want's own state, since it's
  // a property of the type (what page this opens), not this instance's run.
  const webWantScreenshotUrl = matchedWantType?.labels?.['screenshot-url'];
  const cardScreenshotUrl = replayScreenshotUrl || webWantScreenshotUrl;
  // Web want screenshots are the card's actual visual identity (same as
  // WebWantCard's near-opaque rendering in the type picker) — shown at high
  // opacity, with the type gradient faded out from under it so its own
  // color doesn't wash the screenshot out. replay's screenshot is a subtle
  // background texture instead (low opacity, gradient stays put), so it only
  // gets the strong treatment when there's no replay screenshot to preserve.
  const isWebWantScreenshot = !replayScreenshotUrl && !!webWantScreenshotUrl;
  const version = want.metadata?.version ?? 1;

  const isIdle = (want.status as string) === 'idle';

  // Navigation cursor: always tied to selectedWant (keyboard focus), independent of checkbox selection.
  const isNavFocused = (selectedWant?.metadata?.id || selectedWant?.id) === (want.metadata?.id || want.id);

  // The cursor stands on ONE card. The panel's copy of this want is not that
  // card — it is a second drawing of the want the cursor is already standing
  // on out in the grid, so putting him on this one too puts the same character
  // on screen twice. The ring stays: that says "this is the one", which is
  // true of both copies.
  const showCursorMan = isNavFocused && innerFocusScope !== 'sidebar';

  // フォーカス枠は他カードと同じくカード全体に出し、色は自分のキャラクター色に合わせる。
  const focusColor = useMyCursorColor();
  const showFocusRing = isNavFocused || selected;

  return (
    <>
    <div className="relative h-full" style={{ isolation: 'isolate' }}>
      <CardCursorMan visible={showCursorMan} />
      <StackLayers stackCount={stackCount} />
      <div
        ref={(node) => { cardRef.current = node; touchReorder.ref.current = node; }}
        data-free-cursor-item
        data-want-card-index={index}
        draggable={!isSelectMode && !isBeingProcessed && !sliderActive}
        onDragStart={handleDragStart}
        onDragEnd={() => onReorderDragEnd?.()}
        onClick={handleCardClick}
        onContextMenu={handleContextMenu}
        onMouseDown={longPress.onMouseDown}
        onMouseMove={longPress.onMouseMove}
        onMouseUp={longPress.onMouseUp}
        onMouseLeave={() => {
          longPress.cancel();
          if (overlay.showQuickActions) overlay.closeQuickActions();
        }}
        onBlur={(e) => {
          const relatedTarget = e.relatedTarget as Node;
          if (overlay.showQuickActions && (!relatedTarget || !cardRef.current?.contains(relatedTarget))) {
            overlay.closeQuickActions();
          }
        }}
        onTouchStart={longPress.onTouchStart}
        onTouchMove={longPress.onTouchMove}
        onTouchEnd={longPress.onTouchEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        tabIndex={isBeingProcessed ? -1 : 0}
        data-keyboard-nav-selected={selected}
        data-keyboard-nav-id={wantId}
        data-is-target={isTargetWant}
        data-robot-target="want_card"
        data-robot-id={wantId}
        // The handle the free cursor confines itself to while this card is the
        // one being operated — the same stable attribute the detail panel and
        // the minimap wear, for the same reason. See keyHoldingSurface.
        data-inner-focus-card={isInnerFocused ? 'true' : undefined}
        className={classNames(
          // CARD_SHELL_BASE, not `card`: the shell must carry no opaque
          // background of its own or it shows through as the surface layer
          // below fades with card_opacity.
          `${CARD_SHELL_BASE} ${CARD_HOVER_RING} hover:shadow-md dark:hover:shadow-blue-900/20 transition-[box-shadow,transform,border-color,filter] duration-300 group relative ${cardHeightClass} flex ${isHeaderBottom ? 'flex-col-reverse' : 'flex-col'} select-none ${CARD_FOCUS_BASE}`,
          CARD_BORDER_BASE,
          showFocusRing && CARD_FOCUS_RING,
          // The same ring the pointer raises, raised by the character standing
          // here — see .mw-ring-on. It used to be an inset shadow on this root
          // element, which the card's own fill layer paints over, so walking
          // onto a card in the list lit nothing at all.
          showFocusRing && 'mw-ring-on',
          (isDragOverWant || isDragOver) && !isBeingProcessed && 'border-blue-600 border-2 bg-blue-100 dark:bg-blue-900/30',
          isHighlighted && styles.highlighted,
          isBeingProcessed && 'opacity-50 pointer-events-none cursor-not-allowed',
          styles.controlCardBorder,
          !showFocusRing && styles.controlCardBorderHidden,
          className || ''
        )}
        style={{
          WebkitTouchCallout: 'none',
          // pan-y normally, so the page still scrolls under a finger; none once
          // the card itself is being dragged, or the scroll runs away with it.
          touchAction: touchReorder.dragging ? 'none' : 'pan-y',
          ...hoverRingVars(focusColor, isDarkMode),
          ...cardInkVars(typeIconStyle.color as string, isDarkMode),
        } as React.CSSProperties}
      >
        {/* His shadow on the card, so it goes wherever he does. */}
        {showCursorMan && (
          <div
            className="absolute z-[5] pointer-events-none"
            style={{
              top: '30px',
              left: '6px',
              width: '44px',
              height: '12px',
              borderRadius: '50%',
              background: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.16)',
              filter: 'blur(8px)',
            }}
          />
        )}
        {/* Card surface — the white/gray base the shell used to carry. It sits
            inside the same opacity treatment as the gradient above it, so
            lowering card_opacity makes the card genuinely transparent instead
            of revealing an opaque base. */}
        <div
          className={classNames('absolute inset-0 z-0 pointer-events-none', CARD_SURFACE_BASE)}
          style={{ opacity: cardOpacity }}
        />

        {/* Type gradient/image background — same source as the want type picker.
            Fades out on drag-over so the blue drop-indicator shows through. */}
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            ...typeGradientStyle,
            // Shared card background opacity (Settings → Cards). A web-want
            // screenshot sits on top at high opacity, so the gradient under it
            // is scaled down proportionally rather than fixed at the setting.
            opacity: (isDragOverWant || isDragOver)
              ? 0
              : (isWebWantScreenshot ? cardOpacity * (0.1 / 0.7) : cardOpacity),
            transition: 'background 0.22s ease-in-out, background-image 0.22s ease-in-out',
          }}
        />

        <CorrelationOverlay rate={correlationRate} />

        {cardScreenshotUrl && (
          <div
            className="absolute inset-0 z-0 pointer-events-none rounded-[inherit]"
            style={{
              backgroundImage: `url(${cardScreenshotUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center top',
              opacity: isWebWantScreenshot ? 0.85 : 0.12,
            }}
          />
        )}

        <div className={classNames(
          'absolute inset-0 z-30 flex items-center justify-center bg-blue-700 dark:bg-blue-900 transition-all duration-400 ease-out pointer-events-none',
          isDragOverWant && isTargetWant && !isBeingProcessed ? 'bg-opacity-60 opacity-100' : 'bg-opacity-0 opacity-0'
        )}>
          <div className={classNames(
            'bg-white dark:bg-gray-800 p-4 rounded-full shadow-2xl border-4 border-blue-600 dark:border-blue-500 transform transition-all duration-400 ease-out',
            isDragOverWant && isTargetWant && !isBeingProcessed ? 'scale-100 opacity-100' : 'scale-[2.5] opacity-0'
          )}>
            <Plus className="w-16 h-12 text-blue-700 dark:text-blue-400" />
          </div>
        </div>

        {isSelectMode && (
          <div className="absolute top-2 right-2 z-20 pointer-events-none">
            {selected ? <CheckSquare className="w-6 h-6 text-blue-600 bg-white rounded-md" /> : <Square className="w-6 h-6 text-gray-400 bg-white rounded-md opacity-50" />}
          </div>
        )}

        <VersionBadge version={version} />

        <CharacterCornerIcons want={want} category={typeCategory} hidden={isSelectMode} />

        {/* Compact pill — type icon + status icon, visible when header is hidden.
            Tracks header position (top/bottom) from settings. */}
        {/* Type and status, always on: this is what the focus-revealed header
            used to say, and a card that changes what it tells you depending on
            whether it is focused is a card you have to focus to read. */}
        {!isFullScreen && (
          <div className={`absolute ${isHeaderBottom ? 'bottom-1.5' : 'top-1.5'} left-2 z-20 flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-white/30 dark:bg-black/30 backdrop-blur-sm border border-white/20 dark:border-white/10 pointer-events-none`}>
            <TypeIcon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" style={typeIconStyle} />
            <StatusChangeIcon status={want.status} size="md" />
          </div>
        )}

        <div
          className={[
            'relative z-10 flex-1 min-h-0',
            isInnerFocused ? 'ring-2 ring-inset ring-sky-400/70 rounded-[inherit]' : '',
          ].join(' ')}
          style={{
            ...(overlay.showQuickActions ? { filter: 'blur(2px)', opacity: 0.5, pointerEvents: 'none' } : {})
          }}
        >
          {/* iframe embed mode — only rendered here when not expanded (expanded portal renders its own) */}
          {iframeUrl && !expandShowing ? (
            <div className="absolute inset-0 flex flex-col bg-white dark:bg-gray-900 rounded-[inherit] overflow-hidden">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-black/80 flex-shrink-0">
                <span className="flex-1 text-[0.6rem] font-mono text-white/60 truncate">{iframeUrl}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); if (iframeRef.current) iframeRef.current.src = iframeUrl; }}
                  className="p-0.5 rounded text-white/60 hover:text-white transition-colors"
                  title="再読み込み"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); window.open(iframeUrl, '_blank'); }}
                  className="p-0.5 rounded text-white/60 hover:text-white transition-colors"
                  title="新しいタブで開く"
                >
                  <ExternalLink className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setIframeUrl(null); }}
                  className="p-0.5 rounded text-white/60 hover:text-white transition-colors"
                  title="閉じる"
                >
                  <XIcon className="w-3 h-3" />
                </button>
              </div>
              <iframe
                ref={iframeRef}
                src={iframeUrl}
                className="flex-1 w-full border-0"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                title="card-embed"
              />
            </div>
          ) : isRecipeBased && hasChildren ? (
            /* Recipe-based target with children: show slide deck of child wants */
            <RecipeSlideDeck
              ref={slideDeckRef}
              parentWant={want}
              children={children ?? []}
              onView={onView}
              onViewAgents={onViewAgents}
              onViewResults={onViewResults}
              onViewChat={onViewChat}
              onEdit={onEdit}
              onDelete={onDelete}
              onSuspend={onSuspend}
              onResume={onResume}
              onShowReactionConfirmation={onShowReactionConfirmation}
              onSlideChange={setActiveSlideWant}
              isInnerFocused={isInnerFocused}
              onEnterInnerFocus={enterInnerFocus}
              onExitInnerFocus={() => {
                setIsInnerFocused(false);
                cardRef.current?.focus();
              }}
              onOpenBalloon={onOpenBalloon}
              onCloseBalloon={onCloseBalloon}
            />
          ) : (
            <WantCardContent
              want={want} isChild={false} hasChildren={!!hasChildren} isFocused={selected} isSelectMode={isSelectMode}
              onView={onView} onViewAgents={onViewAgents} onViewResults={onViewResults} onViewChat={onViewChat}
              onEdit={onEdit} onDelete={onDelete}
              onSuspend={onSuspend} onResume={onResume}
              onShowReactionConfirmation={onShowReactionConfirmation}
              onSliderActiveChange={setSliderActive}
              isInnerFocused={isInnerFocused}
              onEnterInnerFocus={enterInnerFocus}
              onExitInnerFocus={() => {
                setIsInnerFocused(false);
                cardRef.current?.focus();
              }}
            />
          )}
        </div>

        {/* Idle want overlay — hidden when reaction queue is active (approve/deny buttons show instead) */}
        {isIdle && !overlay.activeOverlay && !want.state?.current?.reaction_queue_id && !iframeUrl && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1.5 rounded-[inherit] bg-black/40 backdrop-blur-[1px] pointer-events-none">
            <Hourglass className="w-5 h-5 text-white/70" />
            <span className="text-[0.6rem] font-medium text-white/70 tracking-wide">waiting...</span>
          </div>
        )}

        {/* "Picked up, movable" overlay — shared by mouse long-press (0-150ms
            hold, before the quick-actions overlay commits — see
            useLongPress's holding) and keyboard/gamepad reorder (Shift/A held
            past the long-press threshold — see isKbReorderSource). A proper
            dark backdrop (not just a subtle opacity fade) plus a centered
            4-directional icon makes "this can now move any direction"
            unambiguous, and for the mouse case specifically gives a reason to
            keep moving instead of landing on an overlay button the moment the
            user pauses. Gone once the quick-actions overlay itself takes over. */}
        {((longPress.holding && !overlay.showQuickActions) || (isKbReorderSource && !isBeingProcessed)) && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[inherit] bg-black/60 pointer-events-none">
            <Move className={classNames('w-7 h-7 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]', styles.longPressHint)} />
          </div>
        )}

        {overlay.showQuickActions && !overlay.activeOverlay && (
          <QuickActionsOverlay
            want={want}
            onClose={overlay.closeQuickActions}
            onView={() => onView(want)}
            onStart={() => startWant(wantId || '')}
            onStop={() => stopWant(wantId || '')}
            onSuspend={() => onSuspend?.(want)}
            onResume={() => onResume?.(want)}
            onArchive={onArchive ? () => onArchive(want) : undefined}
            onUnarchive={onUnarchive ? () => onUnarchive(want) : undefined}
            onRestart={async () => {
              await stopWant(wantId || '');
              setTimeout(() => startWant(wantId || ''), 300);
            }}
            onEdit={() => onEdit(want)}
            onAddAura={addAura}
            onDelete={() => overlay.setOverlay(
              buildDeleteConfirmConfig(
                () => { overlay.clearOverlay(); onDelete(want); },
                overlay.clearOverlay,
              )
            )}
          />
        )}

        {/* Plan approval overlay rendered via useEffect (see above) */}

        {/* The mark, as something you can reach with a finger.
            X does this, and X is a keyboard and a gamepad — neither of which a
            phone has, and the pad's X belongs to whatever board-wide want
            claimed it. So every card that has something markable wears a star,
            and a tap on it is the same press: one callback (addAura), so the
            two ways in cannot drift apart.
            Dim until it has been used, because a mark is a thing you added and
            an un-marked card should not look like it is holding one. */}
        {markField && !cardAura.isOpen && (
          <button
            type="button"
            aria-label={cardAura.myNamedDef ? `名前: ${cardAura.myNamedDef.name}` : '名前を付ける'}
            title={cardAura.myNamedDef ? cardAura.myNamedDef.name : '名前を付ける (X)'}
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); addAura(); }}
            onPointerDown={(e) => e.stopPropagation()}
            className={classNames(
              'absolute bottom-1 right-1 z-[26] flex items-center gap-1 rounded-full px-3 py-1',
              'transition-colors pointer-events-auto',
              cardAura.myNamedDef
                ? 'bg-amber-400/85 text-amber-950'
                : 'bg-black/25 text-white/45 hover:bg-black/40 hover:text-white/80',
            )}
            style={{ touchAction: 'manipulation' }}
          >
            <Star
              className="w-6 h-6"
              strokeWidth={2.25}
              fill={cardAura.myNamedDef ? 'currentColor' : 'none'}
            />
            {cardAura.myNamedDef && (
              <span className="text-[18px] font-semibold leading-none max-w-[12rem] truncate">
                {cardAura.myNamedDef.name}
              </span>
            )}
          </button>
        )}

        {/* Naming a mark, on the card the mark is about.
            The pill takes over the card while it is open (it is
            position:absolute inside this relative shell, which is what
            useAuraNaming's editorNode is built for) and is gone the moment the
            name is committed or Escape is pressed. Above the content and below
            the quick-actions overlay: naming is a thing you do TO the card,
            and the overlay is a menu about it. */}
        {cardAura.isOpen && (
          <div className="absolute inset-0 z-[28] flex items-center justify-center rounded-[inherit] bg-black/55 backdrop-blur-[1px]">
            {cardAura.editorNode}
          </div>
        )}

        {/* ── Single overlay render point ── */}
        <WantCardOverlay activeOverlay={overlay.activeOverlay} onClose={overlay.clearOverlay} />


      </div>

      {/* Right-click context menu */}
    </div>

    {/* Animated in-grid card expansion */}
    {expandShowing && createPortal(
      <div
        data-maximized-want-id={wantId}
        // Says which surface this portal belongs to, since the DOM tree no
        // longer can. Read by isInSidebarSurface.
        data-sidebar-portal={fromSidebarRef.current ? 'true' : undefined}
        className={classNames(
          'relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl flex overflow-hidden',
          isHeaderBottom ? 'flex-col-reverse' : 'flex-col',
        )}
        style={{
          position: 'fixed',
          zIndex: 200,
          top:    (expandAnimated ? getTargetRect().top    : originRect?.top)    ?? 0,
          left:   (expandAnimated ? getTargetRect().left   : originRect?.left)   ?? 0,
          width:  (expandAnimated ? getTargetRect().width  : originRect?.width)  ?? 0,
          height: (expandAnimated ? getTargetRect().height : originRect?.height) ?? 0,
          transition: 'top 300ms cubic-bezier(0.4,0,0.2,1), left 300ms cubic-bezier(0.4,0,0.2,1), width 300ms cubic-bezier(0.4,0,0.2,1), height 300ms cubic-bezier(0.4,0,0.2,1)',
          borderRadius: expandAnimated ? '0.75rem' : '0.5rem',
        }}
        onClick={handleExpandedOverlayClick}
      >
        {/* Type gradient background at 70% opacity (same as the card tile) */}
        <div className="absolute inset-0 z-0 pointer-events-none"
             style={{ ...typeGradientStyle, opacity: 0.7 }} />
        {/* Header — shared component, expanded mode */}
        <WantCardHeader
          want={want}
          isFullScreen={isFullScreen}
          groupNames={wantGroupNames}
          onCollapse={handleCollapse}
          isWide={expandWide}
          onToggleWide={canWiden || expandWide ? () => setExpandWide(w => !w) : undefined}
          showMax
        />
        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden relative">
          {iframeUrl ? (
            <div className="absolute inset-0 flex flex-col bg-white dark:bg-gray-900 overflow-hidden">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-black/80 flex-shrink-0">
                <span className="flex-1 text-[0.6rem] font-mono text-white/60 truncate">{iframeUrl}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); if (iframeRef.current) iframeRef.current.src = iframeUrl; }}
                  className="p-0.5 rounded text-white/60 hover:text-white transition-colors"
                  title="再読み込み"
                ><RefreshCw className="w-3 h-3" /></button>
                <button
                  onClick={(e) => { e.stopPropagation(); window.open(iframeUrl, '_blank'); }}
                  className="p-0.5 rounded text-white/60 hover:text-white transition-colors"
                  title="新しいタブで開く"
                ><ExternalLink className="w-3 h-3" /></button>
                <button
                  onClick={(e) => { e.stopPropagation(); setIframeUrl(null); }}
                  className="p-0.5 rounded text-white/60 hover:text-white transition-colors"
                  title="閉じる"
                ><XIcon className="w-3 h-3" /></button>
              </div>
              <iframe
                ref={iframeRef}
                src={iframeUrl}
                className="flex-1 w-full border-0"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                title="card-embed"
              />
            </div>
          ) : (
            <WantCardContent
              want={want} isChild={false} hasChildren={!!hasChildren} isFocused={true} isSelectMode={false}
              onView={onView} onViewAgents={onViewAgents} onViewResults={onViewResults} onViewChat={onViewChat}
              onEdit={onEdit} onDelete={onDelete}
              onSuspend={onSuspend} onResume={onResume}
              onShowReactionConfirmation={onShowReactionConfirmation}
              onSliderActiveChange={() => {}}
              isInnerFocused={false} onExitInnerFocus={() => {}}
              isExpanded={true}
            />
          )}
        </div>
      </div>,
      document.body
    )}
    </>
  );
};
