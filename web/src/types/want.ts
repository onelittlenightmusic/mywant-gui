export interface SelectModeProps {
  isSelectMode?: boolean;
  selectedWantIds?: Set<string>;
  onSelectWant?: (wantId: string) => void;
  /**
   * The other half of a canvas selection.
   *
   * Things are tiles on the same board and are ticked the same way, but they
   * are kept in their own set: the batch actions built on the want set take it
   * straight to the want API, and a thing id arriving there as a want is the
   * kind of mistake a shared set invites. What acts on both — moving the
   * selection, naming it as a constellation — takes the union on purpose.
   */
  selectedThingIds?: Set<string>;
  onSelectThing?: (thingId: string) => void;
}

export interface WantState {
  final_result?: unknown;            // Promoted to top level for convenient access
  current?: Record<string, unknown>; // Fields labeled "current" + system-reserved fields
  goal?: Record<string, unknown>;    // Fields labeled "goal"
  plan?: Record<string, unknown>;    // Fields labeled "plan"
  internal?: Record<string, unknown>; // Fields labeled "internal" (UI control inputs, not exposed)
}

export interface ExposableFieldInfo {
  name: string;
  type?: string;
  subType?: string;
}

export interface Want {
  id?: string; // Want execution ID
  metadata: WantMetadata;
  spec: WantSpec;
  status: WantExecutionStatus;
  state?: WantState; // Hierarchical state grouped by label
  state_timestamps?: Record<string, string>; // ISO timestamp per state key (last updated at)
  hidden_state?: Record<string, unknown>; // Internal framework fields
  stats?: WantStats;
  history?: WantHistory;
  results?: Record<string, unknown>;
  builder?: unknown; // ChainBuilder reference (not serialized)
  current_agent?: string; // Name of the agent currently executing for this want
  running_agents?: string[]; // Array of all currently running agent names
  hash?: string; // Hash for change detection (metadata, spec, all state fields, status)
  exposable_fields?: ExposableFieldInfo[]; // State fields marked exposable in the want type definition (backend-merged)
  /** The mirror: slots this want type asks to have filled from elsewhere.
   *  Same shape as exposable_fields, so anything that can draw one draws both. */
  importable_fields?: ExposableFieldInfo[];
}

export interface WantConfig {
  wants: WantDefinition[];
  metadata?: ConfigMetadata;
}

export interface WantDefinition {
  metadata: WantMetadata;
  spec: WantSpec;
  stats?: WantStats;
  status?: WantStatus;
}

export interface OwnerReference {
  apiVersion: string;
  kind: string;
  name: string;
  id?: string;
  controller: boolean;
  blockOwnerDeletion?: boolean;
}

export interface CorrelationEntry {
  relationID?: string; // deterministic ID: sha256(providerID:fieldName)[:12], same for both sides
  /** "relation" (want↔want data flow, the default) | "constellation" | "parameter". Absent on old servers. */
  kind?: 'relation' | 'constellation' | 'parameter';
  wantID: string;
  /** "want" (default) | "thing". When "thing", targetID is "<catalog>::<value>" and wantID is "". */
  targetKind?: 'want' | 'thing';
  /** The other end's id — equals wantID for a want target. */
  targetID?: string;
  labels: string[];
  rate: number;
  dataType?: string; // e.g. "string", "date", "array" — set by engine from provider state field type
}

export interface WantMetadata {
  id?: string;
  name: string;
  type: string;
  labels?: Record<string, string>;
  ownerReferences?: OwnerReference[];
  updatedAt?: number; // Server-managed timestamp for detecting metadata changes
  isSystemWant?: boolean; // true for system-managed wants (e.g., system-scheduler)
  orderKey?: string; // Fractional index for custom ordering (supports drag-and-drop reordering)
  correlation?: CorrelationEntry[]; // Inter-Want correlation (computed by correlationPhase, read-only)
  series?: string;  // Series ID shared across cancel+rebook cycles
  version?: number; // Version number starting at 1; increments on each rebook
}

export interface WhenSpec {
  at?: string;               // Time expression like "7am", "17:30", "midnight"
  every?: string;            // Frequency like "day", "5 minutes", "2 hours"
  fromGlobalParam?: string; // Reference to a named timer defined in parameters.yaml
}

export interface ExposeEntry {
  currentState?: string;
  param?: string;
  as?: string;
  /** Push currentState to parent's Goal-labeled state (bottom-up). */
  asGoal?: string;
  /** Write currentState directly to a named global parameter (asGlobalParam). */
  asGlobalParam?: string;
}

