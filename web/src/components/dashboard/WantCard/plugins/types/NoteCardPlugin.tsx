import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Check, X } from 'lucide-react';
import { WantCardPluginProps, registerWantCardPlugin } from '../registry';
import { WantCardLayout } from '../../WantCardLayout';
import { LinkifiedText } from '@/components/common/LinkifiedText';
import { classNames } from '@/utils/helpers';
import { writeWantState } from '@/api/wantState';
import { useOwed } from '@/hooks/useOwed';

const NoteContentSection: React.FC<WantCardPluginProps> = ({
  want, isFocused, isExpanded, isInnerFocused, onEnterInnerFocus, onExitInnerFocus,
}) => {
  const id = want.metadata?.id;
  const serverContent = (want.state?.current?.content as string) ?? (want.spec?.params?.content as string) ?? '';
  const isAchieved = want.status === 'achieved' || want.status === 'achieved_with_warning';

  const [text, setText] = useState(serverContent);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [done, setDone] = useState(isAchieved);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  /**
   * The text as committed — what the writer has said they mean, which is not
   * quite the same as what the server has echoed back yet.
   *
   * Kept here rather than read off the want, because the want's copy arrives
   * on the next poll and the writer is done the moment they press Enter.
   * Comparing against the want left the box yellow and the arrows trapped in
   * it for a round trip after the text was committed — the card disagreeing
   * with the person about whether they had finished.
   */
  const [committed, setCommitted] = useState(serverContent);
  const committedRef = useRef(serverContent);
  const setCommittedNow = useCallback((value: string) => {
    committedRef.current = value;
    setCommitted(value);
  }, []);

  // Follow the server, except over something the writer has not committed yet.
  // Uncommitted text is the one thing here that exists nowhere else, so an
  // arriving poll must not be allowed to type over it.
  //
  // `prevCommitted` is read before setCommittedNow runs: that call mutates
  // committedRef.current synchronously, so the setText updater — which reacts
  // later — would otherwise compare `text` against the value that just
  // arrived and read every server change as an uncommitted local edit.
  useEffect(() => {
    const prevCommitted = committedRef.current;
    setText(current => (current === prevCommitted ? serverContent : current));
    setCommittedNow(serverContent);
  }, [serverContent, setCommittedNow]);
  useEffect(() => { setDone(isAchieved); }, [isAchieved]);
  // Only ever true when a save is genuinely held up — see api/outbox.
  const unsaved = useOwed(id ? `want:${id}:state:content` : null);

  // Saved the moment it is meant, whatever the network is doing. The writer
  // said "that one" by pressing commit; whether the packet got through is not
  // something they should have to watch, and the outbox will not stop trying.
  const saveContent = useCallback(async (value: string): Promise<boolean> => {
    if (!id) return false;
    writeWantState(id, { content: value });
    return true;
  }, [id]);

  /**
   * Typed but not yet meant — the same state a parameter card is in between an
   * edit and the Enter that commits it (see CommitInput).
   *
   * The note used to save 600ms after the last keystroke, which is a different
   * promise: every half-finished thought went to the server, and there was no
   * moment the writer said "that one". Here as there, the text is theirs until
   * they commit it, the box says so while it waits, and Escape puts back what
   * was there before.
   */
  const dirty = text !== committed;

  /**
   * Committed the moment it is sent, not when the server says so.
   *
   * The yellow, and the arrows the box is holding on to, are about whether the
   * writer has finished — so Enter ends both at once and the card goes back to
   * being an ordinary operated card, with the arrows walking its ring.
   *
   * It used to become uncommitted again if the write failed, which said the
   * wrong thing: the writer DID finish the sentence, and a packet that went
   * missing is not them changing their mind. The text is committed here and
   * stays committed; what a failure affects is whether the server has heard
   * yet, and that is what "not saved" below reports.
   */
  const commit = useCallback(async () => {
    if (text === committed) return;
    const value = text;
    setCommittedNow(value);
    await saveContent(value);
  }, [text, committed, saveContent, setCommittedNow]);

  /**
   * While there is something uncommitted, the arrows belong to the caret.
   *
   * A card being operated walks its inner-focus ring with the arrows
   * (useInnerFocusRing), which is right when the card is a row of controls and
   * wrong in the middle of a sentence: up would leave the box for the Save
   * button rather than move a line. So the arrows are stopped here for as long
   * as the writing is unfinished, and go back to walking the ring once it is
   * committed — which is also the only time stepping to Save or Done is a
   * useful thing to do.
   *
   * A native listener on the textarea, not React's onKeyDown: the ring listens
   * on the card element, and a native listener there fires while the event is
   * still bubbling, long before React dispatches its synthetic event at the
   * root. Stopping it from a React handler would be stopping it after the fact.
   */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el || !dirty) return;
    const keepArrows = (e: KeyboardEvent) => {
      if (e.key.startsWith('Arrow')) e.stopPropagation();
    };
    el.addEventListener('keydown', keepArrows);
    return () => el.removeEventListener('keydown', keepArrows);
  }, [dirty]);

  const setAchievedState = async (achieved: boolean) => {
    if (!id) return;
    writeWantState(id, { achieved, completed: achieved });
  };

  const handleDone = async () => {
    if (!id || done) return;
    // Finishing the note keeps whatever is in the box: nobody means to file a
    // note and throw away the last sentence they typed into it.
    await commit();
    setDone(true);
    try {
      await setAchievedState(true);
    } catch (err) {
      console.error('[NoteCard] done failed:', err);
      setDone(false);
    }
  };

  const handleReopen = async () => {
    if (!id || !done) return;
    setDone(false);
    try {
      await setAchievedState(false);
      await fetch(`/api/v1/wants/${id}/start`, { method: 'POST' });
    } catch (err) {
      console.error('[NoteCard] reopen failed:', err);
      setDone(true);
    }
  };

  /**
   * Finished writing: commit the text and step back out of the box.
   *
   * The same thing Enter does, for a hand on the mouse. It exists because the
   * note needed a control that means exactly that: the only button on the card
   * was Done, which finishes the NOTE, and a button placed under a text box
   * reads as finishing the WRITING. People pressed it to save.
   */
  const handleSave = async () => {
    await commit();
    onExitInnerFocus?.();
  };

  /**
   * Whether the note itself is finished — a switch, because it is a state the
   * note is in and can be brought back out of, not an action taken once.
   *
   * It was a Done button beside the text box and a Reopen button on the other
   * face of the card, which is two controls for one flag and no hint from
   * either that the other exists. A switch shows which way it is set while you
   * are looking at it, and reads as a setting rather than as a submission.
   */
  const doneToggle = (
    <button
      data-inner-focus
      type="button"
      role="switch"
      aria-checked={done}
      aria-label="Done"
      onClick={(e) => { e.stopPropagation(); if (done) handleReopen(); else handleDone(); }}
      className="flex items-center gap-1.5 focus:outline-none flex-shrink-0"
    >
      <span className={done ? 'text-emerald-500 font-semibold' : 'text-gray-400 dark:text-gray-500'}>
        Done
      </span>
      <span
        style={{
          width: 34, height: 18, borderRadius: 999, position: 'relative',
          background: done
            ? 'linear-gradient(135deg, #22c55e, #16a34a)'
            : 'linear-gradient(135deg, #6b7280, #4b5563)',
          boxShadow: done
            ? '0 0 8px rgba(34,197,94,0.4), inset 0 1px 2px rgba(0,0,0,0.15)'
            : 'inset 0 1px 3px rgba(0,0,0,0.25)',
          transition: 'background 0.2s ease',
        }}
      >
        <span
          style={{
            position: 'absolute', top: 3, left: done ? 19 : 3,
            width: 12, height: 12, borderRadius: '50%',
            background: '#ffffff', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            transition: 'left 0.18s ease',
          }}
        />
      </span>
    </button>
  );

  /**
   * When there is a box to write in.
   *
   * Being operated counts, and not only being selected. The copy of this card
   * living in the detail sidebar is rendered `selected={false}` on purpose —
   * the board's card owns the selection, and two cards claiming it would fight
   * over the same keys — so a note shown there had no textarea at all. Not a
   * hidden one, not an unfocusable one: nothing to click, and an empty
   * inner-focus ring for Enter to walk. The sidebar copy is the only place a
   * note on the board can be edited, so that was every route to typing.
   */
  const editing = isFocused || isExpanded || isInnerFocused;
  const compact = !editing;

  // Paper, not a panel.
  //
  // A note is the one card whose content is somebody's handwriting rather than
  // a machine's reading, and it was being drawn in the same grey as a gauge. So
  // it gets a warm ground, faint rules to write along, and a hand for the
  // writing — enough that a page of them reads as pages, without pretending to
  // be a photograph of paper.
  //
  // The rules are a repeating gradient rather than an image: they scale with
  // the card, cost nothing to load, and stay crisp at any zoom the canvas is at.
  const PAPER_LINE_H = 22;
  // Ink, in one place. The card has two ways of showing the same words — a
  // read-only run of text and a textarea — and they were drifting apart the
  // moment one of them was restyled.
  const INK: React.CSSProperties = {
    fontFamily: '"Bradley Hand", "Segoe Print", "Yu Gothic", "Hiragino Maru Gothic ProN", cursive',
    color: '#2f3a52',
    lineHeight: `${PAPER_LINE_H}px`,
  };
  const paper: React.CSSProperties = {
    backgroundColor: '#fdfaf0',
    backgroundImage:
      `repeating-linear-gradient(to bottom, transparent, transparent ${PAPER_LINE_H - 1}px, rgba(120,105,70,0.16) ${PAPER_LINE_H}px)`,
    backgroundAttachment: 'local',
  };

  const content = (
    <div
      className="h-full flex flex-col note-paper"
      style={paper}
      // Presses are NOT stopped here.
      //
      // They used to be, on the whole sheet, so that placing a caret or
      // selecting a line did not drag the tile. It also stopped them reaching
      // the card, which is where a long press turns into the quick actions — so
      // a note was the one want on the board whose controls could not be opened
      // by holding it. The guard belongs on the box that actually wants the
      // gesture, which is the textarea below, not on the paper around it.
    >
      {/* iframe embed */}
      {iframeUrl ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-1 px-2 py-1 bg-black/70 flex-shrink-0">
            <span className="flex-1 text-white/50 font-mono truncate">{iframeUrl}</span>
            <button onClick={() => setIframeUrl(null)} title="Close" className="text-white/60 hover:text-white px-1"><X className="w-3.5 h-3.5" /></button>
          </div>
          <iframe
            src={iframeUrl}
            className="flex-1 w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            title="note-embed"
          />
        </div>
      ) : done ? (
        /* Achieved overlay */
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Check className="w-6 h-6 text-emerald-500" strokeWidth={2.5} />
          </div>
          {!compact && (
            <p className="text-emerald-600 dark:text-emerald-400 font-medium line-clamp-3">{text || '(empty)'}</p>
          )}
          {/* The same switch that finished it, still showing which way it is
              set — flip it back and the note is open again. It used to be a
              separate Reopen button living only on this face, so the way out
              looked nothing like the way in. */}
          {editing && doneToggle}
        </div>
      ) : editing ? (
        /* Edit mode */
        <div className="flex-1 flex flex-col min-h-0 p-2 pt-5 gap-2">
          {/* Room above the box for the badge to hang in — the same place it
              hangs on a parameter (CommitInput), which is above the field's top
              edge. Without the padding the card would clip it. */}
          <div className="relative flex-1 flex min-h-0">
          {/* The card's inner-focus ring — one stop, so entering the card puts
              the caret here. Was a focus() effect of its own; see
              useInnerFocusRing for why every card declares it the same way. */}
          <textarea
            data-inner-focus
            data-inner-focus-default
            ref={textareaRef}
            // The one place a press means something other than "this card".
            // Caret placement and text selection are its own; everywhere else
            // on the sheet, a hold still opens the card's actions.
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Enter commits, Shift+Enter is a newline — the same bargain a
              // parameter card strikes (CommitInput), and for the same reason:
              // a box that saves as you type has no moment you can point at and
              // call the text finished.
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                if (e.shiftKey) return;
                e.preventDefault();
                e.stopPropagation();
                void commit();
                return;
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                // Put back what was there, then leave. Escape that kept the
                // edit would be the one key that saves by walking away.
                setText(committed);
                textareaRef.current?.blur();
                onExitInnerFocus?.();
              }
            }}
            placeholder="なんでもメモ…"
            style={{
              minHeight: 0,
              // Sits on the rules rather than near them, and is written in ink
              // rather than in the UI's text colour — including in dark mode,
              // because the paper does not go dark just because the app did.
              ...INK,
              fontSize: '1.05em',
            }}
            className={classNames(
              'flex-1 w-full resize-none placeholder-black/25 outline-none transition-colors',
              // The card's own colour while it agrees with the server, and the
              // waiting-to-be-committed yellow while it does not — the same
              // signal, in the same colour, as an edited parameter.
              dirty
                ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-400 dark:border-yellow-600 rounded px-1 focus:ring-2 focus:ring-yellow-400'
                : 'bg-transparent border-none',
            )}
          />
          {/* Word for word and class for class the badge a parameter shows
              (CommitInput), because it is the same fact about the same kind of
              edit: what is on screen is not yet what is stored, and this is the
              key that stores it. Two spellings of one state would have to be
              learned twice. */}
          {dirty && (
            <div className="absolute right-2 -top-5 text-[10px] font-medium text-yellow-700 bg-yellow-100 px-1.5 py-0.5 rounded shadow-sm border border-yellow-200 pointer-events-none animate-in fade-in slide-in-from-bottom-1">
              Enter to commit / Shift+Enter for newline
            </div>
          )}
          </div>
          <div className="flex items-center justify-between flex-shrink-0 gap-2">
            <span className="text-gray-400">{unsaved ? 'not saved yet' : ''}</span>
            <div className="flex items-center gap-3">
              {/* The button under the text box is the one about the text: it
                  commits what has been typed and hands the keys back. Both it
                  and the switch are ring stops, so Tab walks
                  textarea → Save → Done without reaching for the mouse (a ring
                  of one is left to the browser — see useInnerFocusRing). */}
              <button
                data-inner-focus
                type="button"
                onClick={(e) => { e.stopPropagation(); handleSave(); }}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white font-semibold transition-colors flex-shrink-0"
              >
                <Check className="w-3 h-3" strokeWidth={3} />
                Save
              </button>
              {doneToggle}
            </div>
          </div>
        </div>
      ) : (
        /* Read mode */
        <div
          className="flex-1 flex items-start p-2 overflow-hidden cursor-text"
          // Clicking the writing starts writing, which is what clicking text on
          // a note means everywhere else. This is the mouse's half of the same
          // step Enter takes; without it the sidebar copy could only be edited
          // from the keyboard, since a click there never selects the card.
          //
          // A link is the exception: it belongs to LinkifiedText, which opens
          // it. The card's own click handler still runs — this adds a way in
          // rather than taking one away, so selecting and the double-click that
          // maximises both behave as they did.
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('a')) return;
            onEnterInnerFocus?.();
          }}
        >
          {text ? (
            <span style={INK}>
              <LinkifiedText
                text={text}
                onOpenIframe={setIframeUrl}
                className="line-clamp-4"
              />
            </span>
          ) : (
            <span className="italic" style={{ ...INK, opacity: 0.4 }}>空のメモ</span>
          )}
        </div>
      )}
    </div>
  );

  return <WantCardLayout content={content} />;
};

registerWantCardPlugin({
  types: ['note'],
  ContentSection: NoteContentSection,
  hideFinalResult: true,
});
