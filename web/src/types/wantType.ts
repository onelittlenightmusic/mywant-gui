// Want Type Definitions from Backend API

export interface WantTypeMetadata {
  name: string;
  title: string;
  description: string;
  version: string;
  category: string;
  pattern: 'generator' | 'processor' | 'sink' | 'coordinator' | 'independent';
  system_type?: boolean; // If true, hide from user-facing want type selector
  /** Declarations that belong to the type rather than to one parameter — e.g.
   *  `seed-param`, naming the parameter a thing-seeded value should fill. */
  labels?: Record<string, string>;
}

export interface ParameterDef {
  name: string;
  description: string;
  type: string;
  label?: string;
  default?: unknown;
  defaultGlobalParameter?: string;
  defaultGlobalParameterFrom?: string;
  required: boolean;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: unknown[];
  };
  example?: unknown;
  subType?: string;
  /** Further subtypes this parameter takes, without changing what a value
   *  entered here is recorded as — see want-spec's ParameterDef.Accepts.
   *  subType is always accepted and is not repeated here. */
  accepts?: string[];
  recordThing?: boolean;
  /** What recordThing was called. Still sent by want types not yet updated. */
  recordMemo?: boolean;
  /** What the parameter is called on screen when its name, an ASCII
   *  identifier, is not what anybody would call it. */
  title?: string;
  /** A picture drawn behind the parameter's card (URL or data: URL) — a web
   *  want's saved object as it looked on its page. */
  backgroundImage?: string;
}

export interface StateDef {
  name: string;
  description: string;
  type: string;
  subType?: string;
  persistent: boolean;
  example?: unknown;
  exposable?: boolean;
}

export interface ChannelDef {
  name: string;
  type: string;
  description: string;
  required?: boolean;
  multiple?: boolean;
}

export interface ConnectivityDef {
  inputs: ChannelDef[];
  outputs: ChannelDef[];
}

export interface ConnectionSpec {
  name: string;
  type: string;
  description: string;
  required?: boolean;
  multiple?: boolean;
}

export interface RequireSpec {
  type: 'none' | 'providers' | 'users' | 'providers_and_users';
  providers?: ConnectionSpec[];
  users?: ConnectionSpec[];
}

export interface AgentDef {
  name: string;
  role: 'monitor' | 'action' | 'validator' | 'transformer';
  description: string;
  example?: string;
}

export interface ConstraintDef {
  description: string;
  validation: string;
}

export interface WantMetadata {
  name: string;
  type: string;
  labels: Record<string, string>;
}

export interface ExposeEntry {
  currentState?: string;
  param?: string;
  as?: string;
}

export interface WantSpec {
  params: Record<string, unknown>;
  using?: Array<Record<string, string>>;
  exposes?: ExposeEntry[];
  imports?: Record<string, string>;
}

export interface WantConfiguration {
  metadata: WantMetadata;
  spec: WantSpec;
}

export interface ExampleDef {
  name: string;
  description: string;
  want: WantConfiguration;
  expectedBehavior: string;
}

export interface WantTypeDefinition {
  metadata: WantTypeMetadata;
  parameters: ParameterDef[];
  state: StateDef[];
  connectivity: ConnectivityDef;
  require?: RequireSpec;
  agents: AgentDef[];
  constraints: ConstraintDef[];
  examples: ExampleDef[];
  relatedTypes?: string[];
  seeAlso?: string[];
}

// API Response Types
export interface WantTypeListItem {
  name: string;
  title: string;
  category: string;
  pattern: string;
  version: string;
  system_type?: boolean; // If true, hide from user-facing want type selector
  labels?: Record<string, string>; // metadata.labels from want type definition
  /** Distinct non-empty parameter subtypes (for thing-seeded Add Want filtering). */
  paramSubtypes?: string[];
  /**
   * The same subtypes with their parameters kept apart — one entry per
   * parameter that takes a subtype, holding everything that parameter accepts.
   *
   * paramSubtypes is a set and so cannot say how MANY of a subtype a type has
   * room for, which is the whole question when several things are seeded at
   * once: transit has two station slots, a weather lookup has one.
   */
  paramSlots?: string[][];
  /**
   * Which of those slots takes a LIST of values rather than one, index for
   * index. A route takes a start, an end, and any number of stops between
   * them; counted as three slots it would refuse a fourth place.
   */
  paramSlotIsList?: boolean[];
}

export interface WantTypeListResponse {
  count: number;
  wantTypes: WantTypeListItem[];
}

export interface WantTypeDetailResponse {
  metadata: WantTypeMetadata;
  parameters: ParameterDef[];
  state: StateDef[];
  connectivity: ConnectivityDef;
  require?: RequireSpec;
  agents: AgentDef[];
  constraints: ConstraintDef[];
  examples: ExampleDef[];
  relatedTypes?: string[];
  seeAlso?: string[];
}

export interface WantTypeExamplesResponse {
  name: string;
  examples: ExampleDef[];
}

// Labels API Response Type
export interface LabelsResponse {
  labelKeys: string[];
  labelValues: Record<string, string[]>; // Map of key -> array of values
  count: number;
}

// Store state type
export interface WantTypeState {
  wantTypes: WantTypeListItem[];
  selectedWantType: WantTypeDefinition | null;
  loading: boolean;
  error: string | null;
}

// Filter types
export interface WantTypeFilters {
  category?: string;
  pattern?: string;
  searchTerm?: string;
}