export interface WantSpec {
  params?: Record<string, unknown>;
  using?: Array<Record<string, string>>;
  recipe?: string;
  when?: WhenSpec[];
  resetOnRestart?: boolean; // Default true; set false to preserve state across scheduled restarts
  exposes?: ExposeEntry[];
  /** Maps global state key → internal state key. Imported fields are read-only and always reflect the current global state value. */
  imports?: Record<string, string>;
  /** State field whose value is mirrored into final_result (the want's headline
   *  output). May use dot-notation (e.g. "msg.text"). Naming a want names this
   *  source field, not the final_result blob. */
  finalResultField?: string;
}

export interface WantStats {
  created_at?: string;
  started_at?: string;
  completed_at?: string;
  execution_count?: number;
}

export interface WantStatus {
  phase: WantPhase;
  message?: string;
  error?: string;
}

export interface ConfigMetadata {
  name?: string;
  description?: string;
  version?: string;
  labels?: Record<string, string>;
}

export type WantExecutionStatus = 'created' | 'initializing' | 'reaching' | 'reaching_with_warning' | 'suspended' | 'achieved' | 'achieved_with_warning' | 'failed' | 'stopped' | 'terminated' | 'deleting' | 'config_error' | 'module_error' | 'waiting_user_action' | 'cancelled' | 'archived';

export type WantPhase = 'pending' | 'initializing' | 'reaching' | 'achieved' | 'failed' | 'stopped' | 'terminated' | 'config_error' | 'module_error' | 'waiting_user_action';

export interface WantDetails extends Want {
  execution_status?: WantExecutionStatus;
}

export interface WantResults {
  data?: Record<string, unknown>;
  metrics?: {
    duration_ms?: number;
    items_processed?: number;
    success_count?: number;
    error_count?: number;
  };
  logs?: string[];
}

/**
 * One answer a want arrived at, shaped by the engine.
 *
 * The board does not derive these. State history records every write a run
 * made — a script path, a percentage, a summary, a raw payload — and picking
 * the answer back out of those deltas means knowing which fields a run wrote
 * itself and which it merely inherited, which is exactly the knowledge the
 * engine has and a card does not. So the engine keeps them (see
 * engine/core/result_history.go) and the card only turns the pages.
 */
export interface ResultHistoryEntry {
  /** Identifies this answer — what an alert names when it announces it.
   *  Absent on answers recorded before outputs had ids. */
  id?: string;
  /** What kind of thing the answer is (song, weather, …) — a datatypes.yaml
   *  subtype, which picks its icon. Absent when the want type does not say. */
  type?: string;
  /** When this answer first appeared. */
  timestamp: string;
  /** When it was last confirmed still current — a monitor finding the same thing again. */
  lastSeen?: string;
  /**
   * What the answer is ABOUT, when it says so (an MRS check writes its own
   * `checked_at`). Days apart from `timestamp` in the case that matters: a
   * reservation found on the 5th, recorded again by a restore on the 13th.
   */
  about?: string;
  /** The want's own answer — whatever its finalResultField names. */
  result?: unknown;
  /** The rest of the answer: the fields the type publishes or keeps. */
  fields?: Record<string, unknown>;
}

export interface WantHistory {
  parameterHistory?: Array<{
    wantName: string;
    stateValue: Record<string, unknown>;
    timestamp: string;
  }>;
  stateHistory?: Array<unknown>;
  logHistory?: Array<{
    timestamp: number;
    logs: string;
  }>;
  agentHistory?: AgentExecution[]; // Complete history of agent executions for this want
  resultHistory?: ResultHistoryEntry[]; // What this want has ANSWERED, oldest first
}

export interface CreateWantRequest {
  metadata: WantMetadata;
  spec: WantSpec;
  status?: WantExecutionStatus;
  state?: Record<string, unknown>;
  history?: WantHistory;
}

/** A merge patch of a want's labels and params (PATCH /api/v1/wants/{id}):
 *  each key set, or taken away when null. */
export interface WantPatch {
  labels?: Record<string, string | null>;
  params?: Record<string, unknown>;
}

export interface UpdateWantRequest {
  metadata: WantMetadata;
  spec: WantSpec;
  status?: WantExecutionStatus;
  state?: WantState;
  history?: WantHistory;
}


export interface SuspendResumeResponse {
  message: string;
  wantId: string;
  suspended: boolean;
  timestamp: string;
}

export interface WantStatusResponse {
  id: string;
  status: WantExecutionStatus;
  suspended?: boolean;
}

export interface AgentExecution {
  execution_id: string;
  agent_name: string;
  agent_type: 'do' | 'monitor' | 'think' | string;
  timestamp: string;
  status: 'running' | 'achieved' | 'failed' | 'terminated';
  error?: string;
  activity?: string;
  execution_mode?: string;
}
/** One generated riff — an absurd wiring between a named thing and an effect
 *  toy, proposed for the interact bubble. Mirrors RiffProposal in engine/core. */
export interface RiffProposal {
  text: string;
  triggerKind: 'named' | 'source';
  triggerName: string;
  reactionType: string;
}
