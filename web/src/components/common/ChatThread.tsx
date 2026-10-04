/**
 * The conversation with the agent behind a want, wherever it is shown.
 *
 * There were two of these. The Chat tab rendered the whole thread as bubbles;
 * the want card rendered the last reply alone, in a grey box, with what you
 * said reduced to a "You:" caption above it. Same conversation, same fields,
 * two different things to read — and the card's version quietly lost the shape
 * of the exchange, which on a board of cards is most of what you are looking
 * for.
 *
 * So the thread lives here and both show it. `compact` is the only difference:
 * a card is small, so it tightens the spacing and drops the timestamps. What a
 * message looks like, how a reply is parsed, where the working log sits — all
 * of that is decided once.
 */
import React, { useLayoutEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Copy, Check, Sparkles, Wrench, Activity, ThumbsUp, X, RotateCcw } from 'lucide-react';
import { useWantStore } from '@/stores/wantStore';
import { Want } from '@/types/want';
import { formatRelativeTime, classNames } from '@/utils/helpers';
import { MarkdownContent, looksLikeMarkdown } from '@/components/common/MarkdownContent';
import { ChatWantCard, type ChatCardRef } from '@/components/common/ChatWantCard';

export interface CCMessage {
  sender: string;
  text: string;
  timestamp?: string;
}

export interface CCResponse {
  text: string;
  timestamp?: string;
  subtype?: string;
  /**
   * Set when the reply is an answer about a picture: the picture want it read,
   * and which of that picture's remembered answers this is — see
   * recordFMAnswerAbout in agent_fm.go.
   */
  picture_id?: string;
  picture_name?: string;
  answer_id?: string;
  /** The wants the reply is about (the robot's tools went to them), shown
   *  under it as small cards — see ChatWantCard and the engine's fmTurnCards. */
  cards?: ChatCardRef[];
}

/** Which picture answer a reply is, so it can be marked right or wrong. */
interface AnswerRef { pictureId: string; answerId: string }

/** One line of the agent's working log — see cc_activity in coding.yaml. */
export interface CCActivity {
  kind: 'note' | 'tool' | 'phase' | 'error';
  text: string;
  timestamp: string;
  /** The full call behind the summary — the command a Bash line actually ran. */
  detail?: string;
}

/** A message bubble or a working-log line, in the order they are shown. */
export type ChatItem =
  | { kind: 'message'; role: 'user' | 'assistant'; text: string; timestamp?: string; about?: AnswerRef; cards?: ChatCardRef[] }
  | { kind: 'activity'; activity: CCActivity }
  | { kind: 'reset'; timestamp: string };

/**
 * One line of the agent's working log, rendered deliberately unlike a message
 * bubble: full-width, muted, and small, so the conversation still reads as the
 * conversation and the log reads as marginalia around it.
 */
export const ActivityLine: React.FC<{ activity: CCActivity; compact?: boolean }> = ({ activity, compact }) => {
  const { kind, text, detail } = activity;
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const Icon = kind === 'tool' ? Wrench
    : kind === 'error' ? AlertTriangle
    : kind === 'phase' ? Activity
    : Sparkles;

  const tone = kind === 'error'
    ? 'text-red-500 dark:text-red-400'
    : kind === 'tool'
    ? 'text-violet-600 dark:text-violet-400'
    : kind === 'phase'
    ? 'text-gray-400 dark:text-gray-500'
    : 'text-gray-500 dark:text-gray-400';

  // The summary line. A tool call with a recorded call behind it becomes a
  // button; everything else stays inert text, so nothing looks clickable
  // unless clicking it would actually reveal something.
  const summary = (
    <>
      <Icon className="h-3 w-3 mt-[3px] flex-shrink-0" />
      {kind === 'tool' || kind === 'phase' ? (
        <span className="font-mono truncate">{text}</span>
      ) : (
        // Notes are prose the agent wrote, so they wrap and keep their breaks.
        <span className="whitespace-pre-wrap break-words italic">{text}</span>
      )}
    </>
  );

  const rowCls = classNames(
    'flex items-start gap-1.5 px-1 leading-relaxed',
    compact ? 'text-[10px]' : 'text-xs',
    tone,
  );

  if (!detail) {
    return <div className={rowCls}>{summary}</div>;
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(detail).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        className={classNames(rowCls, 'w-full text-left hover:opacity-80 transition-opacity')}
        aria-expanded={open}
        title={open ? 'Hide the call' : 'Show the call'}
      >
        {open
          ? <ChevronDown className="h-3 w-3 mt-[3px] flex-shrink-0" />
          : <ChevronRight className="h-3 w-3 mt-[3px] flex-shrink-0" />}
        {summary}
      </button>
      {open && (
        <div className="relative mt-1 ml-5 mr-1">
          <button
            onClick={handleCopy}
            className="absolute right-1.5 top-1.5 p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-100/80 dark:bg-gray-800/80"
            title="Copy"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </button>
          <pre className="overflow-x-auto rounded-md bg-gray-100 dark:bg-gray-800/70 px-2.5 py-2 pr-8 text-[11px] leading-snug font-mono text-gray-700 dark:text-gray-300 whitespace-pre">
            {detail}
          </pre>
        </div>
      )}
    </div>
  );
};

