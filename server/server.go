package server

import (
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"mywant-gui/buildinfo"
	"mywant-gui/web"
)

type Config struct {
	Port       int
	Host       string
	BackendURL string // e.g. "http://localhost:8080"

	// AuthUser/AuthPassword enable HTTP Basic authentication. Auth is off when
	// AuthPassword is empty, which keeps local development password-free; set
	// it on any deployment reachable from the internet.
	AuthUser     string
	AuthPassword string
}

type Server struct {
	config    Config
	mux       *http.ServeMux
	homeIcons *homeIconStore
}

func New(config Config) *Server {
	s := &Server{config: config, homeIcons: newHomeIconStore()}
	s.mux = http.NewServeMux()

	// Reverse proxy: /api/ and /health → backend
	backend, err := url.Parse(config.BackendURL)
	if err != nil {
		log.Fatalf("invalid backend URL %q: %v", config.BackendURL, err)
	}
	proxy := httputil.NewSingleHostReverseProxy(backend)
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		log.Printf("[proxy] backend unreachable: %v", err)
		http.Error(w, "backend unavailable", http.StatusBadGateway)
	}

	s.mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		// The /w/<id> web app manifest is built here (see want_home.go) so its
		// icons can be the want's own, not the backend's generic default.
		if s.serveWantManifest(w, r) {
			return
		}
		proxy.ServeHTTP(w, r)
	})

	// Served here rather than proxied (the longer pattern wins in ServeMux):
	// the token is derived from this process's own Basic password, which the
	// backend knows nothing about. Reaching this requires Basic auth like any
	// other path — it is how the authenticated setup page learns the token to
	// bake into a bookmarklet, not a way to obtain one without credentials.
	s.mux.HandleFunc("/api/v1/inspector-token", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		token := inspectorToken(config.AuthPassword)
		// No auth configured means no token is needed to reach anything; the
		// setup page uses `enabled` to decide whether to append one at all.
		fmt.Fprintf(w, `{"enabled":%t,"token":%q}`, token != "", token)
	})
	s.mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		proxy.ServeHTTP(w, r)
	})

	// This process's own build, as opposed to /health, which answers for the
	// backend. Served here rather than proxied, and deliberately behind Basic
	// auth like the rest of the API: healthz below is the anonymous endpoint,
	// and naming an exact build to anyone who asks only helps someone shopping
	// for a version with a known hole.
	s.mux.HandleFunc("/api/v1/gui-version", func(w http.ResponseWriter, r *http.Request) {
		version, commit := buildinfo.Get()
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		fmt.Fprintf(w, `{"version":%q,"commit":%q}`, version, commit)
	})

	// Liveness probe for the platform health check. Unlike /health it neither
	// requires authentication nor touches the backend, so the check reports on
	// this process alone.
	s.mux.HandleFunc(healthzPath, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		fmt.Fprintln(w, `{"status":"ok"}`)
	})

	// Extensions installed beside the app — see extensions.go. The list is
	// served here, not proxied: they are installed with this process, not with
	// the backend.
	s.mux.HandleFunc("/api/v1/gui-extensions", s.handleExtensionList)
	s.mux.HandleFunc("/gui-extensions/", s.handleExtensionFile)

	// Per-want home-screen icon: the SPA renders the want's real tile icon and
	// PUTs the PNG; we serve it back at a stable URL. See want_home_icon.go.
	s.mux.HandleFunc("/w-home-icon/", s.handleWantHomeIcon)

	// Tools for an on-device model on another device — see fm.go. Served
	// here, not proxied: they are this process's, built on the backend's API.
	s.mux.HandleFunc("/api/v1/fm/manifest", s.handleFMManifest)
	s.mux.HandleFunc("/api/v1/fm/call", s.handleFMCall)
	s.mux.HandleFunc("/api/v1/fm/said", s.handleFMSaid)

	// Static files (embedded React SPA)
	fs := http.FileServer(web.GetFileSystem(true))
	s.mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Only serve GET/HEAD for static content
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.NotFound(w, r)
			return
		}
		// Strip any double slashes
		r.URL.Path = strings.ReplaceAll(r.URL.Path, "//", "/")

		// /w/<id> gets the SPA shell with its home-screen head tags already
		// rewritten for that want — see want_home.go.
		if s.serveWantHome(w, r) {
			return
		}
		// An extension's own top-level files (public/ in its directory).
		if s.serveExtensionPublic(w, r) {
			return
		}

		// Vite fingerprints everything under /assets/ with a content hash, so
		// those are safe to cache forever — a changed file gets a new name.
		//
		// index.html is the opposite and must NEVER be cached: it is the only
		// thing that names those hashed files, so a stale copy pins the browser
		// to an old build no matter how many times the server is rebuilt. Go's
		// FileServer sends no Cache-Control of its own, which leaves browsers
		// free to apply heuristic caching — exactly the "my rebuild didn't take
		// effect" trap.
		//
		// /resources/ is cached the same way, for a different reason: those are
		// the pictures kinds of thing are drawn over (DataTypeInfo.Background),
		// they ship inside this binary, and they are big. Revalidating them was
		// not merely a round trip — an embedded file has no modification time,
		// so Go's FileServer sends no Last-Modified, the browser has nothing to
		// ask "has this changed?" with, and every visit re-downloaded every
		// picture in full.
		//
		// The cost of caching them forever is that REPLACING one needs a new
		// name — swap the file and the picture is stale in every browser that
		// has seen the old one. Give the new picture its own filename and point
		// the catalog at it (engine datatypes.yaml's `background:`), which is
		// one line changed in the same breath as the picture itself.
		if strings.HasPrefix(r.URL.Path, "/assets/") || strings.HasPrefix(r.URL.Path, "/resources/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			w.Header().Set("Cache-Control", "no-cache, must-revalidate")
		}
		fs.ServeHTTP(w, r)
	})

	return s
}

// handler returns the mux wrapped in Basic auth when a password is configured.
func (s *Server) handler() http.Handler {
	if s.config.AuthPassword == "" {
		return s.mux
	}
	return basicAuth(s.mux, s.config.AuthUser, s.config.AuthPassword)
}

func (s *Server) Start() error {
	addr := fmt.Sprintf("%s:%d", s.config.Host, s.config.Port)
	if s.config.AuthPassword == "" {
		log.Printf("[mywant-gui] WARNING: no auth configured — /api proxies to an " +
			"unauthenticated backend. Set MYWANT_AUTH_PASSWORD before exposing this publicly.")
	} else {
		log.Printf("[mywant-gui] Basic auth enabled for user %q", s.config.AuthUser)
	}
	log.Printf("[mywant-gui] serving on http://%s  →  backend %s", addr, s.config.BackendURL)
	return http.ListenAndServe(addr, s.handler())
}
