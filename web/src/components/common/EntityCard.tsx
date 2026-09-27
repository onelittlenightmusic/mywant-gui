/**
 * EntityCard — the one card shell every non-want grid renders.
 *
 * The want card (components/dashboard/WantCard) is the reference design and is
 * deliberately NOT built on this; EntityCard exists so want types, worlds, web
 * wants, recipes, agents, achievements, devices and characters all look and
 * behave like it:
 *
 *   - a big centred icon over a category background (no prose on the card),
 *   - a bottom bar with the name and at most a couple of badges,
 *   - every action reachable as a grid of tiles overlaid on the card itself
 *     (long-press, right-click, or Shift+Enter / gamepad Start), never as
 *     buttons scattered through the card or the details sidebar.
 *
 * Descriptive detail belongs in the page's details sidebar, which `onView`
 * opens — "Details" is always the first tile so opening is one more action in
 * the same grid rather than a special case.
 */
import React, { useRef, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { classNames } from '@/utils/helpers';
import { menuTintBg, menuColorForPath } from '@/utils/menuColors';
import { OverlayActionGrid, OverlayItem, type OverlayTone } from '@/components/overlay';
import { WantCardOverlay } from '@/components/dashboard/WantCard/parts/WantCardOverlay';
import { buildDeleteConfirmConfig } from '@/components/dashboard/WantCard/parts/DeleteConfirmOverlay';
import { CardOverlayConfig } from '@/components/dashboard/WantCard/hooks/useCardOverlay';
import { CardCursorMan } from '@/components/dashboard/CardCursorMan';
import { WantCardFace } from '@/components/dashboard/WantCardFace';
import { useCardOverlayStore } from '@/stores/cardOverlayStore';
import { handOverToSidebar, useInputHandedOver } from '@/stores/focusOwner';
import { playSound } from '@/utils/sounds';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useCardOpacity } from '@/hooks/useCardOpacity';
import { useSystemFontSize, CARD_FACE_NAME_SIZE } from '@/hooks/useSystemFontSize';
import { useMyCursorColor } from '@/hooks/useMyCursorColor';
import { playHapticClick } from '@/utils/haptic';
import {
  CARD_FOCUS_BASE,
  CARD_SELECTED_CLASSES,
  CARD_UNSELECTED_CLASSES,
  CARD_BOTTOM_BAR_SELECTED,
  CARD_BOTTOM_BAR_UNSELECTED,
  CARD_SHELL_BASE,
  CARD_SURFACE_BASE,
  CARD_HOVER_RING,
  hoverRingVars,
  focusGlowVars,
} from '@/components/dashboard/WantCard/hooks/cardStyles';
import { cardInkVars } from '@/components/dashboard/WantCardFace';
import { BOOKMARK_CLIP } from '@/utils/bookmarkShape';
import { THING_CLIP } from '@/utils/thingShape';
import { thingFaceBackground } from '@/utils/thingFace';

/** One tile in a card's action overlay. */
export interface EntityCardAction {
  icon: React.ReactNode;
  /** Short uppercase label under the icon. Keep it to one word where possible. */
  label: string;
  onClick: () => void;
  /** What the action means, which decides its colour — see OverlayTone. */
  tone: OverlayTone;
  /** The off half of an on/off action — see OverlayCell. */
  off?: boolean;
  disabled?: boolean;
  title?: string;
  /** When true, a Yes/No overlay is shown before onClick runs. */
  confirm?: boolean;
}

export interface EntityCardProps {
  /**
   * Globally unique card id — build it with `entityCardId(scope, name)`.
   * Drives the shared overlay store and `data-keyboard-nav-id`.
   */
  navId: string;
  /** Name shown under the icon and in the bottom bar. */
  title: string;
  selected: boolean;
  /**
   * Keep DOM focus where it is when this card becomes selected.
   *
   * For a card in a grid, selection and focus are the same thing — the cursor
   * lands on it and the keyboard follows. A card embedded in a detail sidebar
   * is different: it is "selected" only in the sense of being that sidebar's
   * subject, and pulling focus into the sidebar would silence the canvas's own
   * arrow keys (they ignore input while focus sits in a sidebar), leaving
   * CursorMan stuck the moment the sidebar opened.
   */
  keepFocus?: boolean;
  /** Opens the page's details sidebar for this entity. */
  onView: () => void;
  actions?: EntityCardAction[];
  /** Columns in the action overlay. Default 3, matching the want card. */
  overlayCols?: number;

