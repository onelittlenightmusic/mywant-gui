import React from 'react';
import { Circle, Crosshair, Layers } from 'lucide-react';
import { useWantStore } from '@/stores/wantStore';
import { useThingTileStore } from '@/stores/thingTileStore';
import { useMarkJump } from '@/components/common/MarkButton';
import { getStatusHexColor } from '@/components/dashboard/WantCard/parts/StatusColor';
import { classNames } from '@/utils/helpers';
import type { WantExecutionStatus } from '@/types/want';

/**
 * A want an answer is about, as the engine settled it with the answer
 * (fmAnswerCards): the same card the phone shows — under the chat's answer, in
 * its answer window and its Live Activity — drawn here the GUI's way. What it
 * says is decided there, once, for every client; nothing here summarizes.
 * (An answer from before cards carried their content has the name alone.)
 */
export interface ChatCardRef {
  kind: string;
  id: string;
  name: string;
  type?: string;
  status?: string;
  summary?: string;
}

/**
 * The want an answer is about, small, under the answer: its name, how it is
 * doing, its type and its result in a line — enough to see what the answer was
 * read from (a question about one place answered from another shows here),
 * not the card itself, which would be the thread's size. Pressed, the board's
 * camera goes to the want, as the phone's card does.
 */
export const ChatWantCard: React.FC<{ card: ChatCardRef; compact?: boolean }> = ({ card, compact }) => {
  const isThing = card.kind === 'thing';
  const wantOnBoard = useWantStore(s => s.wants.some(w => (w.metadata?.id || w.id) === card.id));
  const thingOnBoard = useThingTileStore(s => s.onCanvas.has(card.id) || !s.loaded);
  const onBoard = isThing ? thingOnBoard : wantOnBoard;
  const jump = useMarkJump();
  const status = (card.status ?? '') as WantExecutionStatus;
  const color = status ? getStatusHexColor(status) : '#9ca3af';
  const name = card.name;
  const result = card.summary ?? '';

  return (
    <button
      type="button"
      // The character walks to it — a want or a thing, as from every card.
      onClick={(e) => {
        e.stopPropagation();
        jump(isThing ? { kind: 'thing', id: card.id, name, color: '' } : { kind: 'want', id: card.id, name });
      }}
      title={`盤面の "${name}" へ行く`}
      className={classNames(
        'mt-1.5 w-full text-left rounded-md border border-black/10 dark:border-white/10',
        'bg-white/70 dark:bg-gray-900/60 hover:bg-white dark:hover:bg-gray-900 transition-colors',
        compact ? 'px-1.5 py-1' : 'px-2 py-1.5',
      )}
    >
      <span className="flex items-center gap-1.5 min-w-0">
        {isThing
          ? <Circle className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
          : <Layers className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />}
        <span className="text-xs font-semibold truncate text-gray-900 dark:text-gray-100">{name}</span>
        <span className="flex-1" />
        {status && (
          <span
            className="text-[10px] font-semibold px-1.5 rounded-full flex-shrink-0"
            style={{ color, backgroundColor: `${color}22` }}
          >
            {status}
          </span>
        )}
        <Crosshair className="w-3 h-3 flex-shrink-0 text-gray-400" />
      </span>
      {!compact && card.type && (
        <span className="block text-[10px] text-gray-500 dark:text-gray-400 truncate">{card.type}</span>
      )}
      {result && (
        <span className="block text-[11px] text-gray-600 dark:text-gray-300 truncate">{result}</span>
      )}
      {!onBoard && (
        <span className="block text-[11px] text-gray-400">盤面にありません</span>
      )}
    </button>
  );
};
