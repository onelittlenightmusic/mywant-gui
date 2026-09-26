package server

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strings"

	"mywant-gui/buildinfo"
)

// GUI extensions: parts of the GUI installed beside it rather than built in.
//
// Each is a directory under ~/.mywant/gui-extensions (or
// $MYWANT_GUI_EXTENSIONS_DIR) holding a gui-extension.json, the script and
// stylesheets it names, and optionally a public/ directory whose files are
// served at the site root (an extension's own top-level URLs — the
// bookmarklet's overlay, say).
//
// The frontend asks for the list before its first render and loads each
// script, which registers itself with the app's extension registry (see
// web/src/extensions/runtime.ts). A script is written against the modules of
// one build of the app, so only extensions built for the running version are
// listed; any other is skipped and the log says why.

// extensionManifest is gui-extension.json.
type extensionManifest struct {
	Name    string `json:"name"`
	Version string `json:"version,omitempty"`
	// Requires is the version of mywant-gui the extension was built against.
	Requires string   `json:"requires,omitempty"`
	Script   string   `json:"script"`
	Styles   []string `json:"styles,omitempty"`
	// Public is a directory, relative to the extension, served at the site root.
	Public string `json:"public,omitempty"`
}

// extensionEntry is what the frontend is given for one extension.
type extensionEntry struct {
	Name    string   `json:"name"`
	Version string   `json:"version,omitempty"`
	Script  string   `json:"script"`
	Styles  []string `json:"styles,omitempty"`
}

// ExtensionsDir is where GUI extensions are installed.
func ExtensionsDir() string {
	if d := os.Getenv("MYWANT_GUI_EXTENSIONS_DIR"); d != "" {
		return d
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".mywant", "gui-extensions")
}

// A release version: v1.2.3 with nothing after it. Anything else — "dev", a
// git describe past a tag, a dirty tree — is a build being worked on.
var releaseVersion = regexp.MustCompile(`^v?\d+\.\d+\.\d+$`)

// compatible reports whether an extension built for `requires` may run on
// this build. Two releases must be the same release. A development build on
// either side is allowed, since that is how an extension is developed against
// the app — and logged, since it is not a promise.
func compatible(requires, running string) (bool, string) {
	req := strings.TrimPrefix(requires, "v")
	run := strings.TrimPrefix(running, "v")
	switch {
	case requires == "":
		return true, "declares no required version"
	case !releaseVersion.MatchString(requires) || !releaseVersion.MatchString(running):
		return true, "development build (requires " + requires + ", running " + running + ")"
	case req == run:
		return true, ""
	default:
		return false, "built for mywant-gui " + requires + ", this is " + running
	}
}

// installedExtensions reads every extension directory that has a manifest.
func installedExtensions() map[string]extensionManifest {
	out := map[string]extensionManifest{}
	entries, err := os.ReadDir(ExtensionsDir())
	if err != nil {
		return out
	}
	for _, e := range entries {
		dir := filepath.Join(ExtensionsDir(), e.Name())
		if info, err := os.Stat(dir); err != nil || !info.IsDir() {
			continue
		}
		data, err := os.ReadFile(filepath.Join(dir, "gui-extension.json"))
		if err != nil {
			continue
		}
		var m extensionManifest
		if err := json.Unmarshal(data, &m); err != nil || m.Script == "" {
			log.Printf("[gui-extensions] %s: unreadable gui-extension.json: %v", e.Name(), err)
			continue
		}
		m.Name = e.Name() // the directory is the name the URLs use
		out[e.Name()] = m
	}
	return out
}

// loadableExtensions is installedExtensions less those built for another
// version. It runs for every file an extension serves, so it says why only
// when asked to (the list, which is fetched once per page load).
func loadableExtensions(explain bool) map[string]extensionManifest {
	running, _ := buildinfo.Get()
	out := map[string]extensionManifest{}
	for name, m := range installedExtensions() {
		ok, why := compatible(m.Requires, running)
		if explain && why != "" {
			if ok {
				log.Printf("[gui-extensions] %s loaded: %s", name, why)
			} else {
				log.Printf("[gui-extensions] %s skipped: %s", name, why)
			}
		}
		if !ok {
			continue
		}
		out[name] = m
	}
	return out
}

func (s *Server) handleExtensionList(w http.ResponseWriter, r *http.Request) {
	list := []extensionEntry{}
	for name, m := range loadableExtensions(true) {
		// The version rides along so a reinstall is a new URL to the browser.
		q := "?v=" + m.Version
		e := extensionEntry{Name: name, Version: m.Version, Script: "/gui-extensions/" + name + "/" + m.Script + q}
		for _, st := range m.Styles {
			e.Styles = append(e.Styles, "/gui-extensions/"+name+"/"+st+q)
		}
		list = append(list, e)
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(list)
}

// safeJoin joins a URL path under dir, refusing anything that would leave it.
func safeJoin(dir, urlPath string) (string, bool) {
	clean := path.Clean("/" + urlPath)
	full := filepath.Join(dir, filepath.FromSlash(clean))
	if full != dir && !strings.HasPrefix(full, dir+string(filepath.Separator)) {
		return "", false
	}
	return full, true
}

// handleExtensionFile serves /gui-extensions/<name>/<file>.
func (s *Server) handleExtensionFile(w http.ResponseWriter, r *http.Request) {
	rest := strings.TrimPrefix(r.URL.Path, "/gui-extensions/")
	name, file, ok := strings.Cut(rest, "/")
	if !ok || name == "" || file == "" {
		http.NotFound(w, r)
		return
	}
	if _, loadable := loadableExtensions(false)[name]; !loadable {
		http.NotFound(w, r)
		return
	}
	full, ok := safeJoin(filepath.Join(ExtensionsDir(), name), file)
	if !ok {
		http.NotFound(w, r)
		return
	}
	if info, err := os.Stat(full); err != nil || info.IsDir() {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Cache-Control", "no-cache, must-revalidate")
	http.ServeFile(w, r, full)
}

// serveExtensionPublic serves a root path from an extension's public/, and
// reports whether it did. Asked before the SPA, which answers every unknown
// path with its shell.
func (s *Server) serveExtensionPublic(w http.ResponseWriter, r *http.Request) bool {
	if r.URL.Path == "/" || strings.HasPrefix(r.URL.Path, "/assets/") {
		return false
	}
	for name, m := range loadableExtensions(false) {
		if m.Public == "" {
			continue
		}
		root, ok := safeJoin(filepath.Join(ExtensionsDir(), name), m.Public)
		if !ok {
			continue
		}
		full, ok := safeJoin(root, r.URL.Path)
		if !ok {
			continue
		}
		if info, err := os.Stat(full); err == nil && !info.IsDir() {
			w.Header().Set("Cache-Control", "no-cache, must-revalidate")
			http.ServeFile(w, r, full)
			return true
		}
	}
	return false
}
