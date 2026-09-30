import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { ExternalLink, Globe, Map as MapIcon, Minus, Plus, RefreshCw } from 'lucide-react';
import { WantCardPluginProps, registerWantCardPlugin } from '../registry';
import { useWantTypeStore } from '@/stores/wantTypeStore';
import { Want } from '@/types/want';
import { myDeviceId } from '@/hooks/useDeviceSession';
import { writeWantState } from '@/api/wantState';
import { useOverlayDesign } from '@/components/overlay';
import { useDarkMode } from '@/hooks/useDarkMode';
import { classNames } from '@/utils/helpers';
import { controlPillVars, ensureControlPillCss, CONTROL_PILL_LABELS } from '@/shared/controlPill';

// The page's bar is drawn as the control pill is (see WebFrameBar).
if (typeof document !== 'undefined') ensureControlPillCss(document);

/**
 * Hosts that refuse to be framed as-is but have a way in. Mirrored by
 * frameRewrites in the server's handlers_web_wants.go, which probes through it.
 *
 * www.google.com answers X-Frame-Options: SAMEORIGIN, except when the URL
 * carries igu=1 — undocumented, so this is a table of what works today rather
 * than a promise, and the first place to look when a card goes blank.
 */
const FRAME_REWRITES: Record<string, (u: URL) => void> = {
  'www.google.com': (u) => u.searchParams.set('igu', '1'),
  'google.com': (u) => u.searchParams.set('igu', '1'),
};

function toEmbeddableUrl(raw: string): string {
  try {
    const u = new URL(raw);
    FRAME_REWRITES[u.hostname]?.(u);
    return u.toString();
  } catch {
    return raw;
  }
}

/**
 * How large the page is drawn inside the card. A card is a small window onto a
 * page laid out for a whole screen, so by default the page is shown at half
 * size — laid out as if the card were twice as wide, then scaled down — and
 * more of it fits. Kept per want in the `zoom` state field, so a card someone
 * has zoomed stays that way.
 *
 * Web want types do not declare `zoom`, so the server files it under
 * hidden_state; writeWantState shows it in current until the server's copy
 * arrives. Read from either.
 */
const DEFAULT_ZOOM = 0.5;
const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1];

function readZoom(want: Want): number {
  const raw = Number(want.state?.current?.zoom ?? want.hidden_state?.zoom);
  return Number.isFinite(raw) && raw >= ZOOM_STEPS[0] && raw <= 1 ? raw : DEFAULT_ZOOM;
}

function stepZoom(zoom: number, dir: 1 | -1): number {
  const next = dir > 0 ? ZOOM_STEPS.find(z => z > zoom + 0.001) : [...ZOOM_STEPS].reverse().find(z => z < zoom - 0.001);
  return next ?? zoom;
}

/**
 * What the want was told to type into its page, keyed by field_key: each saved
 * field's parameter, and over it the plan field of the same name — the monitor
 * seeds the plan from the parameters, so a plan value is either the same one or
 * one set on the plan afterwards, which is the newer of the two.
 */
function collectFieldValues(want: Want): Record<string, string> {
  const out: Record<string, string> = {};
  const layers = [want.spec?.params, want.state?.plan] as (Record<string, unknown> | undefined)[];
  for (const layer of layers) {
    for (const [key, value] of Object.entries(layer ?? {})) {
      if (key !== 'target_url' && typeof value === 'string' && value) out[key] = value;
    }
  }
  return out;
}

/** The url-template label's {{plan.x}} placeholders, filled — as webFormBuildURL does on the server. */
function fillUrlTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{plan\.([a-zA-Z0-9_]+)\}\}/g, (_, key: string) => encodeURIComponent(values[key] ?? ''));
}

/**
 * The type's saved objects, from elements.json ({host: elements}). Asked each
 * time rather than kept: a type overwritten from Inspect changes them.
 */
async function loadTypeElements(typeName: string): Promise<{ hosts: string[]; elements: unknown[] } | null> {
  try {
    const res = await fetch(`/api/v1/web-wants/${encodeURIComponent(typeName)}`);
    if (!res.ok) return null;
    const byHost = (await res.json()) as Record<string, unknown[]>;
    return { hosts: Object.keys(byHost), elements: Object.values(byHost).flat() };
  } catch {
    return null;
  }
}