  /**
   * Face derived from a want type: category background image/gradient plus the
   * type's icon, exactly as want cards and canvas tiles render it.
   * Mutually exclusive with `icon` / `backgroundStyle`.
   */
  wantTypeFace?: { typeName: string; bgTypeName?: string; category: string };
  /** Centred icon for entities that have no want type (worlds, devices, …). */
  icon?: React.ReactNode;
  /**
   * Background for the generic face. Painted in the shared opacity layer, so
   * it dims with the setting while the icon stays crisp.
   *
   * Defaults to the tint of the menu section this page belongs to, which is
   * what every card wants and what every card used to pass by hand. Give one
   * only to override that — a thumbnail, or a card that is deliberately not of
   * its page.
   */
  backgroundStyle?: React.CSSProperties;
  /**
   * Tailwind background classes for the card's own surface, drawn under
   * `backgroundStyle` inside the opacity layer. Use this — not `className` —
   * for a card's base tint, or it will not fade with the opacity setting.
   * Default: CARD_SURFACE_BASE (white / dark gray).
   */
  surfaceClass?: string;
  /**
   * Image layer drawn over the background and under the icon — world
   * thumbnails and web-want screenshots. Also inside the opacity layer.
   * Supply a scrim yourself if the icon needs to stay legible.
   */
  backgroundNode?: React.ReactNode;

  /** Small icon left of the name in the bottom bar. */
  titleIcon?: React.ReactNode;
  /** Badges on the right of the bottom bar. Keep to two at most. */
  badges?: React.ReactNode;
  /**
   * Small badges rendered directly under the name on the card face (badge mode
   * only) — for what a card *depends on*, as opposed to what it is. A kata uses
   * it to name the lower forms it is built from.
   */
  faceBadges?: React.ReactNode;
  /**
   * A mark drawn directly ABOVE the name on the card face (badge mode only).
   *
   * For the one glyph that says what an entity IS, when the badge itself is
   * already spoken for by something else — a kata's badge is the row of 所作,
   * so the form's own mark has nowhere else on the face to go, and it belongs
   * with the name rather than down in the fine print.
   */
  faceLead?: React.ReactNode;
  /** Corner markers etc. rendered inside the card above the face. */
  children?: React.ReactNode;
  className?: string;
  /** Inline style merged onto the card shell (e.g. a per-entity border colour). */
  style?: React.CSSProperties;
  /**
   * Render `icon` field-card style: a large, left-aligned rounded badge sitting
   * like a background element at the bottom-left, instead of a centered icon.
   * Works with `wantTypeFace` too (its own centered icon is suppressed).
   */
  /**
   * Draw the icon as a badge in the corner rather than centred on the card.
   *
   * On by default: it is what every card in the app does, and the one that did
   * not do it was simply the one that forgot.
   */
  iconBadge?: boolean;
  /** Tint (hex) for the icon-badge background wash + ring. */
  iconBadgeColor?: string;
  /** A CSS background for the icon badge, in place of the pale wash of
   *  `iconBadgeColor` — a kata's own gradient, say. The ink stays
   *  `iconBadgeColor`'s. */
  iconBadgeBackground?: string;
  /**
   * Wide variant of `iconBadge`, for cards whose face content is a ROW rather
   * than a single glyph (a kata's 所作 tiles). The badge keeps its left-anchored
   * position but runs horizontally instead of square, and the name centres in
   * the strip to its right instead of over the whole card. Everything else —
   * menu tint, card ink, no bottom bar — stays identical to `iconBadge`.
   * Ignored unless `iconBadge` is also set.
   */
  wideBadge?: boolean;
  /**
   * Silhouette of the icon badge. 'bookmark' clips it to the shape a remembered
   * value wears everywhere else, so a thing card and a thing tile read as the same
   * kind of thing. Ignored unless `iconBadge` is set.
   */
  /** 'thing' is the round badge a remembered value wears everywhere. */
  badgeShape?: 'square' | 'bookmark' | 'thing';
}

