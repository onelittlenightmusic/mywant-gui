import { useCharacterStore, getDefaultCursorColor } from '@/stores/characterStore';
import { useDarkMode } from './useDarkMode';

/**
 * 自分のキャラクターの色。カーソル（CursorMan / DragOverlay）と
 * カードのフォーカス枠線で共通に使う。
 * キャラ未選択時は設定済みのカーソル色、それも無ければ表示モード既定色。
 */
export function useMyCursorColor(): string {
  const isDarkMode = useDarkMode();
  const characters = useCharacterStore(s => s.characters);
  const myCharacterId = useCharacterStore(s => s.myCharacterId);
  const myDefaultCursorColor = useCharacterStore(s => s.myDefaultCursorColor);

  const mine = myCharacterId ? characters.find(c => c.id === myCharacterId) : undefined;
  return mine?.color ?? myDefaultCursorColor ?? getDefaultCursorColor(isDarkMode);
}
