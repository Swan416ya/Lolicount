// Package server live2d.go serves the embedded Live2D (Cubism) dynamic
// illustration models consumed by the Live2D counter page
// (web/public/live2d-player.html).
//
// A Live2D model is a directory whose entry point is a Cubism model settings
// file. Two flavors are supported, and the engine auto-detects which:
//
//  - Cubism 3: model3.json / <name>.model3.json referencing a .moc3 binary.
//  - Cubism 2 (legacy): model.json / <name>.model.json referencing a .moc
//    binary. This is the format BanG Dream! and other game-extracted models
//    ship, and the one the bundled live2d-legacy.min.js (the official Cubism 2
//    Web runtime) renders directly.
//
// Both flavors reference, by relative path: the moc binary, one or more
// textures (.png/.jpg), and optionally physics, pose, motions (.mtn) and
// expressions (.exp3.json / .exp3 / .json). Like the E-mote PSB and Spine
// models these are NOT imgcore themes: the bytes are rendered client-side by
// the Cubism core + PixiJS runtime, so the server only lists and streams them.
//
// The interactive (JS) path loads the model files from /live2d/models/<name>/
// in an <iframe> on the counter page (web/public/live2d-player.html). There is
// no no-JS embed path: a Live2D model needs WebGL + JS to render, and a
// pre-rendered animated image is too large to bake into the binary while a
// real-time re-encode is too slow for a counter, so the character is only
// served to the interactive player.
//
// NOTE on asset format: the official Cubism 3 Web SDK core (live2dcubismcore)
// only parses standard .moc3 files; the Cubism 2 legacy runtime
// (live2d-legacy.min.js) parses standard .moc files (magic "moc", version
// byte 8-11). Both are loaded by the engine, which registers runtimes for
// each. Non-standard moc containers are not loadable. See docs/live2d-widget.md.
package server

import (
	"io/fs"
	"regexp"
	"sort"
	"strings"

	"github.com/gofiber/fiber/v3"
)

// live2dModelPattern restricts model directory names to the same charset as
// theme/psb/spine names, which also blocks path traversal.
const live2dModelPattern = "^[a-zA-Z0-9-]+$"

var live2dModelNameRe = regexp.MustCompile(live2dModelPattern)

// live2dFileNameRe whitelists the file names a Live2D model uses. The manifest
// is model3.json / <name>.model3.json (Cubism 3) or model.json / <name>.model.json
// (Cubism 2 / legacy). The moc is *.moc3 or *.moc; textures/motions/
// expressions/physics/pose are extension-checked. Matching the name explicitly
// (rather than "any file without a slash") blocks a client from probing
// arbitrary paths under the model directory.
var live2dFileNameRe = regexp.MustCompile(
	`^(model3|.*\.model3)\.json$` + // Cubism 3 manifest
		`|^(model|.*\.model)\.json$` + // Cubism 2 (legacy) manifest
		`|^.*\.(moc3|moc)$` + // moc binary
		`|^.*\.(png|jpg|jpeg)$` + // textures
		`|^.*\.(mtn|motion3\.json|exp3\.json|exp3|exp\.json|physics3\.json|physics\.json|pose3\.json)$`,
)

// live2dContentTypes maps the file extensions a Live2D model uses to the
// Content-Type the browser needs to load them via XHR. The moc binary is
// opaque bytes; JSON manifests/motions are text; textures are PNG/JPEG.
var live2dContentTypes = map[string]string{
	".json":  "application/json",
	".moc3":  "application/octet-stream",
	".moc":   "application/octet-stream",
	".mtn":   "application/octet-stream",
	".png":   "image/png",
	".jpg":   "image/jpeg",
	".jpeg":  "image/jpeg",
	".webp":  "image/webp",
	".gif":   "image/gif",
}

// listLive2DModels answers GET /api/live2d/models with the embedded Live2D
// model names. Read-only and stable per build, so the short cache used by the
// other /api list endpoints applies.
func (s *Server) listLive2DModels(c fiber.Ctx) error {
	names := s.live2dModelNames()
	if names == nil {
		names = []string{}
	}
	c.Set("Cache-Control", "public, max-age=60")
	return c.Status(fiber.StatusOK).JSON(fiber.Map{"models": names})
}

// live2dModelHandler answers GET /live2d/models/:name/:file with a single model
// file (manifest, moc, texture, motion or expression). The bytes are fixed at
// build time (embed.FS), so the response is immutable. CORS is open: the bytes
// are public and the counter page (and any tooling) loads them cross-origin.
func (s *Server) live2dModelHandler(c fiber.Ctx) error {
	name := c.Params("name")
	file := c.Params("file")
	if !live2dModelNameRe.MatchString(name) || !live2dFileNameRe.MatchString(file) {
		return fiber.NewError(fiber.StatusBadRequest, "invalid model name")
	}
	if s.live2dFS == nil {
		return fiber.NewError(fiber.StatusNotFound, "no models")
	}
	fp := name + "/" + file
	data, err := fs.ReadFile(s.live2dFS, fp)
	if err != nil {
		return fiber.NewError(fiber.StatusNotFound, "file not found")
	}
	ctype, ok := live2dContentTypes["."+extOf(file)]
	if !ok {
		ctype = "application/octet-stream"
	}
	c.Set("Content-Type", ctype)
	c.Set("Cache-Control", "public, max-age=31536000, immutable")
	c.Set("Access-Control-Allow-Origin", "*")
	return c.Status(fiber.StatusOK).Send(data)
}

// live2dModelNames returns the sorted list of model directories that contain a
// Cubism model settings manifest (model3.json / *.model3.json for Cubism 3, or
// model.json / *.model.json for Cubism 2 / BanG Dream). An empty (or missing)
// tree yields an empty list, never an error.
func (s *Server) live2dModelNames() []string {
	if s.live2dFS == nil {
		return nil
	}
	entries, err := fs.ReadDir(s.live2dFS, ".")
	if err != nil {
		return nil
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		if live2dHasManifest(s.live2dFS, e.Name()) {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)
	return names
}

// live2dHasManifest reports whether the model directory holds a Cubism model
// settings file. A Cubism 3 manifest (model3.json or <name>.model3.json) or a
// Cubism 2 / legacy manifest (model.json or <name>.model.json) both count.
func live2dHasManifest(fsys fs.FS, name string) bool {
	entries, err := fs.ReadDir(fsys, name)
	if err != nil {
		return false
	}
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		n := e.Name()
		if n == "model3.json" || (strings.HasSuffix(n, ".model3.json") && strings.Contains(n, ".")) {
			return true
		}
		if n == "model.json" || (strings.HasSuffix(n, ".model.json") && strings.Contains(n, ".")) {
			return true
		}
	}
	return false
}