export const EntityCard: React.FC<EntityCardProps> = ({
  navId,
  title,
  selected,
  keepFocus = false,
  onView,
  actions = [],
  overlayCols = 3,
  wantTypeFace,
  icon,
  backgroundStyle,
  surfaceClass = CARD_SURFACE_BASE,
  backgroundNode,
  titleIcon,
  badges,
  faceBadges,
  faceLead,
  children,
  className,
  style,
  iconBadge = true,
  iconBadgeColor,
  iconBadgeBackground,
  wideBadge = false,
  badgeShape = 'square',
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const isDarkMode = useDarkMode();
  // The page's own accent, unless the caller names one. Every card in the app
  // passed menuTintBg(MENU_COLORS.<its own page>) and iconBadge — twelve call
  // sites, twelve identical lines, and a thirteenth card that forgot them was
  // simply a card that did not match the others. A default cannot be forgotten.
  const routeTint = menuTintBg(menuColorForPath(useLocation().pathname));
  const cardOpacity = useCardOpacity();
  const faceNameSize = CARD_FACE_NAME_SIZE[useSystemFontSize()];

  const openCardId = useCardOverlayStore(s => s.openCardId);
  const setOpenCardId = useCardOverlayStore(s => s.setOpenCardId);
  // Whether the keys are already in the panel — read for the second-click
  // handover in handleClick, and the same fact the grid dims itself from.
  const inputHandedOver = useInputHandedOver();
  const showActions = openCardId === navId;
  const closeActions = () => setOpenCardId(null);

  // Secondary overlay stacked on the action grid (currently only Yes/No
  // confirmations). Kept local: it never needs to survive a re-mount.
  const [activeOverlay, setActiveOverlay] = useState<CardOverlayConfig | null>(null);
  const clearOverlay = () => setActiveOverlay(null);

  // Keyboard navigation moves selection; mirror that onto DOM focus so the
  // free-roaming cursor and scrollIntoView both track the same element.
  useEffect(() => {
    if (keepFocus) return;
    if (selected && document.activeElement !== cardRef.current) {
      cardRef.current?.focus();
    }
  }, [selected, keepFocus]);

  // Closing selection must not leave an orphaned overlay behind.
  useEffect(() => {
    if (!selected && showActions) setOpenCardId(null);
  }, [selected, showActions, setOpenCardId]);

  // Long-press (150 ms) — same timing and haptics as the want card's useLongPress.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const posRef = useRef<{ x: number; y: number } | null>(null);

  /**
   * Open this card's action grid, selecting the card first if it is not the
   * selected one. The effect above closes the grid of any card that is not
   * selected, so opening it on an unselected card (a right-click or long-press
   * straight onto it) was undone on the very next render — the menu never
   * appeared and Delete was unreachable until the card had been clicked once.
   */
  const openActions = () => {
    if (!selected) onView();
    setOpenCardId(navId);
  };

  const lpStart = (x: number, y: number) => {
    posRef.current = { x, y };
    timerRef.current = setTimeout(() => {
      if (posRef.current) {
        navigator.vibrate?.(10);
        playHapticClick();
        openActions();
        timerRef.current = null;
      }
    }, 150);
  };
  const lpCancel = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    posRef.current = null;
  };
  const lpMove = (x: number, y: number) => {
    if (!posRef.current) return;
    if (Math.hypot(x - posRef.current.x, y - posRef.current.y) > 10) lpCancel();
  };

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[role="button"]')) return;
    /**
     * Clicking the card you are already on is the press.
     *
     * Two beats, the same two the keyboard and the pad have had all along: the
     * arrows walk onto a card and A goes into the panel beside it (see
     * useGridFocus's onConfirm). The mouse had only the first — every click,
     * including the fifth on the same card, just re-selected it — so the one
     * input with no second button was the one that could never get in.
     *
     * `selected` carries the condition because on these grids selection IS
     * focus: the card the cursor is on is the card the panel is showing. Not
     * offered once input is already over there, where the click would be asking
     * for something that has happened — and not on a keepFocus card, which is
     * the copy embedded in a panel and is "selected" only in the sense of being
     * that panel's subject (see the prop's note).
     */
    const open = () => {
      // Landing on a card sounds the same whether you walked to it or clicked
      // it. The mouse used to be the silent way in, which made the pointer and
      // the pad feel like two different apps.
      playSound('gridMove');
      onView();
    };
    if (selected && !keepFocus && !inputHandedOver) {
      // Deferred like every other caller: a panel that this click is what
      // opened does not exist until the next frame.
      //
      // And it falls back when there was nothing to hand to, which is the
      // contract handOverToSidebar states and this caller was ignoring. On a
      // phone the detail sheet waits to be asked for, so a tap on the float
      // card — always `selected`, since it shows the tile the character is
      // standing on — took this branch, found no panel, and returned. Every
      // tap did nothing at all.
      requestAnimationFrame(() => { if (!handOverToSidebar()) open(); });
      return;
    }
    open();
    // Bring the newly selected card into view once the sidebar has reflowed.
    requestAnimationFrame(() => {
      setTimeout(() => {
        const el = document.querySelector('[data-keyboard-nav-selected="true"]');
        if (el instanceof HTMLElement) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 0);
    });
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    openActions();
  };

  const runAction = (action: EntityCardAction) => {
    if (action.disabled) return;
    if (action.confirm) {
      closeActions();
      setActiveOverlay(buildDeleteConfirmConfig(
        () => { clearOverlay(); action.onClick(); },
        clearOverlay,
      ));
      return;
    }
    closeActions();
    action.onClick();
  };

  // The card's own actions, then Close. (Opening details is done by clicking the
  // card — onView — so there is no separate "Details" overlay tile.)
  const overlayItems: OverlayItem[] = [
    ...actions.map((action, i) => ({
      icon: action.icon,
      label: action.label,
      title: action.title,
      onClick: () => runAction(action),
      tone: action.tone,
      off: action.off,
      disabled: action.disabled,
      delay: i * 30,
    })),
    {
      icon: <X className="w-5 h-5 text-white" />,
      label: 'Close',
      onClick: closeActions,
      tone: 'cancel',
      delay: actions.length * 30,
    },
  ];

  const isOverlayOpen = showActions || !!activeOverlay;

  // No background class on the shell: the card's whole painted surface lives in
  // the opacity layer below, so lowering card_opacity reveals the page behind
  // the card instead of an opaque white base bleeding through.
  const shellClassName = classNames(
    CARD_SHELL_BASE,
    CARD_HOVER_RING,
    'group hover:shadow-md dark:hover:shadow-blue-900/20 transition-all duration-300',
    'cursor-pointer select-none h-full flex flex-col min-h-[6rem] sm:min-h-[10rem]',
    CARD_FOCUS_BASE,
    // A keepFocus card is the pinned subject of a sidebar, not one cell in a
    // grid — `selected` here means "this is what the panel is about", not
    // "keyboard focus landed here". So it skips the grid pop: scale-[1.02] +
    // z-10 lifted its top edge (and shadow) up over the panel's name row,
    // which since the focus border became a glow had nothing framing it and
    // read as the name sitting on the card.
    selected
      ? (keepFocus ? CARD_UNSELECTED_CLASSES : CARD_SELECTED_CLASSES)
      : CARD_UNSELECTED_CLASSES,
    className ?? '',
  );

  // フォーカス枠の色は自分のキャラクター色に統一する（枠の太さ・影はクラス側）。
  const focusColor = useMyCursorColor();

  const dataAttributes = {
    'data-keyboard-nav-selected': selected,
    'data-keyboard-nav-id': navId,
    'data-free-cursor-item': true,
  };

  const handlers = {
    onClick: handleClick,
    onContextMenu: handleContextMenu,
    onMouseDown: (e: React.MouseEvent) => { if (e.button !== 0) return; lpStart(e.clientX, e.clientY); },
    onMouseMove: (e: React.MouseEvent) => lpMove(e.clientX, e.clientY),
    onMouseUp: lpCancel,
    onMouseLeave: lpCancel,
    onTouchStart: (e: React.TouchEvent) => { const t = e.touches[0]; lpStart(t.clientX, t.clientY); },
    onTouchMove: (e: React.TouchEvent) => { const t = e.touches[0]; lpMove(t.clientX, t.clientY); },
    onTouchEnd: lpCancel,
  };

  const noSelectStyle = {
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
    ...hoverRingVars(focusColor, isDarkMode),
    ...cardInkVars(iconBadgeColor, isDarkMode),
    ...style,
    // Not on a keepFocus card: it is the only card in the panel, so there is
    // nothing to pick it out from — a glow there is just noise on the subject.
    ...(selected && !keepFocus ? focusGlowVars(focusColor, isDarkMode) : {}),
  } as React.CSSProperties;

  // Everything layered OVER the painted surface — icons, text, overlays. These
  // stay at full opacity in both face variants.
  // Field-card-style icon: a large, left-aligned rounded badge that reads as a
  // background element at the card's bottom-left (vs. a centered icon).
  const iconBadgeNode = iconBadge && icon ? (
    <div className="absolute inset-0 z-10 pointer-events-none">
      <div
        className={classNames(
          'absolute top-1/2 -translate-y-1/2 left-2 flex items-center justify-center rounded-2xl',
          // Wide: room for a row, and the content keeps its own size. Square:
          // one glyph, scaled to 60% of the badge.
          wideBadge
            ? 'w-[54%] max-w-[15rem] h-[62%] max-h-[5.5rem] px-1.5'
            : 'w-[46%] aspect-square max-w-[7rem] [&_svg]:w-[60%] [&_svg]:h-[60%]',
          // A bookmark has no rounded corners to speak of; the clip supplies
          // the shape instead.
          badgeShape === 'bookmark' && '!rounded-none',
          badgeShape === 'thing' && '!rounded-full',
          // A thing's glyph is not scaled down to sit inside a badge: the badge
          // is the small part. See below.
          // Bigger than the 60% a badge glyph gets, because a thing's glyph is
          // the object rather than a mark inside a badge — but not so big it
          // reaches into the title. At 86% it did: the title is centred in what
          // is left of the card, so a long one grows back towards the badge and
          // the two met.
          badgeShape === 'thing' && '[&_svg]:!w-[72%] [&_svg]:!h-[72%]',
        )}
        style={{
          ...(iconBadgeBackground && badgeShape !== 'thing'
            ? { background: iconBadgeBackground }
            : iconBadgeColor
            ? {
                // Every badge but a thing's keeps the pale wash it always had.
                //
                // A thing's used to be its face — filled with its colour, with a
                // pale glyph laid over. That is the arrangement the board
                // dropped: a filled disc is the want-shaped silhouette, and a
                // glyph inside one is decoration on it rather than the object.
                // The fill goes; the dot below carries the colour instead.
                backgroundColor: badgeShape === 'thing' ? 'transparent' : `${iconBadgeColor}3a`,
              }
            : { backgroundColor: 'rgba(120,120,120,0.18)' }),
          ...(badgeShape === 'bookmark' ? { clipPath: BOOKMARK_CLIP } : {}),
          // No clip either: it was there to make the disc a sphere, and there
          // is no disc now. Left on, it would cut the glyph that overhangs.
          ...(badgeShape === 'thing' ? { borderRadius: '50%' } : {}),
        }}
      >
        {/* The anchor, behind the glyph and much smaller than it — the board's
            arrangement, at badge size. */}
        {badgeShape === 'thing' && iconBadgeColor && (
          <span
            aria-hidden
            className="absolute rounded-full"
            style={{ width: '30%', height: '30%', background: iconBadgeColor }}
          />
        )}
        {icon}
      </div>
    </div>
  ) : null;

  const faceChildren = (
    <>
      {children}
      {iconBadgeNode}

      {/* Badge cards carry the name italic on the face (always visible); the
          bottom bar with badges is revealed only on focus/hover, mirroring the
          want card's header behaviour. */}
      {iconBadge && (
        <div
          className={classNames(
            'absolute top-0 bottom-0 right-0 z-10 flex items-center justify-center pointer-events-none',
            // A wide badge reaches past the card's middle, so the name gets the
            // strip beside it rather than the whole card.
            wideBadge ? 'left-[57%] px-2' : 'left-0 px-3',
          )}
        >
          <div className="flex flex-col items-center gap-1 min-w-0 max-w-full">
            {faceLead && (
              <div className="flex items-center justify-center leading-none">
                {faceLead}
              </div>
            )}
            <span
              className={classNames('font-semibold text-center leading-tight text-gray-800 dark:text-gray-100', faceNameSize)}
              style={{
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical' as const,
                textShadow: '0 1px 3px rgba(255,255,255,0.7), 0 0 2px rgba(0,0,0,0.2)',
              }}
            >
              {title}
            </span>
            {faceBadges && (
              <div className="flex items-center justify-center gap-1 flex-wrap max-w-full">
                {faceBadges}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Badge cards carry their name on the face and their state in the pill,
          so this bar only ever appeared on focus to repeat them. It is left for
          the cards that have nowhere else to put a name. */}
      {!iconBadge && (
      <div
        className={classNames(
          'absolute bottom-0 left-0 right-0 z-20 mt-auto select-none',
        )}
        style={isOverlayOpen ? { filter: 'blur(2px)', opacity: 0.5, pointerEvents: 'none' } : undefined}
      >
        <div className={classNames(
          'backdrop-blur-[2px] transition-colors duration-200 px-3 sm:px-6 py-1.5 flex items-center justify-between gap-1',
          selected ? CARD_BOTTOM_BAR_SELECTED : CARD_BOTTOM_BAR_UNSELECTED,
        )}>
          <h3 className="flex-1 min-w-0 text-[9px] sm:text-[13px] font-semibold card-ink truncate flex items-center gap-1.5">
            {titleIcon}
            <span className="truncate">{title}</span>
          </h3>
          {badges && (
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">{badges}</div>
          )}
        </div>
      </div>
      )}

      {showActions && !activeOverlay && (
        <OverlayActionGrid
          items={overlayItems}
          cols={overlayCols}
          onClose={closeActions}
          onMouseDown={(e) => e.stopPropagation()}
        />
      )}
      <WantCardOverlay activeOverlay={activeOverlay} onClose={clearOverlay} />
    </>
  );

  const face = wantTypeFace ? (
    <WantCardFace
      divRef={cardRef}
      typeName={wantTypeFace.typeName}
      bgTypeName={wantTypeFace.bgTypeName}
      displayName={title}
      category={wantTypeFace.category}
      theme={isDarkMode ? 'dark' : 'light'}
      context="canvas"
      iconSize={28}
      showIcon={!iconBadge}
      showName={!iconBadge}
      imageAlign="right"
      tabIndex={0}
      className={shellClassName}
      style={noSelectStyle}
      dataAttributes={dataAttributes}
      surfaceClass={surfaceClass}
      backgroundNode={backgroundNode}
      {...handlers}
    >
      {faceChildren}
    </WantCardFace>
  ) : (
    <div
      ref={cardRef}
      tabIndex={0}
      className={classNames('relative overflow-hidden', shellClassName)}
      style={noSelectStyle}
      {...dataAttributes}
      {...handlers}
    >
      {/* The card's entire painted surface — base tint, category background and
          any image — in ONE layer at the shared opacity. Keeping the base tint
          in here is the point: an opaque white on the shell would show through
          as the background fades, making low opacity look white instead of
          transparent. */}
      <div
        className="absolute inset-0 pointer-events-none z-0 rounded-[inherit] overflow-hidden"
        style={{ opacity: cardOpacity }}
      >
        <div
          className={classNames('absolute inset-0', surfaceClass)}
          style={backgroundStyle?.backgroundImage
            ? { ...backgroundStyle, backgroundSize: 'auto 100%', backgroundPosition: 'right center', backgroundRepeat: 'no-repeat' }
            : (backgroundStyle ?? routeTint)}
        />
        {backgroundNode}
      </div>

      {/* Centred icon + name — the generic mirror of WantCardFace's content
          layer. Skipped in badge mode, where the icon becomes a bottom-left
          background badge and the name lives only in the bottom bar. */}
      {!iconBadge && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 px-2 pb-6 pointer-events-none">
          {icon}
          <p
            className="font-semibold text-center leading-tight select-none text-gray-800 dark:text-gray-100"
            style={{
              fontSize: 9,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical' as const,
              maxWidth: '100%',
            }}
          >
            {title}
          </p>
        </div>
      )}
      {faceChildren}
    </div>
  );

  return (
    <div className="relative h-full" style={{ isolation: 'isolate' }}>
      {/* Only on a card in a grid. A card embedded in a details panel is
          "selected" in the sense of being that panel's subject (see keepFocus),
          not in the sense of being where the cursor is standing — and the
          cursor is standing on the grid card this one is a copy of, which is
          already drawing him. Two of the same character on screen at once. */}
      <CardCursorMan visible={selected && !keepFocus} />
      {face}
    </div>
  );
};
