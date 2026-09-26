/**
 * Shared Tailwind class tokens for result display components:
 * ObjectResultDisplay, ArrayResultTable, CodeBlock.
 *
 * All three use the same light/dark theme pattern so visual output
 * stays consistent regardless of which component renders the data.
 */

export const RESULT_DISPLAY_STYLES = {
  /** Outer container: rounded border + themed background */
  container:
    'overflow-x-auto rounded border border-gray-300/40 dark:border-gray-600/30 bg-gray-100/60 dark:bg-gray-900/80',

  /** Alternating row highlight (odd rows) */
  rowAlt: 'bg-black/5 dark:bg-white/5',

  /** Object / table key cell */
  keyCell:
    'text-slate-600 dark:text-green-400/70 font-semibold',

  /** Normal value cell */
  valCell: 'text-slate-700 dark:text-gray-300',

  /** Muted / secondary value (null, truncated, count labels) */
  muted: 'text-slate-400 dark:text-gray-500',

  // ── CodeBlock-specific ────────────────────────────────────────────────────

  /** CodeBlock toolbar bar */
  codeToolbar:
    'bg-gray-100/80 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-700/60',

  /** CodeBlock toolbar label text */
  codeToolbarLabel: 'text-slate-500 dark:text-slate-500',

  /** CodeBlock toolbar secondary text (line count, field name) */
  codeToolbarMeta: 'text-slate-400 dark:text-slate-600',

  /** CodeBlock copy button */
  codeCopyBtn:
    'bg-gray-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-gray-300 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-200',

  /** CodeBlock line-number gutter */
  codeLineNums:
    'text-slate-400 dark:text-slate-600 border-r border-gray-200 dark:border-slate-700/40',

  /** CodeBlock pre element text */
  codePre: 'text-slate-700 dark:text-slate-300',

  // ── JSON syntax tokens ────────────────────────────────────────────────────

  jsonKey:        'text-cyan-700 dark:text-cyan-300',
  jsonString:     'text-amber-700 dark:text-amber-300',
  jsonKeyword:    'text-purple-700 dark:text-purple-400',
  jsonNumber:     'text-green-700 dark:text-green-400',
  jsonPunctuation:'text-slate-500 dark:text-slate-400',
} as const;
