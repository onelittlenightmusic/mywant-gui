import React, { useState, useEffect, useReducer, useCallback, useRef } from 'react';
import { OverlayActionGrid } from '@/components/overlay';
import { useInputActions } from '@/hooks/useInputActions';
import { useSystemFontSize, CARD_CONTENT_SIZE } from '@/hooks/useSystemFontSize';
import { AlertTriangle, ThumbsUp, ThumbsDown, Copy, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Want } from '@/types/want';
import { ArrayResultTable } from '@/components/common/ArrayResultTable';
import { ObjectResultDisplay, isPlainObject } from '@/components/common/ObjectResultDisplay';
import { RESULT_DISPLAY_STYLES as S } from '@/components/common/resultDisplayStyles';
import { NestedCard } from '@/components/sidebar/WantDetailsSidebar';
import { truncateText } from '@/utils/helpers';
import { useResultPages } from './WantCard/hooks/useResultPages';
import { useSwipePages } from './WantCard/hooks/useSwipePages';
import { ResultPager } from './WantCard/parts/ResultPager';

function isUrl(s: string): boolean {
  try {
    const u = new URL(s.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function isImageUrl(s: string): boolean {
  try {
    const u = new URL(s.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    if (/\.(jpe?g|png|gif|webp|avif|svg|bmp)(\?|$)/i.test(u.pathname)) return true;
    // Known image CDN hostnames
    const h = u.hostname;
    return h === 'i.scdn.co' || h.includes('cloudinary.com') || h.includes('imgix.net') ||
           h.includes('cdn.shopify.com') || h === 'images.unsplash.com';
  } catch {
    return false;
  }
}

function isBudgetObject(v: unknown): v is Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return ('total_spent' in o || 'spent' in o) && ('remaining_budget' in o || 'remaining' in o);
}

function looksLikeJson(s: string): boolean {
  const t = s.trim();
  return (t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'));
}

// ── JSON syntax highlighter (no external library) ─────────────────────────────
// Tokenises JSON into colored spans using Tailwind dark: classes so colors
// adapt to both light and dark themes.
function highlightJson(raw: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = /("(?:[^"\\]|\\.)*")|(\btrue\b|\bfalse\b|\bnull\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}\[\],:])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let keyNext = false;

  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) nodes.push(raw.slice(last, m.index));
    const [full, str, kw, num, punct] = m;

    if (punct) {
      keyNext = punct === '{' || punct === ',';
      nodes.push(<span key={m.index} className={S.jsonPunctuation}>{full}</span>);
    } else if (str) {
      const isKey = keyNext && raw[re.lastIndex]?.trimStart()[0] === ':';
      keyNext = false;
      nodes.push(
        isKey
          ? <span key={m.index} className={S.jsonKey}>{full}</span>
          : <span key={m.index} className={S.jsonString}>{full}</span>
      );
    } else if (kw) {
      nodes.push(<span key={m.index} className={S.jsonKeyword}>{full}</span>);
    } else if (num) {
      nodes.push(<span key={m.index} className={S.jsonNumber}>{full}</span>);
    }

    last = re.lastIndex;
  }
  if (last < raw.length) nodes.push(raw.slice(last));
  return nodes;
}

// ── ExpandedCodeView ──────────────────────────────────────────────────────────
// Full-height scrollable code/text viewer used in the maximized card.
const ExpandedCodeView: React.FC<{
  text: string;
  language: 'json' | 'text';
  copied: boolean;
  onCopy: (e: React.MouseEvent) => void;
  label?: string;
}> = ({ text, language, copied, onCopy, label }) => {
  const lineCount = (text.match(/\n/g)?.length ?? 0) + 1;
  const showLineNums = lineCount > 1;

  return (
    <div className={`flex flex-col h-full w-full min-h-0 overflow-hidden rounded-xl ${S.container}`}>
      {/* Toolbar */}
      <div className={`flex items-center justify-between px-4 py-2 flex-shrink-0 ${S.codeToolbar}`}>
        <div className="flex items-center gap-2">
          <span className={`text-[0.65em] font-mono ${S.codeToolbarLabel} uppercase tracking-widest`}>
            {language === 'json' ? 'JSON' : 'TEXT'}
          </span>
          {label && (
            <span className={`text-[0.65em] font-mono ${S.codeToolbarMeta}`}>{label}</span>
          )}
          <span className={`text-[0.65em] font-mono ${S.codeToolbarMeta}`}>{lineCount} lines</span>
        </div>
        <button
          onClick={onCopy}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[0.75em] font-mono transition-colors ${S.codeCopyBtn}`}
        >
          {copied ? <Check className="w-3 h-3 text-green-600 dark:text-green-400" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Code body */}
      <div className="flex-1 overflow-auto min-h-0">
        <div className="flex">
          {/* Line numbers */}
          {showLineNums && (
            <div
              className={`select-none flex-shrink-0 text-right pr-3 pt-3 pb-3 pl-3 font-mono text-[0.8em] leading-5 ${S.codeLineNums}`}
              aria-hidden="true"
            >
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
          )}

          {/* Code content */}
          <pre
            className={`flex-1 p-3 font-mono text-[0.8em] leading-5 ${S.codePre} whitespace-pre overflow-x-auto`}
            style={{ margin: 0 }}
          >
            {language === 'json' ? highlightJson(text) : text}
          </pre>
        </div>
      </div>
    </div>
  );
};

// Register all plugins (side-effect imports)
import './WantCard/plugins';
import { getWantCardPlugin, onPluginRegistered } from './WantCard/plugins/registry';
import { WeatherContentSection } from './WantCard/plugins/types/WeatherCardPlugin';

// Types handled by built-in type renderers (no plugin registration needed)
const WEATHER_TYPES = new Set(['weather', 'weather_effect']);

// ── FinalResultDisplay ────────────────────────────────────────────────────────
const FinalResultDisplay: React.FC<{
  value: unknown;
  isChild: boolean;
  isExpanded: boolean;
  copied: boolean;
  onCopy: (e: React.MouseEvent) => void;
  onView: () => void;
}> = ({ value, isChild, isExpanded, copied, onCopy, onView }) => {
  // isExpanded is still used for non-URL result types (array, object, text)
  let parsedValue = value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'object' && parsed !== null) {
        parsedValue = parsed;
      }
    } catch (e) {
      // Not a JSON string, keep as is
    }
  }

  const isArrayOfObjects =
    Array.isArray(parsedValue) &&
    parsedValue.length > 0 &&
    typeof parsedValue[0] === 'object' &&
    parsedValue[0] !== null;

  const fullText = typeof parsedValue === 'string' ? parsedValue : JSON.stringify(parsedValue, null, 2);
  const truncateLimit = isChild ? 40 : 50;
  const iconSize = isChild ? 'w-3 h-3' : 'w-3.5 h-3.5';
  const labelClass = `${isChild ? 'text-[0.6em]' : 'text-[0.68em]'} font-mono text-slate-500/80 hover:text-slate-600 dark:text-slate-400/70 dark:hover:text-slate-300 cursor-pointer`;

  // ── Image URL ────────────────────────────────────────────────────────────────
  if (typeof parsedValue === 'string' && isImageUrl(parsedValue)) {
    return (
      <div className="w-full h-full overflow-hidden rounded-lg">
        <img
          src={parsedValue.trim()}
          alt="result"
          className="w-full h-full object-cover"
          style={{ borderRadius: 8, display: 'block' }}
        />
      </div>
    );
  }

  // ── Budget object ─────────────────────────────────────────────────────────
  if (isBudgetObject(parsedValue)) {
    const spent = Number(parsedValue.total_spent ?? parsedValue.spent ?? 0);
    const remaining = Number(parsedValue.remaining_budget ?? parsedValue.remaining ?? 0);
    const budget = Number(parsedValue.budget ?? parsedValue.budget_limit ?? (spent + remaining));
    const exceeded = Boolean(parsedValue.budget_exceeded ?? parsedValue.exceeded ?? false);
    const currency = String(parsedValue.currency ?? '');
    const costs = parsedValue.costs as Record<string, number> | null | undefined;
    const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
    const fmt = (n: number) => `${currency}${n.toLocaleString()}`;
    return (
      <div className="w-full px-1 py-1 flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[0.7em] font-mono">
          <span className={exceeded ? 'text-red-500 font-bold' : 'text-slate-500 dark:text-slate-400'}>
            {fmt(spent)} / {fmt(budget)}
          </span>
          <span className={exceeded ? 'text-red-500 font-bold' : 'text-slate-400 dark:text-slate-500'}>
            {exceeded ? '超過' : `残 ${fmt(remaining)}`}
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${exceeded ? 'bg-red-500' : 'bg-sky-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {costs && Object.keys(costs).length > 0 && !isChild && (
          <div className="flex flex-col gap-0.5 mt-0.5">
            {Object.entries(costs).map(([k, v]) => (
              <div key={k} className="flex justify-between text-[0.62em] text-slate-400 dark:text-slate-500 font-mono">
                <span className="truncate mr-2">{k}</span>
                <span>{fmt(Number(v))}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (typeof parsedValue === 'string' && isUrl(parsedValue)) {
    const url = parsedValue.trim();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const containerRef = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [qrSize, setQrSize] = useState(isChild ? 70 : 90);

    // Always observe — CSS @container handles the layout, ResizeObserver only drives QR pixel size
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const update = () => {
        const { width, height } = el.getBoundingClientRect();
        const minDim = Math.min(width, height);
        // Large container (expanded): fill generously; small container: compact fixed size
        setQrSize(minDim > 120
          ? Math.min(Math.max(Math.floor(minDim * 0.72), 80), 320)
          : (isChild ? 70 : 90));
      };
      update();
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }, [isChild]);

    return (
      <div ref={containerRef} className="wc-result">
        <div className="wc-url">
          {/* QR code — sizing driven by ResizeObserver, position driven by CSS */}
          <div className="wc-qr flex-shrink-0 bg-white rounded p-0.5 shadow-sm">
            <QRCodeSVG value={url} size={qrSize} level="M" />
          </div>

          {/* URL label + compact copy (always visible) */}
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <button
              onClick={onView}
              className={`text-left ${isChild ? 'text-[0.65em]' : 'text-[0.72em]'} font-mono font-bold text-teal-700 dark:text-teal-300 leading-tight truncate w-full`}
              title={url}
            >
              {url}
            </button>
            <button onClick={onCopy}
              className="flex items-center gap-1 text-slate-500/70 hover:text-slate-600 dark:text-slate-400/60 dark:hover:text-slate-300 transition-colors w-fit"
              title="Copy URL">
              {copied ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
              <span className={`${isChild ? 'text-[0.55em]' : 'text-[0.6em]'} font-mono`}>{copied ? 'copied' : 'copy'}</span>
            </button>
          </div>

          {/* Full actions — CSS @container shows these only in large containers */}
          <div className="wc-url-actions max-w-sm w-full min-w-0">
            <button
              onClick={onView}
              className="text-[0.9em] font-mono font-semibold text-teal-700 dark:text-teal-300 leading-snug break-all text-center hover:underline"
              title={url}
            >
              {url}
            </button>
            <button
              onClick={onCopy}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-[0.75em] font-mono"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy URL'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isArrayOfObjects) {
    const data = parsedValue as Record<string, unknown>[];
    return (
      <div className={`flex flex-col min-h-0 overflow-hidden${isExpanded ? ' h-full' : ''}`}>
        <div className="flex items-center justify-between mb-0.5">
          <button onClick={onView} className={labelClass}>
            [{data.length} items]{isExpanded ? '' : ' — view all'}
          </button>
          <button onClick={onCopy} className="p-0.5 rounded text-slate-400 dark:text-slate-300" title="Copy to clipboard">
            {copied ? <Check className={iconSize} /> : <Copy className={iconSize} />}
          </button>
        </div>
        <ArrayResultTable
          data={data}
          maxRows={isChild ? 3 : 5}
          size={isExpanded ? 'normal' : 'compact'}
          scrollable={isExpanded}
        />
      </div>
    );
  }

  if (isPlainObject(parsedValue)) {
    const data = parsedValue as Record<string, unknown>;
    const fieldCount = Object.keys(data).length;
    if (isExpanded) {
      return (
        <ExpandedCodeView
          text={JSON.stringify(data, null, 2)}
          language="json"
          copied={copied}
          onCopy={onCopy}
          label={`{${fieldCount} fields}`}
        />
      );
    }
    return (
      <div className="flex flex-col min-h-0 overflow-hidden">
        <div className="flex items-center justify-between mb-0.5">
          <button onClick={onView} className={labelClass}>
            {'{'}&#8203;{fieldCount} fields{'}'}
          </button>
          <button onClick={onCopy} className="p-0.5 rounded text-slate-400 dark:text-slate-300" title="Copy to clipboard">
            {copied ? <Check className={iconSize} /> : <Copy className={iconSize} />}
          </button>
        </div>
        <NestedCard data={data} depth={0} defaultOpen={true} size="compact" />
      </div>
    );
  }

  // ── Plain text / fallback ──────────────────────────────────────────────────
  if (isExpanded) {
    return (
      <ExpandedCodeView
        text={fullText}
        language={looksLikeJson(fullText) ? 'json' : 'text'}
        copied={copied}
        onCopy={onCopy}
      />
    );
  }

  return (
    <div className="relative flex justify-start">
      <button
        onClick={onView}
        className={`inline-flex items-center gap-1.5 ${isChild ? 'text-[0.75em]' : 'text-[0.85em]'} font-mono font-bold text-slate-700 bg-gray-100/70 border border-gray-300/50 dark:text-emerald-300 dark:bg-gray-700/35 dark:border-gray-500/25 rounded-md px-2 py-0.5 w-full text-left cursor-pointer pr-7`}
      >
        <span className="truncate">{truncateText(fullText, truncateLimit)}</span>
      </button>
      <button onClick={onCopy}
        className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 dark:text-slate-300"
        title="Copy to clipboard">
        {copied ? <Check className={iconSize} /> : <Copy className={iconSize} />}
      </button>
    </div>
  );
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface WantCardContentProps {
  want: Want;
  isChild?: boolean;
  hasChildren?: boolean;
  isFocused?: boolean;
  isSelectMode?: boolean;
  onView: (want: Want) => void;
  onViewAgents?: (want: Want) => void;
  onViewResults?: (want: Want) => void;
  onViewChat?: (want: Want) => void;
  onEdit?: (want: Want) => void;
  onDelete?: (want: Want) => void;
  onSuspend?: (want: Want) => void;
  onResume?: (want: Want) => void;
  onShowReactionConfirmation?: (want: Want, action: 'approve' | 'deny') => void;
  onSliderActiveChange?: (active: boolean) => void;
  isInnerFocused?: boolean;
  onEnterInnerFocus?: () => void;
  onExitInnerFocus?: () => void;
  isExpanded?: boolean;
}

// ── Main component ────────────────────────────────────────────────────────────
export const WantCardContent: React.FC<WantCardContentProps> = ({
  want: liveWant,
  isChild = false,
  hasChildren = false,
  isFocused = false,
  isSelectMode = false,
  onView: onViewProp,
  onViewAgents: onViewAgentsProp,
  onViewResults: onViewResultsProp,
  onViewChat: onViewChatProp,
  onEdit: onEditProp,
  onDelete: onDeleteProp,
  onSuspend: onSuspendProp,
  onResume: onResumeProp,
  onShowReactionConfirmation: onShowReactionConfirmationProp,
  onSliderActiveChange,
  isInnerFocused = false,
  onEnterInnerFocus,
  onExitInnerFocus,
  isExpanded = false,
}) => {
  /**
   * The card is a small stack: what this want answers now, and what it
   * answered before (useResultPages). Everything below draws `want`, which is
   * the page showing — a past page hands the same shape as the live want, so
   * no plugin, type renderer or result panel has to know this exists.
   */
  const pages = useResultPages(liveWant);
  const want = pages.current.want;
  const isPastPage = pages.current.isPast;
  // ...and a swipe across the card does what the edge controls do, which on a
  // phone is the only gesture anybody reaches for. Nothing at all on a card
  // with one answer. See useSwipePages.
  const swipe = useSwipePages(pages);

  /**
   * ...but nothing ACTS on a page. A remembered answer is a picture of a want,
   * and opening, editing, stopping or approving a picture would act on state
   * that is no longer there — so every callback is handed the live want and
   * ignores whichever page asked.
   */
  const onView = (_w?: Want) => onViewProp(liveWant);
  const onViewAgents = onViewAgentsProp ? (_w?: Want) => onViewAgentsProp(liveWant) : undefined;
  const onViewResults = onViewResultsProp ? (_w?: Want) => onViewResultsProp(liveWant) : undefined;
  const onViewChat = onViewChatProp ? (_w?: Want) => onViewChatProp(liveWant) : undefined;
  const onEdit = onEditProp ? (_w?: Want) => onEditProp(liveWant) : undefined;
  const onDelete = onDeleteProp ? (_w?: Want) => onDeleteProp(liveWant) : undefined;
  const onSuspend = onSuspendProp ? (_w?: Want) => onSuspendProp(liveWant) : undefined;
  const onResume = onResumeProp ? (_w?: Want) => onResumeProp(liveWant) : undefined;
  const onShowReactionConfirmation = onShowReactionConfirmationProp
    ? (_w: Want, action: 'approve' | 'deny') => onShowReactionConfirmationProp(liveWant, action)
    : undefined;

  const wantType = want.metadata?.type || 'unknown';
  const labels = want.metadata?.labels || {};
  const [, forceUpdate] = useReducer(x => x + 1, 0);
  useEffect(() => onPluginRegistered(forceUpdate), []);

  const queueId = want.state?.current?.reaction_queue_id as string | undefined;
  const requireReaction = want.spec?.params?.require_reaction !== false;
  const isReminder = wantType === 'reminder';
  const isGoal = wantType === 'goal';
  const status = want.status;
  const isAwaitingApproval = (isReminder && (status as any) === 'waiting_user_action') || (isGoal && (status as any) === 'awaiting_approval') || Boolean(queueId);

  const [isSubmittingReaction, setIsSubmittingReaction] = useState(false);
  const [reactionSubmitted, setReactionSubmitted] = useState(false);
  // Reset optimistic hide when a new queue is created
  const prevQueueIdRef = useRef<string | undefined>(undefined);
  if (prevQueueIdRef.current !== queueId) {
    prevQueueIdRef.current = queueId;
    if (reactionSubmitted) setReactionSubmitted(false);
  }

  const shouldShowReactionButtons = queueId && requireReaction && isAwaitingApproval && !reactionSubmitted;

  const submitReaction = useCallback(async (approved: boolean) => {
    const currentQueueId = liveWant.state?.current?.reaction_queue_id as string | undefined;
    if (!currentQueueId || isSubmittingReaction) return;

    console.log(`[TIMING] T+0ms approve pressed`);
    const t0 = performance.now();
    setIsSubmittingReaction(true);
    try {
      await fetch(`/api/v1/reactions/${currentQueueId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved, comment: 'Reaction submitted' }),
      });
      console.log(`[TIMING] T+${(performance.now()-t0).toFixed(0)}ms reaction API done`);
      setReactionSubmitted(true);
    } catch (error) { console.error('Error submitting reaction:', error); } finally { setIsSubmittingReaction(false); }
  }, [liveWant.state?.current?.reaction_queue_id, isSubmittingReaction]);


  const [finalResultCopied, setFinalResultCopied] = useState(false);
  const handleCopyFinalResult = (e: React.MouseEvent) => {
    e.stopPropagation();
    const value = want.state?.final_result;
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    navigator.clipboard?.writeText(text).then(() => {
        setFinalResultCopied(true);
        setTimeout(() => setFinalResultCopied(false), 1500);
    });
  };

  const isFailed = want.status === 'failed';
  const hasError = Boolean(isFailed && want.state?.current?.error);
  const isControl = labels['user-control'] === 'true';
  const isFullScreen = labels['full-screen-display'] === 'true';

  const plugin = getWantCardPlugin(wantType, labels);
  const isWeatherType = WEATHER_TYPES.has(wantType);
  // Type renderer: built-in type-based content (no plugin registration needed)
  const TypeRenderer = isWeatherType ? WeatherContentSection : null;
  const hasTypeRenderer = TypeRenderer !== null;
  const edgeToEdge = plugin || hasTypeRenderer;

  /**
   * Left and right turn the pages once the card holds the keys (A/Enter into
   * it), which is how a stack of cards on a table would work.
   *
   * Off on a control card: those hand left/right to the thing they control (a
   * slider's value, a gear's notch), and a control want has one answer anyway.
   * Off while the reaction buttons are up: those own the same two keys for
   * Deny/Approve. B backs out to the front of the stack before it gives the
   * keys up, so escaping a card you turned back leaves it showing the present.
   */
  useInputActions({
    enabled: !!isInnerFocused && pages.pages.length > 1 && !shouldShowReactionButtons && !isControl,
    captureInput: true,
    ignoreWhenInputFocused: false,
    ignoreWhenInSidebar: false,
    onNavigate: (dir) => {
      if (dir === 'left') pages.turn(1);    // left goes back in time
      if (dir === 'right') pages.turn(-1);  // right comes forward again
    },
    onCancel: () => {
      if (pages.page > 0) pages.turn(-pages.page);
      else onExitInnerFocus?.();
    },
  });

  // Single body-text size for every want-type card, driven by the System Font
  // setting. Plugins inherit from here instead of setting their own sizes.
  const contentFontSize = CARD_CONTENT_SIZE[useSystemFontSize()];

  return (
    <div className="h-full w-full overflow-hidden">
      {/* ── Main Content Container ── */}
      <div className="h-full relative flex flex-col justify-center min-h-0" {...swipe}>

        {/* A dealt-back card is warmed and slightly drained, so a remembered
            answer can never be mistaken for the present one at a glance — the
            pager's number says which card, but a glance does not read numbers.
            Behind the content and over the card's own ground. */}
        {isPastPage && (
          <div className="absolute inset-0 z-[5] pointer-events-none bg-amber-500/10" />
        )}

        {/* Dealing through the answers — one control at each edge, overlaid so
            the face keeps its full height. See ResultPager. */}
        <ResultPager pages={pages} />

        {/* Approve / Deny — the card's whole height in two tiles, the way every
            other question a card asks is laid out (OverlayActionGrid). It stays
            up while the answer is owed rather than being opened, so the keys are
            the grid's only while the card is entered (A/Enter into it); B leaves
            the card. What would be submitted is written across the top. */}
        {shouldShowReactionButtons && (() => {
          const plan = want.state?.plan as Record<string, unknown> | undefined;
          const entries = Object.entries(plan ?? {}).filter(([, v]) => v !== '' && v != null && v !== false);
          return (
            <OverlayActionGrid
              key={queueId}
              cols={2}
              initialFocus={1}
              keyboardEnabled={!!isInnerFocused}
              onClose={() => onExitInnerFocus?.()}
              className="absolute inset-0 z-[30] rounded-[inherit] overflow-hidden"
              headerLabel={entries.length > 0 ? (
                <span className="normal-case tracking-normal font-mono font-normal text-[0.65rem] truncate max-w-[90%]">
                  {entries.map(([k, v]) => `${k}: ${String(v)}`).join('  ')}
                </span>
              ) : undefined}
              items={[
                { icon: <ThumbsDown className="w-6 h-6 text-white" />, label: 'Deny', onClick: () => { void submitReaction(false); }, tone: 'danger', delay: 0, disabled: isSubmittingReaction },
                { icon: isSubmittingReaction
                    ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <ThumbsUp className="w-6 h-6 text-white" />,
                  label: 'Approve', onClick: () => { void submitReaction(true); }, tone: 'confirm', delay: 30, disabled: isSubmittingReaction },
              ]}
            />
          );
        })()}

        {/*
          Plugin / type-renderer cards: WantCardLayout is always edge-to-edge.
          Non-rendered cards get horizontal + top padding.
        */}
        {/* The card's FACE — the card that gets dealt. The edge controls are
            overlaid above this and do not move with it, which is what makes the
            movement read as one card off the top rather than the whole thing
            sliding. The deal itself is in styles/index.css. */}
        <div
          className={`wc-ct flex flex-col flex-1 overflow-hidden min-h-0${edgeToEdge ? '' : ' px-3 sm:px-4 pt-2 sm:pt-3'}${pages.turnClass ? ` ${pages.turnClass}` : ''}`}
          style={isPastPage ? { filter: 'saturate(0.75)' } : undefined}
        >
          <div className={`wc-body ${contentFontSize} flex flex-col flex-1 min-h-0`}>
          {/* Error display */}
          {hasError && (!isControl || isFocused) && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-800 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-[0.7em] text-red-700 dark:text-red-300 leading-tight">
                {truncateText(String(want.state?.current?.error), 100)}
              </p>
            </div>
          )}

          {/* Plugin content section */}
          {plugin && (
            <div className="wc-ct flex-1 overflow-hidden min-h-0 flex flex-col">
              <div className={`wc-body ${contentFontSize} flex-1 min-h-0 flex flex-col justify-center`}>
                <plugin.ContentSection
                  // Keyed by the want it is about: a plugin section that holds
                  // a local editor buffer (the note's textarea, say) is at a
                  // fixed spot in the tree — the sidebar's card copy, a reused
                  // canvas card — and without this React keeps the same
                  // instance when the spot starts showing a different want, so
                  // the previous want's un-committed text stays on screen.
                  key={want.metadata?.id ?? want.id}
                  want={want}
                  isChild={isChild}
                  isControl={isControl}
                  isFocused={isFocused}
                  isSelectMode={isSelectMode}
                  onView={onView}
                  onViewResults={onViewResults}
                  onSliderActiveChange={onSliderActiveChange}
                  isInnerFocused={isInnerFocused}
                  onEnterInnerFocus={onEnterInnerFocus}
                  onExitInnerFocus={onExitInnerFocus}
                  isExpanded={isExpanded}
                />
              </div>
            </div>
          )}

          {/* Built-in type renderer (weather, etc.) — no plugin registration needed */}
          {!plugin && TypeRenderer && (
            <div className="wc-ct flex-1 overflow-hidden min-h-0 flex flex-col">
              <div className={`wc-body ${contentFontSize} flex-1 min-h-0 flex flex-col justify-center`}>
                <TypeRenderer
                  want={want}
                  isChild={isChild}
                  isControl={isControl}
                  isFocused={isFocused}
                  isSelectMode={isSelectMode}
                  onView={onView}
                  onViewResults={onViewResults}
                  onSliderActiveChange={onSliderActiveChange}
                  isInnerFocused={isInnerFocused}
                  onExitInnerFocus={onExitInnerFocus}
                  isExpanded={isExpanded}
                />
              </div>
            </div>
          )}

          {/* Final result text area — suppressed for type renderers */}
          {want.state?.final_result != null && want.state?.final_result !== '' && !isFullScreen && !plugin?.hideFinalResult && !hasTypeRenderer && (
            <div className={`${isExpanded ? 'flex-1 min-h-0' : 'flex-shrink-0'} ${plugin ? 'p-2 pt-0' : 'pb-2 sm:pb-3'}`}>
              <FinalResultDisplay
                value={want.state!.final_result}
                isChild={isChild}
                isExpanded={isExpanded}
                copied={finalResultCopied}
                onCopy={handleCopyFinalResult}
                onView={() => onViewResults ? onViewResults(want) : onView(want)}
              />
            </div>
          )}
          </div>
        </div>

      </div>
    </div>
  );
};
