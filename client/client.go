package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Client struct {
	BaseURL    string
	HTTPClient *http.Client
}

func New(baseURL string) *Client {
	return &Client{
		BaseURL:    baseURL,
		HTTPClient: &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *Client) request(method, path string, body any, out any) error {
	var bodyReader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		bodyReader = bytes.NewReader(b)
	}

	req, err := http.NewRequest(method, c.BaseURL+path, bodyReader)
	if err != nil {
		return err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("server returned %d: %s", resp.StatusCode, string(b))
	}

	if out != nil {
		return json.NewDecoder(resp.Body).Decode(out)
	}
	return nil
}

// GUIState is the current GUI navigation state.
// The server returns { seq: int64, state: map[string]any } where state
// is a flat map of all GUI state fields.
type GUIState struct {
	Seq   int64          `json:"seq"`
	State map[string]any `json:"state"`
}

// GetGUIState fetches the current GUI state.
func (c *Client) GetGUIState() (*GUIState, error) {
	var result GUIState
	if err := c.request("GET", "/api/v1/gui/state", nil, &result); err != nil {
		return nil, fmt.Errorf("failed to get GUI state: %w", err)
	}
	if result.State == nil {
		result.State = map[string]any{}
	}
	return &result, nil
}

// ShowWant navigates the GUI to the sidebar for a specific want.
func (c *Client) ShowWant(wantID, tab, statusFilter, searchQuery string) error {
	updates := map[string]any{
		"source":                  "cli",
		"sidebar_open":            true,
		"sidebar_want_id":         wantID,
		"sidebar_active_tab":      tab,
		"dashboard_status_filter": statusFilter,
		"dashboard_search_query":  searchQuery,
	}
	return c.request("PUT", "/api/v1/gui/state", updates, nil)
}

// ShowDashboard navigates the GUI to the dashboard view.
func (c *Client) ShowDashboard(statusFilter, searchQuery string) error {
	updates := map[string]any{
		"source":                  "cli",
		"sidebar_open":            false,
		"sidebar_want_id":         "",
		"sidebar_active_tab":      "",
		"dashboard_status_filter": statusFilter,
		"dashboard_search_query":  searchQuery,
	}
	return c.request("PUT", "/api/v1/gui/state", updates, nil)
}

// ── Robot cursor control ─────────────────────────────────────────────────────

// RobotCommand encapsulates all fields needed to drive the robot cursor overlay.
type RobotCommand struct {
	Visible       bool   `json:"robot_visible"`
	Message       string `json:"robot_message"`
	TargetType    string `json:"robot_target_type"`    // "want_card" | "nav_wants" | "nav_agents" | "nav_types" | "nav_recipes" | "param_field" | "none"
	TargetID      string `json:"robot_target_id"`      // want ID, param key, nav id
	Action        string `json:"robot_action"`         // "click" | "hover" | "type" | "navigate" | ""
	ActionPayload string `json:"robot_action_payload"` // for "type": value to display
	Nonce         int64  `json:"robot_nonce"`          // millisecond timestamp to make each command unique
	NavRoute      string `json:"nav_route,omitempty"`  // e.g. "/agents", "/recipes"
}

// SendRobotCommand sends a robot cursor command via the GUI state API.
func (c *Client) SendRobotCommand(cmd RobotCommand, extra map[string]any) error {
	updates := map[string]any{
		"source":               "cli",
		"robot_visible":        cmd.Visible,
		"robot_message":        cmd.Message,
		"robot_target_type":    cmd.TargetType,
		"robot_target_id":      cmd.TargetID,
		"robot_action":         cmd.Action,
		"robot_action_payload": cmd.ActionPayload,
		"robot_nonce":          cmd.Nonce,
	}
	if cmd.NavRoute != "" {
		updates["nav_route"] = cmd.NavRoute
	}
	for k, v := range extra {
		updates[k] = v
	}
	return c.request("PUT", "/api/v1/gui/state", updates, nil)
}

