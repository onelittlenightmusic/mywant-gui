import React from 'react';
import type { Want } from '@/types/want';
import { replyChoices } from './ChatThread';

/**
 * The replies the robot's last answer asks for (「スコアを確認しますか？」 →
 * はい / いいえ), as pills left of a chat's input: pressed, one is said as if
 * typed. Nothing while the answer asks nothing, something has been typed, or
 * anything has been said since. The phone's chat offers the same, from the
 * same answer (the turn's choices).
 */
export const ReplyChoices: React.FC<{
  want: Want;
  /** What is in the input: typing puts the pills away. */
  typed: string;
  disabled?: boolean;
  onChoose: (choice: string) => void;
}> = ({ want, typed, disabled, onChoose }) => {
  const choices = typed.trim() ? [] : replyChoices(want);
  if (!choices.length) return null;
  return (
    <div className="flex flex-shrink-0 gap-1 self-center">
      {choices.map(choice => (
        <button
          key={choice}
          type="button"
          disabled={disabled}
          onClick={(e) => { e.stopPropagation(); onChoose(choice); }}
          onMouseDown={(e) => e.stopPropagation()}
          className="rounded-full border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/50 disabled:opacity-50"
        >
          {choice}
        </button>
      ))}
    </div>
  );
};
