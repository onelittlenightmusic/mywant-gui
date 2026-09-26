package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func okHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("reached"))
	})
}

func TestBasicAuth(t *testing.T) {
	h := basicAuth(okHandler(), "mywant", "s3cret")

	tests := []struct {
		name     string
		path     string
		user     string
		pass     string
		withAuth bool
		want     int
	}{
		{name: "correct credentials", path: "/", user: "mywant", pass: "s3cret", withAuth: true, want: http.StatusOK},
		{name: "no credentials", path: "/", want: http.StatusUnauthorized},
		{name: "wrong password", path: "/", user: "mywant", pass: "nope", withAuth: true, want: http.StatusUnauthorized},
		{name: "wrong user", path: "/", user: "someone", pass: "s3cret", withAuth: true, want: http.StatusUnauthorized},
		{name: "empty credentials", path: "/", user: "", pass: "", withAuth: true, want: http.StatusUnauthorized},

		// The API proxies to a backend with no auth of its own, so it must be
		// covered too — not just the SPA.
		{name: "api without credentials", path: "/api/v1/wants", want: http.StatusUnauthorized},
		{name: "api with credentials", path: "/api/v1/wants", user: "mywant", pass: "s3cret", withAuth: true, want: http.StatusOK},

		// /health proxies to the backend, so it must stay protected.
		{name: "health without credentials", path: "/health", want: http.StatusUnauthorized},

		// /healthz is the platform liveness probe and must stay open, or the
		// health check fails the moment auth is switched on.
		{name: "healthz without credentials", path: "/healthz", want: http.StatusOK},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tc.path, nil)
			if tc.withAuth {
				req.SetBasicAuth(tc.user, tc.pass)
			}
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)

			if rec.Code != tc.want {
				t.Errorf("GET %s = %d, want %d", tc.path, rec.Code, tc.want)
			}
		})
	}
}

func TestBasicAuthChallengeHeader(t *testing.T) {
	h := basicAuth(okHandler(), "mywant", "s3cret")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))

	// Without this header the browser never shows a login prompt.
	if got := rec.Header().Get("WWW-Authenticate"); got == "" {
		t.Error("401 response is missing WWW-Authenticate; browsers will not prompt")
	}
	if got := rec.Header().Get("Cache-Control"); got != "no-store" {
		t.Errorf("Cache-Control = %q, want no-store", got)
	}
}

func TestHandlerDisabledWithoutPassword(t *testing.T) {
	// Local development must keep working without credentials.
	s := &Server{config: Config{AuthUser: "mywant"}, mux: http.NewServeMux()}
	s.mux.Handle("/", okHandler())

	rec := httptest.NewRecorder()
	s.handler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))

	if rec.Code != http.StatusOK {
		t.Errorf("with no password configured, got %d, want %d", rec.Code, http.StatusOK)
	}
}

func TestHandlerEnabledWithPassword(t *testing.T) {
	s := &Server{config: Config{AuthUser: "mywant", AuthPassword: "s3cret"}, mux: http.NewServeMux()}
	s.mux.Handle("/", okHandler())

	rec := httptest.NewRecorder()
	s.handler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("with a password configured, got %d, want %d", rec.Code, http.StatusUnauthorized)
	}
}

