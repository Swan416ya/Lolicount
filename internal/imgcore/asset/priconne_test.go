package asset_test

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"io/fs"
	"os"
	"regexp"
	"strings"
	"testing"

	"github.com/miaoledor/lolicount/assets"
	"github.com/miaoledor/lolicount/internal/imgcore/asset"
	"github.com/miaoledor/lolicount/internal/imgcore/composer"
)

// TestPriconnePortraits exercises the real loader and SVG composition for every
// contributed portrait, including alternate draw orders and body-only models.
func TestPriconnePortraits(t *testing.T) {
	source, err := os.ReadFile("../../../scripts/priconne-manifest.txt")
	if err != nil {
		t.Fatal(err)
	}
	exclusionJSON, err := os.ReadFile("../../../scripts/priconne-exclusions.json")
	if err != nil {
		t.Fatal(err)
	}
	var exclusions map[string]string
	if err := json.Unmarshal(exclusionJSON, &exclusions); err != nil {
		t.Fatal(err)
	}
	nameJSON, err := os.ReadFile("../../../scripts/priconne-names.json")
	if err != nil {
		t.Fatal(err)
	}
	var names map[string]string
	if err := json.Unmarshal(nameJSON, &names); err != nil {
		t.Fatal(err)
	}
	silhouetteJSON, err := os.ReadFile("../../../scripts/priconne-silhouettes.json")
	if err != nil {
		t.Fatal(err)
	}
	var silhouettes map[string]string
	if err := json.Unmarshal(silhouetteJSON, &silhouettes); err != nil {
		t.Fatal(err)
	}
	expected := make(map[string]bool)
	for _, match := range regexp.MustCompile(`spine_full_(\d+)`).FindAllStringSubmatch(string(source), -1) {
		modelID := match[1]
		if _, excluded := exclusions[modelID]; excluded {
			continue
		}
		if _, silhouette := silhouettes[modelID]; silhouette {
			continue
		}
		label := names[modelID[:4]]
		if label == "" || strings.HasPrefix(label, "Story ") {
			expected["pcr-npc-"+modelID[:4]] = true
		} else {
			expected["pcr-"+modelID] = true
		}
	}
	if len(expected) == 0 {
		t.Fatal("source manifest contains no portrait models")
	}
	root, err := fs.Sub(assets.FS, "theme")
	if err != nil {
		t.Fatal(err)
	}
	entries, err := fs.ReadDir(root, ".")
	if err != nil {
		t.Fatal(err)
	}
	catalogs, catalogErrors := asset.LoadThemeCatalogs(root)
	if len(catalogErrors) > 0 {
		t.Fatal(catalogErrors)
	}
	for _, entry := range entries {
		if !entry.IsDir() || !strings.HasPrefix(entry.Name(), "pcr-") {
			continue
		}
		if !expected[entry.Name()] {
			t.Fatalf("portrait %s is absent from the documented source selection", entry.Name())
		}
		delete(expected, entry.Name())
		t.Run(entry.Name(), func(t *testing.T) {
			portrait, err := asset.LoadCharacterTheme(root, entry.Name())
			if err != nil {
				t.Fatal(err)
			}
			type configSet struct {
				canvasW int
				canvasH int
				ranges  map[string]asset.PartRange
			}
			sets := []configSet{{canvasW: portrait.Config.CanvasW, canvasH: portrait.Config.CanvasH, ranges: portrait.Config.Ranges}}
			if len(portrait.Config.Sets) > 0 {
				sets = nil
				for _, configured := range portrait.Config.Sets {
					sets = append(sets, configSet{canvasW: configured.CanvasW, canvasH: configured.CanvasH, ranges: configured.Ranges})
				}
			}
			multiple := len(sets) > 1
			expectedVariants := 0
			for _, configured := range sets {
				setVariants := 1
				for category, span := range configured.ranges {
					if span.First < 1 || span.Last < span.First || span.Last >= len(portrait.Manifest) {
						t.Fatalf("%s: invalid manifest range %+v", category, span)
					}
					for i := span.First; i <= span.Last; i++ {
						layer := portrait.Manifest[i]
						if category == "body" && !strings.HasSuffix(layer.Name, "_body") || category == "eye" && !strings.Contains(layer.Name, "_eye") || category == "mouth" && !strings.Contains(layer.Name, "_mouth") {
							t.Fatalf("%s range includes unrelated layer %q", category, layer.Name)
						}
						part, ok := portrait.Parts[layer.LayerID]
						if !ok || part.Width != layer.Width || part.Height != layer.Height {
							t.Fatalf("layer %d missing or dimensions disagree with manifest", layer.LayerID)
						}
						if layer.Left < 0 || layer.Top < 0 || layer.Left+layer.Width > configured.canvasW || layer.Top+layer.Height > configured.canvasH {
							t.Fatalf("layer %d falls outside canvas", layer.LayerID)
						}
					}
					multiple = multiple || span.Last > span.First
					setVariants *= span.Last - span.First + 1
				}
				expectedVariants += setVariants
			}
			catalog := catalogs[entry.Name()]
			if catalog == nil {
				t.Fatal("portrait is absent from the production theme catalog")
			}
			if catalog.Variants != expectedVariants {
				t.Fatalf("catalog variants = %d, want additive set total %d", catalog.Variants, expectedVariants)
			}
			var first string
			varies := false
			for seed := 0; seed < 8; seed++ {
				theme, err := asset.AssembleTheme(root, catalog, func(n int) int { return seed % n })
				if err != nil {
					t.Fatal(err)
				}
				svg, err := composer.Compose(composer.ComposeParams{Theme: theme, Seed: fmt.Sprint(seed)})
				if err != nil {
					t.Fatal(err)
				}
				selected := sets[0]
				if len(portrait.Config.Sets) > 0 {
					selected = sets[seed%len(sets)]
				}
				if got := strings.Count(svg, "<image "); got != len(selected.ranges) {
					t.Fatalf("rendered %d parts, want one per category", got)
				}
				decoder := xml.NewDecoder(strings.NewReader(svg))
				for {
					_, err := decoder.Token()
					if err == io.EOF {
						break
					}
					if err != nil {
						t.Fatal(err)
					}
				}
				if seed == 0 {
					first = svg
				} else {
					varies = varies || svg != first
				}
			}
			if multiple && !varies {
				t.Fatal("all seeds produced identical SVG despite alternative parts")
			}
		})
	}
	if len(expected) != 0 {
		t.Fatalf("source portraits have not been exported: %v", expected)
	}
}
