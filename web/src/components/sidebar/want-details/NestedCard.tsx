/** A JSON value rendered as nested, colour-coded cards. Exported: also used by WantCardContent. */
import React, { useEffect, useLayoutEffect, useState, useCallback, useMemo, useRef } from 'react';
import { ChevronDown, Copy, Check } from 'lucide-react';
import { WantCardContent } from '@/components/dashboard/WantCardContent';
import { WantCard } from '@/components/dashboard/WantCard/WantCard';
import { ArrayResultTable } from '@/components/common/ArrayResultTable';
import {
  DetailsSidebar,
  TabContent,
  TabSection,
  TabGrid,
  EmptyState,
  InfoRow,
  TabConfig
} from '../DetailsSidebar';



// ── Nested card display (card-nest style with muted color coding) ─────────────

// Value color by type — muted, calm palette
const ncValueClass = (v: unknown): string => {
  if (v === null || v === undefined) return 'text-gray-400 dark:text-gray-600 italic';
  if (typeof v === 'boolean') return 'text-violet-500 dark:text-violet-400';
  if (typeof v === 'number')  return 'text-sky-600   dark:text-sky-400';
  if (typeof v === 'string')  return 'text-teal-700  dark:text-teal-400';
  return 'text-gray-500 dark:text-gray-400';
};

const ncFormat = (v: unknown): string => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') return `"${v}"`;
  return String(v);
};

// Background + border per nesting depth (light / dark)
const NC_DEPTH = [
  'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700',
  'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700/70',
  'bg-gray-100 dark:bg-gray-800/60 border-gray-300/70 dark:border-gray-600/50',
];
const NC_HEADER = [
  'bg-gray-50 dark:bg-gray-700/60',
  'bg-gray-100 dark:bg-gray-800/80',
  'bg-gray-200/60 dark:bg-gray-700/40',
];

// Copy button
const CopyValueButton: React.FC<{ value: string }> = ({ value }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover/kv:opacity-100 flex-shrink-0 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-opacity"
      title="Copy value"
    >
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-gray-400" />}
    </button>
  );
};