/** What the want is holding, read the same way wherever the thread is shown. */
export function readChat(want: Want) {
  const current = want.state?.current as Record<string, unknown> | undefined;
  return {
    phase: current?.phase as string | undefined,
    messages: (current?.cc_messages as CCMessage[] | undefined) ?? [],
    responses: (current?.cc_responses as CCResponse[] | undefined) ?? [],
    streamingText: (current?.cc_streaming_text as string | undefined) ?? '',
    activities: (current?.cc_activity as CCActivity[] | undefined) ?? [],
    sessionState: current?.current_session_state as string | undefined,
    sessionResets: (current?.cc_session_resets as string[] | undefined) ?? [],
  };
}

/** Whether a reply is being composed right now. */
export function isChatStreaming(want: Want): boolean {
  const { phase, streamingText } = readChat(want);
  return (phase === 'requesting' || phase === 'awaiting_response') && streamingText !== '';
}

/** Whether the agent is working on something, streaming or not. */
export function isChatBusy(want: Want): boolean {
  const { phase } = readChat(want);
  return phase === 'requesting' || phase === 'awaiting_response';
}

/**
 * Interleave the messages, the replies and the working log.
 *
 * Messages and replies pair up by index: [you[0], it[0], you[1], it[1], …].
 * The log is slotted into the gaps by timestamp, and the messages keep the
 * order they already had and are never re-sorted — a bad timestamp can put a
 * status line in the wrong gap, but cannot scramble the conversation.
 */
export function buildChatItems(want: Want, showActivity: boolean): ChatItem[] {
  const { messages, responses, activities: all } = readChat(want);
  const activities = showActivity ? all : [];

  const conversation: Array<{ role: 'user' | 'assistant'; text: string; timestamp?: string; about?: AnswerRef; cards?: ChatCardRef[] }> = [];
  const len = Math.max(messages.length, responses.length);
  for (let i = 0; i < len; i++) {
    const msg = messages[i];
    const res = responses[i];
    if (msg?.text) conversation.push({ role: 'user', text: msg.text, timestamp: msg.timestamp });
    if (res?.text) conversation.push({
      role: 'assistant', text: res.text, timestamp: res.timestamp,
      about: res.picture_id && res.answer_id ? { pictureId: res.picture_id, answerId: res.answer_id } : undefined,
      cards: res.cards?.length ? res.cards : undefined,
    });
  }

  const items: ChatItem[] = [];
  const at = (v?: string) => (v ? Date.parse(v) : NaN);
  let a = 0;
  const emitActivitiesUpTo = (limit: number) => {
    while (a < activities.length) {
      const t = at(activities[a].timestamp);
      if (!Number.isNaN(limit) && !Number.isNaN(t) && t > limit) break;
      items.push({ kind: 'activity', activity: activities[a] });
      a++;
    }
  };
  for (const m of conversation) {
    const mt = at(m.timestamp);
    if (!Number.isNaN(mt)) emitActivitiesUpTo(mt);
    items.push({ kind: 'message', ...m });
  }
  while (a < activities.length) {
    items.push({ kind: 'activity', activity: activities[a] });
    a++;
  }
  return withSessionResets(items, readChat(want).sessionResets);
}

