// Package server spine.go serves the embedded Spine dynamic-illustration
// models consumed by the Spine counter page (web/public/spine-player.html).
//
// A Spine model is a directory of three files: the skeleton
// (dyn.skel binary or dyn.json), the texture atlas (dyn.atlas) and one or
// more texture pages (dyn.png / pageN.png). Like the E-mote PSB models, these
// are NOT imgcore themes: the bytes are rendered client-side by the Spine 3.8
// WebGL runtime, so the server only lists and streams them.
//
// The interactive (JS) path loads the three files from /spine/models/<name>/.
// The no-JS embed path is separate: an animated WebP render of a chosen model
// + motion, served as a plain <img>-able image (see spineAnimWebP).
package server

import (
	"io/fs"
	"regexp"
	"sort"

	"github.com/gofiber/fiber/v3"
)

// spineModelPattern restricts model directory names to the same charset as
// theme/psb names, which also blocks path traversal.
const spineModelPattern = "^[a-zA-Z0-9-]+$"

var spineModelNameRe = regexp.MustCompile(spineModelPattern)

// spineFileNameRe whitelists the file names a Spine model uses: the fixed
// dyn.{skel,json,atlas,png} plus numbered texture pages pageN.png. Matching
// the name explicitly (rather than "any file without a slash") blocks a
// client from probing arbitrary paths under the model directory.
var spineFileNameRe = regexp.MustCompile(`^dyn\.(skel|json|atlas|png|jpg)$|^page[0-9]+\.(png|jpg)$`)

// spineContentTypes maps the file extensions a Spine model uses to the
// Content-Type the browser needs to load them via XHR. The skeleton binary is
// opaque bytes; the atlas and JSON are text; pages are PNG.
var spineContentTypes = map[string]string{
	".skel": "application/octet-stream",
	".json": "application/json",
	".atlas": "text/plain; charset=utf-8",
	".png":   "image/png",
	".jpg":   "image/jpeg",
	".webp":  "image/webp",
	".gif":   "image/gif",
}

// listSpineModels answers GET /api/spine/models with the embedded Spine model
// names. Read-only and stable per build, so the short cache used by the other
// /api list endpoints applies.
func (s *Server) listSpineModels(c fiber.Ctx) error {
	names := s.spineModelNames()
	if names == nil {
		names = []string{}
	}
	c.Set("Cache-Control", "public, max-age=60")
	return c.Status(fiber.StatusOK).JSON(fiber.Map{"models": names})
}

// spineModelHandler answers GET /spine/models/:name/:file with a single model
// file (skeleton, atlas or texture page). The bytes are fixed at build time
// (embed.FS), so the response is immutable. CORS is open: the bytes are public
// and the counter page (and any tooling) loads them cross-origin.
func (s *Server) spineModelHandler(c fiber.Ctx) error {
	name := c.Params("name")
	file := c.Params("file")
	if !spineModelNameRe.MatchString(name) || !spineFileNameRe.MatchString(file) {
		return fiber.NewError(fiber.StatusBadRequest, "invalid model name")
	}
	if s.spineFS == nil {
		return fiber.NewError(fiber.StatusNotFound, "no models")
	}
	fp := name + "/" + file
	data, err := fs.ReadFile(s.spineFS, fp)
	if err != nil {
		return fiber.NewError(fiber.StatusNotFound, "file not found")
	}
	ctype, ok := spineContentTypes["."+extOf(file)]
	if !ok {
		ctype = "application/octet-stream"
	}
	c.Set("Content-Type", ctype)
	c.Set("Cache-Control", "public, max-age=31536000, immutable")
	c.Set("Access-Control-Allow-Origin", "*")
	return c.Status(fiber.StatusOK).Send(data)
}

// spineModelNames returns the sorted list of model directories that contain a
// skeleton file (dyn.skel or dyn.json). An empty (or missing) tree yields an
// empty list, never an error.
func (s *Server) spineModelNames() []string {
	if s.spineFS == nil {
		return nil
	}
	entries, err := fs.ReadDir(s.spineFS, ".")
	if err != nil {
		return nil
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		if spineHasSkeleton(s.spineFS, e.Name()) {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)
	return names
}

// spineHasSkeleton reports whether the model directory holds a skeleton file.
func spineHasSkeleton(fsys fs.FS, name string) bool {
	for _, f := range []string{"dyn.skel", "dyn.json"} {
		if _, err := fs.Stat(fsys, name+"/"+f); err == nil {
			return true
		}
	}
	return false
}

// extOf returns the file extension without the leading dot, e.g. "png".
// Callers prepend the dot when looking up extension-keyed maps.
func extOf(file string) string {
	i := len(file) - 1
	for i >= 0 && file[i] != '.' {
		i--
	}
	if i < 0 {
		return ""
	}
	return file[i+1:]
}

// spineAnimNameRe whitelists the pre-rendered no-JS animation file names.
// Every Spine model can ship a single "loop.webp" (the character's main loop)
// plus optional per-motion "<motion>.webp" renders. Names are lowercase
// alphanumeric, hyphen, dot and underscore so a client cannot probe paths.
var spineAnimNameRe = regexp.MustCompile(`^[a-zA-Z0-9_-]+\.(webp|png|gif)$`)

// spineAnimHandler answers GET /spine/anim/:name/:file with a pre-rendered
// animated image (WebP) of a Spine model. This is the no-JS embed path: a
// third party embeds it with a bare <img src> tag — no <script>, no WebGL,
// works in GitHub READMEs and any other <img>-only context — and the animated
// WebP plays on its own. The bytes are built at release time by
// scripts/render-spine-anim.mjs (which plays each animation through the Spine
// runtime in a headless browser and encodes the frames), so they are immutable.
func (s *Server) spineAnimHandler(c fiber.Ctx) error {
	name := c.Params("name")
	file := c.Params("file")
	if !spineModelNameRe.MatchString(name) || !spineAnimNameRe.MatchString(file) {
		return fiber.NewError(fiber.StatusBadRequest, "invalid name")
	}
	if s.spineFS == nil {
		return fiber.NewError(fiber.StatusNotFound, "no models")
	}
	data, err := fs.ReadFile(s.spineFS, name+"/anim/"+file)
	if err != nil {
		return fiber.NewError(fiber.StatusNotFound, "animation not found")
	}
	ctype, ok := spineContentTypes["."+extOf(file)]
	if !ok {
		ctype = "image/webp"
	}
	c.Set("Content-Type", ctype)
	c.Set("Cache-Control", "public, max-age=31536000, immutable")
	c.Set("Access-Control-Allow-Origin", "*")
	return c.Status(fiber.StatusOK).Send(data)
}
