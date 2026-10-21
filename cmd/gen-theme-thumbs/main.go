// Command gen-theme-thumbs pre-renders a static gallery thumbnail for
// every built-in theme into web/public/images/theme-thumbs/<name>.svg.
//
// The themes gallery (web/app/pages/themes.vue) shows one card per theme.
// Rendering every card through the live counter endpoint fires hundreds
// of /@demo requests per page load, which trips the IP-level rate limit
// (429) and breaks the card images. The pre-rendered thumbs are static
// files served by the frontend origin — zero backend render cost, the
// same pattern as the emote-thumbs used by animated themes.
//
// Thumbnails are deterministic: a fixed per-theme seed selects a stable
// frame/layer combination, so re-running the generator against an
// unchanged theme tree reproduces identical files.
//
// Usage: go run ./cmd/gen-theme-thumbs [-out DIR]
// Run after adding or removing themes, then rebuild the SSG
// (pnpm generate) so the files land in assets/dist.
package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/miaoledor/lolicount/internal/imgcore/composer"
	"github.com/miaoledor/lolicount/internal/imgcore/theme"
	"github.com/miaoledor/lolicount/internal/server"
)

// renderThumb renders the deterministic gallery thumbnail for one theme:
// the demo text, default scale and font size, unshowf on (cards hide the
// font label), and a fixed seed so the random frame/layer pick is stable
// across runs. The parameters mirror the gallery card's live request
// (name=demo, unshowf=true) so the thumb matches the old card output.
func renderThumb(base *theme.Theme, name string) (string, error) {
	t, err := server.BuildThemeLayers(base, 0, server.DemoText, 0, true,
		theme.TextStyle{}, theme.TextPos{})
	if err != nil {
		return "", err
	}
	seed := name + ":thumb"
	return composer.Compose(composer.ComposeParams{Theme: t, Seed: seed, CountText: server.DemoText})
}

// cleanStale deletes thumb files whose theme no longer exists in the
// registry so the output directory never ships orphaned thumbnails.
func cleanStale(dir string, known map[string]bool) int {
	removed := 0
	entries, err := os.ReadDir(dir)
	if err != nil {
		return 0
	}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".svg") {
			continue
		}
		name := strings.TrimSuffix(e.Name(), ".svg")
		if !known[name] {
			os.Remove(filepath.Join(dir, name+".svg"))
			removed++
		}
	}
	return removed
}

func main() {
	out := flag.String("out", "web/public/images/theme-thumbs", "output directory for thumbnail SVGs")
	flag.Parse()

	reg, errs := composer.NewThemeRegistry()
	if len(errs) > 0 {
		for _, e := range errs {
			fmt.Fprintln(os.Stderr, "theme load error:", e)
		}
		os.Exit(1)
	}
	if err := os.MkdirAll(*out, 0o755); err != nil {
		fmt.Fprintln(os.Stderr, "mkdir:", err)
		os.Exit(1)
	}

	entries := reg.List()
	known := make(map[string]bool, len(entries))
	written := 0
	for _, entry := range entries {
		known[entry.Name] = true
		base, ok := reg.Get(entry.Name)
		if !ok {
			fmt.Fprintf(os.Stderr, "skip %s: not in registry\n", entry.Name)
			continue
		}
		svg, err := renderThumb(base, entry.Name)
		if err != nil {
			fmt.Fprintf(os.Stderr, "render %s: %v\n", entry.Name, err)
			os.Exit(1)
		}
		path := filepath.Join(*out, entry.Name+".svg")
		if err := os.WriteFile(path, []byte(svg), 0o644); err != nil {
			fmt.Fprintf(os.Stderr, "write %s: %v\n", path, err)
			os.Exit(1)
		}
		written++
	}

	removed := cleanStale(*out, known)
	fmt.Printf("generated %d theme thumb(s) in %s (removed %d stale)\n", written, *out, removed)
}