// UpdateGUIState sends arbitrary key/value updates to the GUI state without
// changing the robot cursor fields. Useful for form automation steps that
// should be decoupled from the robot movement.
func (c *Client) UpdateGUIState(updates map[string]any) error {
	updates["source"] = "cli"
	return c.request("PUT", "/api/v1/gui/state", updates, nil)
}

// HideRobot hides the robot cursor overlay.
func (c *Client) HideRobot() error {
	updates := map[string]any{
		"source":            "cli",
		"robot_visible":     false,
		"robot_message":     "",
		"robot_target_type": "",
		"robot_target_id":   "",
		"robot_action":      "",
	}
	return c.request("PUT", "/api/v1/gui/state", updates, nil)
}

// ── Want data access (for params set) ────────────────────────────────────────

// WantData holds the minimal want structure needed for param updates.
type WantData struct {
	Metadata struct {
		ID     string            `json:"id"`
		Name   string            `json:"name"`
		Type   string            `json:"type"`
		Labels map[string]string `json:"labels"`
	} `json:"metadata"`
	Spec struct {
		Params  map[string]any `json:"params"`
		Using   []any          `json:"using,omitempty"`
		Recipe  any            `json:"recipe,omitempty"`
		Exposes []ExposeEntry  `json:"exposes,omitempty"`
		Imports map[string]any `json:"imports,omitempty"`
	} `json:"spec"`
	Status  any `json:"status,omitempty"`
	State   any `json:"state,omitempty"`
	History any `json:"history,omitempty"`
}

// ExposeEntry represents one expose entry in spec.exposes.
type ExposeEntry struct {
	As           string `json:"as"`
	CurrentState string `json:"currentState,omitempty"`
	Param        string `json:"param,omitempty"`
}

// GetWant fetches a single want by ID.
func (c *Client) GetWant(id string) (*WantData, error) {
	var result WantData
	if err := c.request("GET", "/api/v1/wants/"+id, nil, &result); err != nil {
		return nil, fmt.Errorf("get want %s: %w", id, err)
	}
	return &result, nil
}

// UpdateWantLabels merges the given labels into a want's metadata (fetches current data first).
func (c *Client) UpdateWantLabels(id string, labels map[string]string) error {
	want, err := c.GetWant(id)
	if err != nil {
		return err
	}
	if want.Metadata.Labels == nil {
		want.Metadata.Labels = make(map[string]string)
	}
	for k, v := range labels {
		want.Metadata.Labels[k] = v
	}
	return c.request("PUT", "/api/v1/wants/"+id, want, nil)
}

// UpdateWantParam updates a single param on a want (fetches current data first).
func (c *Client) UpdateWantParam(id, key string, value any) error {
	want, err := c.GetWant(id)
	if err != nil {
		return err
	}
	if want.Spec.Params == nil {
		want.Spec.Params = make(map[string]any)
	}
	want.Spec.Params[key] = value
	return c.request("PUT", "/api/v1/wants/"+id, want, nil)
}

// GetCurrentGUIState returns the current GUI state fields as a flat map.
// The server returns { seq: int64, state: map[string]any } where state
// is the flat current state (not nested under "current").
func (c *Client) GetCurrentGUIState() (map[string]any, error) {
	gui, err := c.GetGUIState()
	if err != nil {
		return nil, err
	}
	return gui.State, nil
}

// ── Characters (persistent, /api/v1/characters) ────────────────────────────────
// Distinct from CharacterCursor below: this is the persistent character
// record (id/name/avatar/color/device assignment), not the live canvas
// position — see ListCharacterCursors for that.

// Character is one entry from GET /api/v1/characters.
type Character struct {
	ID                string   `json:"id"`
	Name              string   `json:"name"`
	Avatar            string   `json:"avatar,omitempty"`
	Color             string   `json:"color,omitempty"`
	AssignedDeviceIDs []string `json:"assignedDeviceIds,omitempty"`
	AuraCardWantID    string   `json:"auraCardWantId,omitempty"`
}

