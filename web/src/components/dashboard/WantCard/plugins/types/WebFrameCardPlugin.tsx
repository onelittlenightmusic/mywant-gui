import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Globe, Map as MapIcon } from 'lucide-react';
import { WantCardPluginProps, registerWantCardPlugin } from '../registry';
import { useWantTypeStore } from '@/stores/wantTypeStore';
import { Want } from '@/types/want';
import { myDeviceId } from '@/hooks/useDeviceSession';
import { writeWantState } from '@/api/wantState';
import { lendController } from '@/lib/controllerHub';
import { useOverlayDesign } from '@/components/overlay';
import { useDarkMode } from '@/hooks/useDarkMode';
import { Slot } from '@/extensions/Slot';
import { extensionSlot } from '@/extensions/registry';
import { classNames } from '@/utils/helpers';
import { controlPillVars, ensureControlPillCss, CONTROL_PILL_LABELS } from '@/shared/controlPill';
import { useHostCardActions } from '@/lib/nativeHost';

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
 * more of it fits. A `zoom` in the want's state (0.25–1) is used instead.
 *
 * Web want types do not declare `zoom`, so the server files it under
 * hidden_state; writeWantState shows it in current until the server's copy
 * arrives. Read from either.
 */
const DEFAULT_ZOOM = 0.5;

function readZoom(want: Want): number {
  const raw = Number(want.state?.current?.zoom ?? want.hidden_state?.zoom);
  return Number.isFinite(raw) && raw >= 0.25 && raw <= 1 ? raw : DEFAULT_ZOOM;
}

/**
 * Where the page in a live frame (an expanded card, /w/:id) has got to, kept in
 * the want's state so the want opens there again — on another tab, or on a
 * phone through Open w:
 *
 *   frame_url      the page the frame is on
 *   frame_from     the page it started from — frame_url counts only while the
 *                  want still starts there (new values, a new start: fresh)
 *   frame_scroll   how far down it was
 *   frame_history  the pages it went through, oldest first, each with when
 *
 * The frame is cross-origin, so only the extension can read these off it
 * (MYWANT_FRAME_PLACE, from background.js's frame stand-in); without it — a
 * phone — they are only read. Undeclared by web want types, so filed under
 * hidden_state, as zoom is.
 */
const FRAME_HISTORY_MAX = 30;
type FrameVisit = { url: string; at: string };

function readFrameField(want: Want, key: string): unknown {
  return want.state?.current?.[key] ?? want.hidden_state?.[key];
}

