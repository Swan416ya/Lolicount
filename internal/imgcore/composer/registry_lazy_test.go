package composer

import (
	"strings"
	"testing"

	"github.com/miaoledor/lolicount/internal/imgcore/render"
	"github.com/miaoledor/lolicount/internal/imgcore/theme"
)

// srcsOf extracts the image sources referenced by a theme snapshot.
func srcsOf(t *testing.T, th *theme.Theme) []string {
	t.Helper()
	var out []string
	for _, l := range th.Layers {
		switch layer := l.(type) {
		case *render.RandomPickLayer:
			for _, o := range layer.Options {
				out = append(out, o.Src)
			}
		case *render.GroupLayer:
			for _, p := range layer.Parts {
				out = append(out, p.Src)
			}
		case *render.ImageLayer:
			out = append(out, layer.Src)
		}
	}
	return out
}

// TestRegistryPrepareRenderSwapsSlot pins the one-image-per-slot swap
// contract: the resident assembly evolves by exactly one candidate per
// PrepareRender call (the swap rotates the picked slot to a DIFFERENT
// candidate), and each call returns an isolated deep snapshot.
func TestRegistryPrepareRenderSwapsSlot(t *testing.T) {
	reg, errs := NewThemeRegistry()
	if len(errs) > 0 {
		t.Fatalf("registry errors: %v", errs)
	}
	prep, ok := reg.(RenderPreparer)
	if !ok {
		t.Fatal("registry does not implement RenderPreparer")
	}

	// lian-ren: multi-slot character theme (brow/eye/mouth/face/lass...).
	s1, err := prep.PrepareRender("lian-ren")
	if err != nil {
		t.Fatalf("prepare 1: %v", err)
	}
	s2, err := prep.PrepareRender("lian-ren")
	if err != nil {
		t.Fatalf("prepare 2: %v", err)
	}
	srcs1, srcs2 := srcsOf(t, s1), srcsOf(t, s2)
	if len(srcs1) == 0 || len(srcs1) != len(srcs2) {
		t.Fatalf("slot count mismatch: %d vs %d", len(srcs1), len(srcs2))
	}
	diffs := 0
	for i := range srcs1 {
		if srcs1[i] != srcs2[i] {
			diffs++
		}
	}
	if diffs == 0 {
		t.Errorf("two PrepareRender calls produced identical assemblies; want exactly one slot evolved")
	}
	if diffs > 1 {
		t.Errorf("got %d changed slots between consecutive snapshots, want exactly 1", diffs)
	}

	// Snapshot isolation: mutating the snapshot's parts must not affect
	// the registry's resident assembly.
	gl1, ok := s1.Layers[0].(*render.GroupLayer)
	if !ok {
		t.Fatalf("lian-ren layer 0 is %T, want *render.GroupLayer", s1.Layers[0])
	}
	oldSrc := gl1.Parts[0].Src
	gl1.Parts[0].Src = "data:image/gif;base64,TAMPERED"
	base, _ := reg.Get("lian-ren")
	baseGL, ok := base.Layers[0].(*render.GroupLayer)
	if !ok {
		t.Fatalf("base layer 0 is %T, want *render.GroupLayer", base.Layers[0])
	}
	if baseGL.Parts[0].Src == "data:image/gif;base64,TAMPERED" {
		t.Errorf("snapshot mutation leaked into the resident assembly")
	}
	_ = oldSrc

	// Both snapshots render successfully via Compose.
	for i, th := range []*theme.Theme{s1, s2} {
		if _, err := Compose(ComposeParams{Theme: th, Seed: "test", CountText: "0123456789"}); err != nil {
			t.Fatalf("compose snapshot %d: %v", i, err)
		}
	}
}