// ListCharacters returns all persistent character records.
func (c *Client) ListCharacters() ([]Character, error) {
	var result struct {
		Characters []Character `json:"characters"`
	}
	if err := c.request("GET", "/api/v1/characters", nil, &result); err != nil {
		return nil, fmt.Errorf("list characters: %w", err)
	}
	return result.Characters, nil
}

// ── Character cursors ────────────────────────────────────────────────────────

// CharacterCursor is one entry from GET /api/v1/cursors.
type CharacterCursor struct {
	CharacterID string  `json:"characterId"`
	DeviceID    string  `json:"deviceId,omitempty"`
	X           float64 `json:"x"`
	Y           float64 `json:"y"`
	Avatar      string  `json:"avatar,omitempty"`
	Color       string  `json:"color,omitempty"`
	Name        string  `json:"name,omitempty"`
	LastSeen    int64   `json:"lastSeen"`
	EffectType  string  `json:"effectType,omitempty"`
	EffectNonce int64   `json:"effectNonce,omitempty"`
}

// CharacterCursorOpts holds optional metadata for UpdateCharacterCursor.
type CharacterCursorOpts struct {
	DeviceID string
	Avatar   string
	Color    string
	Name     string
	// Message is the speech bubble to show above the character. The server
	// stores it on the (8s TTL) cursor entry, so it fades on its own.
	// MessageAt defaults to now when a Message is given.
	Message   string
	MessageAt int64
}

// ListCharacterCursors returns all active character cursors.
func (c *Client) ListCharacterCursors() ([]CharacterCursor, error) {
	var result []CharacterCursor
	if err := c.request("GET", "/api/v1/cursors", nil, &result); err != nil {
		return nil, fmt.Errorf("list cursors: %w", err)
	}
	return result, nil
}

// GetCharacterCursor returns the cursor for a specific character, or nil if not active.
func (c *Client) GetCharacterCursor(characterID string) (*CharacterCursor, error) {
	cursors, err := c.ListCharacterCursors()
	if err != nil {
		return nil, err
	}
	for i := range cursors {
		if cursors[i].CharacterID == characterID {
			return &cursors[i], nil
		}
	}
	return nil, nil
}

// UpdateCharacterCursor sets the canvas position for a character.
// opts is optional; pass nil to skip metadata fields.
func (c *Client) UpdateCharacterCursor(characterID string, x, y float64, opts *CharacterCursorOpts) error {
	body := map[string]any{"x": x, "y": y}
	if opts != nil {
		if opts.DeviceID != "" {
			body["deviceId"] = opts.DeviceID
		}
		if opts.Avatar != "" {
			body["avatar"] = opts.Avatar
		}
		if opts.Color != "" {
			body["color"] = opts.Color
		}
		if opts.Name != "" {
			body["name"] = opts.Name
		}
		if opts.Message != "" {
			body["message"] = opts.Message
			at := opts.MessageAt
			if at == 0 {
				at = time.Now().UnixMilli()
			}
			body["messageAt"] = at
		}
	}
	return c.request("PUT", "/api/v1/cursors/"+characterID, body, nil)
}

// AppendPendingDeviceAction queues one action for a browser/device client via
// POST /api/v1/gui/pending-action. The server appends under its own lock, so
// this never clobbers an action queued concurrently by someone else.
func (c *Client) AppendPendingDeviceAction(action map[string]any) error {
	return c.request("POST", "/api/v1/gui/pending-action", action, nil)
}

// DeleteCharacterCursor removes a character's cursor entry.
func (c *Client) DeleteCharacterCursor(characterID string) error {
	return c.request("DELETE", "/api/v1/cursors/"+characterID, nil, nil)
}

// ── Want listing ─────────────────────────────────────────────────────────────

