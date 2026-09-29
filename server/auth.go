package server

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"net/http"
	"strings"
)

// healthzPath is served without authentication so the platform health check
// keeps passing once Basic auth is switched on. It is also independent of the
// backend, unlike /health which proxies through.
const healthzPath = "/healthz"

// inspectorTokenParam is the query parameter carrying a capability token, and
// inspectorTokenHeader its header equivalent.
const (
	inspectorTokenParam  = "mywant_token"
	inspectorTokenHeader = "X-MyWant-Inspector-Token"
)

// inspectorTokenPaths are the only paths a capability token can reach. Kept
// deliberately narrow: the token travels in a bookmark URL and in server access
// logs, so it must never be equivalent to the Basic password. Everything else —
// the SPA, every other API route — still requires Basic auth.
var inspectorTokenPaths = []string{
	"/inspector-overlay.standalone.js", // the loader the bookmarklet injects
	"/mywant-embed.js",                 // the GUI's components it mounts (mywant-guiex's embed bundle)
	"/api/v1/web-wants/",               // active-inspection, capture, suggest-name
	"/api/v1/webhooks/",                // per-session capture webhook
	"/api/v1/system/pause",             // the control pill's emergency stop
	"/api/v1/speech",                   // the control pill's talk field, and the robot's answer
	"/api/v1/attention",                // the control pill's attention button (read-only)
}

// inspectorToken derives the Web Inspector capability token from the Basic auth
// password.
//
// Derived rather than stored so there is no new secret at rest and no state to
// keep in sync across restarts or between Fly machines — and so that rotating
// MYWANT_AUTH_PASSWORD invalidates every bookmarklet that carries the old one.
// Returns "" when auth is off, where a token would be meaningless.
func inspectorToken(password string) string {
	if password == "" {
		return ""
	}
	mac := hmac.New(sha256.New, []byte(password))
	mac.Write([]byte("mywant-web-inspector-v1"))
	return hex.EncodeToString(mac.Sum(nil))[:32]
}

// tokenAllowedPath reports whether path may be reached with a capability token.
func tokenAllowedPath(path string) bool {
	for _, p := range inspectorTokenPaths {
		if path == p || (strings.HasSuffix(p, "/") && strings.HasPrefix(path, p)) {
			return true
		}
	}
	return false
}

// basicAuth wraps h with HTTP Basic authentication, exempting healthzPath.
//
// mywant-gui proxies /api/* to a backend that has no authentication of its own,
// so this middleware is the only thing standing between the public internet and
// full read/write access to every want.
//
// The bookmarklet cannot use Basic auth at all: Chrome does not attach cached
// credentials to cross-origin subresource loads (measured — a <script> to this
// origin from a third-party page fails while the same URL loads same-origin),
// and it suppresses the auth prompt there too, so the failure is silent. A
// capability token on the few inspector paths is the way in for that flow.
func basicAuth(h http.Handler, user, password string) http.Handler {
	// Compare digests rather than the raw values: fixed-length inputs keep the
	// constant-time comparison meaningful and stop the credential length from
	// leaking through timing.
	wantUser := sha256.Sum256([]byte(user))
	wantPass := sha256.Sum256([]byte(password))
	wantToken := inspectorToken(password)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == healthzPath {
			h.ServeHTTP(w, r)
			return
		}

		gotUser, gotPass, ok := r.BasicAuth()
		if ok {
			u := sha256.Sum256([]byte(gotUser))
			p := sha256.Sum256([]byte(gotPass))
			// Bitwise AND, not &&, so both comparisons always run and the
			// response time does not reveal which half was wrong.
			if subtle.ConstantTimeCompare(u[:], wantUser[:])&
				subtle.ConstantTimeCompare(p[:], wantPass[:]) == 1 {
				h.ServeHTTP(w, r)
				return
			}
		}

		if wantToken != "" && tokenAllowedPath(r.URL.Path) {
			got := r.Header.Get(inspectorTokenHeader)
			if got == "" {
				got = r.URL.Query().Get(inspectorTokenParam)
			}
			if subtle.ConstantTimeCompare([]byte(got), []byte(wantToken)) == 1 {
				h.ServeHTTP(w, r)
				return
			}
		}

		w.Header().Set("WWW-Authenticate", `Basic realm="MyWant", charset="UTF-8"`)
		// Never let a browser or proxy cache a 401.
		w.Header().Set("Cache-Control", "no-store")
		http.Error(w, "unauthorized", http.StatusUnauthorized)
	})
}
