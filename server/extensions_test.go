package server

import "testing"

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