// Recursive card component (exported for use in WantCardContent FinalResultDisplay)
export const NestedCard: React.FC<{
  label?: string;
  data: unknown;
  depth?: number;
  defaultOpen?: boolean;
  size?: 'normal' | 'compact';
}> = ({ label, data, depth = 0, defaultOpen, size = 'normal' }) => {
  const isArr = Array.isArray(data);
  const isObj = !isArr && typeof data === 'object' && data !== null;
  const isNested = isArr || isObj;

  const [isOpen, setIsOpen] = useState(defaultOpen ?? depth === 0);

  // compact size: font matches table format (text-[0.55rem])
  const textClass = size === 'compact' ? 'text-[0.55rem]' : 'text-xs';
  const padClass  = size === 'compact' ? 'px-1.5 py-0.5' : 'px-2.5 py-1.5';
  const rowPad    = size === 'compact' ? 'px-1.5 py-0.5' : 'px-2.5 py-1';
  const iconClass = size === 'compact' ? 'w-2 h-2' : 'w-3 h-3';

  // Array-of-objects → render as compact table
  const isArrayOfObjects =
    isArr &&
    (data as unknown[]).length > 0 &&
    typeof (data as unknown[])[0] === 'object' &&
    (data as unknown[])[0] !== null &&
    !Array.isArray((data as unknown[])[0]);

  if (!isNested) {
    return <span className={`font-mono ${textClass} ${ncValueClass(data)}`}>{ncFormat(data)}</span>;
  }

  if (isArrayOfObjects) {
    const di = depth % NC_DEPTH.length;
    return (
      <div className={`rounded-lg border overflow-hidden ${textClass} ${NC_DEPTH[di]}`}>
        <button
          onClick={() => setIsOpen(o => !o)}
          className={`w-full flex items-center gap-1.5 ${padClass} text-left ${NC_HEADER[di]} hover:brightness-[0.97] dark:hover:brightness-110 transition-colors`}
        >
          <ChevronDown className={`${iconClass} text-gray-400 flex-shrink-0 transition-transform duration-150 ${isOpen ? '' : '-rotate-90'}`} />
          {label && <span className="font-mono text-gray-600 dark:text-gray-300 truncate">{label}</span>}
          <span className={`font-mono text-gray-400 dark:text-gray-500 ml-auto flex-shrink-0 ${isOpen ? 'opacity-0' : ''}`}>
            [{(data as unknown[]).length}]
          </span>
        </button>
        {isOpen && (
          <div className="p-1">
            <ArrayResultTable data={data as Record<string, unknown>[]} maxRows={20} size="compact" />
          </div>
        )}
      </div>
    );
  }

  const entries: [string, unknown][] = isArr
    ? (data as unknown[]).map((v, i) => [String(i), v])
    : Object.entries(data as Record<string, unknown>);

  // Scalar-valued object: all values are primitives → render as ArrayResultTable
  // with column headers (key name / value), same format as final result tables.
  const isScalarObj = !isArr && isObj && entries.every(
    ([, v]) => v === null || v === undefined || typeof v !== 'object'
  );
  if (isScalarObj) {
    const tableRows = entries.map(([k, v]) => ({ key: k, value: String(v ?? '') }));
    const di = depth % NC_DEPTH.length;
    return (
      <div className={`rounded-lg border overflow-hidden ${textClass} ${NC_DEPTH[di]}`}>
        <button
          onClick={() => setIsOpen(o => !o)}
          className={`w-full flex items-center gap-1.5 ${padClass} text-left ${NC_HEADER[di]} hover:brightness-[0.97] dark:hover:brightness-110 transition-colors`}
        >
          <ChevronDown className={`${iconClass} text-gray-400 flex-shrink-0 transition-transform duration-150 ${isOpen ? '' : '-rotate-90'}`} />
          {label && <span className="font-mono text-gray-600 dark:text-gray-300 truncate">{label}</span>}
          <span className={`font-mono text-gray-400 dark:text-gray-500 ml-auto flex-shrink-0 ${isOpen ? 'opacity-0' : ''}`}>
            {`{${entries.length}}`}
          </span>
        </button>
        {isOpen && (
          <div className="p-1">
            <ArrayResultTable data={tableRows} maxRows={50} size="compact" />
          </div>
        )}
      </div>
    );
  }

  const typeHint = isArr ? `[${entries.length}]` : `{${entries.length}}`;
  const di = depth % NC_DEPTH.length;

  return (
    <div className={`rounded-lg border overflow-hidden ${textClass} ${NC_DEPTH[di]}`}>
      <button
        onClick={() => setIsOpen(o => !o)}
        className={`w-full flex items-center gap-1.5 ${padClass} text-left ${NC_HEADER[di]} hover:brightness-[0.97] dark:hover:brightness-110 transition-colors`}
      >
        <ChevronDown className={`${iconClass} text-gray-400 flex-shrink-0 transition-transform duration-150 ${isOpen ? '' : '-rotate-90'}`} />
        {label && <span className="font-mono text-gray-600 dark:text-gray-300 truncate">{label}</span>}
        <span className={`font-mono text-gray-400 dark:text-gray-500 ml-auto flex-shrink-0 ${isOpen ? 'opacity-0' : ''}`}>
          {typeHint}
        </span>
      </button>

      {isOpen && (
        <div className="divide-y divide-gray-100 dark:divide-gray-800/50">
          {entries.map(([key, value]) => {
            const childNested = value !== null && typeof value === 'object';
            if (childNested) {
              return (
                <div key={key} className="px-1.5 py-1">
                  <NestedCard label={isArr ? `[${key}]` : key} data={value} depth={depth + 1} defaultOpen={false} size={size} />
                </div>
              );
            }
            const valStr = String(value ?? '');
            return (
              <div key={key} className={`flex items-baseline gap-2 ${rowPad} group/kv`}>
                <span
                  className="font-mono text-gray-400 dark:text-gray-500 flex-shrink-0 truncate"
                  style={{ minWidth: size === 'compact' ? '3rem' : '4rem', maxWidth: size === 'compact' ? '6rem' : '9rem' }}
                  title={isArr ? `[${key}]` : key}
                >
                  {isArr ? `[${key}]` : key}
                </span>
                <span
                  className={`font-mono flex-1 min-w-0 truncate group-hover/kv:whitespace-normal group-hover/kv:break-all ${ncValueClass(value)}`}
                  title={valStr}
                >
                  {ncFormat(value)}
                </span>
                <CopyValueButton value={valStr} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
