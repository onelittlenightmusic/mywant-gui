import React, { useState, useRef } from 'react';
import { Check, Eraser, Mic, Send, Square } from 'lucide-react';
import { WantCardPluginProps, registerWantCardPlugin } from '../registry';
import { WantCardLayout } from '../../WantCardLayout';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { useHeaderAtBottom } from '@/hooks/useDisplaySettings';
import { apiClient } from '@/api/client';
// The card shows the same thread the Chat tab does, from the same component:
// it was the last reply alone in a grey box, with what you said reduced to a
// "You:" caption, which loses the shape of the exchange — and on a board of
// cards the shape is most of what you are reading. See ChatThread.
import { ChatThread, readChat, isChatBusy, type CCMessage } from '@/components/common/ChatThread';

export const CodingContentSection: React.FC<WantCardPluginProps> = ({
  want, isChild, isControl, isFocused,
}) => {
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState(false);
  // The card's type/status pill sits in the bottom-left corner when the header
  // is at the bottom (see WantCard), which is now where the input is — so the
  // input starts to the right of it rather than underneath.
  const pillAtBottom = useHeaderAtBottom();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Text already in the box when mic listening started — interim/final
  // speech results are appended after it rather than replacing it, so
  // typing then dictating (or dictating twice) both work as expected.
  const micBaseTextRef = useRef('');
  const { supported: micSupported, listening: micListening, toggle: toggleMic } = useSpeechToText({
    onResult: (text, isFinal) => {
      const base = micBaseTextRef.current;
      const sep = base && !/[\s\n]$/.test(base) ? ' ' : '';
      const combined = base + sep + text;
      setInputText(combined);
      if (isFinal) micBaseTextRef.current = combined;
    },
  });
  const handleMicClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!micListening) micBaseTextRef.current = inputText;
    toggleMic();
  };

  // phase drives the in-flight indicators only — it is not shown as a badge.
  const { phase, messages: ccMessages } = readChat(want);
  const wantName = want.metadata?.name;
  const wantId = want.metadata?.id ?? wantName;

  const lastMessage = ccMessages[ccMessages.length - 1];
  const isAwaiting = isChatBusy(want);
  // Whose turn it is. Phase says what the want's own request machine is doing;
  // this says whether the agent has handed the conversation back, which is the
  // thing a person walking past the board wants to read off it. Same value the
  // bell listens to — see useCodingAgentRing.
  const yielded = (want.state?.current?.current_session_state as string | undefined) === 'waiting_for_input';

  const compact = isChild || (isControl && !isFocused);

  // A character's chat has nobody behind it, so nothing ever answers — the
  // message IS the content, and the thread is one side of a conversation.
  // See character_chat.yaml.
  const isMonologue = want.metadata?.type === 'character_chat';

  // cc_latest_message is the field for exactly this — the most recent thing
  // said — while cc_messages is a capped, FIFO history that backfills and
  // rolls. Falling back to its tail covers a want written before the latest
  // field was being kept.
  const latest = want.state?.current?.cc_latest_message as CCMessage | undefined;
  const spoken = isMonologue ? (latest?.text ?? lastMessage?.text) : undefined;

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !wantName || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/v1/webhooks/${wantName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sender: 'user' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setInputText('');
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  // Stopping a turn that has already finished is a normal thing to do — the
  // card is always a poll or two behind the want — so nothing is reported when
  // there was nothing to stop.
  const handleStop = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!wantId) return;
    setSendError(null);
    try {
      await apiClient.interruptChat(wantId);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to stop');
    }
  };

  // Same forgetting as the Chat tab's eraser: the agent's memory of the
  // conversation goes, the messages on the card stay. See ChatTab.
  const handleResetSession = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!wantId) return;
    setSendError(null);
    try {
      await apiClient.clearChatSession(wantId);
      setResetDone(true);
      setTimeout(() => setResetDone(false), 2000);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to reset the session');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <WantCardLayout
      // The box you write in sits under the thread, where the next message will
      // appear — the way every chat reads, and the way the Chat tab already is.
      bottom={
        <div
          className={`flex flex-col gap-1 pr-1 ${pillAtBottom ? 'pl-[4.75rem]' : 'pl-1'} ${compact ? 'pb-1' : 'pb-1.5'}`}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {sendError && <p className="text-red-500 px-0.5">{sendError}</p>}
          <div className="flex gap-1.5 items-end">
            {/* The card's inner focus lands here — writing to the agent is
                what operating this want means. Tab steps on to the mic and
                send buttons; see useInnerFocusRing. */}
            <textarea
              data-inner-focus
              data-inner-focus-default
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              placeholder={compact ? 'Message...' : 'Message... (Enter to send, Shift+Enter for newline)'}
              rows={1}
              disabled={sending}
              className="
                flex-1 resize-none rounded-lg border border-gray-200 dark:border-gray-600
                bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500
                placeholder-gray-400 dark:placeholder-gray-500
                disabled:opacity-50
              "
            />
            {/* Every button on the card in one place, bottom right: send
                first, then the mic, then reset. */}
            {/* While the agent is working, the button that sends becomes the
                button that stops — the same swap the Chat tab makes. There is
                nothing to send until it has answered. */}
            {isAwaiting ? (
              <button
                data-inner-focus
                onClick={handleStop}
                onMouseDown={(e) => e.stopPropagation()}
                className="
                  flex-shrink-0 p-1.5 rounded-lg
                  bg-red-600 hover:bg-red-700 text-white
                  transition-colors
                "
                title="Stop (the conversation so far is forgotten)"
              >
                <Square className="w-3 h-3" fill="currentColor" />
              </button>
            ) : (
              <button
                data-inner-focus
                onClick={(e) => { e.stopPropagation(); handleSend(); }}
                disabled={!inputText.trim() || sending || !wantName}
                className="
                  flex-shrink-0 p-1.5 rounded-lg
                  bg-blue-600 hover:bg-blue-700
                  disabled:bg-gray-300 dark:disabled:bg-gray-600
                  text-white disabled:text-gray-400
                  transition-colors
                "
                title="Send (Enter)"
              >
                {sending ? (
                  <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-3 h-3" />
                )}
              </button>
            )}
            {micSupported && (
              <button
                data-inner-focus
                onClick={handleMicClick}
                onMouseDown={(e) => e.stopPropagation()}
                disabled={sending}
                className={`
                  flex-shrink-0 p-1.5 rounded-lg transition-colors
                  ${micListening
                    ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                    : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-300'}
                  disabled:opacity-50
                `}
                title={micListening ? 'Stop voice input' : 'Voice input'}
              >
                <Mic className="w-3 h-3" />
              </button>
            )}
            {/* Last, and red: it cannot be taken back. A character's chat has
                no session to forget. */}
            {!isMonologue && (
              <button
                data-inner-focus
                onClick={handleResetSession}
                onMouseDown={(e) => e.stopPropagation()}
                disabled={isAwaiting || !wantId}
                className="
                  flex-shrink-0 p-1.5 rounded-lg transition-colors
                  bg-red-600 hover:bg-red-700 text-white disabled:opacity-40
                "
                title={isAwaiting
                  ? 'Stop the agent before resetting what it remembers'
                  : resetDone ? 'Session reset'
                  : 'Reset the session: the agent forgets this conversation (the messages stay)'}
              >
                {resetDone ? <Check className="w-3 h-3" /> : <Eraser className="w-3 h-3" />}
              </button>
            )}
          </div>
        </div>
      }
      content={
        <div className={`h-full flex flex-col ${compact ? 'gap-1.5 px-1 pt-1' : 'gap-2 px-1 pt-1.5'}`}>
          {/* No provider name and no phase badge — the card shows the
              conversation, not the machinery behind it. The only survivor is
              the in-flight pulse, and it takes a row only while it is on. */}
          {(isAwaiting || yielded) && (
            <div className="flex-shrink-0 flex items-center justify-end">
              {/* Steady amber for "your turn", pulsing yellow for "still going":
                  a dot that pulses reads as activity, and the whole point of the
                  first one is that there is none. */}
              <span className={yielded
                ? 'w-1.5 h-1.5 rounded-full bg-amber-500'
                : 'w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse'} />
            </div>
          )}
          {/* The thread itself, exactly as the Chat tab draws it — only
              tighter, and without the working log, which is the machinery this
              card deliberately leaves out. */}
          {/* compact follows the card's own size, so a maximized card reads
              like the Chat tab — timestamps and all — and a tile on the grid
              stays a tile. */}
          <ChatThread
            want={want}
            compact={compact}
            className="flex-1 px-0.5"
            empty={(
              <span className="text-gray-400 dark:text-gray-500 italic">
                {isMonologue ? (spoken ?? 'Nothing said yet')
                  : isAwaiting ? 'Waiting for response...'
                  : yielded ? 'Your turn' : 'No response yet'}
              </span>
            )}
          />
        </div>
      }
    />
  );
};

registerWantCardPlugin({
  // "robot" is the always-on chat companion want, built on the same
  // Monitor/Think/Do machinery as "coding" (see engine/types/robot_types.go)
  // — its want card (dashboard grid, canvas float card, expanded portal)
  // inherits this exact chat UI unchanged. Only the canvas *tile marker*
  // (a free-floating character avatar, see WantCanvas.tsx) differs, since
  // that's a position/collision marker, not the want card itself.
  // character_chat is the same card with nobody behind it: a character's chat
  // window holds the same message history in the same fields, so the chat UI
  // is the chat UI. What differs is only that no answer ever comes back, which
  // this card already copes with — a conversation with no reply yet looks
  // exactly the same as one waiting for one.
  types: ['coding', 'robot', 'character_chat'],
  ContentSection: CodingContentSection,
  hideFinalResult: true,
});
