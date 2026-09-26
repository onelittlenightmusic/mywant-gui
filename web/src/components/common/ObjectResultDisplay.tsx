import React from 'react';
import { RESULT_DISPLAY_STYLES as S } from './resultDisplayStyles';

interface ObjectResultDisplayProps {
  data: Record<string, unknown>;
  maxRows?: number;
  size?: 'compact' | 'normal';
}

export const formatObjectValue = (v: unknown, size: 'compact' | 'normal'): { text: string; muted: boolean } => {
  if (v === null || v === undefined) return { text: '—', muted: true };
  if (typeof v === 'boolean') return { text: String(v), muted: false };
  if (typeof v === 'number') return { text: String(v), muted: false };
  if (typeof v === 'string') return { text: v, muted: false };
  if (Array.isArray(v)) {
    if (v.length === 0) return { text: '[]', muted: true };
    return { text: `[${v.length} items]`, muted: true };
  }
  const json = JSON.stringify(v);
  const limit = size === 'compact' ? 30 : 60;
  return { text: json.length > limit ? json.slice(0, limit) + '…' : json, muted: true };
};

export const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

export const ObjectResultDisplay: React.FC<ObjectResultDisplayProps> = ({
  data,
  maxRows = 5,
  size = 'normal',
}) => {
  const entries = Object.entries(data);
  const visibleEntries = entries.slice(0, maxRows);
  const remaining = entries.length - maxRows;

  // 'compact' font is em-relative so a want card's container-query size flows
  // into it (see .wc-body in styles/index.css). The sidebar, the other caller,
  // inherits ~16px there, which is what the previous rem value resolved to — so
  // its rendering is unchanged.
  const fontClass = size === 'compact' ? 'text-[0.55em]' : 'text-xs sm:text-sm';
  const cellPad = size === 'compact' ? 'px-1.5 py-0.5' : 'px-2 py-1';
  const keyMaxWidth = size === 'compact' ? 'max-w-[6rem]' : 'max-w-[10rem]';
  const valMaxWidth = size === 'compact' ? 'max-w-[12rem]' : 'max-w-[20rem]';

  return (
    <div className={S.container}>
      <table className={`${fontClass} font-mono w-full border-collapse`}>
        <tbody>
          {visibleEntries.map(([key, value], i) => {
            const { text, muted } = formatObjectValue(value, size);
            return (
              <tr key={key} className={i % 2 !== 0 ? S.rowAlt : ''}>
                <td className={`${cellPad} ${S.keyCell} whitespace-nowrap ${keyMaxWidth} truncate align-top`}>
                  {key}
                </td>
                <td className={`${cellPad} ${muted ? `${S.muted} italic` : S.valCell} ${valMaxWidth} truncate whitespace-nowrap`}>
                  {text}
                </td>
              </tr>
            );
          })}
          {remaining > 0 && (
            <tr>
              <td colSpan={2} className={`${cellPad} ${S.muted} italic text-center`}>
                + {remaining} more fields
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
