// Package buildinfo answers "which build is this?" for both halves of
// mywant-gui: the CLI in your hand and the server process it talks to.
//
// The value is never written by hand. The release build stamps the git tag
// into main.version (-X, see .goreleaser.yaml), main hands it here, and a
// build with no stamp at all falls back to what the toolchain recorded rather
// than inventing a number.
package buildinfo

import (
	"runtime/debug"
	"sync"
)

var injectedVersion = "dev"

// SetVersion records the version of the binary embedding this package. Call it
// before serving; an empty value is ignored so callers can pass their
// (possibly unstamped) main.version unconditionally.
func SetVersion(v string) {
	if v != "" {
		injectedVersion = v
	}
}

// Get reports the running binary's version and source commit. It is resolved
// once, lazily, so SetVersion still lands if it runs after init.
var Get = sync.OnceValues(resolve)

func resolve() (version string, commit string) {
	version = injectedVersion

	bi, ok := debug.ReadBuildInfo()
	if !ok {
		return version, ""
	}

	dirty := false
	for _, s := range bi.Settings {
		switch s.Key {
		case "vcs.revision":
			commit = s.Value
			if len(commit) > 7 {
				commit = commit[:7]
			}
		case "vcs.modified":
			dirty = s.Value == "true"
		}
	}

	// Nothing was stamped in — built straight from source, or `go run`. Use
	// whatever the toolchain recorded so the answer is still true: `go install
	// module@v1.2.3` puts the tag in Main.Version, while a plain `go build`
	// puts the placeholder "(devel)" there, which says nothing.
	if version == "dev" {
		switch {
		case bi.Main.Version != "" && bi.Main.Version != "(devel)":
			version = bi.Main.Version
		case commit != "":
			version = "dev+" + commit
			if dirty {
				version += "-dirty"
			}
		}
	}

	return version, commit
}
