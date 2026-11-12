import React from 'react';
import { ArrowLeft, Pipette, X } from 'lucide-react';
import { usePickStore, cancelPick, type PickRequest } from '@/stores/pickStore';
import { useInputActions } from '@/hooks/useInputActions';
import { nativeHost, nativePanelPage, useHostControl, iconName, type HostControl } from '@/lib/nativeHost';
import { resolveIconForFamily } from '@/components/dashboard/WantTypeVisuals';
import { wantTypeIconStyle } from '@/components/dashboard/WantCardFace';
import { useWantTypeStore } from '@/stores/wantTypeStore';
import { useDataTypes } from '@/hooks/useDataTypes';
import { resolveLucideIcon } from '@/utils/subtypeIcons';
import { classNames } from '@/utils/helpers';
import { DisplayCard } from '@/components/forms/CardPrimitives';
import { getTypeStyle } from '@/components/forms/sections/ParameterGridSection';
import { WantSlot } from '@/components/forms/WantInventoryPicker';
import { useWantStore } from '@/stores/wantStore';
import { Slot } from '@/extensions/Slot';
import { extensionSlot, type PanelSubject } from '@/extensions/registry';
import type { Want } from '@/types/want';

/** In an app, a panel or card page (its sheet, its sidebar, a card on the
 *  board) is beside the board, which says it: one banner, not one a page. */
const besideTheBoard = nativeHost && (nativePanelPage
  || (typeof location !== 'undefined' && location.pathname.startsWith('/panel/card/')));

/**
 * Escape while picking means only "stop picking" — before whatever still holds
 * the keys (the panel put away keeps its own Escape, on a capturing handler of
 * its own). Listened for from the start, so it is the first such handler.
 * Both halves of the press: actions go on its release (useInputActions).
 */
