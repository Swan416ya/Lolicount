package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/miaoledor/lolicount/internal/imgcore"
	"github.com/miaoledor/lolicount/internal/imgcore/render"
	"github.com/miaoledor/lolicount/internal/imgcore/theme"
	"github.com/miaoledor/lolicount/internal/server"
)

// onePixelGIF is a base64 1x1 transparent GIF, the smallest image payload
// that exercises the ImageLayer render path.
const onePixelGIF = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"

// testTheme builds a minimal single-frame theme so renderThumb can be
// exercised without depending on the embedded theme tree (theme content
// and count must not affect test outcomes).
func testTheme(t *testing.T, name string) *theme.Theme {
	t.Helper()
	return &theme.Theme{
		Name:   name,
		Canvas: theme.Canvas{Width: 10, Height: 10},
		BgW:    10,
		BgH:    10,
		Layers: []imgcore.Layer{
			&render.ImageLayer{
				Src:    "[image omitted]" + onePixelGIF,
				Width:  10,
				Height: 10,
				Z:      0,
			},
		},
	}
}

// TestRenderThumbDeterministic ensures the fixed per-theme seed makes the
// pre-rendered gallery thumb stable: two renders of the same theme must
// produce byte-identical SVG, so re-running the generator never churns
// the committed thumbnails.
func TestRenderThumbDeterministic(t *testing.T) {
	base := testTheme(t, "thumb-test")
	a, err := renderThumb(base, "thumb-test")
	if err != nil {
		t.Fatalf("renderThumb first: %v", err)
	}
	b, err := renderThumb(base, "thumb-test")
	if err != nil {
		t.Fatalf("renderThumb second: %v", err)
	}
	if a != b {
		t.Fatal("renderThumb is not deterministic for the same theme")
	}
	if !strings.HasPrefix(a, "<?xml") || !strings.Contains(a, "<svg") {
		t.Fatalf("renderThumb output does not look like an SVG: %q", a[:min(60, len(a))])
	}
	// unshowf=true (gallery card contract) omits the text layer entirely,
	// so the demo digits must NOT appear in the thumb.
	if strings.Contains(a, server.DemoText) {
		t.Error("renderThumb output should omit the text layer (unshowf)")
	}
}

// TestCleanStale ensures cleanStale removes thumb files whose theme no
// longer exists and keeps everything else, so the output directory never
// ships orphaned thumbnails after a theme removal.
func TestCleanStale(t *testing.T) {
	dir := t.TempDir()
	for _, name := range []string{"keep-a.svg", "keep-b.svg", "gone.svg", "not-a-thumb.txt"} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte("x"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	known := map[string]bool{"keep-a": true, "keep-b": true}
	removed := cleanStale(dir, known)
	if removed != 1 {
		t.Fatalf("cleanStale removed %d, want 1", removed)
	}
	if _, err := os.Stat(filepath.Join(dir, "gone.svg")); !os.IsNotExist(err) {
		t.Error("cleanStale kept an orphaned thumb file")
	}
	for _, name := range []string{"keep-a.svg", "keep-b.svg", "not-a-thumb.txt"} {
		if _, err := os.Stat(filepath.Join(dir, name)); err != nil {
			t.Errorf("cleanStale removed %q: %v", name, err)
		}
	}
}
