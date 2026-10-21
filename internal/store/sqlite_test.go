package store

import (
	"context"
	"path/filepath"
	"testing"
)

func newTestRepo(t *testing.T) Repository {
	t.Helper()
	dsn := filepath.Join(t.TempDir(), "test.db")
	repo, err := NewSQLite(context.Background(), dsn)
	if err != nil {
		t.Fatalf("NewSQLite: %v", err)
	}
	t.Cleanup(func() {
		if c, ok := repo.(*sqliteRepo); ok {
			c.Close()
		}
	})
	return repo
}

func TestGetMissing(t *testing.T) {
	r := newTestRepo(t)
	c, ok, err := r.Get(context.Background(), "nope")
	if err != nil || ok {
		t.Fatalf("Get missing: c=%+v ok=%v err=%v", c, ok, err)
	}
}

func TestSetAndGet(t *testing.T) {
	r := newTestRepo(t)
	ctx := context.Background()
	if err := r.Set(ctx, "a", 42); err != nil {
		t.Fatalf("Set: %v", err)
	}
	c, ok, err := r.Get(ctx, "a")
	if err != nil || !ok {
		t.Fatalf("Get: ok=%v err=%v", ok, err)
	}
	if c.Num != 42 {
		t.Errorf("Num = %d want 42", c.Num)
	}
}

func TestSetOverwrites(t *testing.T) {
	r := newTestRepo(t)
	ctx := context.Background()
	r.Set(ctx, "a", 1)
	r.Set(ctx, "a", 99)
	c, _, _ := r.Get(ctx, "a")
	if c.Num != 99 {
		t.Errorf("after overwrite Num = %d want 99", c.Num)
	}
}

func TestSetMulti(t *testing.T) {
	r := newTestRepo(t)
	ctx := context.Background()
	items := []Counter{
		{Name: "x", Num: 10},
		{Name: "y", Num: 20},
		{Name: "z", Num: 30},
	}
	if err := r.SetMulti(ctx, items); err != nil {
		t.Fatalf("SetMulti: %v", err)
	}
	for _, want := range items {
		c, ok, err := r.Get(ctx, want.Name)
		if err != nil || !ok || c.Num != want.Num {
			t.Errorf("Get %s: c=%+v ok=%v err=%v want %d", want.Name, c, ok, err, want.Num)
		}
	}
}

func TestSetMultiUpsertsExisting(t *testing.T) {
	r := newTestRepo(t)
	ctx := context.Background()
	r.Set(ctx, "a", 5)
	r.Set(ctx, "b", 5)
	if err := r.SetMulti(ctx, []Counter{{Name: "a", Num: 100}, {Name: "b", Num: 200}}); err != nil {
		t.Fatalf("SetMulti: %v", err)
	}
	c, _, _ := r.Get(ctx, "a")
	if c.Num != 100 {
		t.Errorf("a = %d want 100", c.Num)
	}
}

func TestSetMultiEmpty(t *testing.T) {
	r := newTestRepo(t)
	if err := r.SetMulti(context.Background(), nil); err != nil {
		t.Errorf("SetMulti(nil): %v", err)
	}
}

func TestGetAll(t *testing.T) {
	r := newTestRepo(t)
	ctx := context.Background()
	r.Set(ctx, "b", 2)
	r.Set(ctx, "a", 1)
	r.Set(ctx, "c", 3)
	all, err := r.GetAll(ctx)
	if err != nil {
		t.Fatalf("GetAll: %v", err)
	}
	if len(all) != 3 {
		t.Fatalf("len = %d want 3", len(all))
	}
	// Ordered by name.
	if all[0].Name != "a" || all[2].Name != "c" {
		t.Errorf("order wrong: %v", all)
	}
}

// TestThemeUsageIsolation pins the theme-usage view contract: reads and
// writes go to tb_theme_usage and never touch tb_count, and vice versa.
func TestThemeUsageIsolation(t *testing.T) {
	r := newTestRepo(t)
	ctx := context.Background()
	tu, ok := r.(ThemeUsageSource)
	if !ok {
		t.Fatal("sqliteRepo must implement ThemeUsageSource")
	}
	view := tu.ThemeUsage()

	if err := view.Set(ctx, "lian-ren", 5); err != nil {
		t.Fatalf("theme set: %v", err)
	}
	if err := view.Set(ctx, "wenders", 9); err != nil {
		t.Fatalf("theme set: %v", err)
	}

	// The user counter namespace is untouched.
	if _, found, _ := r.Get(ctx, "lian-ren"); found {
		t.Errorf("theme usage leaked into tb_count")
	}
	// The theme view reads back its own rows.
	got, found, err := view.Get(ctx, "lian-ren")
	if err != nil || !found {
		t.Fatalf("theme get: found=%v err=%v", found, err)
	}
	if got.Num != 5 {
		t.Errorf("theme num: got %d want 5", got.Num)
	}
	all, err := view.GetAll(ctx)
	if err != nil || len(all) != 2 {
		t.Fatalf("theme GetAll: len=%d err=%v", len(all), err)
	}
	// Counters written to tb_count never appear in the theme view.
	if err := r.Set(ctx, "some-counter", 1); err != nil {
		t.Fatalf("counter set: %v", err)
	}
	all, err = view.GetAll(ctx)
	if err != nil || len(all) != 2 {
		t.Errorf("theme view polluted by tb_count: len=%d err=%v", len(all), err)
	}
}

// TestThemeUsageSetMultiAbsolute pins absolute-overwrite semantics on the
// theme view (same contract as tb_count SetMulti, Iron Rule 5).
func TestThemeUsageSetMultiAbsolute(t *testing.T) {
	r := newTestRepo(t)
	ctx := context.Background()
	view := r.(ThemeUsageSource).ThemeUsage()
	if err := view.Set(ctx, "lian-ren", 1); err != nil {
		t.Fatalf("set: %v", err)
	}
	if err := view.SetMulti(ctx, []Counter{{Name: "lian-ren", Num: 7}}); err != nil {
		t.Fatalf("set multi: %v", err)
	}
	got, found, _ := view.Get(ctx, "lian-ren")
	if !found || got.Num != 7 {
		t.Errorf("after SetMulti: found=%v num=%d want 7", found, got.Num)
	}
}
