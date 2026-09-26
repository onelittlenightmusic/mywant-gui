import { useEffect, useRef } from 'react';
import { useWantStore } from '@/stores/wantStore';
import { playSound } from '@/utils/sounds';

/**
 * Ring when a coding agent hands the turn back.
 *
 * An agent run is long and mostly silent, and the moment that matters to a
 * person is the one moment they cannot see coming: the agent stops, and it is
 * their turn again — whether it finished, or paused to ask something. Watching
 * for that means watching the screen, which is precisely what having an agent
 * was supposed to save. So the screen says it out loud instead.
 *
 * The signal is the session state the engine already derives from the
 * transcript (current_session_state, see agent_claude_code.go): waiting_for_input
 * means the assistant yielded the turn. Deriving it here from message counts
 * would be a second, worse copy of that rule — the engine is reading stop_reason
 * off the transcript, which is the only thing that actually knows.
 *
 * Rings on the TRANSITION into that state, never on first sight of it: a page
 * load, a reconnect or a want arriving in the store would otherwise ring for a
 * turn that was handed back an hour ago.
 */

/** Want types whose state is a coding-agent session. */
const AGENT_TYPES = new Set(['robot', 'coding', 'claude_code_thread']);

/** The state that means "your turn" — the engine's word, not ours. */
const YIELDED = 'waiting_for_input';

/**
 * Silence after a ring, per want. The classifier reads whatever line is last in
 * the transcript, and a run that writes its lines out of order can show a
 * yielded turn for one poll before carrying on. One bell for that is a glance
 * at the screen; a bell every poll is a reason to turn the sound off.
 */
const REARM_MS = 30_000;

export function useCodingAgentRing(): void {
  // Per want: the last state seen, and when we last rang for it.
  const seen = useRef(new Map<string, string>());
  const rangAt = useRef(new Map<string, number>());

  useEffect(() => {
    const check = (wants: ReturnType<typeof useWantStore.getState>['wants']) => {
      for (const w of wants) {
        const type = w.metadata?.type ?? '';
        if (!AGENT_TYPES.has(type)) continue;
        const id = w.metadata?.id || w.id;
        if (!id) continue;

        const state = (w.state?.current as Record<string, unknown> | undefined)
          ?.current_session_state as string | undefined;
        if (!state) continue;

        const prev = seen.current.get(id);
        seen.current.set(id, state);
        // First sight of this want: remember where it stands, say nothing.
        if (prev === undefined || prev === state) continue;
        if (state !== YIELDED) continue;

        const now = Date.now();
        if (now - (rangAt.current.get(id) ?? 0) < REARM_MS) continue;
        rangAt.current.set(id, now);
        playSound('ring');
      }
    };

    check(useWantStore.getState().wants);
    return useWantStore.subscribe(s => check(s.wants));
  }, []);
}