/**
 * Open a web want's real site in a new tab — with the values the want was
 * given already typed in when that can be done.
 *
 * A type saved with a url-template puts its values in the URL, so the page
 * arrives filled on any browser. Any other page is filled by the extension:
 * the same launch the approved form goes through, told to fill and stop — no
 * button is pressed, the person sees the form and submits it themselves.
 * Without the extension (or with nothing to fill) it is the plain page.
 *
 * Shared by the card's open button and by A/Enter on the card (see WantCard),
 * so the two cannot open different pages.
 */
export function openWebWant(want: Want): void {
  const params = (want.spec?.params ?? {}) as Record<string, unknown>;
  const current = (want.state?.current ?? {}) as Record<string, unknown>;
  const labels = want.metadata?.labels ?? {};
  const typeName = want.metadata?.type ?? '';
  const urlTemplate = labels['url-template']
    || useWantTypeStore.getState().wantTypes.find(t => t.name === typeName)?.labels?.['url-template']
    || '';
  const values = collectFieldValues(want);
  const hasValues = Object.keys(values).length > 0;
  const url =
    (urlTemplate && hasValues && fillUrlTemplate(urlTemplate, values)) ||
    (typeof current.embed_url === 'string' && current.embed_url) ||
    (typeof params.target_url === 'string' && params.target_url) ||
    labels['source-url'] ||
    '';
  if (!url) return;
  const openPlain = () => window.open(url, '_blank', 'noopener,noreferrer');
  // A url-template type's url is already the filled one.
  if (!hasValues || urlTemplate) { openPlain(); return; }
  if (document.documentElement.dataset.mywantExtension !== 'true' || !typeName) { openPlain(); return; }
  const pageUrl = (typeof params.target_url === 'string' && params.target_url) || labels['source-url'] || url;
  fetch(`/api/v1/web-wants/${encodeURIComponent(typeName)}/launch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // device: the tab opens in this browser, not whichever one is home.
    body: JSON.stringify({ target_url: pageUrl, field_values: values, fill_only: true, device: myDeviceId }),
  })
    .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); })
    .catch(err => {
      console.error('[WebFrameCard] prefilled open failed, opening the plain page:', err);
      openPlain();
    });
}

/**
 * A web want's card: the page itself, live.
 *
 * Which page: what the want last arrived at (embed_url, written when an
 * approved form resolves to a URL), else where it was pointed (target_url),
 * else the page it was captured from.
 *
 * The keys go into the page only while the card is inner-focused, the same
 * rule every card's controls follow (useInnerFocusRing). The page does not
 * wait to be asked — Google focuses its own search box the moment it loads —
 * so outside inner focus the frame is inert: it cannot take focus or the
 * pointer, and a click on the card stays a click on the card. Inside, the
 * frame is the card's one ring stop, so entering puts the caret in the page
 * and leaving hands it back to the card.
 *
 * Leaving cannot be Escape: keys pressed in a cross-origin page never reach
 * this one. So the way out is focus coming back — a click anywhere outside the
 * page, or Tab walking off its end.
 *
 * On its own (/w/:id) there is no card around it and nothing else on the page
 * for the keys to belong to, so there the page simply has them.
 *
 * Either way the page comes up with the want's values typed in: a url-template
 * type is pointed at the filled URL, any other page is filled by the extension
 * once it has loaded (MYWANT_FILL_FRAME — this page cannot reach into a
 * cross-origin frame). Filled, never submitted.
 */
/**
 * Something to show in place of the page, with what a press on it does.
 *
 * Where the card is drawn somewhere the page itself is — the browser
 * extension's warp sidebar, on that very page — framing it again would be a
 * picture of what is already all around it. There the card shows where it
 * leads instead (the board, as last seen) and a press goes there. Provided by
 * mywant-guiex's embed (WarpSidebar); absent everywhere in the app.
 */
export interface WebFrameStandIn {
  image?: string;
  label: string;
  onPress: () => void;
}
export const WebFrameStandInContext = createContext<WebFrameStandIn | null>(null);

const WebFrameContentSection: React.FC<WantCardPluginProps> = ({
  want, isFocused, isExpanded, isInnerFocused, onEnterInnerFocus, onExitInnerFocus,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const standIn = useContext(WebFrameStandInContext);
  const current = (want.state?.current ?? {}) as Record<string, unknown>;
  const params = (want.spec?.params ?? {}) as Record<string, unknown>;
  const labels = want.metadata?.labels ?? {};
  const typeName = want.metadata?.type ?? '';
  const urlTemplate = useWantTypeStore(
    st => labels['url-template'] || st.wantTypes.find(t => t.name === typeName)?.labels?.['url-template'] || '',
  );

  const fieldValues = collectFieldValues(want);
  const valuesKey = JSON.stringify(fieldValues);
  const hasValues = valuesKey !== '{}';

  // A url-template type's filled URL comes first: it is the page for the
  // values the want has now, where embed_url is the one for the values it had
  // when the form was last approved.
  const url =
    (urlTemplate && hasValues && fillUrlTemplate(urlTemplate, fieldValues)) ||
    (typeof current.embed_url === 'string' && current.embed_url) ||
    (typeof params.target_url === 'string' && params.target_url) ||
    labels['source-url'] ||
    '';
  const src = url ? toEmbeddableUrl(url) : '';

  const standalone = !onEnterInnerFocus;
  const live = standalone || !!isInnerFocused;

  // On its own (/w/:id) the page has the whole screen, so it is drawn as is.
  // An expanded card is live like that page but still a card on the board —
  // it has a way back out (onExitInnerFocus) — so it keeps the card's zoom.
  const onOwnPage = standalone && !onExitInnerFocus;
  const zoom = onOwnPage ? 1 : readZoom(want);
  const wantId = want.metadata?.id || want.id || '';
  const setZoom = (e: React.MouseEvent, next: number) => {
    e.stopPropagation();
    if (wantId && next !== zoom) writeWantState(wantId, { zoom: next });
  };

  // Filling the framed page. Once per (page, values): on the frame's first load,
  // and again when the values change — not on every load, which would type the
  // values back over a page the person has since moved on to inside the frame.
  const frameFill = useRef({ loadedSrc: '', sent: '' });
  const fillKey = `${src}\n${valuesKey}`;
  // The frame's own name, so the extension fills this card's frame and not
  // another card's showing the same page with different values. A live frame
  // (expanded, /w/:id) has one of its own, apart from the board card's.
  const frameName = `mywant-web-${want.metadata?.id || want.id || typeName}${standalone ? '-live' : ''}`;
  const fillFrame = () => {
    const st = frameFill.current;
    if (st.loadedSrc !== src || st.sent === fillKey) return;
    if (!hasValues || urlTemplate || !typeName) return;
    if (document.documentElement.dataset.mywantExtension !== 'true') return;
    st.sent = fillKey;
    const quiet = !live;
    loadTypeElements(typeName).then(saved => {
      if (!saved || !saved.elements.length) return;
      window.postMessage(
        { source: 'mywant-gui', type: 'MYWANT_FILL_FRAME', frameName, hosts: saved.hosts, elements: saved.elements, fieldValues, quiet },
        window.location.origin,
      );
    });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fillFrame(); }, [fillKey]);

  // Browse or Canvas inside a live frame, as the pill switches them on a page
  // of its own: Canvas brings the CursorMan into the page — its marks shaded,
  // Z mode, the arrows its — and Browse is the page as itself. The extension
  // does it (background.js's frameViewOf), since no pill runs in a frame; it
  // is told again on each of the frame's loads, which start the page afresh.
  // The CursorMan's own b / c / R1 in the frame come back here as
  // MYWANT_FRAME_VIEW_SET, this being where the switch is.
  const design = useOverlayDesign();
  const isDark = useDarkMode();
  const hasExtension = document.documentElement.dataset.mywantExtension === 'true';
  const viewable = standalone && hasExtension;
  const [canvas, setCanvas] = useState(false);
  const sendView = (on: boolean) => {
    if (!viewable) return;
    window.postMessage({ source: 'mywant-gui', type: 'MYWANT_FRAME_VIEW', frameName, canvas: on }, window.location.origin);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (frameFill.current.loadedSrc) sendView(canvas); }, [canvas, viewable]);
  useEffect(() => {
    if (!viewable) return;
    const onMessage = (e: MessageEvent) => {
      const m = e.data;
      if (!m || m.source !== 'mywant-ext' || m.type !== 'MYWANT_FRAME_VIEW_SET') return;
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow) return;
      setCanvas(!!m.canvas);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [viewable]);
  // b / c here too, as the pill hears them on a page of its own: b Browse,
  // c Canvas. In the capture phase, ahead of the board's own c (its canvas
  // mode), while this page is what is in front. Not while typing, not with a
  // modifier. With the frame focused, the keys are the frame's — the CursorMan
  // there, or the stand-in pill's c, sends them back as MYWANT_FRAME_VIEW_SET.
  useEffect(() => {
    if (!viewable) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.isComposing || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key !== 'b' && key !== 'c') return;
      const t = document.activeElement as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setCanvas(key === 'c');
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [viewable]);

  // React 18 does not pass `inert` through, so it is set on the element.
  useEffect(() => {
    iframeRef.current?.toggleAttribute('inert', !live);
  }, [live, url]);

  // inert is not enough on its own: a cross-origin page can still focus()
  // itself from its own scripts (Google does, on load). So whenever it may have
  // done so — this window losing focus, or the page finishing a load — check,
  // and give the focus back to whatever held it just before.
  useEffect(() => {
    const frame = iframeRef.current;
    if (live || !frame) return;
    let before: Element | null = document.activeElement;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const reclaim = () => {
      if (document.activeElement !== frame) return;
      if (before instanceof HTMLElement && before !== frame) before.focus();
      if (document.activeElement === frame) frame.blur();
    };
    const later = (ms: number) => { timers.push(setTimeout(reclaim, ms)); };
    const onFocusIn = () => { if (document.activeElement !== frame) before = document.activeElement; };
    const onBlur = () => later(0);
    // The page's own focus() runs some time after load, and when is its business.
    const onLoad = () => { later(0); later(500); later(1500); };
    reclaim();
    document.addEventListener('focusin', onFocusIn);
    window.addEventListener('blur', onBlur);
    frame.addEventListener('load', onLoad);
    return () => {
      timers.forEach(clearTimeout);
      document.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('blur', onBlur);
      frame.removeEventListener('load', onLoad);
    };
  }, [live, url]);

  // The way out: this document getting the focus or a press back means the
  // page let go. Three signals for one fact, because none is always there — a
  // window that never had OS focus fires no `focus`, and a press on something
  // that cannot take focus moves no focus at all. A press here can only be
  // outside the page: presses inside it never reach this document.
  useEffect(() => {
    if (standalone || !isInnerFocused) return;
    const onFocus = () => {
      if (document.activeElement !== iframeRef.current) onExitInnerFocus?.();
    };
    const onPress = () => onExitInnerFocus?.();
    window.addEventListener('focus', onFocus);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('pointerdown', onPress, true);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('pointerdown', onPress, true);
    };
  }, [standalone, isInnerFocused, onExitInnerFocus]);

  if (!url) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 p-4">
        Set <code className="mx-1 bg-gray-100 dark:bg-gray-700 px-1 rounded">target_url</code> in params
      </div>
    );
  }

  // The real site, with the values the want was given already typed in —
  // see openWebWant.
  const openRealSite = (e: React.MouseEvent) => {
    e.stopPropagation();
    openWebWant(want);
  };

  if (standIn) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); standIn.onPress(); }}
        className="relative w-full h-full min-h-0 overflow-hidden bg-gradient-to-br from-sky-300 to-sky-600 text-left"
        title={standIn.label}
      >
        {standIn.image && <img src={standIn.image} alt="" className="absolute inset-0 w-full h-full object-cover object-top" />}
        {/* At the foot: the card's own badges sit along its top edge. */}
        <span className="absolute left-2 right-12 bottom-2 flex items-center gap-1.5 px-2 py-1 rounded bg-black/70 text-white text-[0.65rem]">
          <ExternalLink className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{standIn.label}</span>
        </span>
      </button>
    );
  }

  // The server asked the page when the type was made, and it said no
  // (X-Frame-Options / frame-ancestors). A frame here would only ever be the
  // browser's broken-page icon, so show what the page looked like instead.
  if (labels.frameable === 'false') {
    const shot = labels['screenshot-url'];
    return (
      <button
        onClick={openRealSite}
        className="relative w-full h-full min-h-0 overflow-hidden bg-gray-100 dark:bg-gray-800 text-left"
        title="実サイトを新しいタブで開く"
      >
        {shot && <img src={shot} alt="" className="absolute inset-0 w-full h-full object-cover object-top" />}
        <span className="absolute left-2 right-2 top-2 flex items-center gap-1.5 px-2 py-1 rounded bg-black/70 text-white text-[0.65rem]">
          <ExternalLink className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{new URL(url, window.location.href).hostname} を開く</span>
        </span>
      </button>
    );
  }

  return (
    <div className="flex flex-col w-full h-full min-h-0 bg-white dark:bg-gray-900">
      <div className="relative flex-1 min-h-0 flex overflow-hidden">
        <iframe
          data-inner-focus
          data-inner-focus-default
          ref={iframeRef}
          src={src}
          name={frameName}
          onLoad={() => { frameFill.current.loadedSrc = src; fillFrame(); sendView(canvas); }}
          className={zoom === 1 ? 'flex-1 w-full min-h-0 border-0' : 'absolute left-0 top-0 border-0'}
          // Laid out 1/zoom times the card's size, then scaled back down into it.
          style={{
            pointerEvents: live ? 'auto' : 'none',
            ...(zoom === 1 ? {} : {
              width: `${100 / zoom}%`,
              height: `${100 / zoom}%`,
              transform: `scale(${zoom})`,
              transformOrigin: '0 0',
            }),
          }}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title={want.metadata?.name ?? 'web'}
        />
        {/* The mouse's way in, on a card that is already the selected one — the
            first click selects, the next one goes into the page. */}
        {!live && (isFocused || isExpanded) && (
          <div
            className="absolute inset-0 cursor-pointer"
            title="クリックでページを操作"
            onClick={() => onEnterInnerFocus?.()}
          />
        )}
        {/* The page's controls: a control pill (shared/controlPill) in the
            overlay design this person picked — the header pill's height, icons
            and words — only as wide as its cells, floating in the page's top
            right corner so it costs the page no height. On its own page
            (/w/:id) it keeps clear of the notification bell there
            (WantPushToggle). */}
        <div
          className={classNames('mwp-pill absolute top-1 z-10 shadow-lg', isDark && 'mwp-dark', onOwnPage ? 'right-[56px]' : 'right-1')}
          style={{ ...(controlPillVars(design.portable) as React.CSSProperties), height: 40 }}
        >
          <div className="mwp-row">
            {viewable && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setCanvas(c => !c); }}
                className="mwp-cell mwp-start"
                title={canvas ? 'キャンバスモード（タップでブラウズへ・b）' : 'ブラウズモード（タップでキャンバスへ・c）'}
                aria-pressed={canvas}
              >
                <span className="mwp-icon">{canvas ? <MapIcon /> : <Globe />}</span>
                <span className="mwp-label">{canvas ? CONTROL_PILL_LABELS.canvas : CONTROL_PILL_LABELS.browse}</span>
              </button>
            )}
            {!onOwnPage && (
              <>
                <button
                  type="button"
                  onClick={(e) => setZoom(e, stepZoom(zoom, -1))}
                  disabled={zoom <= ZOOM_STEPS[0]}
                  className={classNames('mwp-cell !min-w-[36px] !px-1', viewable ? 'mwp-divided' : 'mwp-start')}
                  title="縮小"
                  aria-label="縮小"
                >
                  <span className="mwp-icon"><Minus /></span>
                </button>
                <button
                  type="button"
                  onClick={(e) => setZoom(e, DEFAULT_ZOOM)}
                  className="mwp-cell !min-w-[44px] !px-1"
                  title={`${Math.round(DEFAULT_ZOOM * 100)}% に戻す`}
                >
                  <span className="font-mono text-[12px] font-bold leading-none">{Math.round(zoom * 100)}%</span>
                  <span className="mwp-label">{CONTROL_PILL_LABELS.zoom}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => setZoom(e, stepZoom(zoom, 1))}
                  disabled={zoom >= 1}
                  className="mwp-cell !min-w-[36px] !px-1"
                  title="拡大"
                  aria-label="拡大"
                >
                  <span className="mwp-icon"><Plus /></span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                // A reload is a fresh page: fill it again.
                frameFill.current = { loadedSrc: '', sent: '' };
                if (iframeRef.current) iframeRef.current.src = src;
              }}
              className={classNames('mwp-cell', viewable || !onOwnPage ? 'mwp-divided' : 'mwp-start')}
              title="再読み込み"
            >
              <span className="mwp-icon"><RefreshCw /></span>
              <span className="mwp-label">{CONTROL_PILL_LABELS.reload}</span>
            </button>
            <button
              type="button"
              onClick={openRealSite}
              className="mwp-cell mwp-divided mwp-end"
              title="実サイトを新しいタブで開く"
            >
              <span className="mwp-icon"><ExternalLink /></span>
              <span className="mwp-label">{CONTROL_PILL_LABELS.open}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

registerWantCardPlugin({
  types: [],
  labels: { 'form-type': 'web' },
  ContentSection: WebFrameContentSection,
  hideFinalResult: true,
});