/**
 * Draw where the session was reset.
 *
 * The history outlives a reset on purpose — it is what was said — but a thread
 * that runs on unmarked past one reads as one conversation, and the answers
 * after it look as if they ignored everything above. So each reset is a break
 * in the thread, placed by time: before the first item that came after it.
 *
 * A reset older than everything left (the history is a short FIFO) has nothing
 * to divide and is dropped; one after everything is drawn last, which is what
 * pressing the button should show at once — the next message starts afresh.
 */
function withSessionResets(items: ChatItem[], resets: string[]): ChatItem[] {
  if (items.length === 0 || resets.length === 0) return items;
  const timeOf = (it: ChatItem) => Date.parse(
    it.kind === 'activity' ? it.activity.timestamp ?? '' : it.timestamp ?? '');
  const marks = resets.map(r => ({ r, t: Date.parse(r) }))
    .filter(m => !Number.isNaN(m.t))
    .sort((x, y) => x.t - y.t);
  const out: ChatItem[] = [];
  let m = 0;
  let seenAny = false;
  for (const it of items) {
    const t = timeOf(it);
    if (!Number.isNaN(t)) {
      while (m < marks.length && marks[m].t <= t) {
        if (seenAny) out.push({ kind: 'reset', timestamp: marks[m].r });
        m++;
      }
    }
    out.push(it);
    seenAny = true;
  }
  while (m < marks.length) out.push({ kind: 'reset', timestamp: marks[m++].r });
  return out;
}

/** Where the session was reset — a rule across the thread, not a message. */
const SessionResetLine: React.FC<{ timestamp: string; compact?: boolean }> = ({ timestamp, compact }) => (
  <div
    className={classNames(
      'flex items-center gap-2 text-gray-400 dark:text-gray-500',
      compact ? 'text-[0.7em] py-0.5' : 'text-xs py-1',
    )}
    title={new Date(timestamp).toLocaleString()}
  >
    <span className="flex-1 border-t-2 border-dashed border-current opacity-60" />
    <span className="flex items-center gap-1 whitespace-nowrap">
      <RotateCcw className="w-[1em] h-[1em]" />
      Session reset{!compact && ` · ${formatRelativeTime(timestamp)}`}
    </span>
    <span className="flex-1 border-t-2 border-dashed border-current opacity-60" />
  </div>
);

/**
 * 👍 / 違う under an answer about a picture.
 *
 * The verdict is kept on the picture, next to the answer it is about (the
 * picture's `answers`), not on the chat: what a picture was asked and whether
 * it was answered right belongs to the picture, and outlives the robot's
 * twenty-reply chat buffer. So the buttons read their state from the picture
 * and write it back there. Pressing the lit one again takes it back.
 */
