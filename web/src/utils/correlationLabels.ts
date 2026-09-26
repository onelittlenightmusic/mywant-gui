/**
 * Correlation labels that describe an actual flow of data between two wants,
 * as opposed to the looser couplings (shared metadata labels, `using` selectors,
 * sibling-of-a-common-provider) that also appear in `metadata.correlation`.
 *
 * The backend emits them as `stateAccess/<role>:<channel>/<key>`:
 *
 *   stateAccess/consumer:expose/K   the peer READS K from me   (I provide)
 *   stateAccess/provider:expose/K   the peer PROVIDES K to me  (I consume)
 *   stateAccess/consumer:param/K    same, but K travels as a global PARAMETER
 *   stateAccess/provider:param/K
 *
 * The two channels are different transports for the same idea. `expose` is a
 * field published to global state (`exposes: [{as: K}]`, read back with
 * `imports`); `param` is a field published to a named global parameter
 * (`exposes: [{asGlobalParam: K}]`, read back with `{fromGlobalParam: K}` in
 * spec.params or spec.when). Both mean the two wants are wired together, so
 * every consumer here treats them alike — this module exists so that stays true
 * without each call site repeating the prefix list.
 */

export const FLOW_CHANNELS = ['expose', 'param'] as const;
export type FlowChannel = (typeof FLOW_CHANNELS)[number];
export type FlowRole = 'consumer' | 'provider';

const FLOW_ROLES: readonly FlowRole[] = ['consumer', 'provider'];

export interface ParsedFlowLabel {
  role: FlowRole;
  channel: FlowChannel;
  /** The bare key, e.g. "arrival_time". */
  key: string;
  /** The payload as the backend stores it, e.g. "param/arrival_time". This is
   *  the form used as an edge's fieldLabel, so it stays channel-qualified and
   *  two keys of the same name on different channels never collide. */
  field: string;
}

export function parseFlowLabel(label: string): ParsedFlowLabel | null {
  for (const role of FLOW_ROLES) {
    const rolePrefix = `stateAccess/${role}:`;
    if (!label.startsWith(rolePrefix)) continue;
    const field = label.slice(rolePrefix.length);
    for (const channel of FLOW_CHANNELS) {
      if (field.startsWith(`${channel}/`)) {
        return { role, channel, key: field.slice(channel.length + 1), field };
      }
    }
  }
  return null;
}

/** True for a label that names a data flow (either channel, either direction). */
export function isFlowLabel(label: string): boolean {
  return parseFlowLabel(label) !== null;
}

/** True when `role` matches — `'consumer'` reads as "the peer consumes from me". */
export function isFlowLabelWithRole(label: string, role: FlowRole): boolean {
  return parseFlowLabel(label)?.role === role;
}

export function hasFlowLabel(labels: string[] | undefined | null): boolean {
  return (labels ?? []).some(isFlowLabel);
}

export function hasFlowLabelWithRole(labels: string[] | undefined | null, role: FlowRole): boolean {
  return (labels ?? []).some(l => isFlowLabelWithRole(l, role));
}

/** Every flow named by a label list, from that side's point of view. */
export function flowsFromLabels(labels: string[] | undefined | null): ParsedFlowLabel[] {
  return (labels ?? []).map(parseFlowLabel).filter((p): p is ParsedFlowLabel => p !== null);
}

/**
 * Is this correlation a data relation — the only kind a road is about?
 *
 * The server sends one list holding three different readings of "related"
 * (see handlers_correlation_extras): the want↔want data dependencies
 * correlationPhase computes, plus two derived on read for the jump overlay —
 * the constellation a want shares with its chain neighbours, and the things it
 * names through a parameter. They ride in `metadata.correlation` together
 * because the overlay wants one list to rank.
 *
 * Everything that DRAWS a wire has to ask this first. A road says data travels
 * from here to there; a shared constellation says a person grouped these, and
 * the board already draws that as the constellation's own line. Left unasked,
 * putting two notes in one constellation grew a road between them that nothing
 * was flowing along, on top of the line that had just been drawn.
 *
 * Absent kind means relation: servers older than the derived kinds only ever
 * sent the real ones.
 */
export function isDataRelation(corr: { kind?: string }): boolean {
  return corr.kind === undefined || corr.kind === 'relation';
}
