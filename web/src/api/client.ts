import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  Want,
  WantDetails,
  WantResults,
  CreateWantRequest,
  UpdateWantRequest,
  SuspendResumeResponse,
  WantStatusResponse,
  RiffProposal
} from '@/types/want';
import { HealthCheck, ApiError, ErrorHistoryEntry, ErrorHistoryResponse, LogsResponse } from '@/types/api';
import { Constellation, ConstellationKind } from '@/types/constellation';
import {
  AgentResponse,
  CreateAgentRequest,
  CapabilityResponse,
  CreateCapabilityRequest,
  AgentsListResponse,
  CapabilitiesListResponse,
  FindAgentsByCapabilityResponse
} from '@/types/agent';
import {
  GenericRecipe,
  RecipeListResponse,
  RecipeCreateResponse,
  RecipeUpdateResponse,
  RecipeMetadata,
  StateDef,
  WantRecipeAnalysis,
} from '@/types/recipe';
import {
  WantTypeListResponse,
  WantTypeDetailResponse,
  WantTypeExamplesResponse,
  LabelsResponse,
} from '@/types/wantType';
import { WorldSummary, OpenWorldResponse } from '@/types/world';
import {
  InteractSession,
  InteractMessageRequest,
  InteractMessageResponse,
  InteractDeployRequest,
  InteractDeployResponse,
} from '@/types/interact';
import {
  CreateDraftWantData,
  UpdateDraftWantData,
  DRAFT_WANT_LABEL,
} from '@/types/draft';
import { ServerConfig } from '@/types/config';
import { ThingEvent, ThingStats, ThingFull } from '@/types/thing';
import {
  Achievement, AchievementListResponse, CreateAchievementRequest,
  AchievementRule, AchievementRuleListResponse, CreateRuleRequest,
} from '@/types/achievement';
import { Character, CharacterDisplay, CharacterListResponse, RemoteCursor } from '@/types/character';
import { KataListResponse, KataRecord, LiveKataResponse } from '@/types/kata';
import { CANVAS_LABEL_X, CANVAS_LABEL_Y, isSystemWant } from '@/utils/wantPlacement';
import { Cell, knownCursorManCell } from '@/utils/cursorManCell';

export interface WantHashEntry {
  id: string;
  hash: string;
  updated_at: number;
}

export interface WantHashesResponse {
  collection_hash: string;
  wants: WantHashEntry[];
}

/** A single robot cursor command recorded by the backend */
export interface RobotLogEntry {
  id: string;
  timestamp: string;
  message: string;
  target_type: string;
  target_id: string;
  action: string;
  action_payload: string;
  nav_route: string;
  nonce: number;
  sidebar_open: boolean;
  sidebar_want_id: string;
  sidebar_tab: string;
  settings_subtab: string;
}

/** One notice the GUI spoke through the robot's bubble — see robotStore.notify.
 *  Unlike RobotLogEntry (a command issued from the CLI), a notice is raised by
 *  the browser about its own state, then posted to the server so the Logs page
 *  shows what users on any device were told. */
export interface NotificationEntry {
  id: string;
  at: string;
  message: string;
  targetType?: string;
  targetId?: string;
  route?: string;
  characterId?: string;
}

/** A value the server suggests for one parameter of a not-yet-created want. */
export interface ParamRecommendation {
  paramName: string;
  value: unknown;
  score: number;
  /** "thing" for a remembered value, otherwise the want holding it now. */
  sourceName: string;
  /** Set when the value comes from a deployed want. Applying it wires the two
   *  together (expose + import) instead of copying the value, so the new want
   *  follows the old one when it moves. */
  sourceId?: string;
  /** The provider's want type — draws its icon, since several wants can offer
   *  the same field name. */
  sourceType?: string;
  /** The field to connect from. Naming it is what asks the server to wire the
   *  two rather than copy a value; how they get wired is the server's call. */
  sourceField?: string;
}

interface RawFieldMatchRec {
  score?: number;
  source?: { want_name?: string; want_id?: string; want_type?: string; field_name?: string; current_value?: unknown };
  param_change: { param_name: string; value: unknown };
}

class MyWantApiClient {
  private client: AxiosInstance;
  private pendingRequests: Map<string, Promise<any>> = new Map();