// TestRegistryFrameThemeSwap pins the frame-theme variant of the swap:
// the resident assembly holds exactly ONE loaded frame (one option),
// and each PrepareRender rotates it to a different frame.
func TestRegistryFrameThemeSwap(t *testing.T) {
	reg, errs := NewThemeRegistry()
	if len(errs) > 0 {
		t.Fatalf("registry errors: %v", errs)
	}
	prep := reg.(RenderPreparer)
	base, ok := reg.Get("wenders")
	if !ok {
		t.Fatal("wenders missing")
	}
	rp, ok := base.Layers[0].(*render.RandomPickLayer)
	if !ok || len(rp.Options) != 1 {
		t.Fatalf("wenders resident should hold exactly 1 frame, got %T with %d options", base.Layers[0], len(rp.Options))
	}

	s1, err := prep.PrepareRender("wenders")
	if err != nil {
		t.Fatalf("prepare 1: %v", err)
	}
	s2, err := prep.PrepareRender("wenders")
	if err != nil {
		t.Fatalf("prepare 2: %v", err)
	}
	srcs1, srcs2 := srcsOf(t, s1), srcsOf(t, s2)
	if len(srcs1) != 1 || len(srcs2) != 1 {
		t.Fatalf("frame theme should expose exactly one loaded frame, got %d/%d", len(srcs1), len(srcs2))
	}
	if srcs1[0] == srcs2[0] {
		t.Errorf("consecutive swaps kept the same frame; want rotation to a different one")
	}
	if !strings.HasPrefix(srcs1[0], "data:image/") {
		t.Errorf("frame src should be a data URI, got %.40s", srcs1[0])
	}
}

// TestRegistryVariantsFromCatalog pins the List contract under the lazy
// strategy: Variants comes from the full candidate catalog (product
// across slots), not the one-candidate-per-slot resident assembly.
func TestRegistryVariantsFromCatalog(t *testing.T) {
	reg, errs := NewThemeRegistry()
	if len(errs) > 0 {
		t.Fatalf("registry errors: %v", errs)
	}
	var lian *ThemeEntry
	for _, e := range reg.List() {
		if e.Name == "lian-ren" {
			lian = &e
			break
		}
	}
	if lian == nil {
		t.Fatal("lian-ren missing from List")
	}
	// README-documented combination count for lian-ren.
	if lian.Variants != 311040 {
		t.Errorf("lian-ren variants: got %d want 311040", lian.Variants)
	}
}

// TestRegistryCanvasStableAcrossSwaps pins canvas stability for frame
// themes whose frames differ in size: every snapshot carries the
// catalog's max frame dims, so the embedded image's aspect ratio does
// not jump between requests. Skips when the theme's frames are uniform.
func TestRegistryCanvasStableAcrossSwaps(t *testing.T) {
	reg, errs := NewThemeRegistry()
	if len(errs) > 0 {
		t.Fatalf("registry errors: %v", errs)
	}
	prep := reg.(RenderPreparer)
	e, ok := reg.(*unifiedRegistry).themes["wenders"]
	if !ok {
		t.Fatal("wenders missing")
	}
	// Skip uniform-frame themes: nothing to stabilize.
	uniform := true
	for _, s := range e.cat.Slots {
		for _, c := range s.Candidates {
			if c.Width != e.cat.CanvasW || c.Height != e.cat.CanvasH {
				uniform = false
			}
		}
	}
	if uniform {
		t.Skip("wenders frames are uniform; canvas stability is trivial")
	}

	seen := map[[2]int]bool{}
	for i := 0; i < 6; i++ {
		s, err := prep.PrepareRender("wenders")
		if err != nil {
			t.Fatalf("prepare %d: %v", i, err)
		}
		seen[[2]int{s.Canvas.Width, s.Canvas.Height}] = true
	}
	if len(seen) != 1 {
		t.Errorf("canvas dims changed across swaps: %v", seen)
	}
	for dims := range seen {
		if dims != [2]int{e.cat.CanvasW, e.cat.CanvasH} {
			t.Errorf("canvas %dx%d != catalog max %dx%d", dims[0], dims[1], e.cat.CanvasW, e.cat.CanvasH)
		}
	}
}
