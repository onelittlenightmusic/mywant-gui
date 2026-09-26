package server

import (
	"os"
	"path/filepath"
	"testing"
)

func TestCompatible(t *testing.T) {
	cases := []struct {
		requires, running string
		want              bool
	}{
		{"v0.6.106", "v0.6.106", true},
		{"0.6.106", "v0.6.106", true},
		{"v0.6.106", "v0.6.107", false},
		{"", "v0.6.106", true},
		{"v0.6.106", "dev", true},
		{"v0.6.106-3-gabc1234", "v0.6.106", true},
		{"v0.6.106", "v0.6.106-dirty", true},
	}
	for _, c := range cases {
		if got, _ := compatible(c.requires, c.running); got != c.want {
			t.Errorf("compatible(%q, %q) = %v, want %v", c.requires, c.running, got, c.want)
		}
	}
}

func TestSafeJoin(t *testing.T) {
	// path.Clean roots the path first, so ".." cannot climb out of dir.
	if p, ok := safeJoin("/x/ext", "../../etc/passwd"); !ok || p != "/x/ext/etc/passwd" {
		t.Fatalf("safeJoin escaped or refused: %q %v", p, ok)
	}
	if p, ok := safeJoin("/x/ext", "a/b.js"); !ok || p != "/x/ext/a/b.js" {
		t.Fatalf("safeJoin = %q %v", p, ok)
	}
}

func TestInstalledExtensions(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("MYWANT_GUI_EXTENSIONS_DIR", dir)
	ext := filepath.Join(dir, "guiex")
	if err := os.MkdirAll(ext, 0o755); err != nil {
		t.Fatal(err)
	}
	os.WriteFile(filepath.Join(ext, "gui-extension.json"),
		[]byte(`{"name":"ignored","version":"v1","requires":"v0.6.106","script":"guiex.js","public":"public"}`), 0o644)
	os.MkdirAll(filepath.Join(dir, "no-manifest"), 0o755)

	got := installedExtensions()
	m, ok := got["guiex"]
	if !ok || len(got) != 1 {
		t.Fatalf("installedExtensions = %v", got)
	}
	if m.Name != "guiex" || m.dir != ext || m.Requires != "v0.6.106" {
		t.Fatalf("manifest = %+v", m)
	}
}