func TestInspectorTokenAccess(t *testing.T) {
	const password = "s3cret"
	h := basicAuth(okHandler(), "mywant", password)
	token := inspectorToken(password)

	if token == "" {
		t.Fatal("inspectorToken returned empty for a configured password")
	}

	tests := []struct {
		name   string
		path   string
		query  string
		header string
		want   int
	}{
		// The bookmarklet's own three stops.
		{name: "loader with token", path: "/inspector-overlay.standalone.js", query: token, want: http.StatusOK},
		{name: "web-wants with token", path: "/api/v1/web-wants/capture", query: token, want: http.StatusOK},
		{name: "webhook with token", path: "/api/v1/webhooks/abc123", query: token, want: http.StatusOK},
		{name: "token via header", path: "/api/v1/web-wants/capture", header: token, want: http.StatusOK},

		// A token is not a password: everything outside the allowlist stays shut,
		// which is the whole point of deriving a scoped credential.
		{name: "token cannot read wants", path: "/api/v1/wants", query: token, want: http.StatusUnauthorized},
		{name: "token cannot load the SPA", path: "/", query: token, want: http.StatusUnauthorized},
		{name: "token cannot fetch itself", path: "/api/v1/inspector-token", query: token, want: http.StatusUnauthorized},

		{name: "wrong token", path: "/api/v1/web-wants/capture", query: "deadbeef", want: http.StatusUnauthorized},
		{name: "no token", path: "/api/v1/web-wants/capture", want: http.StatusUnauthorized},
		// Prefix matching must not let a lookalike path through.
		{name: "lookalike path", path: "/api/v1/web-wants-secret", query: token, want: http.StatusUnauthorized},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			url := tc.path
			if tc.query != "" {
				url += "?" + inspectorTokenParam + "=" + tc.query
			}
			req := httptest.NewRequest(http.MethodGet, url, nil)
			if tc.header != "" {
				req.Header.Set(inspectorTokenHeader, tc.header)
			}
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)
			if rec.Code != tc.want {
				t.Errorf("GET %s = %d, want %d", url, rec.Code, tc.want)
			}
		})
	}
}

func TestInspectorTokenDerivation(t *testing.T) {
	// Empty when auth is off — there is nothing to bypass, and an empty token
	// must never be accepted as a match for an empty query parameter.
	if got := inspectorToken(""); got != "" {
		t.Errorf("inspectorToken(\"\") = %q, want empty", got)
	}
	// Stable across calls (bookmarklets survive restarts) but tied to the
	// password (rotating it invalidates them).
	if inspectorToken("a") != inspectorToken("a") {
		t.Error("token is not stable for the same password")
	}
	if inspectorToken("a") == inspectorToken("b") {
		t.Error("different passwords produced the same token")
	}
}

// TestInspectorTokenEndToEnd exercises the real mux — the token endpoint and
// the loader path a bookmarklet actually hits — rather than basicAuth alone.
func TestInspectorTokenEndToEnd(t *testing.T) {
	s := New(Config{
		BackendURL:   "http://127.0.0.1:1",
		AuthUser:     "mywant",
		AuthPassword: "s3cret",
	})
	h := s.handler()

	// The setup page reads the token, and needs Basic auth to do it.
	req := httptest.NewRequest(http.MethodGet, "/api/v1/inspector-token", nil)
	req.SetBasicAuth("mywant", "s3cret")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("token endpoint with Basic auth = %d, want 200", rec.Code)
	}
	body := rec.Body.String()
	want := inspectorToken("s3cret")
	if !strings.Contains(body, want) || !strings.Contains(body, `"enabled":true`) {
		t.Fatalf("token endpoint body = %s, want it to contain %q and enabled:true", body, want)
	}

	// Unauthenticated, it must not hand the token out.
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/inspector-token", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("token endpoint without credentials = %d, want 401", rec.Code)
	}

	// The loader the bookmarklet injects: reachable with the token, not without.
	// 404 is a pass here — it means auth let the request through to the static
	// file server, which is what is under test (the asset is a build artifact
	// that may not exist in a bare checkout).
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet,
		"/inspector-overlay.standalone.js?mywant_token="+want, nil))
	if rec.Code == http.StatusUnauthorized {
		t.Error("loader with a valid token was rejected")
	}

	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/inspector-overlay.standalone.js", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("loader without a token = %d, want 401", rec.Code)
	}
}

// TestNoTokenWithoutPassword: with auth off there is no token, and an empty
// mywant_token must not be treated as a match.
func TestNoTokenWithoutPassword(t *testing.T) {
	h := basicAuth(okHandler(), "mywant", "")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet,
		"/api/v1/web-wants/capture?mywant_token=", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("empty token against empty password = %d, want 401", rec.Code)
	}
}
