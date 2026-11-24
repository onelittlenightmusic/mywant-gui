import React from 'react';
import { WantIcon } from '@/components/dashboard/WantIcon';
import type { IconFamily } from '@/components/dashboard/WantTypeVisuals';
import { useWantTypeStore } from '@/stores/wantTypeStore';
import { useIconFont } from '@/hooks/useDisplaySettings';
import { useColorMode } from '@/hooks/useColorMode';
import { classNames } from '@/utils/helpers';
import type { ChatCardRef } from '@/components/common/ChatWantCard';

/**
 * The wants a request could be, side by side, for the person to say which
 * (the engine's resolveQuestion: Laya's likeliest scored too close to tell
 * apart). Each is drawn as a small tile of its type — its icon, its name, what
 * it would be made with — and pressed, its name is said as the reply, as if
 * typed. Once anything has been said since, they stay as a record, dimmed.
 */
export const ChoiceTiles: React.FC<{
  tiles: ChatCardRef[];
  /** Pressing one says its name; none while the question no longer waits. */
  onChoose?: (name: string) => void;
  compact?: boolean;
}> = ({ tiles, onChoose, compact }) => {
  const wantTypes = useWantTypeStore(st => st.wantTypes);
  const iconFont = useIconFont() as IconFamily;
  const isLight = useColorMode() !== 'dark';
  const live = !!onChoose;
  return (
    <div
      className={classNames('mt-1.5 grid gap-1.5', compact ? 'text-[10px]' : 'text-xs')}
      style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}
    >
      {tiles.map((t, i) => (
        <button
          key={t.id}
          type="button"
          disabled={!live}
          title={t.summary ? `${t.name} — ${t.summary}` : t.name}
          onClick={(e) => { e.stopPropagation(); onChoose?.(t.name); }}
          onMouseDown={(e) => e.stopPropagation()}
          className={classNames(
            'relative flex flex-col items-center justify-start gap-1 rounded-lg border text-center min-w-0',
            compact ? 'px-1 py-1.5' : 'px-1.5 py-2',
            live
              ? 'border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-900 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-500 transition-colors cursor-pointer'
              : 'border-black/10 dark:border-white/10 bg-white/50 dark:bg-gray-900/40 opacity-60 cursor-default',
          )}
        >
          <span className="absolute top-0.5 left-1 text-[9px] font-semibold text-gray-400">{i + 1}</span>
          {t.type ? (
            <WantIcon
              typeName={t.type}
              category={wantTypes.find(w => w.name === t.type)?.category ?? ''}
              iconFont={iconFont}
              size={compact ? 22 : 28}
              isLight={isLight}
            />
          ) : (
            <span className={compact ? 'text-base' : 'text-xl'} aria-hidden>🤖</span>
          )}
          <span className="font-semibold text-gray-900 dark:text-gray-100 w-full truncate">{t.name}</span>
          {t.summary && (
            <span className="text-[10px] leading-tight text-gray-500 dark:text-gray-400 w-full line-clamp-2 break-all">{t.summary}</span>
          )}
        </button>
      ))}
    </div>
  );
};
