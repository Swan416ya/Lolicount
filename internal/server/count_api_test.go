package server

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/rs/zerolog"

	"github.com/miaoledor/lolicount/internal/config"
	"github.com/miaoledor/lolicount/internal/counter"
	"github.com/miaoledor/lolicount/internal/imgcore/theme"
	"github.com/miaoledor/lolicount/internal/store"
)

// newCountTestServer builds a Server with a real in-memory SQLite counter
// so the JSON count endpoint can be exercised end to end.
func newCountTestServer(t *testing.T) *Server {
	t.Helper()
	repo, err := store.NewSQLite(context.Background(), ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if c, ok := repo.(interface{ Close() error }); ok {
			c.Close()
		}
	})
	buf := counter.New(repo, zerolog.Nop(), 3600)
	if err := buf.Start(context.Background()); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(buf.Stop)

	cfg := &config.Config{Host: "127.0.0.1", Port: 0, DBInterval: 10, RateLimitIPPerSec: 10000, RateLimitIPPerMin: 100000, RateLimitNamePerSec: 10000}
	s := New(cfg, zerolog.Nop(), nil, nil, buf, nil)
	t.Cleanup(func() {
		s.ipLimiter.Stop()
		s.nameLimiter.Stop()
	})
	return s
}

// getCount fetches /api/count/@:name and decodes the JSON body.
func getCount(t *testing.T, s *Server, path, origin string) (map[string]any, *http.Response) {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	if origin != "" {
		req.Header.Set("Origin", origin)
	}
	resp, err := s.app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	var body map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode json: %v", err)
	}
	return body, resp
}

func TestCountAPIIncrements(t *testing.T) {
	s := newCountTestServer(t)
	for i := 1; i <= 3; i++ {
		body, resp := getCount(t, s, "/api/count/@inc-test", "")
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("status: got %d want %d", resp.StatusCode, http.StatusOK)
		}
		if num, ok := body["num"].(float64); !ok || int64(num) != int64(i) {
			t.Fatalf("iter %d: num = %v, want %d", i, body["num"], i)
		}
	}
}

func TestCountAPIDemoAndNumberDoNotIncrement(t *testing.T) {
	s := newCountTestServer(t)

	body, _ := getCount(t, s, "/api/count/@demo", "")
	if num, ok := body["num"].(float64); !ok || int64(num) != 123456789 {
		t.Errorf("demo num: got %v want 123456789", body["num"])
	}

	body, _ = getCount(t, s, "/api/count/@demo?number=42", "")
	if num, ok := body["num"].(float64); !ok || int64(num) != 42 {
		t.Errorf("demo number num: got %v want 42", body["num"])
	}

	body, _ = getCount(t, s, "/api/count/@fixed?number=7", "")
	if num, ok := body["num"].(float64); !ok || int64(num) != 7 {
		t.Errorf("fixed number num: got %v want 7", body["num"])
	}
}

func TestCountAPIHeadersAndCORS(t *testing.T) {
	s := newCountTestServer(t)
	_, resp := getCount(t, s, "/api/count/@cors-test", "https://example.com")

	if cc := resp.Header.Get("Cache-Control"); cc != realCountCacheControl {
		t.Errorf("Cache-Control: got %q want %q", cc, realCountCacheControl)
	}
	// The /api CORS middleware reflects the caller origin so the emote
	// widget can fetch the count from third-party pages.
	if allow := resp.Header.Get("Access-Control-Allow-Origin"); allow != "https://example.com" {
		t.Errorf("Access-Control-Allow-Origin: got %q want https://example.com", allow)
	}
	if ct := resp.Header.Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
		t.Errorf("Content-Type: got %q want application/json*", ct)
	}
}

func TestCountAPIRejectsBadNumber(t *testing.T) {
	s := newCountTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/count/@x?number=abc", nil)
	resp, err := s.app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("status: got %d want %d", resp.StatusCode, http.StatusBadRequest)
	}
}

// TestHotThemes pins GET /api/themes/hot: with usage recorded the list is
// the top-10 names ordered by count; with no usage it falls back to the
// first registered themes so the category always exists.
func TestHotThemes(t *testing.T) {
	repo, err := store.NewSQLite(context.Background(), ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if c, ok := repo.(interface{ Close() error }); ok {
			c.Close()
		}
	})
	themeBuf := counter.New(repo.(store.ThemeUsageSource).ThemeUsage(), zerolog.Nop(), 3600)
	for i := 0; i < 3; i++ {
		themeBuf.Incr(context.Background(), "lian-ren")
	}
	themeBuf.Incr(context.Background(), "hina")

	reg := &stubRegistry{themes: map[string]*theme.Theme{
		"lian-ren": makeCardTheme("lian-ren", 2),
		"hina":     makeCardTheme("hina", 2),
		"wenders":  makeCardTheme("wenders", 2),
	}}
	cfg := &config.Config{Host: "127.0.0.1", Port: 0, DBInterval: 10, RateLimitIPPerSec: 10000, RateLimitIPPerMin: 100000, RateLimitNamePerSec: 10000}
	s := New(cfg, zerolog.Nop(), reg, nil, nil, themeBuf)
	t.Cleanup(func() {
		s.ipLimiter.Stop()
		s.nameLimiter.Stop()
		close(s.hotStop)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/themes/hot", nil)
	resp, err := s.app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status: got %d want 200", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	want := `{"hot":["lian-ren","hina"]}`
	if got := strings.TrimSpace(string(body)); got != want {
		t.Errorf("hot list with usage: got %s want %s", got, want)
	}

	// Fresh deployment: no usage at all -> alphabetical fallback, capped
	// at 10.
	themeBuf2 := counter.New(repo.(store.ThemeUsageSource).ThemeUsage(), zerolog.Nop(), 3600)
	s2 := New(cfg, zerolog.Nop(), reg, nil, nil, themeBuf2)
	t.Cleanup(func() {
		s2.ipLimiter.Stop()
		s2.nameLimiter.Stop()
		close(s2.hotStop)
	})
	resp2, err := s2.app.Test(httptest.NewRequest(http.MethodGet, "/api/themes/hot", nil))
	if err != nil {
		t.Fatalf("app.Test fallback: %v", err)
	}
	body2, _ := io.ReadAll(resp2.Body)
	// The fallback takes the registry's List order (the real registry is
	// alphabetical; the stub's map iteration is not), so assert the set
	// and the cap instead of a specific order.
	var parsed struct {
		Hot []string `json:"hot"`
	}
	if err := json.Unmarshal(body2, &parsed); err != nil {
		t.Fatalf("parse fallback body: %v", err)
	}
	if len(parsed.Hot) != 3 {
		t.Errorf("fallback len = %d want 3 (%v)", len(parsed.Hot), parsed.Hot)
	}
	got := map[string]bool{}
	for _, n := range parsed.Hot {
		got[n] = true
	}
	for _, want := range []string{"lian-ren", "hina", "wenders"} {
		if !got[want] {
			t.Errorf("fallback missing %q: %v", want, parsed.Hot)
		}
	}
}