const AnswerFeedback: React.FC<{ about: AnswerRef; compact?: boolean }> = ({ about, compact }) => {
  const picture = useWantStore(s => s.wants.find(w => (w.metadata?.id || w.id) === about.pictureId));
  const answers = (picture?.state?.current as Record<string, unknown> | undefined)?.answers;
  const kept = Array.isArray(answers)
    ? (answers as Array<Record<string, unknown>>).find(a => a.id === about.answerId)
    : undefined;
  const serverValue = typeof kept?.feedback === 'string' ? kept.feedback : '';
  // Shown at once; the picture's own state catches up on its next tick.
  const [pending, setPending] = useState<string | null>(null);
  const value = pending ?? serverValue;
  React.useEffect(() => { setPending(null); }, [serverValue]);

  // The picture has gone, or has not recorded the answer yet: nothing to mark.
  if (!picture) return null;

  const send = (next: 'good' | 'wrong') => {
    const v = value === next ? '' : next;
    setPending(v);
    fetch(`/api/v1/webhooks/${about.pictureId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'feedback', id: about.answerId, value: v }),
    }).catch(err => {
      console.error('[AnswerFeedback] webhook failed:', err);
      setPending(null);
    });
  };

  const button = (kind: 'good' | 'wrong', label: string, Icon: typeof ThumbsUp, on: string) => (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); send(kind); }}
      onMouseDown={(e) => e.stopPropagation()}
      aria-pressed={value === kind}
      title={value === kind ? `${label}（取り消す）` : label}
      className={classNames(
        'inline-flex items-center gap-0.5 rounded-full border transition-colors',
        compact ? 'px-1.5 py-0 text-[10px]' : 'px-2 py-0.5 text-xs',
        value === kind
          ? on
          : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-200/70 dark:hover:bg-gray-700/70',
      )}
    >
      <Icon className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      {label}
    </button>
  );

  return (
    <div className="flex items-center gap-1 mt-1">
      {button('good', 'いいね', ThumbsUp, 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300')}
      {button('wrong', '違う', X, 'border-rose-500 bg-rose-500/15 text-rose-700 dark:text-rose-300')}
    </div>
  );
};

interface ChatThreadProps {
  want: Want;
  /** Card-sized: tighter spacing, smaller text, no timestamps. */
  compact?: boolean;
  /** Slot the agent's working log in among the messages. */
  showActivity?: boolean;
  /** Shown when nothing has been said yet. */
  empty?: React.ReactNode;
  className?: string;
}

export const ChatThread: React.FC<ChatThreadProps> = ({
  want, compact = false, showActivity = false, empty, className,
}) => {
  const threadRef = useRef<HTMLDivElement>(null);
  const hasLandedRef = useRef(false);
  const { streamingText } = readChat(want);
  const streaming = isChatStreaming(want);
  const items = buildChatItems(want, showActivity);

  // Keep the newest message in view. The first run happens on mount, and a
  // reopened thread must already be at the bottom rather than travel there —
  // so that one lands instantly, before paint. Only updates that arrive while
  // the thread is on screen glide.
  useLayoutEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    if (hasLandedRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } else {
      hasLandedRef.current = true;
      el.scrollTop = el.scrollHeight;
    }
  }, [items.length, streamingText]);

  const bubble = (role: 'user' | 'assistant') => classNames(
    'rounded-lg break-words',
    compact ? 'max-w-[88%] px-2 py-1' : 'max-w-[80%] px-3 py-2 text-sm',
    role === 'user'
      ? 'bg-blue-600 text-white'
      : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100',
  );

  return (
    <div
      ref={threadRef}
      className={classNames(
        'overflow-y-auto min-h-0',
        compact ? 'space-y-1.5' : 'space-y-3',
        className,
      )}
    >
      {items.length === 0 && !streaming ? empty : null}
      {items.map((entry, i) => entry.kind === 'activity' ? (
        <ActivityLine key={i} activity={entry.activity} compact={compact} />
      ) : entry.kind === 'reset' ? (
        <SessionResetLine key={i} timestamp={entry.timestamp} compact={compact} />
      ) : (
        <div key={i} className={classNames('flex', entry.role === 'user' ? 'justify-end' : 'justify-start')}>
          <div className={bubble(entry.role)}>
            {/* A reply that carries markdown renders as markdown. Plain ones
                stay pre-wrapped so their line breaks survive. */}
            {entry.role === 'assistant' && looksLikeMarkdown(entry.text) ? (
              <MarkdownContent fontScale="text-[1em]">{entry.text}</MarkdownContent>
            ) : (
              <p className="whitespace-pre-wrap break-words">{entry.text}</p>
            )}
            {entry.role === 'assistant' && entry.about && (
              <AnswerFeedback about={entry.about} compact={compact} />
            )}
            {entry.role === 'assistant' && entry.cards?.map(card => (
              <ChatWantCard key={card.id} card={card} compact={compact} />
            ))}
            {!compact && entry.timestamp && (
              <p className={classNames(
                'text-xs mt-1',
                entry.role === 'user' ? 'text-blue-200' : 'text-gray-400 dark:text-gray-500',
              )}>
                {formatRelativeTime(entry.timestamp)}
              </p>
            )}
          </div>
        </div>
      ))}
      {streaming && (
        <div className="flex justify-start">
          {/* Deliberately not markdown: a stream is re-rendered on every chunk
              with half-written syntax, which a parser turns into flickering
              garbage. Markdown kicks in once the reply is final. */}
          <div className={bubble('assistant')}>
            <p className="whitespace-pre-wrap break-words">{streamingText}<span className="animate-pulse">▊</span></p>
          </div>
        </div>
      )}
    </div>
  );
};