if (typeof window !== 'undefined') {
  let swallowRelease = false;
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    if (e.type === 'keydown') {
      if (!usePickStore.getState().request) return;
      swallowRelease = true;
      cancelPick();
    } else if (!swallowRelease) {
      return;
    } else {
      swallowRelease = false;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('keyup', onKey, true);
}

/** The app draws the banner itself (lib/nativeHost, kind 'pick'): this page
 *  hands it what to show and hears its ✕. */
const hostDrawsBanner = nativeHost && !besideTheBoard && !!window.__mywantHost?.pickBanner;

/** A CSS colour as the app reads one: rgb(), as the browser computes it. */
function asRgb(color: string | undefined): string | undefined {
  if (!color || typeof document === 'undefined') return undefined;
  const el = document.createElement('span');
  el.style.color = color;
  document.body.appendChild(el);
  const rgb = getComputedStyle(el).color;
  el.remove();
  return rgb || undefined;
}

/** The parameter card's colours as the page drew it, for the app to draw the
 *  same card: its fill, badge, name, kind icon and empty value. */
export interface PickCardLook { fill: string; badge: string; ink: string; icon: string; value: string }

function readLook(root: HTMLElement | null): PickCardLook | null {
  const card = root?.querySelector<HTMLElement>('[data-pick-card]');
  if (!card) return null;
  const css = (el: Element | null | undefined, prop: 'color' | 'backgroundColor') =>
    el ? getComputedStyle(el)[prop] : '';
  return {
    fill: css(card, 'backgroundColor'),
    badge: css(card.querySelector('[data-pick-badge]'), 'backgroundColor'),
    ink: css(card.querySelector('[data-pick-name]'), 'color'),
    icon: css(card.querySelector('svg'), 'color'),
    value: css(card.querySelector('[data-pick-value]'), 'color'),
  };
}

/** The banner as a native control: the want's tile, the parameter's card, ✕. */
function usePickHostControl(req: PickRequest | null, look: PickCardLook | null, tileImage: string | undefined): void {
  const wantTypes = useWantTypeStore(s => s.wantTypes);
  const { getTypeInfo } = useDataTypes();
  let control: HostControl | null = null;
  if (hostDrawsBanner && req) {
    const wantType = req.asker?.wantType;
    const category = wantTypes.find(t => t.name === wantType)?.category ?? '';
    const p = req.param ?? { type: 'string', hasEnum: false };
    const sub = p.subType ? getTypeInfo(p.subType) : null;
    const style = getTypeStyle(p.type, p.hasEnum, resolveLucideIcon(sub?.icon));
    control = {
      id: 'pick',
      kind: 'pick',
      items: [
        ...(wantType ? [{
          id: 'want',
          label: req.asker?.wantName || wantType,
          detail: wantType,
          icon: iconName(resolveIconForFamily(category, wantType, 'lucide') as { displayName?: string }, 'Heart'),
          color: asRgb(String(wantTypeIconStyle(wantType, category, false).color ?? '')),
          image: tileImage,
          tone: 'want',
        }] : []),
        {
          id: 'param',
          label: req.label,
          detail: style.typeName,
          icon: iconName(style.BgIcon as { displayName?: string }, 'Type'),
          color: look?.ink ?? asRgb(sub?.color),
          colors: look ?? undefined,
          active: !!p.required,
        },
        { id: 'cancel', label: 'やめる', icon: 'X' },
      ],
    };
  }
  useHostControl(control, item => { if (item === 'cancel') cancelPick(); });
}

/** The want asking: its tile, and its name under it. */
const TILE = 44;

/** The want as its panel's head draws it: the extension's mark (the canvas:
 *  the want's own tile, as on the board) — the want itself, or in Add Want
 *  one of the type being made — or, with no extension, the type's slot. */
const AskingWantTile: React.FC<{ asker: NonNullable<PickRequest['asker']> }> = ({ asker }) => {
  const category = useWantTypeStore(s => s.wantTypes.find(t => t.name === asker.wantType)?.category);
  const stored = useWantStore(s => (asker.wantId ? s.wants.find(w => w.metadata?.id === asker.wantId) : undefined));
  const subject = React.useMemo<PanelSubject | null>(() => {
    if (stored) return { kind: 'want', want: stored };
    if (!asker.wantType) return null;
    return { kind: 'want', want: {
      metadata: { id: asker.wantId ?? '', name: asker.wantName ?? asker.wantType, type: asker.wantType, labels: {} },
      spec: { params: {} },
      status: 'idle',
    } as unknown as Want };
  }, [stored, asker.wantId, asker.wantName, asker.wantType]);
  if (subject && extensionSlot('panelIdentityMark').length > 0) {
    return (
      <div style={{ width: TILE, height: TILE }}>
        <Slot name="panelIdentityMark" subject={subject} size={TILE} inert />
      </div>
    );
  }
  if (!asker.wantType) return null;
  return <WantSlot id={asker.wantType} itemType="want-type" category={category} size={TILE} />;
};

const AskingWant: React.FC<{ asker: NonNullable<PickRequest['asker']> }> = ({ asker }) => {
  if (!asker.wantType && !asker.wantId) return null;
  return (
    <div className="flex flex-col items-center gap-0.5 flex-shrink-0 w-14">
      <AskingWantTile asker={asker} />
      <span className="mt-1 max-w-full truncate text-[10px] text-gray-600 dark:text-gray-300" title={asker.wantName || asker.wantType}>
        {asker.wantName || asker.wantType}
      </span>
    </div>
  );
};

/** The parameter asking, as its card in the panel looks — with no value: the
 *  value is what is being picked. */
const AskingParam = React.forwardRef<HTMLDivElement, { req: PickRequest }>(({ req }, ref) => {
  const { getTypeInfo } = useDataTypes();
  const p = req.param ?? { type: 'string', hasEnum: false };
  const sub = p.subType ? getTypeInfo(p.subType) : null;
  const subColor = sub?.color;
  const style = getTypeStyle(p.type, p.hasEnum, resolveLucideIcon(sub?.icon));
  // The card as ParameterGridSection draws one with no value in it: its
  // type's tint, its badge and name, its kind's icon large and faint, and
  // 未入力 where the value would be.
  return (
    <div ref={ref} className="w-36 h-14 flex-shrink-0">
      <DisplayCard
        className={classNames('relative mw-postit p-1.5 h-14 w-full', style.tint)}
        dataAttrs={{ 'data-pick-card': '' }}
        bgIconLarge
        BgIcon={style.BgIcon}
        bgIconColor={subColor ? '' : style.scheme.bgIconColor}
        inkColor={subColor || style.scheme.color}
        bgIconStyle={subColor ? { color: subColor } : undefined}
        headerLeft={
          <span className="flex items-center gap-1 min-w-0">
            <span data-pick-badge className={classNames('flex-shrink-0 px-1 py-px rounded-full text-[8px] font-bold leading-none text-white', style.badge)}>
              {style.typeName}
            </span>
            <span data-pick-name className="text-[11px] font-semibold card-ink truncate leading-none">
              {req.label}{p.required && <span className="text-red-500 ml-0.5">★</span>}
            </span>
          </span>
        }
        headerRight={
          <span className="w-4 h-4 flex items-center justify-center rounded bg-sky-500 text-white">
            <Pipette className="w-2.5 h-2.5" />
          </span>
        }
      >
        <div className="h-full flex items-end justify-end overflow-hidden relative">
          <span data-pick-value className="text-right leading-none text-xl font-semibold text-gray-400/60 dark:text-gray-500/60 italic">未入力</span>
        </div>
      </DisplayCard>
    </div>
  );
});
AskingParam.displayName = 'AskingParam';

/**
 * What is being picked while a parameter asks for its value (pick mode,
 * stores/pickStore) — said over everything, at the top, with the way out: the
 * want asking (its tile) and its parameter's card, empty. The panel they are
 * in is put away while the board answers (RightSidebar; an app's sheet), so
 * this is where they are seen. B / Escape is bound here, so it is the same way
 * out on the board and in a list.
 */
export const PickBanner: React.FC = () => {
  const request = usePickStore(s => s.request);
  useInputActions({ enabled: !!request, ignoreWhenInSidebar: false, onCancel: cancelPick });
  // In an app that draws the banner, the card is drawn here out of sight all
  // the same, and its colours read off it: the app's card is this one.
  const measureRef = React.useRef<HTMLDivElement>(null);
  const [look, setLook] = React.useState<PickCardLook | null>(null);
  // The want's tile, as a picture for the app (its item's image): drawn here
  // out of sight and taken (html2canvas) once it has settled.
  const tileRef = React.useRef<HTMLDivElement>(null);
  const [tileImage, setTileImage] = React.useState<string | undefined>();
  React.useEffect(() => {
    setTileImage(undefined);
    if (!hostDrawsBanner || !request) return;
    let gone = false;
    const t = window.setTimeout(async () => {
      const el = tileRef.current;
      if (!el || gone) return;
      try {
        const { default: html2canvas } = await import('html2canvas');
        const canvas = await html2canvas(el, { backgroundColor: null, scale: window.devicePixelRatio || 2, logging: false, useCORS: true });
        if (!gone) setTileImage(canvas.toDataURL('image/png'));
      } catch { /* the app draws the type's mark instead */ }
    }, 400);
    return () => { gone = true; window.clearTimeout(t); };
  }, [request]);
  React.useLayoutEffect(() => {
    if (!hostDrawsBanner || !request) { setLook(null); return; }
    const next = readLook(measureRef.current);
    setLook(prev => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, [request]);
  usePickHostControl(request, look, tileImage);
  if (!request || besideTheBoard) return null;
  if (hostDrawsBanner) {
    return (
      <div aria-hidden style={{ position: 'fixed', left: -10000, top: 0, pointerEvents: 'none' }}>
        <div ref={measureRef}><AskingParam req={request} /></div>
        {request.asker && <div ref={tileRef} style={{ width: TILE, height: TILE }}><AskingWantTile asker={request.asker} /></div>}
      </div>
    );
  }
  return (
    <div
      role="status"
      aria-label={`「${request.label}」を選ぶ`}
      className="fixed left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 rounded-2xl bg-white/95 dark:bg-gray-900/95 border border-sky-500/60 shadow-xl pl-3 pr-2 py-2 max-w-[calc(100vw-24px)]"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
    >
      {request.asker && <AskingWant asker={request.asker} />}
      <AskingParam req={request} />
      <ArrowLeft className="w-4 h-4 text-sky-600 dark:text-sky-400 flex-shrink-0" aria-hidden />
      <span className="flex flex-col min-w-0 text-sm text-gray-800 dark:text-gray-100">
        <span className="font-semibold whitespace-nowrap">選んでください</span>
        <span className="text-[11px] text-gray-500 dark:text-gray-400 whitespace-nowrap">B / Esc でやめる</span>
      </span>
      <button
        type="button"
        onClick={cancelPick}
        aria-label="やめる"
        className="ml-1 w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-200/70 dark:hover:bg-gray-700/70"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
