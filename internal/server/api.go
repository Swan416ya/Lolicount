package server

import (
	"github.com/gofiber/fiber/v3"
)

// listThemes answers GET /api/themes with the registered theme names.
// Animated models (E-mote PSB, Spine, Live2D) are appended with an "animated"
// flag and a "kind" so the front-end can mark them in the theme picker and
// switch to the matching widget embed flow (each kind has its own player page).
// Read-only and stable, so a short cache is fine.
func (s *Server) listThemes(c fiber.Ctx) error {
	c.Set("Cache-Control", "public, max-age=60")
	exposed := make([]fiber.Map, 0)
	if s.themes != nil {
		entries := s.themes.List()
		for _, e := range entries {
			exposed = append(exposed, fiber.Map{"name": e.Name, "variants": e.Variants})
		}
	}
	for _, m := range s.psbModelNames() {
		exposed = append(exposed, fiber.Map{"name": m, "animated": true, "kind": "psb"})
	}
	for _, m := range s.spineModelNames() {
		exposed = append(exposed, fiber.Map{"name": m, "animated": true, "kind": "spine"})
	}
	for _, m := range s.live2dModelNames() {
		exposed = append(exposed, fiber.Map{"name": m, "animated": true, "kind": "live2d"})
	}
	return c.Status(fiber.StatusOK).JSON(fiber.Map{"themes": exposed})
}

// listFThemes answers GET /api/fthemes with the registered font-style
// theme names.
func (s *Server) listFThemes(c fiber.Ctx) error {
	if s.fthemes == nil {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{"fthemes": []string{}})
	}
	c.Set("Cache-Control", "public, max-age=60")
	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"fthemes": s.fthemes.List(),
	})
}

// getConfig answers GET /api/config with the public-facing configuration
// the front-end needs to build embed links.
func (s *Server) getConfig(c fiber.Ctx) error {
	c.Set("Cache-Control", "public, max-age=60")
	baseURL := ""
	if s.cfg != nil {
		baseURL = s.cfg.BaseURL
	}
	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"baseUrl": baseURL,
	})
}
