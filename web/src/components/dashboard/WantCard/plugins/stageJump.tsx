import React, { useState } from 'react';
import { Want } from '@/types/want';
import { apiClient } from '@/api/client';
import { useWorldSpawnStore } from '@/stores/worldSpawnStore';
import { useInputActions } from '@/hooks/useInputActions';
import { CardActionButton } from '../CardActionButton';

/**
 * Moving the game to another stage, from a card.
 *
 * The two wants that do it are a pair — `next_stage` sits in a stage's last
 * room and goes forward, `startpoint` sits in its first room and goes back —
 * and the gesture is identical in both directions: write the stage id into
 * "pending_jump", which a monitor_mrs_agent poll (~1s) hands to rpg-server's
 * debug/jump, and warp CursorMan to where that stage's counterpart stands.
 * Only the direction and the wording differ, so only those are props.
 *
 * The canvas warp is deliberately not awaited on the jump: it fires now, the
 * game follows within about a second. Making the cursor wait for rpg-server
 * would leave the board frozen on a press that has visibly done nothing.
 */

/** State first, params second: state is what a running want can be corrected to. */
function read(want: Want, key: string): unknown {
  const state = (want.state?.current ?? {}) as Record<string, unknown>;
  const params = (want.spec?.params ?? {}) as Record<string, unknown>;
  return state[key] ?? params[key];
}

export function readStageTarget(want: Want, stageIdKey: string) {
  const raw = read(want, stageIdKey);
  return {
    stageId: typeof raw === 'string' ? raw : '',
    targetX: Number(read(want, 'target_x') ?? 0),
    targetY: Number(read(want, 'target_y') ?? 0),
  };
}


interface Props {
  want: Want;
  /** Where to send the game. Empty disables the button — there is nowhere to go. */
  stageId: string;
  /** Where to put CursorMan on this canvas, immediately. */
  targetX: number;
  targetY: number;
  label: string;
  pendingLabel: string;
  /** The picture on the button. The direction of travel, in both senses. */
  icon: React.ReactNode;
  /** True once the card has been drilled into, which is when A means this. */
  isInnerFocused?: boolean;
}

export const StageJumpButton: React.FC<Props> = ({
  want, stageId, targetX, targetY, label, pendingLabel, icon, isInnerFocused,
}) => {
  const requestSpawn = useWorldSpawnStore(s => s.requestSpawn);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled = pending || !stageId;

  // Why the game did not move, when it did not.
  //
  // The press only writes a field; the travel happens a second later, in the
  // poll, through the game's ordinary action — which can refuse ("current stage
  // is not cleared yet"). Without showing what came back, a refusal looks
  // exactly like a button that does nothing.
  const lastResult = String((want.state?.current as Record<string, unknown> | undefined)?.last_jump_result ?? '');
  const refusal = lastResult && lastResult !== 'ok' && !lastResult.startsWith('ok') ? lastResult : '';

  const trigger = async () => {
    if (disabled) return;
    const id = want.metadata?.id;
    if (!id) return;
    setPending(true);
    setError(null);
    try {
      await apiClient.updateGUIWantState(id, { pending_jump: stageId });
      requestSpawn(targetX, targetY, 'stage');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to jump');
    } finally {
      setPending(false);
    }
  };

  // A, once the card is being operated. The keyboard needs no help — Enter on a
  // focused <button> is a click — but a gamepad A is an action broadcast to
  // whoever is listening, and nothing activates the focused element on its own.
  // Not gated on sidebar focus: the copy of the card that carries the controls
  // is the one inside the detail panel, so that is exactly where this must work.
  useInputActions({
    enabled: !!isInnerFocused && !disabled,
    ignoreWhenInputFocused: false,
    ignoreWhenInSidebar: false,
    onConfirm: trigger,
  });

  return (
    <div
      className="mt-1"
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <CardActionButton
        icon={icon}
        label={label}
        pendingLabel={pendingLabel}
        pending={pending}
        disabled={disabled}
        onPress={trigger}
        isDefaultStop
      />
      {(error || refusal) && (
        <span className="ml-2 text-[0.75em] text-red-500">{error || refusal}</span>
      )}
    </div>
  );
};
