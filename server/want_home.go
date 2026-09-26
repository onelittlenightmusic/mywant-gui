package server

import (
	"context"
	"encoding/json"
	"html"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"mywant-gui/web"
)

// The /w/<id> "one want as an app" route.
//
// The SPA sets the per-want home-screen tags from JavaScript too, but a browser
// grabbing the manifest for "Add to Home Screen" often reads the one that was
// in the HTML at load time — so it would pin the whole app (start_url "/")
// instead of the want. Serving /w/<id> with those tags already rewritten
// removes the race: the manifest link, the apple-touch-icon, the title and the
// apple-mobile-web-app-title all point at the want before any script runs.
//
// The icon is a static PNG generated at build time per want category
// (web/scripts/gen-want-icons.mjs → /want-icons/<key>-<size>.png). iOS fetches
// an apple-touch-icon by URL at placement time, so it has to be a real file.

var wantHomePathRe = regexp.MustCompile(`^/w/([^/]+)/?$`)

// wantIconKeys mirrors the built-in categories that gen-want-icons.mjs emits a
// file for. Anything else (plugin categories) uses "default".
var wantIconKeys = map[string]bool{
	"travel": true, "mathematics": true, "math": true, "queue": true,
	"approval": true, "system": true, "transport": true, "tunnel": true,
	"effect": true, "ui": true, "utility": true, "web": true,
}

// serveWantHome rewrites the SPA shell's head for /w/<id> and returns true if
// it handled the request. A failure to read the shell or reach the backend for
// the name falls through (returns false) to the ordinary SPA fallback.
func (s *Server) serveWantHome(w http.ResponseWriter, r *http.Request) bool {
	m := wantHomePathRe.FindStringSubmatch(r.URL.Path)
	if m == nil {
		return false
	}
	id := m[1]

	// Only rewrite for a want the backend actually knows — a typo'd id should
	// get the plain shell, not a home icon pinned to a manifest that 404s.
	name, category := s.wantMeta(id)
	if name == "" {
		return false
	}

	raw, err := web.IndexHTML()
	if err != nil {
		return false
	}
	page := string(raw)
	esc := html.EscapeString(name)

	manifestHref := "/api/v1/wants/" + url.PathEscape(id) + "/manifest.webmanifest"

	// Runtime-rendered icon (the SPA uploads the want's real tile icon), else
	// the build-time per-category PNG. See wantIconURL.
	icon180 := s.wantIconURL(id, category, 180)
	icon512 := s.wantIconURL(id, category, 512)

	page = strings.Replace(page,
		`<link rel="manifest" href="/manifest.json" />`,
		`<link rel="manifest" href="`+manifestHref+`" />`, 1)
	page = strings.Replace(page,
		`<link rel="apple-touch-icon" href="resources/agent.png" />`,
		`<link rel="apple-touch-icon" sizes="180x180" href="`+icon180+`" />`, 1)
	page = strings.Replace(page,
		`<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`,
		`<link rel="icon" type="image/png" sizes="512x512" href="`+icon512+`" />`, 1)
	page = strings.Replace(page,
		`<meta name="apple-mobile-web-app-title" content="MyWant" />`,
		`<meta name="apple-mobile-web-app-title" content="`+esc+`" />`, 1)
	page = strings.Replace(page,
		`<title>MyWant Dashboard</title>`,
		`<title>`+esc+`</title>`, 1)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache, must-revalidate")
	_, _ = w.Write([]byte(page))
	return true
}

var wantManifestPathRe = regexp.MustCompile(`^/api/v1/wants/([^/]+)/manifest\.webmanifest$`)

// wantIconURL is the best icon for a want at one size: the runtime-rendered one
// (the SPA uploads the want's real tile icon), else the build-time per-category
// PNG, else the default.
func (s *Server) wantIconURL(id, category string, size int) string {
	if s.hasHomeIcon(id, size) {
		return "/w-home-icon/" + url.PathEscape(id) + "-" + strconv.Itoa(size) + ".png"
	}
	key := "default"
	if wantIconKeys[strings.ToLower(category)] {
		key = strings.ToLower(category)
	}
	return "/want-icons/" + key + "-" + strconv.Itoa(size) + ".png"
}

// serveWantManifest builds the /w/<id> web app manifest here instead of letting
// it proxy to the backend's — so its icons are the want's own (not a generic
// default) and its id/scope are unique per want (so Chrome installs one app per
// want rather than reusing whichever was installed first). Returns true if it
// handled the request; false falls through to the proxy.
func (s *Server) serveWantManifest(w http.ResponseWriter, r *http.Request) bool {
	m := wantManifestPathRe.FindStringSubmatch(r.URL.Path)
	if m == nil {
		return false
	}
	id := m[1]
	name, category := s.wantMeta(id)
	if name == "" {
		return false
	}

	short := []rune(name)
	if len(short) > 14 {
		short = short[:14]
	}
	appID := "/w/" + id
	manifest := map[string]any{
		"name":             name,
		"short_name":       string(short),
		"id":               appID,
		"start_url":        appID,
		"scope":            appID,
		"display":          "standalone",
		"orientation":      "any",
		"background_color": "#1e293b",
		"theme_color":      "#3b82f6",
		"icons": []map[string]any{
			{"src": s.wantIconURL(id, category, 192), "sizes": "192x192", "type": "image/png", "purpose": "maskable any"},
			{"src": s.wantIconURL(id, category, 512), "sizes": "512x512", "type": "image/png", "purpose": "maskable any"},
		},
	}
	w.Header().Set("Content-Type", "application/manifest+json")
	w.Header().Set("Cache-Control", "no-store, must-revalidate")
	_ = json.NewEncoder(w).Encode(manifest)
	return true
}

// wantMeta asks the backend for one want's display name and its type's
// category (for the home icon). Best-effort: an empty name just means /w/<id>
// falls through to the plain shell; an empty category means the default icon.
func (s *Server) wantMeta(id string) (name, category string) {
	var want struct {
		Metadata struct {
			Name string `json:"name"`
			Type string `json:"type"`
		} `json:"metadata"`
	}
	if !s.backendJSON("/api/v1/wants/"+url.PathEscape(id), &want) {
		return "", ""
	}
	name = want.Metadata.Name
	if want.Metadata.Type == "" {
		return name, ""
	}

	var wt struct {
		Category string `json:"category"`
		Metadata struct {
			Category string `json:"category"`
		} `json:"metadata"`
	}
	if s.backendJSON("/api/v1/want-types/"+url.PathEscape(want.Metadata.Type), &wt) {
		if wt.Category != "" {
			category = wt.Category
		} else {
			category = wt.Metadata.Category
		}
	}
	return name, category
}

// backendJSON does a short-timeout GET against the proxied backend and decodes
// the body into v. Returns false on any failure.
func (s *Server) backendJSON(path string, v any) bool {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.config.BackendURL+path, nil)
	if err != nil {
		return false
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return false
	}
	return json.NewDecoder(resp.Body).Decode(v) == nil
}