// ListWantTypeIDs returns all want type names for shell completion.
func (c *Client) ListWantTypeIDs() ([]string, error) {
	var result struct {
		WantTypes []struct {
			Name string `json:"name"`
		} `json:"wantTypes"`
	}
	if err := c.request("GET", "/api/v1/want-types", nil, &result); err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(result.WantTypes))
	for _, t := range result.WantTypes {
		if t.Name != "" {
			ids = append(ids, t.Name)
		}
	}
	return ids, nil
}

// ListWantIDs returns all want IDs for shell completion.
func (c *Client) ListWantIDs() ([]string, error) {
	var result struct {
		Wants []struct {
			Metadata struct {
				ID string `json:"id"`
			} `json:"metadata"`
		} `json:"wants"`
	}
	if err := c.request("GET", "/api/v1/wants", nil, &result); err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(result.Wants))
	for _, w := range result.Wants {
		if w.Metadata.ID != "" {
			ids = append(ids, w.Metadata.ID)
		}
	}
	return ids, nil
}

// LatestWantByType returns the ID of the most recently created want of the given type.
// Returns ("", nil) if no want of that type is found.
func (c *Client) LatestWantByType(typeName string) (string, error) {
	var result struct {
		Wants []struct {
			Metadata struct {
				ID        string `json:"id"`
				Type      string `json:"type"`
				CreatedAt string `json:"created_at"`
			} `json:"metadata"`
		} `json:"wants"`
	}
	if err := c.request("GET", "/api/v1/wants", nil, &result); err != nil {
		return "", err
	}
	latest := ""
	latestTime := ""
	for _, w := range result.Wants {
		if w.Metadata.Type == typeName {
			if latest == "" || w.Metadata.CreatedAt > latestTime {
				latest = w.Metadata.ID
				latestTime = w.Metadata.CreatedAt
			}
		}
	}
	return latest, nil
}

// ResolveWantID resolves a want name or ID to a want ID.
// If nameOrID already looks like a want ID (starts with "want-"), it is returned as-is.
// Otherwise the wants list is searched for a want whose metadata.name matches.
// Returns ("", ErrNotFound) if no match is found.
func (c *Client) ResolveWantID(nameOrID string) (string, error) {
	var result struct {
		Wants []struct {
			Metadata struct {
				ID   string `json:"id"`
				Name string `json:"name"`
			} `json:"metadata"`
		} `json:"wants"`
	}
	if err := c.request("GET", "/api/v1/wants", nil, &result); err != nil {
		return "", err
	}
	for _, w := range result.Wants {
		if w.Metadata.ID == nameOrID || w.Metadata.Name == nameOrID {
			return w.Metadata.ID, nil
		}
	}
	return "", fmt.Errorf("want not found: %q", nameOrID)
}

// BuildInfo is the version and commit a mywant or mywant-gui process reports.
type BuildInfo struct {
	Version string `json:"version"`
	Commit  string `json:"commit,omitempty"`
}

// BackendHealth asks the MyWant backend which build it is running. The client
// must be pointed at the backend, not at the GUI server.
func (c *Client) BackendHealth() (*BuildInfo, error) {
	var out BuildInfo
	if err := c.request("GET", "/health", nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// GUIVersion asks the mywant-gui server which build it is running. The client
// must be pointed at the GUI server, not at the backend.
func (c *Client) GUIVersion() (*BuildInfo, error) {
	var out BuildInfo
	if err := c.request("GET", "/api/v1/gui-version", nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// SummonCharacter moves a character to a cell through the server's own summon
// endpoint, optionally asking them first.
//
// The one place that answers "somebody should be over there" — see the engine's
// handlers_character_summon.go. Both this CLI and the GUI call it, so a summons
// means the same thing whichever one issued it.
func (c *Client) SummonCharacter(characterID string, x, y int, invite bool, from string) (string, error) {
	body := map[string]any{"x": x, "y": y, "invite": invite, "from": from}
	var resp struct {
		Outcome string `json:"outcome"`
	}
	if err := c.request("POST", "/api/v1/characters/"+characterID+"/summon", body, &resp); err != nil {
		return "", err
	}
	return resp.Outcome, nil
}
