package server

import (
	"bytes"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
)

// Per-want home-screen icon cache.
//
// The /w/<id> page renders the want's icon exactly as the board tile does —
// with the live type/category-icon labels, brand marks and the viewer's icon
// font, none of which exist at frontend build time — draws it to a canvas and
// PUTs the PNG here. This process just holds the bytes and serves them back at
// a stable URL for the apple-touch-icon. Nothing is derived here and nothing is
// persisted: a restart just means the SPA re-uploads next time /w/<id> opens.
// Until an upload lands, the page falls back to the build-time per-category
// icon under /want-icons/.

const (
	homeIconMaxBytes = 768 << 10 // a 512px gradient PNG runs ~250 KB
	homeIconMaxItems = 400       // ~ two sizes for a couple hundred wants
)

var pngMagic = []byte{0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a}

type homeIconStore struct {
	mu    sync.RWMutex
	items map[string][]byte
	order []string // insertion order, for drop-oldest eviction
}

func newHomeIconStore() *homeIconStore {
	return &homeIconStore{items: make(map[string][]byte)}
}

func (s *homeIconStore) get(key string) ([]byte, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	b, ok := s.items[key]
	return b, ok
}

func (s *homeIconStore) put(key string, b []byte) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.items[key]; !exists {
		s.order = append(s.order, key)
		for len(s.order) > homeIconMaxItems {
			oldest := s.order[0]
			s.order = s.order[1:]
			delete(s.items, oldest)
		}
	}
	s.items[key] = b
}

// homeIconKey is "<id>-<size>".
func homeIconKey(id string, size int) string {
	return id + "-" + strconv.Itoa(size)
}

// normHomeIconSize snaps an uploaded size to the buckets the page and the
// manifest ask for (apple-touch-icon 180, manifest 192 / 512).
func normHomeIconSize(raw string) int {
	switch n, _ := strconv.Atoi(raw); {
	case n >= 384:
		return 512
	case n >= 186:
		return 192
	default:
		return 180
	}
}

// handleWantHomeIcon serves GET /w-home-icon/<id>-<size>.png and
// PUT /w-home-icon/<id>?size=<size>.
func (s *Server) handleWantHomeIcon(w http.ResponseWriter, r *http.Request) {
	rest := strings.TrimPrefix(r.URL.Path, "/w-home-icon/")

	switch r.Method {
	case http.MethodPut:
		id := rest
		if id == "" || strings.Contains(id, "/") {
			http.Error(w, "bad want id", http.StatusBadRequest)
			return
		}
		size := normHomeIconSize(r.URL.Query().Get("size"))
		body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, homeIconMaxBytes))
		if err != nil {
			http.Error(w, "too large", http.StatusRequestEntityTooLarge)
			return
		}
		if !bytes.HasPrefix(body, pngMagic) {
			http.Error(w, "not a png", http.StatusUnsupportedMediaType)
			return
		}
		s.homeIcons.put(homeIconKey(id, size), body)
		w.WriteHeader(http.StatusNoContent)

	case http.MethodGet, http.MethodHead:
		name := strings.TrimSuffix(rest, ".png")
		b, ok := s.homeIcons.get(name)
		if !ok {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "image/png")
		w.Header().Set("Cache-Control", "no-cache, must-revalidate")
		if r.Method == http.MethodHead {
			w.WriteHeader(http.StatusOK)
			return
		}
		_, _ = w.Write(b)

	default:
		w.Header().Set("Allow", "GET, HEAD, PUT")
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

// hasHomeIcon reports whether a runtime-uploaded icon exists for this want at
// the given size — used by serveWantHome to prefer it in the pre-JS HTML.
func (s *Server) hasHomeIcon(id string, size int) bool {
	_, ok := s.homeIcons.get(homeIconKey(id, size))
	return ok
}
