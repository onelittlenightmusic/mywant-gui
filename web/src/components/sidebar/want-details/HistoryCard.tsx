import React from 'react';
import { Bot, FileText, Sparkles, type LucideIcon } from 'lucide-react';
import { classNames } from '@/utils/helpers';

/**
 * One thing in a want's history — an answer it gave, a log it wrote, an agent
 * that ran — on the history's timeline.
 *
 * The three were three cards of three makes; they are one now, told apart by
 * what each opens with: its kind's icon, in its kind's colour, which is also
 * the colour of its dot on the line down the left. Then what happened, when,
 * and anything more under it.
 */
export type HistoryKind = 'output' | 'log' | 'agent';

const KIND: Record<HistoryKind, { Icon: LucideIcon; dot: string; chip: string; ink: string }> = {
  output: { Icon: Sparkles, dot: 'bg-violet-600 ring-violet-100 dark:ring-violet-900/60', chip: 'bg-violet-50 dark:bg-violet-950/50', ink: 'text-violet-700 dark:text-violet-300' },
  log:    { Icon: FileText, dot: 'bg-teal-700 ring-teal-100 dark:ring-teal-900/60',       chip: 'bg-teal-50 dark:bg-teal-950/50',     ink: 'text-teal-700 dark:text-teal-300' },
  agent:  { Icon: Bot,      dot: 'bg-orange-700 ring-orange-100 dark:ring-orange-900/60', chip: 'bg-orange-50 dark:bg-orange-950/50', ink: 'text-orange-700 dark:text-orange-300' },
};

export const HistoryCard: React.FC<{
  kind: HistoryKind;
  /** What happened, in a line. */
  title: React.ReactNode;
  /** When, as the history says it (shortWhen). */
  when?: string;
  /** Beside the time: a log's lines, an agent's state. */
  meta?: React.ReactNode;
  /** Anything more, under it. */
  children?: React.ReactNode;
  /** The one asked about (an answer ball tapped on the board). */
  lit?: boolean;
  /** The last on the line: no line on below its dot. */
  last?: boolean;
  dataAttrs?: Record<string, string>;
}> = ({ kind, title, when, meta, children, lit, last, dataAttrs }) => {
  const k = KIND[kind];
  return (
    <div className="flex gap-2.5" {...dataAttrs}>
      {/* The timeline: its dot, and the line on down to the next. */}
      <div className="w-3 flex-shrink-0 flex flex-col items-center">
        <span className={classNames('mt-3.5 w-2.5 h-2.5 rounded-full ring-[3px]', k.dot)} />
        {!last && <span className="flex-1 w-0.5 mt-1 bg-gray-400/40 dark:bg-gray-500/50" />}
      </div>
      <div className={classNames(
        'flex-1 min-w-0 mb-2 rounded-xl px-2.5 py-2 transition-colors',
        lit
          ? 'bg-sky-50 dark:bg-sky-900/30 ring-2 ring-sky-400'
          : 'bg-white dark:bg-gray-800 shadow-sm',
      )}>
        <div className="flex items-start gap-2 min-w-0">
          <span className={classNames('w-6 h-6 flex-shrink-0 rounded-lg flex items-center justify-center', k.chip, k.ink)}>
            <k.Icon className="w-3.5 h-3.5" />
          </span>
          <div className="flex-1 min-w-0 pt-0.5 text-[13px] font-semibold leading-snug text-gray-900 dark:text-gray-100 break-words">
            {title}
          </div>
          {(when || meta) && (
            <div className="flex-shrink-0 pt-0.5 text-right text-[10px] leading-tight text-gray-500 dark:text-gray-400">
              {when && <div>{when}</div>}
              {meta && <div>{meta}</div>}
            </div>
          )}
        </div>
        {children && <div className="mt-1.5 ml-8 min-w-0">{children}</div>}
      </div>
    </div>
  );
};
