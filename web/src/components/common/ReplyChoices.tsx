import React, { useEffect, useState } from 'react';
import type { Want } from '@/types/want';
import { apiClient, type RobotSuggestion } from '@/api/client';
import { replyChoices } from './ChatThread';
import { WantIcon } from '@/components/dashboard/WantIcon';
import type { IconFamily } from '@/components/dashboard/WantTypeVisuals';
import { useWantTypeStore } from '@/stores/wantTypeStore';
import { useIconFont } from '@/hooks/useDisplaySettings';
import { useColorMode } from '@/hooks/useColorMode';

const pillClass = 'rounded-full border px-2.5 py-1 text-xs font-medium disabled:opacity-50';

/**
 * The replies the robot's last answer asks for (「スコアを確認しますか？」 →
 * はい / いいえ), as pills left of a chat's input: pressed, one is said as if
 * typed. Nothing while the answer asks nothing, something has been typed, or
 * anything has been said since. The phone's chat offers the same, from the
 * same answer (the turn's choices).
 *
 * The robot's chat, opened with no such answer waiting, offers instead what
 * the robot would do now — up to three pills (engine robot_suggest.go: the way
 * to where its person goes at this time, the wants it would bring up to date).
 * Pressed, one is done and said in the chat; asked once each time the chat is
 * opened, put away once anything is said; ↻ asks again now.
 */
export const ReplyChoices: React.FC<{
  want: Want;
  /** What is in the input: typing puts the pills away. */
  typed: string;
  disabled?: boolean;
  onChoose: (choice: string) => void;
}> = ({ want, typed, disabled, onChoose }) => {
  const choices = typed.trim() ? [] : replyChoices(want);
  const isRobot = want.metadata?.type === 'robot';
  const [suggestions, setSuggestions] = useState<RobotSuggestion[]>([]);
  const [taking, setTaking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Each pill drawn with its want's type icon, as the board draws the want.
  const wantTypes = useWantTypeStore(st => st.wantTypes);
  const iconFont = useIconFont() as IconFamily;
  const isLight = useColorMode() !== 'dark';
  // Anything said since they were offered puts them away.
  const said = (want.state?.current?.cc_messages as unknown[] | undefined)?.length ?? 0;
  const [saidAtOffer, setSaidAtOffer] = useState<number | null>(null);
  const ask = (fresh: boolean) => {
    setRefreshing(fresh);
    return apiClient.robotSuggestions(fresh)
      .then(r => { setSuggestions(r.suggestions ?? []); setSaidAtOffer(null); })
      .catch(e => console.warn('[ReplyChoices] no suggestions:', e))
      .finally(() => setRefreshing(false));
  };
  useEffect(() => {
    if (!isRobot) return;
    void ask(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRobot]);
  useEffect(() => { if (suggestions.length && saidAtOffer === null) setSaidAtOffer(said); }, [suggestions.length, said, saidAtOffer]);
  // The robot's chat, asked nothing and nothing typed: its pills, and ↻.
  const idle = isRobot && !choices.length && !typed.trim();
  const offering = idle && suggestions.length > 0 && (saidAtOffer === null || said === saidAtOffer);

  const take = (s: RobotSuggestion) => {
    setTaking(true);
    setSuggestions([]);
    apiClient.takeRobotSuggestion(s.id)
      .catch(e => console.error('[ReplyChoices] the pill failed:', e))
      .finally(() => setTaking(false));
  };

  const refresh = (
    <button
      type="button"
      title="おすすめを更新"
      aria-label="おすすめを更新"
      disabled={disabled || taking || refreshing}
      onClick={(e) => { e.stopPropagation(); void ask(true); }}
      onMouseDown={(e) => e.stopPropagation()}
      className={`${pillClass} border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800`}
    >
      <span className={refreshing ? 'inline-block animate-spin' : 'inline-block'}>↻</span>
    </button>
  );

  if (idle) {
    return (
      <div className="flex flex-shrink-0 flex-wrap gap-1 self-center">
        {offering && suggestions.map(s => (
          <button
            key={s.id}
            type="button"
            title={s.ask}
            disabled={disabled || taking}
            onClick={(e) => { e.stopPropagation(); take(s); }}
            onMouseDown={(e) => e.stopPropagation()}
            className={`${pillClass} inline-flex items-center gap-1 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/50`}
          >
            {s.type && (
              <WantIcon
                typeName={s.type}
                category={wantTypes.find(t => t.name === s.type)?.category ?? ''}
                iconFont={iconFont}
                size={14}
                isLight={isLight}
              />
            )}
            {s.pill}
          </button>
        ))}
        {refresh}
      </div>
    );
  }
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
          className={`${pillClass} border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/50`}
        >
          {choice}
        </button>
      ))}
    </div>
  );
};