  constructor(baseURL: string = '') {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const isPollingUrl = (url?: string) =>
      url?.includes('/api/v1/gui/state') || url?.includes('/api/v1/wants/hashes');

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        if (!isPollingUrl(config.url))
          console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        if (!isPollingUrl(response.config.url))
          console.log(`API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error: AxiosError) => {
        const apiError: ApiError = {
          message: error.message || 'An error occurred',
          status: error.response?.status || 500,
          code: error.code,
        };

        // Handle specific Axios error codes
        if (error.code === 'ECONNABORTED') {
          apiError.message = 'Request timed out or was aborted. The server might be slow or restarting.';
        } else if (error.code === 'ERR_NETWORK') {
          apiError.message = 'Network error. Please check if the server is running.';
        }

        // Handle string error responses (from our Go server)
        if (error.response?.data && typeof error.response.data === 'string') {
          apiError.message = error.response.data;
        }
        // Handle object error responses
        else if (error.response?.data && typeof error.response.data === 'object') {
          const data = error.response.data as any;
          apiError.message = data.message || data.error || error.message;
        }

        // Specifically handle validation errors from want type validation
        if (error.response?.status === 400 && apiError.message.includes('Invalid want types:')) {
          // Extract the detailed error message for better formatting
          apiError.type = 'validation';
          apiError.details = apiError.message.replace('Invalid want types: ', '');
        }

        // 削除直後の want に対する GET（ポーリングやサイドバーの再取得が
        // DELETE と競合したとき）は必ず 404 になる。想定内のレースなので
        // コンソールにエラーを出さず、呼び出し側の 404 ハンドリングに任せる。
        const isDeletedWantRace =
          apiError.status === 404 &&
          error.config?.method?.toLowerCase() === 'get' &&
          /\/api\/v1\/wants\/[^/]+(\/(status|results))?$/.test(error.config?.url ?? '');

        if (!isDeletedWantRace) console.error('API Error:', apiError);
        return Promise.reject(apiError);
      }
    );
  }

  // Helper method for deduplicating GET requests
  /**
   * ETag-conditional GET helper used by all *Conditional methods.
   *
   * - By default (rawETag = false): wraps ifNoneMatch in quotes when sending and
   *   strips quotes from the response ETag — used for content-hash ETags.
   * - rawETag = true: passes ifNoneMatch verbatim and returns the raw ETag string —
   *   used for sequence-number ETags (gui/state).
   */
  private async conditionalGet<T>(
    url: string,
    ifNoneMatch?: string,
    opts: { rawETag?: boolean; extraHeaders?: Record<string, string> } = {},
  ): Promise<{ data: T | null; etag: string | undefined }> {
    const headers: Record<string, string> = { ...(opts.extraHeaders ?? {}) };
    if (ifNoneMatch) {
      headers['If-None-Match'] = opts.rawETag ? ifNoneMatch : `"${ifNoneMatch}"`;
    }
    const response = await this.client.get<T>(url, {
      headers,
      validateStatus: (s) => s === 200 || s === 304,
    });
    const rawEtag = response.headers['etag'] as string | undefined;
    const etag = opts.rawETag ? rawEtag : rawEtag?.replace(/^"|"$/g, '');
    if (response.status === 304) return { data: null, etag };
    return { data: response.data ?? null, etag };
  }

  private async deduplicatedGet<T>(url: string): Promise<T> {
    const key = `GET:${url}`;

    // If request is already pending, return the existing promise
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key) as Promise<T>;
    }

    // Create new request and store it
    const promise = (async () => {
      try {
        const response = await this.client.get<T>(url);
        return response.data;
      } finally {
        // Clean up pending request after completion (success or error)
        this.pendingRequests.delete(key);
      }
    })();

    this.pendingRequests.set(key, promise);
    return promise;
  }

  // Health check
  async healthCheck(): Promise<HealthCheck> {
    return this.deduplicatedGet<HealthCheck>('/health');
  }

  // Config management
  async getServerConfig(): Promise<ServerConfig> {
    return this.deduplicatedGet<ServerConfig>('/api/v1/config');
  }

  /**
   * Partial update — only the keys you pass change; everything else keeps its
   * current server-side value.
   *
   * There is deliberately no PUT wrapper here. The endpoint still supports it,
   * but a full replace means any field the caller omits gets reset, which for
   * settings edits is never what you want.
   */
  async patchServerConfig(updates: Partial<ServerConfig>): Promise<ServerConfig> {
    const response = await this.client.patch<ServerConfig>('/api/v1/config', updates);
    return response.data;
  }

  async uploadCanvasBg(file: File): Promise<ServerConfig> {
    const form = new FormData();
    form.append('image', file);
    const response = await this.client.post<ServerConfig>('/api/v1/config/canvas-bg', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async deleteCanvasBg(): Promise<ServerConfig> {
    const response = await this.client.delete<ServerConfig>('/api/v1/config/canvas-bg');
    return response.data;
  }

  async stopServer(): Promise<{ message: string }> {
    const response = await this.client.post<{ message: string }>('/api/v1/system/stop');
    return response.data;
  }

  async restartServer(): Promise<{ message: string }> {
    const response = await this.client.post<{ message: string }>('/api/v1/system/restart');
    return response.data;
  }

  // Want management
  async createWant(request: CreateWantRequest): Promise<Want> {
    // Stamp the owning character (the viewer's selected character) so the canvas
    // can render this want's tile with that character's chosen design. Read from
    // localStorage (not the character store) to avoid an import cycle; the key
    // matches characterStore's MY_CHAR_KEY. Labels round-trip & persist via the
    // backend, so no server change is needed to carry ownership.
    const ownerCharacterId = (typeof localStorage !== 'undefined' && localStorage.getItem('mywant_my_character_id')) || '';
    const labels: Record<string, string> = { ...request.metadata.labels };
    if (ownerCharacterId) labels['mywant.io/owner-character'] = ownerCharacterId;
    // Where it lands: on my character, whichever path added it (see
    // cursorManCell.ts). A want that names its own cell (a drop on the board)
    // keeps it; a child sits inside its parent and a system want is not placed.
    const placed = labels[CANVAS_LABEL_X] !== undefined || labels[CANVAS_LABEL_Y] !== undefined;
    if (!placed && !request.metadata.ownerReferences?.length && !isSystemWant(request)) {
      const cell = knownCursorManCell() ?? await this.savedCursorManCell(ownerCharacterId);
      if (cell) {
        labels[CANVAS_LABEL_X] = String(cell.x);
        labels[CANVAS_LABEL_Y] = String(cell.y);
      }
    }
    const stamped = { ...request, metadata: { ...request.metadata, labels } };
    const response = await this.client.post<Want>('/api/v1/wants', stamped);
    return response.data;
  }

  /** The CursorMan cell the dashboard last saved to gui_state (useGuiStateSync's
   *  canvas_cursor_x_<id>) — for a want added before the dashboard was opened
   *  in this tab. Null if there is none, and never an error. */
  private async savedCursorManCell(characterId: string): Promise<Cell | null> {
    try {
      const { state } = await this.getGUIState();
      const suffix = characterId ? `_${characterId}` : '';
      const x = state[`canvas_cursor_x${suffix}`];
      const y = state[`canvas_cursor_y${suffix}`];
      return typeof x === 'number' && typeof y === 'number' ? { x: Math.round(x), y: Math.round(y) } : null;
    } catch {
      return null;
    }
  }

  async listWants(options?: { includeCancelled?: boolean; series?: string }): Promise<Want[]> {
    const q = new URLSearchParams();
    if (options?.includeCancelled) q.set('includeCancelled', 'true');
    // Only the versions of one want — see handlers_wants.go's listWants.
    if (options?.series) q.set('series', options.series);
    const url = q.toString() ? `/api/v1/wants?${q}` : '/api/v1/wants';
    const data = await this.deduplicatedGet<{wants: Want[], execution_id: string, timestamp: string}>(url);
    return data.wants;
  }

  /** Fetch generated riff proposals — absurd wirings between named things and
   *  effect toys. n caps how many; omit seed to get fresh ones each call. */
  async getRiffs(n = 5): Promise<RiffProposal[]> {
    const data = await this.client.get<{ proposals: RiffProposal[] }>(`/api/v1/riff?n=${n}`);
    return data.data.proposals ?? [];
  }

  /** Deploy a riff proposal's reaction want straight from its structure — no
   *  prose, no LLM round-trip. Returns the created want's id and name. */
  async deployRiff(p: RiffProposal): Promise<{ wantId: string; name: string; text: string }> {
    const data = await this.client.post<{ wantId: string; name: string; text: string }>('/api/v1/riff/deploy', p);
    return data.data;
  }

  /**
   * Fetch only ID+hash for each want. Returns null when If-None-Match matches (304 Not Modified).
   */
  async listWantHashes(ifNoneMatch?: string): Promise<WantHashesResponse | null> {
    const headers: Record<string, string> = {};
    if (ifNoneMatch) headers['If-None-Match'] = `"${ifNoneMatch}"`;

    const response = await this.client.get<WantHashesResponse>('/api/v1/wants/hashes', {
      headers,
      validateStatus: (s) => s === 200 || s === 304,
    });

    if (response.status === 304) return null;
    return response.data;
  }

  /** Fetch a single want with ETag-based conditional GET. Returns null data on 304. */
  async getWantConditional(id: string, ifNoneMatch?: string): Promise<{ data: Want | null; etag: string | undefined }> {
    return this.conditionalGet<Want>(`/api/v1/wants/${id}`, ifNoneMatch);
  }

  async getWant(id: string): Promise<WantDetails> {
    return this.deduplicatedGet<WantDetails>(`/api/v1/wants/${id}`);
  }

  async updateWant(id: string, request: UpdateWantRequest): Promise<Want> {
    const response = await this.client.put<Want>(`/api/v1/wants/${id}`, request);
    return response.data;
  }

  async updateWantOrder(
    id: string,
    request: { previousWantId?: string; nextWantId?: string }
  ): Promise<{ success: boolean; orderKey: string; wantId: string }> {
    const response = await this.client.put(`/api/v1/wants/${id}/order`, request);
    return response.data;
  }

  async deleteWant(id: string): Promise<void> {
    await this.client.delete(`/api/v1/wants/${id}`);
  }

  async deleteWants(ids: string[]): Promise<void> {
    await this.client.delete('/api/v1/wants', { data: { ids } });
  }

  async getWantStatus(id: string): Promise<WantStatusResponse> {
    return this.deduplicatedGet<WantStatusResponse>(`/api/v1/wants/${id}/status`);
  }

  async getWantResults(id: string): Promise<WantResults> {
    return this.deduplicatedGet<WantResults>(`/api/v1/wants/${id}/results`);
  }

  // Suspend/Resume/Stop/Start operations
  async suspendWant(id: string): Promise<SuspendResumeResponse> {
    const response = await this.client.post<SuspendResumeResponse>(`/api/v1/wants/${id}/suspend`);
    return response.data;
  }

  async resumeWant(id: string): Promise<SuspendResumeResponse> {
    const response = await this.client.post<SuspendResumeResponse>(`/api/v1/wants/${id}/resume`);
    return response.data;
  }

  async stopWant(id: string): Promise<SuspendResumeResponse> {
    const response = await this.client.post<SuspendResumeResponse>(`/api/v1/wants/${id}/stop`);
    return response.data;
  }

  async startWant(id: string): Promise<SuspendResumeResponse> {
    const response = await this.client.post<SuspendResumeResponse>(`/api/v1/wants/${id}/start`);
    return response.data;
  }

  async suspendWants(ids: string[]): Promise<void> {
    await this.client.post('/api/v1/wants/suspend', { ids });
  }

  async resumeWants(ids: string[]): Promise<void> {
    await this.client.post('/api/v1/wants/resume', { ids });
  }

  /** What needs a person across everything running, and where it is (the control pill's attention button). */
  async getAttention(): Promise<AttentionItem[]> {
    const response = await this.client.get<{ items: AttentionItem[] }>('/api/v1/attention');
    return response.data.items ?? [];
  }

  /** Whether every want is held by the global pause (the control pill's stop). */
  async getSystemPause(): Promise<{ paused: boolean }> {
    const response = await this.client.get<{ paused: boolean }>('/api/v1/system/pause');
    return response.data;
  }

  async setSystemPause(paused: boolean): Promise<{ paused: boolean }> {
    const response = await this.client.put<{ paused: boolean }>('/api/v1/system/pause', { paused });
    return response.data;
  }

  async stopWants(ids: string[]): Promise<void> {
    await this.client.post('/api/v1/wants/stop', { ids });
  }

  async startWants(ids: string[]): Promise<void> {
    await this.client.post('/api/v1/wants/start', { ids });
  }

  // Error history operations
  async listErrorHistory(): Promise<ErrorHistoryResponse> {
    return this.deduplicatedGet<ErrorHistoryResponse>('/api/v1/errors');
  }

  async getErrorHistoryEntry(id: string): Promise<ErrorHistoryEntry> {
    return this.deduplicatedGet<ErrorHistoryEntry>(`/api/v1/errors/${id}`);
  }

  async updateErrorHistoryEntry(id: string, updates: { resolved?: boolean; notes?: string }): Promise<ErrorHistoryEntry> {
    const response = await this.client.put<ErrorHistoryEntry>(`/api/v1/errors/${id}`, updates);
    return response.data;
  }

  async deleteErrorHistoryEntry(id: string): Promise<void> {
    await this.client.delete(`/api/v1/errors/${id}`);
  }

  // API logs operations
  async listLogs(): Promise<LogsResponse> {
    return this.deduplicatedGet<LogsResponse>('/api/v1/logs');
  }

  async clearLogs(): Promise<void> {
    await this.client.delete('/api/v1/logs');
  }

  // Agent management
  async createAgent(request: CreateAgentRequest): Promise<AgentResponse> {
    const response = await this.client.post<AgentResponse>('/api/v1/agents', request);
    return response.data;
  }

  async listAgents(): Promise<AgentResponse[]> {
    const data = await this.deduplicatedGet<AgentsListResponse>('/api/v1/agents');
    return data.agents;
  }

  async getAgent(name: string): Promise<AgentResponse> {
    return this.deduplicatedGet<AgentResponse>(`/api/v1/agents/${name}`);
  }

  async deleteAgent(name: string): Promise<void> {
    await this.client.delete(`/api/v1/agents/${name}`);
  }

  // Capability management
  async createCapability(request: CreateCapabilityRequest): Promise<CapabilityResponse> {
    const response = await this.client.post<CapabilityResponse>('/api/v1/capabilities', request);
    return response.data;
  }

  async listCapabilities(): Promise<CapabilityResponse[]> {
    const data = await this.deduplicatedGet<CapabilitiesListResponse>('/api/v1/capabilities');
    return data.capabilities;
  }

  async getCapability(name: string): Promise<CapabilityResponse> {
    return this.deduplicatedGet<CapabilityResponse>(`/api/v1/capabilities/${name}`);
  }

  async deleteCapability(name: string): Promise<void> {
    await this.client.delete(`/api/v1/capabilities/${name}`);
  }

  async findAgentsByCapability(capabilityName: string): Promise<FindAgentsByCapabilityResponse> {
    return this.deduplicatedGet<FindAgentsByCapabilityResponse>(`/api/v1/capabilities/${capabilityName}/agents`);
  }

  // Recipe management
  async createRecipe(recipe: GenericRecipe): Promise<RecipeCreateResponse> {
    const response = await this.client.post<RecipeCreateResponse>('/api/v1/recipes', recipe);
    return response.data;
  }

  async listRecipes(): Promise<RecipeListResponse> {
    return this.deduplicatedGet<RecipeListResponse>('/api/v1/recipes');
  }

  async getRecipe(id: string): Promise<GenericRecipe> {
    return this.deduplicatedGet<GenericRecipe>(`/api/v1/recipes/${id}`);
  }

  async updateRecipe(id: string, recipe: GenericRecipe): Promise<RecipeUpdateResponse> {
    const response = await this.client.put<RecipeUpdateResponse>(`/api/v1/recipes/${id}`, recipe);
    return response.data;
  }

  async deleteRecipe(id: string): Promise<void> {
    await this.client.delete(`/api/v1/recipes/${id}`);
  }

  async analyzeWantForRecipe(wantId: string): Promise<WantRecipeAnalysis> {
    return this.deduplicatedGet<WantRecipeAnalysis>(`/api/v1/wants/${wantId}/recipe-analysis`);
  }

  async saveRecipeFromWant(wantId: string, metadata: RecipeMetadata, state?: StateDef[]): Promise<{id: string, message: string, file: string, wants: number}> {
    const response = await this.client.post('/api/v1/recipes/from-want', { wantId, metadata, state });
    return response.data;
  }

  // World management — named snapshots of the whole want set
  async listWorlds(): Promise<WorldSummary[]> {
    return this.deduplicatedGet<WorldSummary[]>('/api/v1/worlds');
  }

  /**
   * URL of a world's canvas screenshot. `thumbnailAt` (WorldSummary.thumbnail_at)
   * busts the cache when a newer capture is uploaded; pass undefined to get the
   * uncached URL. Returns null when the world has no screenshot yet.
   */
  worldThumbnailUrl(name: string, thumbnailAt?: string): string | null {
    if (!thumbnailAt) return null;
    return `/api/v1/worlds/${encodeURIComponent(name)}/thumbnail?t=${encodeURIComponent(thumbnailAt)}`;
  }

  /** Store a PNG screenshot of the want canvas as the world's thumbnail. */
  async uploadWorldThumbnail(name: string, image: Blob): Promise<{ name: string; thumbnail_at: string }> {
    const form = new FormData();
    form.append('image', image, `${name}.png`);
    const response = await this.client.post<{ name: string; thumbnail_at: string }>(
      `/api/v1/worlds/${encodeURIComponent(name)}/thumbnail`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data;
  }

  async openWorld(name: string): Promise<OpenWorldResponse> {
    const response = await this.client.post<OpenWorldResponse>(`/api/v1/worlds/${encodeURIComponent(name)}/open`);
    return response.data;
  }

  /** Download a world's snapshot YAML. The current world is snapshotted first. */
  async exportWorld(name: string): Promise<{ blob: Blob; filename: string }> {
    const response = await this.client.get(`/api/v1/worlds/${encodeURIComponent(name)}/export`, {
      responseType: 'blob',
    });
    const disposition = response.headers['content-disposition'] as string | undefined;
    const match = disposition?.match(/filename="?([^";\n]+)"?/);
    return { blob: response.data as Blob, filename: match?.[1] ?? `${name}.yaml` };
  }

  /**
   * Store an uploaded world as a new one without opening it. Rejects with a 409
   * when a world of that name exists unless `overwrite` is set.
   *
   * Takes either shape the server accepts: a world exported by this version,
   * which carries its things alongside its wants, or a bare list of wants —
   * what older exports and hand-written world files look like. A wants-only
   * upload says nothing about things, and overwriting with one leaves the
   * world's existing things where they are.
   */
  async importWorld(name: string, yaml: string, overwrite = false): Promise<{ name: string; want_count: number; thing_count: number }> {
    const response = await this.client.post<{ name: string; want_count: number; thing_count: number }>(
      `/api/v1/worlds/${encodeURIComponent(name)}/import${overwrite ? '?overwrite=true' : ''}`,
      yaml,
      { headers: { 'Content-Type': 'application/yaml' } },
    );
    return response.data;
  }

  // Want Type management
  async listWantTypes(category?: string, pattern?: string): Promise<WantTypeListResponse> {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (pattern) params.append('pattern', pattern);
    const url = `/api/v1/want-types${params.toString() ? `?${params.toString()}` : ''}`;
    return this.deduplicatedGet<WantTypeListResponse>(url);
  }

  async getWantType(name: string): Promise<WantTypeDetailResponse> {
    return this.deduplicatedGet<WantTypeDetailResponse>(`/api/v1/want-types/${name}`);
  }

  async getWantTypeExamples(name: string): Promise<WantTypeExamplesResponse> {
    return this.deduplicatedGet<WantTypeExamplesResponse>(`/api/v1/want-types/${name}/examples`);
  }

  async getLabels(): Promise<LabelsResponse> {
    return this.deduplicatedGet<LabelsResponse>('/api/v1/labels');
  }

  // Interactive want creation
  async createInteractSession(): Promise<InteractSession> {
    const response = await this.client.post('/api/v1/interact');
    return response.data;
  }

  async sendInteractMessage(
    sessionId: string,
    request: InteractMessageRequest
  ): Promise<InteractMessageResponse> {
    // Set timeout to 300s for Goose processing
    const response = await this.client.post(
      `/api/v1/interact/${sessionId}`,
      request,
      { timeout: 300000 }  // 5 minutes
    );
    return response.data;
  }

  async deployRecommendation(
    sessionId: string,
    request: InteractDeployRequest
  ): Promise<InteractDeployResponse> {
    const response = await this.client.post(
      `/api/v1/interact/${sessionId}/deploy`,
      request
    );
    return response.data;
  }

  async deleteInteractSession(sessionId: string): Promise<void> {
    await this.client.delete(`/api/v1/interact/${sessionId}`);
  }

  // Draft want management
  // Draft wants are regular wants with special labels, stored in backend for persistence

  async createDraftWant(data: CreateDraftWantData): Promise<{ id: string; execution_id: string }> {
    const draftId = `draft-${Date.now()}`;
    const want = {
      metadata: {
        id: draftId,
        name: `Draft: ${data.message.substring(0, 30)}${data.message.length > 30 ? '...' : ''}`,
        type: 'draft',
        labels: {
          [DRAFT_WANT_LABEL]: 'true',
        },
      },
      spec: {
        params: {},
      },
      state: {
        sessionId: data.sessionId,
        message: data.message,
        recommendations: data.recommendations || [],
        isThinking: data.isThinking ?? true,
        error: data.error,
        createdAt: new Date().toISOString(),
      },
    };

    const response = await this.client.post('/api/v1/wants', want);
    // Return the actual want ID we created, and the backend's execution ID
    return {
      id: draftId,
      execution_id: response.data.id
    };
  }

  async updateDraftWant(id: string, updates: UpdateDraftWantData): Promise<Want> {
    // First get the current want
    const current = await this.getWant(id);

    // Merge updates into state.current
    const updatedWant: UpdateWantRequest = {
      metadata: current.metadata,
      spec: current.spec,
      status: current.status,
      state: {
        ...current.state,
        current: {
          ...(current.state?.current || {}),
          ...updates,
        },
      },
      history: current.history,
    };

    const response = await this.client.put<Want>(`/api/v1/wants/${id}`, updatedWant);
    return response.data;
  }

  async deleteDraftWant(id: string): Promise<void> {
    await this.client.delete(`/api/v1/wants/${id}`);
  }

  // Thing (Global State)
  async getGlobalState(): Promise<{ state: Record<string, unknown>; timestamp: string }> {
    return this.deduplicatedGet<{ state: Record<string, unknown>; timestamp: string }>('/api/v1/global-state');
  }

  async getGlobalStateConditional(ifNoneMatch?: string): Promise<{ data: { state: Record<string, unknown>; timestamp: string } | null; etag: string | undefined }> {
    return this.conditionalGet<{ state: Record<string, unknown>; timestamp: string }>('/api/v1/global-state', ifNoneMatch);
  }

  async deleteGlobalState(): Promise<void> {
    await this.client.delete('/api/v1/global-state');
  }

  // Want State (cross-want state access)
  async clearWantState(id: string): Promise<void> {
    await this.client.delete(`/api/v1/states/${id}`);
  }

  async deleteWantStateKey(id: string, key: string): Promise<void> {
    await this.client.delete(`/api/v1/states/${id}/${encodeURIComponent(key)}`);
  }

  // Webhook messaging
  async sendWebhookMessage(wantName: string, text: string, sender?: string): Promise<{ status: string }> {
    const response = await this.client.post<{ status: string }>(
      `/api/v1/webhooks/${wantName}`,
      { text, sender: sender ?? 'user' }
    );
    return response.data;
  }

  /** Stops the turn the agent is in the middle of.
   *
   *  Not `/stop`, which stops the want itself — this is about the conversation
   *  inside it. The reply says whether anything was actually in flight:
   *  pressing stop on a turn that has just finished is a normal thing to do,
   *  since the screen is always a poll or two behind. */
  async interruptChat(wantId: string): Promise<{ stopped: boolean; message?: string }> {
    const response = await this.client.post<{ stopped: boolean; message?: string }>(
      `/api/v1/wants/${wantId}/chat/interrupt`
    );
    return response.data;
  }

  /** Makes the agent forget the conversation it is holding.
   *
   *  What it forgets is its own transcript — what it can refer back to. The
   *  messages on screen are the want's state and stay: the person asked the
   *  robot to forget, not to erase what they said. Refused with 409 while a
   *  turn is running, because the session is in use — stop it first. */
  async clearChatSession(wantId: string): Promise<{ cleared: boolean }> {
    const response = await this.client.delete<{ cleared: boolean }>(
      `/api/v1/wants/${wantId}/chat/session`
    );
    return response.data;
  }

  // Global Parameters
  async getGlobalParameters(): Promise<{ parameters: Record<string, unknown>; count: number; types: Record<string, string[]>; definitions?: import('@/types/wantType').ParameterDef[] }> {
    return this.deduplicatedGet<{ parameters: Record<string, unknown>; count: number; types: Record<string, string[]>; definitions?: import('@/types/wantType').ParameterDef[] }>('/api/v1/global-parameters');
  }

  async getGlobalParametersConditional(ifNoneMatch?: string): Promise<{ data: { parameters: Record<string, unknown>; count: number; types: Record<string, string[]>; definitions?: import('@/types/wantType').ParameterDef[] } | null; etag: string | undefined }> {
    return this.conditionalGet<{ parameters: Record<string, unknown>; count: number; types: Record<string, string[]>; definitions?: import('@/types/wantType').ParameterDef[] }>('/api/v1/global-parameters', ifNoneMatch);
  }

  async updateGlobalParameters(parameters: Record<string, unknown>, definitions?: import('@/types/wantType').ParameterDef[]): Promise<{ parameters: Record<string, unknown>; count: number; types: Record<string, string[]>; definitions?: import('@/types/wantType').ParameterDef[] }> {
    const response = await this.client.put<{ parameters: Record<string, unknown>; count: number; types: Record<string, string[]>; definitions?: import('@/types/wantType').ParameterDef[] }>('/api/v1/global-parameters', { parameters, definitions });
    return response.data;
  }

  // Kata (型) — read-only; progress is derived server-side from live wants + thing.
  async listKata(): Promise<KataListResponse> {
    return this.deduplicatedGet<KataListResponse>('/api/v1/kata');
  }

  /**
   * The kata standing right now, as constellations to draw. Separate from
   * listKata because drawing needs the EDGES: which members join to which.
   */
  async listLiveKata(): Promise<LiveKataResponse> {
    return this.deduplicatedGet<LiveKataResponse>('/api/v1/kata/live');
  }

  async listKataRecords(): Promise<{ records: KataRecord[]; count: number }> {
    const response = await this.client.get<{ records: KataRecord[]; count: number }>('/api/v1/kata/records');
    return response.data;
  }

  // Achievements
  async listAchievements(): Promise<AchievementListResponse> {
    return this.deduplicatedGet<AchievementListResponse>('/api/v1/achievements');
  }

  async getAchievement(id: string): Promise<Achievement> {
    const response = await this.client.get<Achievement>(`/api/v1/achievements/${id}`);
    return response.data;
  }

  async createAchievement(request: CreateAchievementRequest): Promise<Achievement> {
    const response = await this.client.post<Achievement>('/api/v1/achievements', request);
    return response.data;
  }

  async updateAchievement(id: string, request: Partial<Achievement>): Promise<Achievement> {
    const response = await this.client.put<Achievement>(`/api/v1/achievements/${id}`, request);
    return response.data;
  }

  async lockAchievement(id: string): Promise<Achievement> {
    const response = await this.client.patch<Achievement>(`/api/v1/achievements/${id}/lock`);
    return response.data;
  }

  async unlockAchievement(id: string): Promise<Achievement> {
    const response = await this.client.patch<Achievement>(`/api/v1/achievements/${id}/unlock`);
    return response.data;
  }

  async deleteAchievement(id: string): Promise<void> {
    await this.client.delete(`/api/v1/achievements/${id}`);
  }

  // Achievement Rules
  async listAchievementRules(): Promise<AchievementRuleListResponse> {
    return this.deduplicatedGet<AchievementRuleListResponse>('/api/v1/achievements/rules');
  }

  async createAchievementRule(request: CreateRuleRequest): Promise<AchievementRule> {
    const response = await this.client.post<AchievementRule>('/api/v1/achievements/rules', request);
    return response.data;
  }

  async deleteAchievementRule(id: string): Promise<void> {
    await this.client.delete(`/api/v1/achievements/rules/${id}`);
  }

  // GUI state — backed by the gui_state want, surfaced via /api/v1/gui/state
  async getGUIState(): Promise<{ seq: number; state: Record<string, unknown> }> {
    const response = await this.client.get<{ seq: number; state: Record<string, unknown> }>('/api/v1/gui/state');
    return response.data;
  }

  async getGUIStateConditional(ifNoneMatch?: string): Promise<{ data: { seq: number; state: Record<string, unknown> } | null; etag: string | undefined }> {
    return this.conditionalGet<{ seq: number; state: Record<string, unknown> }>('/api/v1/gui/state', ifNoneMatch, {
      rawETag: true,
      extraHeaders: { 'Cache-Control': 'no-cache' },
    });
  }

  async updateGUIState(
    updates: Record<string, unknown>,
    ifMatchSeq?: number,
  ): Promise<{ seq: number; state: Record<string, unknown> }> {
    const headers: Record<string, string> = {};
    if (ifMatchSeq !== undefined) headers['If-Match'] = `"${ifMatchSeq}"`;
    const response = await this.client.put<{ seq: number; state: Record<string, unknown> }>(
      '/api/v1/gui/state',
      updates,
      { headers, validateStatus: (s) => s === 200 || s === 412 },
    );
    if (response.status === 412) {
      // Concurrent write conflict: another tab wrote first.
      // Return the current server seq from the ETag so the caller can update its baseline.
      const serverETag = response.headers['etag'] as string | undefined;
      const serverSeq = serverETag ? parseInt(serverETag.replace(/"/g, ''), 10) : undefined;
      throw Object.assign(new Error('gui_state write conflict (412)'), { status: 412, serverSeq });
    }
    return response.data;
  }

  /**
   * Append one action to gui_state's pendingDeviceActions queue.
   *
   * Preferred over a read-modify-write through updateGUIState: the server
   * appends under its own lock, so two players calling each other at the same
   * moment can't clobber one another's invite.
   */
  async appendPendingDeviceAction(action: Record<string, unknown>): Promise<void> {
    await this.client.post('/api/v1/gui/pending-action', action);
  }

  // @deprecated — use updateGUIState instead
  async updateGUIWantState(wantId: string, updates: Record<string, unknown>): Promise<void> {
    await this.client.put(`/api/v1/states/${wantId}`, updates);
  }

  // ── Notifications ────────────────────────────────────────────────────────────

  /** Records a notice. Fire-and-forget at the call site: a bubble the user has
   *  already seen must never be blocked, or undone, by its own bookkeeping. */
  async recordNotification(entry: Omit<NotificationEntry, 'id' | 'at'>): Promise<void> {
    await this.client.post('/api/v1/notifications', entry);
  }

  async getNotifications(limit?: number): Promise<{ notifications: NotificationEntry[]; count: number }> {
    const response = await this.client.get<{ notifications: NotificationEntry[]; count: number }>(
      '/api/v1/notifications', { params: limit ? { limit } : undefined },
    );
    return response.data;
  }

  async clearNotifications(): Promise<void> {
    await this.client.delete('/api/v1/notifications');
  }

  // ── Per-want alerts (badge the tile until the want is opened) ────────────────

  /** { counts: { [wantId]: unread }, total } */
  async getUnreadWantCounts(): Promise<{
    counts: Record<string, number>;
    total: number;
    /** Per want, the ids of the outputs its unread alerts announce. */
    outputs?: Record<string, string[]>;
  }> {
    const response = await this.client.get<{ counts: Record<string, number>; total: number; outputs?: Record<string, string[]> }>(
      '/api/v1/notifications/unread-counts',
    );
    return response.data;
  }

  async getWantNotifications(
    wantId: string,
    limit?: number,
  ): Promise<{ notifications: NotificationEntry[]; unread: number }> {
    const response = await this.client.get<{ notifications: NotificationEntry[]; unread: number }>(
      `/api/v1/wants/${wantId}/notifications`,
      { params: limit ? { limit } : undefined },
    );
    return response.data;
  }

  /** Raise a per-want alert. Fire-and-forget at the call site. */
  async notifyWant(wantId: string, message: string, title?: string): Promise<void> {
    await this.client.post(`/api/v1/wants/${wantId}/notify`, { message, title });
  }

  async markWantNotificationsRead(wantId: string): Promise<number> {
    const response = await this.client.post<{ read: number }>(
      `/api/v1/wants/${wantId}/notifications/read`,
    );
    return response.data.read;
  }

  // ── Web Push ───────────────────────────────────────────────────────────────

  async getVapidPublicKey(): Promise<{ key: string; enabled: boolean }> {
    const response = await this.client.get<{ key: string; enabled: boolean }>(
      '/api/v1/push/vapid-public-key',
    );
    return response.data;
  }

  async pushSubscribe(subscription: PushSubscriptionJSON, wantId?: string): Promise<void> {
    await this.client.post('/api/v1/push/subscribe', { subscription, wantId });
  }

  async pushUnsubscribe(endpoint: string): Promise<void> {
    await this.client.post('/api/v1/push/unsubscribe', { endpoint });
  }

  // ── Robot Logs ───────────────────────────────────────────────────────────────

  async getRobotLogs(): Promise<{ logs: RobotLogEntry[]; count: number }> {
    const response = await this.client.get<{ logs: RobotLogEntry[]; count: number }>('/api/v1/robot/logs');
    return response.data;
  }

  async clearRobotLogs(): Promise<void> {
    await this.client.delete('/api/v1/robot/logs');
  }

  async replayRobotLog(id: string): Promise<{ seq: number; state: Record<string, unknown> }> {
    const response = await this.client.post<{ seq: number; state: Record<string, unknown> }>(`/api/v1/robot/logs/${id}/replay`);
    return response.data;
  }

  /** Values a want of this type could be created with, before it exists.
   *  Sources are every deployed want's state plus the thing; the server ranks
   *  them (a value some want holds now outranks one merely remembered). */
  async getParamRecommendations(targetType: string): Promise<ParamRecommendation[]> {
    const resp = await this.client.get<{ recommendations: RawFieldMatchRec[] }>(
      `/api/v1/wants/field-match-recommendations?target_type=${encodeURIComponent(targetType)}`
    );
    return (resp.data.recommendations ?? [])
      .filter(r => r.param_change?.param_name && r.param_change.value !== undefined && r.param_change.value !== null)
      .filter(r => !r.source?.want_id || (r.source?.current_value !== undefined && r.source?.current_value !== '' && r.source?.current_value !== null))
      .map(r => ({
        paramName: r.param_change.param_name,
        value: r.param_change.value,
        score: r.score ?? 0,
        sourceName: r.source?.want_name ?? '',
        sourceId: r.source?.want_id,
        sourceType: r.source?.want_type,
        sourceField: r.source?.field_name,
      }));
  }

  /** Applies a recommendation to a want that has not been created yet.
   *  The provider publishes its field server-side; the value and the import
   *  entry come back for the form to carry into the want it deploys. */
  async applyParamRecommendationPending(rec: ParamRecommendation): Promise<{
    paramName: string; value: unknown; import?: { globalKey: string; localKey: string };
  }> {
    const resp = await this.client.post<{
      pending_param_change?: { param_name: string; value: unknown };
      pending_import?: { global_key: string; local_key: string };
    }>('/api/v1/wants/field-match-recommendations/apply', {
      source_id: rec.sourceId,
      source_field: rec.sourceField,
      param_change: { param_name: rec.paramName },
    });
    const pc = resp.data.pending_param_change;
    const pi = resp.data.pending_import;
    return {
      paramName: pc?.param_name ?? rec.paramName,
      value: pc?.value ?? rec.value,
      import: pi ? { globalKey: pi.global_key, localKey: pi.local_key } : undefined,
    };
  }

  // ── Thing (user input history) ───────────────────────────────────────────────

  async getThingSuggestions(subtype: string, limit = 20): Promise<string[]> {
    const resp = await this.client.get<{ subtype: string; suggestions: string[] }>(
      `/api/v1/things/suggestions/${encodeURIComponent(subtype)}?limit=${limit}`
    );
    return resp.data.suggestions ?? [];
  }

  async getSubtypeDefinitions(): Promise<Record<string, { key: string; icon: string; color?: string }>> {
    const resp = await this.client.get<{ subtypes: Record<string, { key: string; icon: string; color?: string }> }>(
      '/api/v1/things/subtypes'
    );
    return resp.data.subtypes ?? {};
  }

  /**
   * Every remembered value, whole — name, type, icon, colour, who named it,
   * usage stats, the wants naming it now, and its canvas labels.
   *
   * One call. This used to be four (things, datatypes, usage, labels/stats)
   * with the catalog→type reverse lookup reimplemented at each call site; the
   * server assembles it now.
   */
  async getThings(): Promise<ThingFull[]> {
    const resp = await this.client.get<{ things: ThingFull[] }>('/api/v1/things');
    return resp.data.things ?? [];
  }

  /** Remember one value. Returns the thing, identity included. */
  async createThing(catalog: string, value: string): Promise<{ id: string; catalog: string; value: string }> {
    const res = await this.client.post<{ id: string; catalog: string; value: string }>(
      '/api/v1/things', { catalog, value },
    );
    return res.data;
  }

  /**
   * Change what a thing is filed under, or what it is called, without changing
   * which thing it is. Everything pointing at it — its place on the board, the
   * groups it is in — is keyed by the id and keeps pointing.
   */
  async patchThing(id: string, changes: { catalog?: string; value?: string }): Promise<{ id: string; catalog: string; value: string }> {
    const res = await this.client.patch<{ id: string; catalog: string; value: string }>(
      `/api/v1/things/${encodeURIComponent(id)}`, changes,
    );
    return res.data;
  }

  async deleteThing(id: string): Promise<void> {
    await this.client.delete(`/api/v1/things/${encodeURIComponent(id)}`);
  }

  /** The catalog→values shape putThings takes, folded back from the above. */
  async getThingsByCatalog(): Promise<Record<string, string[]>> {
    const things = await this.getThings();
    const out: Record<string, string[]> = {};
    for (const t of things) (out[t.catalog] ??= []).push(t.value);
    return out;
  }

  /** Replaces the entire thing (catalog key → values). Used to remove a value. */
  async putThings(things: Record<string, string[]>): Promise<void> {
    await this.client.put('/api/v1/things', things);
  }

  /** Per-value usage stats (count + lastUsed), keyed by catalog then value. */
  async getThingStats(): Promise<ThingStats> {
    const resp = await this.client.get<{ stats: ThingStats }>('/api/v1/things/stats');
    return resp.data.stats ?? {};
  }

  /** Thing provenance events, newest first. Pass catalog+value to scope to one
   *  named value's history; omit both for the full log. */
  async getThingEvents(opts: { catalog?: string; value?: string; limit?: number } = {}): Promise<ThingEvent[]> {
    const params = new URLSearchParams();
    if (opts.catalog) params.set('catalog', opts.catalog);
    if (opts.value) params.set('value', opts.value);
    params.set('limit', String(opts.limit ?? 200));
    const resp = await this.client.get<{ events: ThingEvent[] }>(`/api/v1/things/events?${params.toString()}`);
    return resp.data.events ?? [];
  }

  // ── Characters ──────────────────────────────────────────────────────────────

  async listCharacters(): Promise<Character[]> {
    const data = await this.deduplicatedGet<CharacterListResponse>('/api/v1/characters');
    return data.characters;
  }

  async getCharacter(id: string): Promise<Character> {
    return this.deduplicatedGet<Character>(`/api/v1/characters/${id}`);
  }

  async createCharacter(req: Pick<Character, 'name' | 'avatar' | 'color'>): Promise<Character> {
    const response = await this.client.post<Character>('/api/v1/characters', req);
    return response.data;
  }

  /** Identity: what this person looks like to everyone. `shape` travels with
   *  name/avatar/colour because it is the same kind of fact and the same
   *  endpoint replaces the lot — omitting it here would clear the shape on the
   *  next rename. */
  async updateCharacter(id: string, req: Pick<Character, 'name' | 'avatar' | 'color'> & Partial<Pick<Character, 'shape'>>): Promise<Character> {
    const response = await this.client.put<Character>(`/api/v1/characters/${id}`, req);
    return response.data;
  }

  async deleteCharacter(id: string): Promise<void> {
    await this.client.delete(`/api/v1/characters/${id}`);
  }

  async assignDevicesToCharacter(characterId: string, deviceIds: string[]): Promise<Character> {
    const response = await this.client.put<Character>(`/api/v1/characters/${characterId}/devices`, { deviceIds });
    return response.data;
  }

  async pruneCharacterDevices(deviceIds: string[]): Promise<void> {
    await this.client.post('/api/v1/characters/prune-devices', { deviceIds });
  }

  /** Marks (or, with an empty value, clears) an aura-default selection. wantId
   *  names the want being marked; the server stores the mark against that
   *  want's *type* so it stays valid across redeploys and in other installs. */
  async setCharacterAuraDefault(characterId: string, wantId: string, section: string, key: string, value: string, mode?: 'set' | 'endorse'): Promise<Character> {
    const response = await this.client.put<Character>(`/api/v1/characters/${characterId}/aura-defaults`, { wantId, section, key, value, mode });
    return response.data;
  }

  /** Defines a catalog entry (kind, name) = value, signed by this character. An
   *  empty name clears it. value may be a scalar or an object (a definition). */
  async setCharacterAuraDefinition(
    characterId: string, kind: string, name: string, value: unknown, wantId?: string,
  ): Promise<Character> {
    const response = await this.client.put<Character>(`/api/v1/characters/${characterId}/aura-defaults`, {
      target: { kind, name, path: '' },
      value: name ? value : '',
      // Which want's value this name was given to. The server records it on the
      // thing event, and without it the thing has no way back to the want that
      // produced the value — the gap that used to be papered over by scanning
      // every want's state at read time.
      wantId: wantId ?? '',
    });
    return response.data;
  }

  /** Sets (or, with an empty wantId, clears) the want a character has bookmarked as their aura card. */
  async setCharacterAuraCard(characterId: string, wantId: string): Promise<Character> {
    const response = await this.client.put<Character>(`/api/v1/characters/${characterId}/aura-card`, { wantId });
    return response.data;
  }

  /** Names a want's final-result value into its catalog (X on a card). The
   *  server resolves the field and its catalog kind, and records the name in the
   *  thing. Same idea as naming a field, but for the whole card's result. */
  async cardAuraName(characterId: string, wantId: string, name: string): Promise<{ kind: string; name: string }> {
    const response = await this.client.put<{ kind: string; name: string }>(`/api/v1/characters/${characterId}/card-aura-name`, { wantId, name });
    return response.data;
  }

  /** The catalog names a want's final-result value carries (matched value, by
   *  proximity for coordinates), so a card can show them without knowing the
   *  field or kind. */
  async getCardAuraMark(characterId: string, wantId: string): Promise<{ names: { name: string; color: string }[] }> {
    const response = await this.client.get<{ names: { name: string; color: string }[] }>(`/api/v1/characters/${characterId}/card-aura-mark?wantId=${encodeURIComponent(wantId)}`);
    return response.data;
  }

  /** Sets the canvas preferences a character owns: tile/aura design-plugin ids
   *  (empty string = inherit the canvas design) and how fast their movement is
   *  animated (1 = normal). */
  async setCharacterDesign(
    characterId: string, tileDesign: string, auraDesign: string, moveSpeed = 1, speed = 0,
  ): Promise<Character> {
    const response = await this.client.put<Character>(`/api/v1/characters/${characterId}/design`, {
      tile_design: tileDesign, aura_design: auraDesign, move_speed: moveSpeed, speed,
    });
    return response.data;
  }

  /** Replaces a character's look-and-feel choices. The whole set is sent: an
   *  omitted field means "the built-in default", not "leave what was there". */
  async setCharacterDisplay(characterId: string, display: CharacterDisplay): Promise<Character> {
    const response = await this.client.put<Character>(`/api/v1/characters/${characterId}/display`, display);
    return response.data;
  }

  // ── Multi-cursor ─────────────────────────────────────────────────────────────

  /**
   * The sequence number each character's next cursor PUT will carry.
   *
   * Ordering used to be the caller's job, and only the caller that sends the
   * moves remembered to do it. Every other cursor PUT — the keepalive timer,
   * a speech bubble, a button's effects — carries a position it read from
   * somewhere rather than chose, races the moves exactly as the moves race
   * each other, and applied unconditionally for want of a seq. A keepalive sent
   * a moment before a step and delivered a moment after it wrote the pre-step
   * cell back, and the next step wrote the new one again: over a phone's
   * network, where that reordering is ordinary, the character paced between two
   * cells on its own. Numbering here means a new call site cannot forget.
   *
   * Seeded from the clock rather than from 0, because the server's high-water
   * mark for a character outlives this page (a remount, a second tab, HMR) and
   * a counter starting over would have every PUT rejected as stale.
   */
  private cursorSeq = new Map<string, number>();

  private nextCursorSeq(characterId: string): number {
    const next = (this.cursorSeq.get(characterId) ?? Date.now()) + 1;
    this.cursorSeq.set(characterId, next);
    return next;
  }

  /**
   * The highest seq this tab has sent for a character, or 0 for none.
   *
   * Read by the own-cursor sync to tell a broadcast it caused from one it did
   * not: anything at or below this number is a position this tab published,
   * and is therefore either what it already shows or somewhere it has since
   * left. See cursorEntry.Seq on the server for why the comparison holds
   * across tabs and devices as well.
   */
  highestCursorSeqSent(characterId: string): number {
    return this.cursorSeq.get(characterId) ?? 0;
  }

  /** Update this character's cursor position on the shared canvas. Fire-and-forget. */
  async updateCursor(
    characterId: string,
    x: number,
    y: number,
    deviceId?: string,
    avatar?: string,
    color?: string,
    name?: string,
    effectType?: string,
    effectNonce?: number,
    /** Speech bubble carried alongside the position — see Dashboard's say state. */
    say?: { message?: string; messageAt?: number },
    /**
     * Orders this browser's PUTs for this character. Assigned here when the
     * caller does not supply one, which is what every caller should do — see
     * cursorSeq above. Pass an explicit value only to reproduce a particular
     * ordering, as the tests do.
     *
     * Losing the race costs the position and nothing else: the server keeps
     * the newer cell and still applies the message and effects this PUT
     * carries, since those are events rather than state.
     */
    seq?: number,
  ): Promise<void> {
    await this.client.put(`/api/v1/cursors/${encodeURIComponent(characterId)}`, {
      x, y, deviceId, avatar, color, name, effectType, effectNonce,
      message: say?.message, messageAt: say?.messageAt,
      seq: seq ?? this.nextCursorSeq(characterId),
    });
  }

  /** Remove this character's cursor (called when leaving canvas mode). */
  async deleteCursor(characterId: string): Promise<void> {
    await this.client.delete(`/api/v1/cursors/${encodeURIComponent(characterId)}`);
  }

  /** Fetch all active remote cursors. */
  /**
   * Move a character to a cell, optionally asking them first.
   *
   * The GUI and the CLI both come through here (see the engine's
   * handlers_character_summon.go), so what a summons does to the board is
   * decided in one place rather than reimplemented per client.
   */
  async summonCharacter(
    characterId: string,
    opts: { x: number; y: number; invite?: boolean; from?: string; url?: string },
  ): Promise<{ outcome: 'invited' | 'moved'; x: number; y: number }> {
    const res = await this.client.post<{ outcome: 'invited' | 'moved'; x: number; y: number }>(
      `/api/v1/characters/${encodeURIComponent(characterId)}/summon`, opts,
    );
    return res.data;
  }

  /**
   * Answer an invitation to come somewhere.
   *
   * The server decides what answering means — accepting takes the same path a
   * direct summons takes, so arriving because you agreed and arriving because
   * you were pulled leave the board in the same state. A page invitation comes
   * back as an address for this client to open, since that is the one part only
   * a browser can do.
   */
  async respondToSummon(
    characterId: string, inviteId: string, accept: boolean,
  ): Promise<{ outcome: 'moved' | 'declined' | 'open-url'; x?: number; y?: number; url?: string }> {
    const res = await this.client.post<{ outcome: 'moved' | 'declined' | 'open-url'; x?: number; y?: number; url?: string }>(
      `/api/v1/characters/${encodeURIComponent(characterId)}/summon/respond`,
      { inviteId, accept },
    );
    return res.data;
  }

  async listCursors(): Promise<RemoteCursor[]> {
    const res = await this.client.get<RemoteCursor[]>('/api/v1/cursors');
    return res.data ?? [];
  }

  /** ETag-conditional fetch of remote cursors. Returns null data on 304 (no change). */
  async listCursorsConditional(ifNoneMatch?: string): Promise<{ data: RemoteCursor[] | null; etag: string | undefined }> {
    return this.conditionalGet<RemoteCursor[]>('/api/v1/cursors', ifNoneMatch);
  }

  // ── Relation (expose) management ────────────────────────────────────────────

  /**
   * Add an expose entry to a want.
   * @param wantId - the provider want
   * @param as     - the key to expose as (ExposeEntry.As)
   * @param currentState - state field to expose (optional)
   * @param param  - param field to expose (optional)
   */
  async addRelation(wantId: string, as: string, currentState?: string, param?: string): Promise<void> {
    await this.client.post(`/api/v1/wants/${wantId}/relations`, { as, currentState, param });
  }

  /**
   * Remove an expose entry from a want.
   * @param wantId - the provider want
   * @param label  - the expose label, e.g. "expose/temperature"
   */
  async removeRelation(wantId: string, label: string): Promise<void> {
    await this.client.delete(`/api/v1/wants/${wantId}/relations`, { data: { label } });
  }

  // Groups — user-defined named collections of things / wants.
  /**
   * Every constellation, or only the ones made of one kind.
   *
   * Omitting the kind is the whole sky — one constellation per name, holding
   * whatever carries its label. That is the honest listing now that a
   * constellation can have a want and a thing in it; the filtered forms remain
   * for the lists that are genuinely about one kind (the Thing page's).
   */
  async getConstellations(kind?: ConstellationKind): Promise<Constellation[]> {
    const response = await this.client.get<{ groups: Constellation[] }>(
      `/api/v1/constellations`, kind ? { params: { kind } } : undefined);
    return response.data.groups ?? [];
  }

  async createConstellation(data: { name: string; kind: ConstellationKind; members: string[]; color?: string }): Promise<Constellation> {
    const response = await this.client.post<Constellation>(`/api/v1/constellations`, data);
    return response.data;
  }

  // Constellation id == its name; kind must accompany update/delete to pick the thing or
  // want label namespace. The name may be non-ASCII, so encode the path segment.
  async updateConstellation(name: string, updates: { name?: string; members?: string[]; color?: string; kind: ConstellationKind }): Promise<{ name: string }> {
    const response = await this.client.put<{ name: string }>(`/api/v1/constellations/${encodeURIComponent(name)}`, updates);
    return response.data;
  }

  async deleteConstellation(name: string, kind: ConstellationKind): Promise<void> {
    await this.client.delete(`/api/v1/constellations/${encodeURIComponent(name)}`, { params: { kind } });
  }

  // Raw per-thing-value labels (general facility; groups ride on group/* keys).
  /** Which live wants are naming which remembered values. */
  async listThingUsage(): Promise<{ usage: import('@/types/thing').ThingUsage[]; count: number }> {
    return this.deduplicatedGet<{ usage: import('@/types/thing').ThingUsage[]; count: number }>(
      '/api/v1/things/usage',
    );
  }

  async getThingLabels(): Promise<Record<string, Record<string, string>>> {
    const response = await this.client.get<{ labels: Record<string, Record<string, string>> }>(`/api/v1/things/labels`);
    return response.data.labels ?? {};
  }

  async setThingLabel(valueId: string, key: string, value: string): Promise<void> {
    await this.client.post(`/api/v1/things/labels`, { value_id: valueId, key, value });
  }

  async removeThingLabel(valueId: string, key: string): Promise<void> {
    await this.client.post(`/api/v1/things/labels/remove`, { value_id: valueId, key });
  }

  /**
   * A thing's neighbours — constellation co-members and the wants naming it —
   * in the same shape as a want's metadata.correlation. Feeds the Y jump
   * overlay when the character is standing on a thing rather than a want.
   */
  async listThingRelations(id: string): Promise<import('@/types/want').CorrelationEntry[]> {
    const resp = await this.client.get<{ relations: import('@/types/want').CorrelationEntry[] }>(
      `/api/v1/things/${encodeURIComponent(id)}/relations`,
    );
    return resp.data.relations ?? [];
  }
}

// Export singleton instance
export const apiClient = new MyWantApiClient('');

export default MyWantApiClient;
/** One thing needing a person — see GET /api/v1/attention (handlers_attention.go). */
export interface AttentionItem {
  id: string;
  kind: 'approval' | 'want_error' | 'web_failed' | 'needs_human';
  title: string;
  detail?: string;
  want_id?: string;
  /** The page whose tab to bring forward; absent means the GUI itself. */
  url?: string;
  at: number;
}
