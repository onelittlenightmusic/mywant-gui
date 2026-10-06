/** The Chat tab — talking to the agent behind this want. */
import React, { useState } from 'react';
import { Activity, Eraser, MessageSquare, Send, Square, Mic } from 'lucide-react';
import { Want } from '@/types/want';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { classNames } from '@/utils/helpers';
import { apiClient } from '@/api/client';
import {
  ChatThread,
  readChat,
  isChatBusy,
  buildChatItems,
} from '@/components/common/ChatThread';
import { sayToWant } from '@/utils/robotAsk';

export const ChatTab: React.FC<{ want: Want }> = ({ want }) => {
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  // The working log is the point of the tab for a running agent, so it starts
  // shown; a finished thread reads better without it.
  const [showActivity, setShowActivity] = useState(true);

  // Text already in the box when mic listening started — interim/final
  // speech results are appended after it rather than replacing it.
  const micBaseTextRef = React.useRef('');
  const { supported: micSupported, listening: micListening, toggle: toggleMic } = useSpeechToText({
    onResult: (text, isFinal) => {
      const base = micBaseTextRef.current;
      const sep = base && !/[\s\n]$/.test(base) ? ' ' : '';
      const combined = base + sep + text;
      setInputText(combined);
      if (isFinal) micBaseTextRef.current = combined;
    },
  });
  const handleMicClick = () => {
    if (!micListening) micBaseTextRef.current = inputText;
    toggleMic();
  };

  const { phase, responses, activities, sessionState } = readChat(want);
  const lastResponseRaw = want.state?.current?.last_response_raw as Record<string, unknown> | undefined;
  const wantName = want.metadata?.name;
  const wantId = want.metadata?.id ?? wantName;
  const busy = isChatBusy(want);
  const hasThread = buildChatItems(want, false).length > 0;

  const handleSend = async () => {
    if (!inputText.trim() || !wantName || sending) return;
    setSending(true);
    setSendError(null);
    try {
      await sayToWant(wantName, inputText.trim());
      setInputText('');
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // Stopping a turn that has already finished is a normal thing to do — the
  // screen is always a poll or two behind the want — so it is not an error
  // here either, just nothing to report.
  const handleStop = async () => {
    if (!wantId) return;
    setSendError(null);
    try {
      await apiClient.interruptChat(wantId);
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : 'Failed to stop');
    }
  };

  // What is forgotten is the agent's own memory of the conversation, not the
  // messages on screen: they are the want's, and the person asked the robot to
  // forget, not to erase what they said.
  const handleClearSession = async () => {
    if (!wantId) return;
    setSendError(null);
    try {
      await apiClient.clearChatSession(wantId);
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : 'Failed to clear the session');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const phaseBadgeClass = classNames(
    'text-xs px-2 py-0.5 rounded-full font-medium',
    phase === 'monitoring'        ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
    : phase === 'requesting'      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
    : phase === 'awaiting_response' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 animate-pulse'
    : phase === 'response_received' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
    : phase === 'achieved'        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
    : phase === 'error'           ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
  );

  const responseSubtype = (responses[responses.length - 1]?.subtype) ?? (lastResponseRaw?.subtype as string | undefined);

  // Whose turn it is, which the phase does not say. Phase is the want's own
  // request/response machine and sits at "monitoring" both while the agent is
  // grinding through a task and while it stands there waiting for you — the
  // engine derives this from the transcript's stop_reason instead
  // (agent_claude_code.go), and it was being computed and never shown.
  const sessionBadge = sessionState === 'waiting_for_input'
    ? { label: 'your turn', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' }
    : sessionState === 'waiting_for_response'
    ? { label: 'working', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 animate-pulse' }
    : sessionState
    ? { label: sessionState.replace(/_/g, ' '), cls: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' }
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Phase indicator */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">Phase:</span>
        {phase && <span className={phaseBadgeClass}>{phase}</span>}
        {sessionBadge && (
          <span className={classNames('text-xs px-2 py-0.5 rounded-full font-medium', sessionBadge.cls)}>
            {sessionBadge.label}
          </span>
        )}
        {responseSubtype && (
          <span className={classNames(
            'text-xs px-2 py-0.5 rounded-full font-medium',
            responseSubtype === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
            : responseSubtype === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
          )}>
            {responseSubtype}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {activities.length > 0 && (
            <button
              onClick={() => setShowActivity(v => !v)}
              className={classNames(
                'flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-colors',
                showActivity
                  ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
              )}
              title={showActivity ? 'Hide the working log' : 'Show the working log'}
            >
              <Activity className="h-3 w-3" />
              {activities.length}
            </button>
          )}
          {/* Forgetting is deliberate and cannot be taken back, so it stays up
              here rather than beside the send button, and is out of reach
              while a turn is running — the session is in use. */}
          {hasThread && (
            <button
              onClick={handleClearSession}
              disabled={busy}
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-40"
              title={busy
                ? 'Stop the agent before clearing what it remembers'
                : 'Make the agent forget this conversation (the messages stay)'}
            >
              <Eraser className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Message thread */}
      <ChatThread
        want={want}
        showActivity={showActivity}
        className="flex-1 px-4 py-4"
        empty={(
          <div className="text-center py-12">
            <MessageSquare className="h-10 w-10 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No messages yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Send a message below</p>
          </div>
        )}
      />

      {/* Input area */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
        {sendError && <p className="text-xs text-red-500 mb-2">{sendError}</p>}
        <div className="flex gap-2 items-end">
          <textarea
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message... (Enter to send, Shift+Enter for newline)"
            rows={2}
            className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 placeholder-gray-400 dark:placeholder-gray-500"
          />
          {micSupported && (
            <button
              onClick={handleMicClick}
              disabled={sending}
              className={classNames(
                'flex-shrink-0 p-2 rounded-lg transition-colors disabled:opacity-50',
                micListening
                  ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                  : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-300'
              )}
              title={micListening ? 'Stop voice input' : 'Voice input'}
            >
              <Mic className="h-4 w-4" />
            </button>
          )}
          {/* While the agent is working, the button that sends becomes the
              button that stops. One button, and it is always the thing you
              want next: there is nothing to send until it has answered. */}
          {busy ? (
            <button
              onClick={handleStop}
              className="flex-shrink-0 p-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
              title="Stop (the conversation so far is forgotten)"
            >
              <Square className="h-4 w-4" fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || sending || !wantName}
              className="flex-shrink-0 p-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white disabled:text-gray-400 dark:disabled:text-gray-500 transition-colors"
              title="Send (Enter)"
            >
              {sending ? <LoadingSpinner size="sm" /> : <Send className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
