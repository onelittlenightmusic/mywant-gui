import React, { useState, useMemo } from 'react';
import { RESULT_DISPLAY_STYLES as S } from './resultDisplayStyles';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import { Search, X, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

interface ArrayResultTableProps {
  data: Record<string, unknown>[];
  maxRows?: number;
  /** compact: card-size font. normal: sidebar-size font. */
  size?: 'compact' | 'normal';
  /** When true, show all rows in a filterable TanStack table. */
  scrollable?: boolean;
}

// ── Compact table (card view — no library overhead) ───────────────────────────

const CompactTable: React.FC<{ data: Record<string, unknown>[]; maxRows: number; size: 'compact' | 'normal' }> = ({
  data, maxRows, size,
}) => {
  const columns = Object.keys(data[0] ?? {});
  const rows = data.slice(0, maxRows);
  const remaining = data.length - maxRows;

  // 'compact' font is em-relative so a want card's container-query size flows
  // into it (see .wc-body in styles/index.css). The sidebar, the other caller,
  // inherits ~16px there, which is what the previous rem value resolved to — so
  // its rendering is unchanged.
  const fontClass = size === 'compact' ? 'text-[0.55em]' : 'text-xs sm:text-sm';
  const cellPad   = size === 'compact' ? 'px-1.5 py-0.5' : 'px-2 py-1';
  const cellClass = size === 'compact'
    ? 'max-w-[10rem] truncate whitespace-nowrap'
    : 'break-words whitespace-pre-wrap max-w-[28rem]';

  return (
    <div className={S.container}>
      <table className={`${fontClass} font-mono w-full border-collapse`}>
        <thead>
          <tr className="border-b border-gray-300/50 dark:border-gray-600/30">
            {columns.map(col => (
              <th key={col} className={`${cellPad} text-left ${S.keyCell} whitespace-nowrap`}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 !== 0 ? S.rowAlt : ''}>
              {columns.map(col => (
                <td key={col} className={`${cellPad} ${S.valCell} ${cellClass}`}>
                  {String(row[col] ?? '')}
                </td>
              ))}
            </tr>
          ))}
          {remaining > 0 && (
            <tr>
              <td colSpan={columns.length} className={`${cellPad} ${S.muted} italic text-center`}>
                + {remaining} more rows
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

// ── Filterable table (expanded / maximized view — TanStack Table) ─────────────

const FilterableTable: React.FC<{ data: Record<string, unknown>[] }> = ({ data }) => {
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters] = useState<ColumnFiltersState>([]);

  const columnHelper = createColumnHelper<Record<string, unknown>>();

  const columns = useMemo(() => {
    const keys = Object.keys(data[0] ?? {});
    return keys.map(key =>
      columnHelper.accessor(row => row[key], {
        id: key,
        header: key,
        cell: info => {
          const v = info.getValue();
          return v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
        },
      })
    );
  }, [data]);

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter, sorting, columnFilters },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: 'includesString',
  });

  const filteredCount = table.getFilteredRowModel().rows.length;
  const totalCount   = data.length;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Filter bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-1 pb-2 flex-shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            placeholder="Filter rows…"
            className="w-full pl-7 pr-7 py-1.5 text-xs rounded-md border border-gray-300/60 bg-white/80 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400/60 dark:border-gray-600/40 dark:bg-gray-800/60 dark:text-gray-200 dark:placeholder-slate-500 dark:focus:ring-blue-500/40"
          />
          {globalFilter && (
            <button
              onClick={() => setGlobalFilter('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <span className="text-[0.6rem] font-mono text-slate-400 dark:text-slate-500 flex-shrink-0 tabular-nums">
          {filteredCount}/{totalCount}
        </span>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className={`flex-1 overflow-auto rounded min-h-0 border border-gray-300/40 dark:border-gray-600/30`}>
        <table className="text-xs font-mono w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-gray-100 dark:bg-gray-800">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id} className="border-b border-gray-300/50 dark:border-gray-600/40">
                {hg.headers.map(header => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className={`px-2 py-1.5 text-left ${S.keyCell} whitespace-nowrap select-none cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors`}
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <span className={S.muted}>
                          {sorted === 'asc'  && <ChevronUp className="w-3 h-3" />}
                          {sorted === 'desc' && <ChevronDown className="w-3 h-3" />}
                          {!sorted           && <ChevronsUpDown className="w-3 h-3 opacity-40" />}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className={`px-2 py-6 text-center ${S.muted} italic text-xs`}
                >
                  No matching rows
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, i) => (
                <tr
                  key={row.id}
                  className={i % 2 !== 0 ? S.rowAlt : ''}
                >
                  {row.getVisibleCells().map(cell => (
                    <td
                      key={cell.id}
                      className={`px-2 py-1 ${S.valCell} break-words whitespace-pre-wrap max-w-[28rem]`}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Public component ──────────────────────────────────────────────────────────

export const ArrayResultTable: React.FC<ArrayResultTableProps> = ({
  data,
  maxRows = 5,
  size = 'normal',
  scrollable = false,
}) => {
  if (data.length === 0) return null;

  if (scrollable) {
    return <FilterableTable data={data} />;
  }

  return <CompactTable data={data} maxRows={maxRows} size={size} />;
};
