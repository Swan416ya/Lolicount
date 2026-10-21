package assets

import (
	"encoding/json"
	"io/fs"
	"os"
	"path"
	"strconv"
	"strings"
	"testing"
)

type manifestTheme struct {
	Name   string `json:"name"`
	Frames int    `json:"frames"`
	Ext    string `json:"ext"`
}

type themesManifest struct {
	Themes []manifestTheme `json:"themes"`
}

// TestThemesManifestMatchesThemeTree ensures the generated manifest stays
// in sync with every embedded theme. Single-layer themes count numeric
// frame files at the theme root; character themes count numeric layer
// files under ren/. A stale or partial manifest would otherwise pass the
// generator while giving consumers an incomplete theme list.
func TestThemesManifestMatchesThemeTree(t *testing.T) {
	raw, err := os.ReadFile("themes.json")
	if err != nil {
		t.Fatalf("read themes.json: %v", err)
	}
	var manifest themesManifest
	if err := json.Unmarshal(raw, &manifest); err != nil {
		t.Fatalf("parse themes.json: %v", err)
	}
	if len(manifest.Themes) == 0 {
		t.Fatal("themes.json has no themes")
	}

	entries := make(map[string]manifestTheme, len(manifest.Themes))
	for _, theme := range manifest.Themes {
		if theme.Name == "" {
			t.Error("themes.json contains an empty theme name")
			continue
		}
		if _, duplicate := entries[theme.Name]; duplicate {
			t.Errorf("themes.json contains duplicate theme %q", theme.Name)
			continue
		}
		entries[theme.Name] = theme
	}

	dirs, err := fs.ReadDir(FS, "theme")
	if err != nil {
		t.Fatalf("read embedded theme directory: %v", err)
	}

	seen := make(map[string]bool, len(entries))
	for _, dir := range dirs {
		if !dir.IsDir() {
			continue
		}
		name := dir.Name()
		seen[name] = true

		want, ok := entries[name]
		if !ok {
			t.Errorf("themes.json is missing theme %q", name)
			continue
		}
		wantCount, wantExt := countThemeImages(t, name)
		if want.Frames != wantCount {
			t.Errorf("themes.json theme %q frames = %d, want %d", name, want.Frames, wantCount)
		}
		if want.Ext != wantExt {
			t.Errorf("themes.json theme %q ext = %q, want %q", name, want.Ext, wantExt)
		}
	}

	for name := range entries {
		if !seen[name] {
			t.Errorf("themes.json contains theme %q absent from assets/theme", name)
		}
	}
}

// countThemeImages mirrors the generator's supported-image counting rules.
func countThemeImages(t *testing.T, name string) (int, string) {
	t.Helper()

	root := path.Join("theme", name)
	files, err := fs.ReadDir(FS, root)
	if err != nil {
		t.Fatalf("read embedded theme %s: %v", name, err)
	}

	imageDir := root
	for _, file := range files {
		if !file.IsDir() && file.Name() == "ren.json" {
			imageDir = path.Join(root, "ren")
			break
		}
	}

	images, err := fs.ReadDir(FS, imageDir)
	if err != nil {
		t.Fatalf("read embedded theme image directory %s: %v", imageDir, err)
	}

	count := 0
	ext := ""
	for _, image := range images {
		base := image.Name()
		dot := strings.LastIndex(base, ".")
		if dot < 0 {
			continue
		}
		extension := strings.ToLower(base[dot:])
		if extension != ".gif" && extension != ".png" && extension != ".webp" {
			continue
		}
		if _, err := strconv.Atoi(base[:dot]); err != nil {
			continue
		}
		count++
		if ext == "" {
			ext = strings.TrimPrefix(extension, ".")
		}
	}
	return count, ext
}
