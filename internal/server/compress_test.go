package server

import (
	"bytes"
	"compress/gzip"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// Counter SVGs embed megabytes of base64 art; with Accept-Encoding: gzip
// the response must come back gzipped and decode to the original SVG.
func TestCompressionAppliesToCounterSVG(t *testing.T) {
	s := newCounterServer(t)
	req := httptest.NewRequest(http.MethodGet, "/@demo?theme=lian&number=1", nil)
	req.Header.Set("Accept-Encoding", "gzip")
	resp, err := s.app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	defer resp.Body.Close()
	if ce := resp.Header.Get("Content-Encoding"); ce != "gzip" {
		t.Fatalf("Content-Encoding: got %q want gzip", ce)
	}
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}
	zr, err := gzip.NewReader(bytes.NewReader(raw))
	if err != nil {
		t.Fatalf("gzip.NewReader: %v", err)
	}
	plain, err := io.ReadAll(zr)
	if err != nil {
		t.Fatalf("gunzip: %v", err)
	}
	if !strings.Contains(string(plain), "<svg") {
		t.Errorf("gunzipped body is not the SVG (len %d)", len(plain))
	}
	if len(raw) >= len(plain) {
		t.Errorf("gzip did not shrink the body: %d >= %d", len(raw), len(plain))
	}
}

// Without Accept-Encoding the body must stay uncompressed.
func TestCompressionSkippedWithoutAcceptEncoding(t *testing.T) {
	s := newCounterServer(t)
	req := httptest.NewRequest(http.MethodGet, "/@demo?theme=lian&number=1", nil)
	resp, err := s.app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	defer resp.Body.Close()
	if ce := resp.Header.Get("Content-Encoding"); ce != "" {
		t.Errorf("Content-Encoding: got %q want none", ce)
	}
}

// Already-compressed binaries must not be double-compressed: gallery
// thumbnails are webp (gzip buys nothing) and are skipped by Next.
func TestCompressionSkippedForGalleryImages(t *testing.T) {
	s := newCounterServer(t)
	thumb := "/images/theme-thumbs/cafestella-yuna.webp"
	if _, err := s.app.Test(httptest.NewRequest(http.MethodGet, thumb, nil)); err != nil {
		t.Skipf("assets/dist has no %s; run `pnpm generate` to test frontend serving", thumb)
	}
	req := httptest.NewRequest(http.MethodGet, thumb, nil)
	req.Header.Set("Accept-Encoding", "gzip")
	resp, err := s.app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	defer resp.Body.Close()
	if ce := resp.Header.Get("Content-Encoding"); ce != "" {
		t.Errorf("Content-Encoding: got %q want none (webp must not be gzipped)", ce)
	}
}