function readFrameHistory(want: Want): FrameVisit[] {
  const raw = readFrameField(want, 'frame_history');
  return Array.isArray(raw) ? raw.filter((v): v is FrameVisit => !!v && typeof v.url === 'string') : [];
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
  // The page the frame starts at: where it was left, when it was left from
  // this same start. Settled once per start — the frame saving where it goes
  // must not send it there again (a reload under the person's feet).
  const savedUrl = readFrameField(want, 'frame_url');
  const savedFrom = readFrameField(want, 'frame_from');
  const savedScroll = Number(readFrameField(want, 'frame_scroll')) || 0;
  const resumes = typeof savedUrl === 'string' && !!savedUrl && savedFrom === src;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const frameSrc = useMemo(() => (resumes ? savedUrl as string : src), [src]);

  const standalone = !onEnterInnerFocus;
  const live = standalone || !!isInnerFocused;

  // On its own (/w/:id) the page has the whole screen, so it is drawn as is.
  // An expanded card is live like that page but still a card on the board —
  // it has a way back out (onExitInnerFocus) — so it keeps the card's zoom.
  const onOwnPage = standalone && !onExitInnerFocus;
  const zoom = onOwnPage ? 1 : readZoom(want);
  const wantId = want.metadata?.id || want.id || '';

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
  const hasPageCells = extensionSlot('webFramePillCells').length > 0;
  const [canvas, setCanvas] = useState(false);
  // The first load of a page it resumes also asks for the scroll back.
  const scrollBack = useRef(frameSrc !== src && savedScroll > 0 ? { url: frameSrc, y: savedScroll } : null);
  const sendView = (on: boolean) => {
    if (!viewable) return;
    const back = scrollBack.current;
    scrollBack.current = null;
    window.postMessage({
      source: 'mywant-gui', type: 'MYWANT_FRAME_VIEW', frameName, canvas: on,
      ...(back ? { scrollUrl: back.url, scrollY: back.y } : {}),
    }, window.location.origin);
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

  // Where the page has got to, as the extension reads it off the frame, into
  // the want's state (see FRAME_HISTORY_MAX). A new page is written at once,
  // with a line in the history; a scroll once it has come to rest.
  const placeRef = useRef({ url: typeof savedUrl === 'string' ? savedUrl : '', scroll: savedScroll });
  const wantRef = useRef(want);
  wantRef.current = want;
  useEffect(() => {
    if (!viewable || !wantId) return;
    let scrollTimer: ReturnType<typeof setTimeout> | undefined;
    const onMessage = (e: MessageEvent) => {
      const m = e.data;
      if (e.source !== window || !m || m.source !== 'mywant-ext' || m.type !== 'MYWANT_FRAME_PLACE') return;
      if (m.frameName !== frameName || typeof m.url !== 'string' || !m.url) return;
      const scroll = Math.max(0, Math.round(Number(m.scroll) || 0));
      const place = placeRef.current;
      if (m.url !== place.url) {
        clearTimeout(scrollTimer);
        placeRef.current = { url: m.url, scroll };
        const history = readFrameHistory(wantRef.current);
        const next = history[history.length - 1]?.url === m.url
          ? history
          : [...history, { url: m.url, at: new Date().toISOString() }].slice(-FRAME_HISTORY_MAX);
        writeWantState(wantId, { frame_url: m.url, frame_from: src, frame_scroll: scroll, frame_history: next });
        return;
      }
      if (scroll === place.scroll) return;
      place.scroll = scroll;
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => writeWantState(wantId, { frame_scroll: scroll }), 1500);
    };
    window.addEventListener('message', onMessage);
    return () => {
      clearTimeout(scrollTimer);
      window.removeEventListener('message', onMessage);
    };
  }, [viewable, wantId, frameName, src]);

  // Whether the page has the keys: the frame focused (a click into it), or
  // Canvas, where every key goes to the CursorMan in it. Shown as a ring round
  // the page (below) — the one a board card wears while you are inside it,
  // thicker for a page this size — so it is plain at a glance where the
  // arrows will go.
  const [frameFocused, setFrameFocused] = useState(false);
  useEffect(() => {
    if (!live) return;
    const check = () => setFrameFocused(!!iframeRef.current && document.activeElement === iframeRef.current);
    // Focus moving into a frame shows here only as this window's blur.
    const later = () => setTimeout(check, 0);
    check();
    window.addEventListener('blur', later);
    window.addEventListener('focus', later);
    document.addEventListener('focusin', later);
    return () => {
      window.removeEventListener('blur', later);
      window.removeEventListener('focus', later);
      document.removeEventListener('focusin', later);
    };
  }, [live]);
  const keysHere = standalone && (canvas || frameFocused);

  // The keys and the controller, as on a page of its own. In Browse, c here
  // turns Canvas on, as the pill hears it (the board's own c comes after: this
  // is in the capture phase). In Canvas they are the CursorMan's: every key
  // pressed here goes to it in the frame — through the extension
  // (MYWANT_FRAME_KEY), never to the page's own scripts — and it answers them
  // exactly as on a tab (cursorKeydown), b included. Kept here: typing into a
  // field of the GUI's, Escape (the expanded card's way out), and the
  // browser's own shortcuts (Cmd / Ctrl with anything but an arrow). With the
  // frame focused none of this runs — the keys land in the frame already.
  // The controller is lent to the frame's CursorMan for as long.
  useEffect(() => {
    if (!viewable) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      const t = document.activeElement as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const down = e.type === 'keydown';
      if (!canvas) {
        if (!down || e.repeat || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.key !== 'c' && e.key !== 'C') return;
        e.preventDefault();
        e.stopImmediatePropagation();
        setCanvas(true);
        return;
      }
      if (e.key === 'Escape') return;
      if ((e.metaKey || e.ctrlKey) && !e.key.startsWith('Arrow')) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      window.postMessage({
        source: 'mywant-gui', type: 'MYWANT_FRAME_KEY', frameName, kind: down ? 'down' : 'up',
        key: e.key, shiftKey: e.shiftKey, metaKey: e.metaKey, ctrlKey: e.ctrlKey, altKey: e.altKey, repeat: e.repeat,
      }, window.location.origin);
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    if (canvas) lendController(frameName);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
      if (canvas) lendController(null);
    };
  }, [viewable, canvas, frameName]);

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

  // The card in hand offers its real site to an app framing the page, which
  // draws the button natively (lib/nativeHost): inside the app there is no
  // extension, so no pill over the page, and a tap on the card only selects it.
  useHostCardActions(want.metadata?.id ?? want.metadata?.name ?? 'web',
    url && (isFocused || isExpanded)
      ? [{ id: 'card:open', label: '開く', icon: 'ExternalLink', run: () => openWebWant(want) }]
      : null);

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
          src={frameSrc}
          name={frameName}
          // Filled only when it starts at the want's own page, not where it was left.
          onLoad={() => { frameFill.current.loadedSrc = frameSrc; fillFrame(); sendView(canvas); }}
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
        {keysHere && (
          <div aria-hidden className="absolute inset-0 z-[5] pointer-events-none ring-4 ring-inset ring-sky-400/80" />
        )}
        {/* The browser extension's pill, for how the page is moved through —
            the same cells, nothing of the card's own: a control pill
            (shared/controlPill) in the overlay design this person picked, only
            as wide as its cells, floating in the page's top right corner so it
            costs the page no height. Only where the extension can do it (a
            live frame, the extension there). On its own page (/w/:id) it keeps
            clear of the notification bell there (WantPushToggle). */}
        {viewable && (
          <div
            className={classNames('mwp-pill absolute top-1 z-10 shadow-lg', isDark && 'mwp-dark', onOwnPage ? 'right-[56px]' : 'right-1')}
            style={{ ...(controlPillVars(design.portable) as React.CSSProperties), height: 40 }}
          >
            <div className="mwp-row">
              {/* How the page is moved through: the extensions' cells when there
                  are (the canvas's — the browser extension's own Browse / Canvas
                  and mode lamp), else a plain Browse / Canvas switch. */}
              {hasPageCells ? (
                <Slot
                  name="webFramePillCells"
                  frameName={frameName}
                  frameWindow={() => iframeRef.current?.contentWindow ?? null}
                  canvas={canvas}
                  setCanvas={setCanvas}
                />
              ) : (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setCanvas(c => !c); }}
                  className="mwp-cell mwp-start mwp-end"
                  title={canvas ? 'キャンバスモード（タップでブラウズへ・b）' : 'ブラウズモード（タップでキャンバスへ・c）'}
                  aria-pressed={canvas}
                >
                  <span className="mwp-icon">{canvas ? <MapIcon /> : <Globe />}</span>
                  <span className="mwp-label">{canvas ? CONTROL_PILL_LABELS.canvas : CONTROL_PILL_LABELS.browse}</span>
                </button>
              )}
              {/* The real site, in a tab of its own — see openWebWant. */}
              <button
                type="button"
                onClick={openRealSite}
                className="mwp-cell mwp-divided mwp-end"
                title="実サイトを新しいタブで開く"
              >
                <span className="mwp-icon"><ExternalLink /></span>
                <span className="mwp-label">開く</span>
              </button>
            </div>
          </div>
        )}
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
