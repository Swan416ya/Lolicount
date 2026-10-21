package asset

import (
	"io/fs"
)

// ManifestName is the marker file that distinguishes a multi-layer
// (character) theme from a single-layer (frame) theme inside the unified
// assets/theme/ tree. Its presence dispatches to the layered catalog
// loader (lazy.go); its absence to the frame catalog loader.
const ManifestName = "ren.json"

// isManifestTheme reports whether the theme directory contains a ren.json
// manifest, marking it as a multi-layer (character) theme.
func isManifestTheme(fsys fs.FS, name string) bool {
	_, err := fs.Stat(fsys, name+"/"+ManifestName)
	return err == nil
}

// pathExt returns the file extension including the leading dot.
func pathExt(name string) string {
	for i := len(name) - 1; i >= 0 && name[i] != '/'; i-- {
		if name[i] == '.' {
			return name[i:]
		}
	}
	return ""
}
