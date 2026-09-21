package server

import (
	"testing"
	"testing/fstest"
)

// mapFile is a helper to build fstest.MapFS entries with a string body.
func mapFile(data string) *fstest.MapFile {
	return &fstest.MapFile{Data: []byte(data)}
}

// TestLive2dHasManifest verifies the model-directory recognizer across the two
// Cubism manifest flavors. A directory is a model if it holds a Cubism 3
// manifest (model3.json / <name>.model3.json) OR a Cubism 2 / BanG Dream
// manifest (model.json / <name>.model.json). Subdirectories (motion groups,
// expression folders) never count, and a directory with only non-manifest files
// (textures, moc binaries) is not a model.
func TestLive2dHasManifest(t *testing.T) {
	cases := []struct {
		name   string
		fsys   fstest.MapFS
		dir    string
		expect bool
	}{
		{
			name:   "cubism3 model3.json",
			fsys:   fstest.MapFS{"m3/model3.json": mapFile(`{"Version":4}`), "m3/m.moc3": mapFile("moc3"), "m3/tex_00.png": mapFile("png")},
			dir:    "m3",
			expect: true,
		},
		{
			name:   "cubism3 named manifest",
			fsys:   fstest.MapFS{"m3/char.model3.json": mapFile(`{"Version":4}`)},
			dir:    "m3",
			expect: true,
		},
		{
			// BanG Dream / Cubism 2 — the format BD ships.
			name:   "cubism2 model.json (banG dream)",
			fsys:   fstest.MapFS{"bd/model.json": mapFile(`{"version":2,"name":"kasumi","model":"kasumi.moc","textures":["kasumi.png"]}`), "bd/kasumi.moc": mapFile("moc"), "bd/kasumi.png": mapFile("png")},
			dir:    "bd",
			expect: true,
		},
		{
			name:   "cubism2 named manifest",
			fsys:   fstest.MapFS{"bd/char.model.json": mapFile(`{"version":2}`)},
			dir:    "bd",
			expect: true,
		},
		{
			name:   "only moc + texture, no manifest",
			fsys:   fstest.MapFS{"nm/kasumi.moc": mapFile("moc"), "nm/kasumi.png": mapFile("png")},
			dir:    "nm",
			expect: false,
		},
		{
			name:   "motion group subdir doesn't change the top-level manifest",
			fsys:   fstest.MapFS{"dg/model.json": mapFile(`{"version":2}`), "dg/motion/a.mtn": mapFile("mtn"), "dg/expression/b.json": mapFile("exp")},
			dir:    "dg",
			expect: true,
		},
		{
			// A manifest nested in a subdirectory is NOT a model manifest.
			name:   "manifest nested in subdir does not count",
			fsys:   fstest.MapFS{"ns/sub/model.json": mapFile(`{"version":2}`)},
			dir:    "ns",
			expect: false,
		},
		{
			name:   "empty model dir",
			fsys:   fstest.MapFS{"ed/.gitkeep": mapFile("")},
			dir:    "ed",
			expect: false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := live2dHasManifest(tc.fsys, tc.dir)
			if got != tc.expect {
				t.Errorf("live2dHasManifest(%q) = %v, want %v", tc.dir, got, tc.expect)
			}
		})
	}
}

// TestLive2dModelNames lists only directories that carry a manifest (both
// Cubism flavors), sorted, ignoring root files and non-model dirs.
func TestLive2dModelNames(t *testing.T) {
	fsys := fstest.MapFS{
		// Valid models (both flavors).
		"archchan/model3.json": mapFile(`{"Version":4}`),
		"kasumi/model.json":    mapFile(`{"version":2}`),
		// Not a model (no manifest).
		"notamodel/tex.png": mapFile("png"),
		// Files at root are ignored.
		"README.md": mapFile("docs"),
	}

	s := &Server{live2dFS: fsys}
	names := s.live2dModelNames()

	if len(names) != 2 {
		t.Fatalf("expected exactly 2 models, got %d: %v", len(names), names)
	}
	// Sorted output: archchan before kasumi.
	if names[0] != "archchan" || names[1] != "kasumi" {
		t.Errorf("expected sorted [archchan kasumi], got %v", names)
	}
}
