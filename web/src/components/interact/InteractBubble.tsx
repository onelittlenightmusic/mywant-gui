import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Dices, Sparkles } from 'lucide-react';
import { classNames } from '@/utils/helpers';
import { useCharacterStore } from '@/stores/characterStore';
import { CursorManIcon } from '@/components/dashboard/CursorManIcon';
import { apiClient } from '@/api/client';
import { RiffProposal } from '@/types/want';

/** How long the character is held before it counts as a hold. */
const LONG_PRESS_MS = 500;

interface InteractBubbleProps {
  onSubmit: (message: string) => void;
  isThinking: boolean;
  disabled?: boolean;
  onRobotClick?: () => void;
  onRobotMouseEnter?: () => void;
  onRobotMouseLeave?: () => void;
  /**
   * Holding the character down. The press that ends a hold is not also a
   * click: it does not fold or unfold the field.
   */
  onRobotLongPress?: () => void;
  autoFocus?: boolean;
  hasUnreadReply?: boolean;
  /**
   * Drawn as a cell of the global control pill rather than as a speech bubble
   * of its own: no bubble frame or pointer, a smaller character, a narrower
   * field. The pill is already the frame.
   */
  inline?: boolean;
}

export const InteractBubble: React.FC<InteractBubbleProps> = ({
  onSubmit,
  isThinking,
  disabled = false,
  onRobotClick,
  onRobotMouseEnter,
  onRobotMouseLeave,
  onRobotLongPress,
  autoFocus = false,
  hasUnreadReply = false,
  inline = false,
}) => {
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  // Inline (in the control pill), the field starts folded behind the face and
  // opens when the face is pressed or the field is focused (a shortcut can
  // focus it directly); it folds again when left empty.
  const [fieldOpen, setFieldOpen] = useState(!inline);

  const myCharacter = useCharacterStore(s => s.getMyCharacter());

  // The hold on the character: its timer, and whether the press it belongs to
  // already did its work — in which case the click at its end is swallowed.
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heldRef = useRef(false);
  const cancelHold = () => {
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
  };
  useEffect(() => cancelHold, []);

  const placeholders = [
    'バグを直してほしい',
    'この関数をリファクタしたい',
    'テストを書いてほしい',
    'コードの意味を説明して'
  ];

  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  // Auto-focus input only when explicitly requested
  useEffect(() => {
    if (autoFocus) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 300); // Wait for slide-in animation
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // A rolled riff sits in a preview above the input (not in it), so the input
  // stays free for normal robot chat. The dice re-rolls it; deploying is a
  // slash command (/riff deploy) or the ✨ on the preview. Send always goes to
  // the robot — a riff never hijacks it.
  const [pendingRiff, setPendingRiff] = useState<RiffProposal | null>(null);
  const [rolling, setRolling] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const folded = inline && !fieldOpen && !message && !pendingRiff && !flash;

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2200);
  };

  // Dice / "/riff": ask the world for one absurd "XしたらX" wiring. Re-rollable —
  // press again for another. Shown as a preview, never forced into the input.
  const rollRiff = async () => {
    if (rolling || disabled) return;
    setRolling(true);
    try {
      const proposals = await apiClient.getRiffs(1);
      if (proposals[0]) setPendingRiff(proposals[0]);
    } catch (err) {
      console.error('[InteractBubble] riff roll failed:', err);
    } finally {
      setRolling(false);
    }
  };

  // Deploy the previewed riff straight from its structure — no LLM re-derivation.
  const deployPending = async () => {
    if (!pendingRiff) { showFlash('先に🎲でriffを振ってください'); return; }
    try {
      const res = await apiClient.deployRiff(pendingRiff);
      showFlash(`✨ ${res.name} を作りました`);
    } catch (err) {
      console.error('[InteractBubble] riff deploy failed:', err);
      showFlash('デプロイに失敗しました');
    }
    setPendingRiff(null);
  };

  // Slash commands run locally and never reach the robot. Everything else is
  // ordinary chat and goes straight to the robot, as before.
  const runSlashCommand = (raw: string): boolean => {
    const cmd = raw.trim().toLowerCase();
    if (cmd === '/riff' || cmd === '/rf') { rollRiff(); return true; }
    if (cmd === '/riff deploy' || cmd === '/deploy') { deployPending(); return true; }
    return false;
  };

  const handleSubmit = async () => {
    const m = message.trim();
    if (!m || disabled) return;
    if (m.startsWith('/')) {
      if (!runSlashCommand(m)) showFlash(`不明なコマンド: ${m}`);
      setMessage('');
      return;
    }
    onSubmit(m);
    setMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle Escape key to unfocus input
    if (e.key === 'Escape') {
      e.preventDefault();
      console.log('[InteractBubble] Escape pressed, blurring input');
      inputRef.current?.blur();
      return;
    }

    // Ignore Enter key press during IME composition (Japanese input).
    // Use e.nativeEvent.isComposing (not state) to avoid race condition where
    // compositionend fires and React flushes the state update before keydown arrives.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div ref={bubbleRef} className={classNames('inline-flex items-center', inline ? 'gap-1.5' : 'gap-2')}>
      {/* Robot Icon -> Character Icon */}
      <div
        className={classNames(
          "relative flex items-center justify-center rounded-full flex-shrink-0 cursor-pointer select-none transition-all duration-150",
          inline ? 'h-8 w-8' : 'h-10 w-10 shadow-lg',
          myCharacter
            ? "bg-slate-900/40 hover:scale-105"
            : "bg-blue-600 hover:bg-blue-700"
        )}
        onPointerDown={onRobotLongPress ? () => {
          heldRef.current = false;
          cancelHold();
          holdTimerRef.current = setTimeout(() => {
            holdTimerRef.current = null;
            heldRef.current = true;
            onRobotLongPress();
          }, LONG_PRESS_MS);
        } : undefined}
        onPointerUp={onRobotLongPress ? cancelHold : undefined}
        onPointerCancel={onRobotLongPress ? cancelHold : undefined}
        onPointerLeave={onRobotLongPress ? cancelHold : undefined}
        // A phone's own long-press menu would open over the one this opens.
        onContextMenu={onRobotLongPress ? (e => e.preventDefault()) : undefined}
        onClick={(e) => {
          if (heldRef.current) { heldRef.current = false; e.stopPropagation(); return; }
          if (!inline) { onRobotClick?.(); return; }
          if (folded) { setFieldOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }
          else { setFieldOpen(false); inputRef.current?.blur(); }
        }}
        onMouseEnter={onRobotMouseEnter}
        onMouseLeave={onRobotMouseLeave}
      >
        {myCharacter ? (
          <CursorManIcon size={inline ? 30 : 38} />
        ) : (
          <Bot className="h-6 w-6 text-white" />
        )}
        {hasUnreadReply && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-white dark:border-gray-900 animate-pulse" />
        )}
      </div>

      {/* Speech Bubble */}
      <div className={classNames(
        'relative flex flex-col gap-1 transition-all duration-200',
        inline
          ? classNames(
              'rounded-full bg-gray-100 dark:bg-gray-900/60 overflow-hidden',
              folded ? 'max-w-0 px-0 py-1.5 opacity-0' : 'max-w-[20rem] px-3 py-1.5 opacity-100',
              isThinking && 'bg-blue-50 dark:bg-blue-900/20',
            )
          : classNames(
              'px-4 py-2 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-300 dark:border-gray-600',
              isThinking && 'bg-blue-50 dark:bg-blue-900/20',
            ),
      )}>
        {/* Triangle pointer (left side) */}
        <div className={classNames('absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[7px]', inline && 'hidden')}>
          <div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[8px] border-r-gray-300 dark:border-r-gray-600" />
          <div className="absolute top-[1px] left-[2px] w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[6px] border-r-white dark:border-r-gray-800" />
        </div>

        {/* Riff preview — a rolled proposal sits here, above the input. Re-roll
            with 🎲, deploy with ✨ (same as sending "/riff deploy"), dismiss with ×. */}
        {pendingRiff && (
          <div className="flex items-center gap-2 px-1 py-0.5 text-sm text-purple-700 dark:text-purple-300">
            <button onClick={rollRiff} disabled={rolling} title="もう一回振る" className="text-purple-500 hover:text-purple-600 disabled:opacity-40">
              <Dices className={classNames('h-4 w-4', rolling && 'animate-spin')} />
            </button>
            <span className={classNames('font-medium', inline && 'truncate max-w-[12rem] xl:max-w-[16rem]')} title={pendingRiff.text}>{pendingRiff.text}</span>
            <button onClick={deployPending} title="作る（/riff deploy）" className="text-emerald-500 hover:text-emerald-600">
              <Sparkles className="h-4 w-4" />
            </button>
            <button onClick={() => setPendingRiff(null)} title="やめる" className="text-gray-400 hover:text-gray-600">×</button>
          </div>
        )}

        {/* Input row — always ordinary robot chat; a riff never hijacks Send.
            Inline, there is one line to share: a previewed riff takes it until
            it is deployed or dismissed. */}
        <div className={classNames('flex items-center gap-2', inline && pendingRiff && 'hidden')}>
          {isThinking && (
            <span className="text-gray-600 dark:text-gray-400 text-xs animate-pulse mr-2">
              処理中...
            </span>
          )}
          {flash ? (
            <span className="text-emerald-600 dark:text-emerald-400 text-sm font-medium px-1">{flash}</span>
          ) : (
          <>
          <input
            ref={inputRef}
            data-interact-input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (inline) setFieldOpen(true); }}
            onBlur={() => {
              if (!inline) return;
              // Wait for focus to land: a press on the dice or send button in
              // the field blurs the input first, and folding then would take
              // the button out from under the press.
              setTimeout(() => {
                if (inputRef.current?.value.trim()) return;
                if (bubbleRef.current?.contains(document.activeElement)) return;
                setFieldOpen(false);
              }, 150);
            }}
            placeholder={placeholders[placeholderIndex]}
            disabled={disabled}
            className={classNames(
              'bg-transparent border-none outline-none',
              'text-base placeholder-gray-400 focus:ring-0',
              inline ? 'w-40 xl:w-56 p-0 text-sm' : 'w-64',
              'text-gray-900 dark:text-gray-100'
            )}
          />
          {/* Empty input: 🎲 rolls a riff (re-rollable — press again for another).
              Non-empty: Send goes to the robot as normal. */}
          {!message ? (
            <button
              onClick={rollRiff}
              disabled={disabled || rolling}
              title="ランダムな「〜したら〜する」を振る（何回でも）"
              className="text-purple-500 hover:text-purple-600 disabled:opacity-40"
            >
              <Dices className={classNames('h-4 w-4', rolling && 'animate-spin')} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={disabled}
              className="text-blue-600 hover:text-blue-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
};
