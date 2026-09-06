# -*- coding: utf-8 -*-
"""Generate per-character multi-layer themes from Sanoba Witch pbd layers.

Each character a-set becomes one theme:
  lass = dress composite (base + arm-diff + bangs)   -> random pick
  eye  = expression composite (expression + HL)       -> random pick
  face = cheek/blush layers                           -> random pick
Excluded from a public repo: 裸 (nude) dresses and 発情 (arousal) expressions.
"""
import json
import re
from pathlib import Path
from PIL import Image

SRC = Path(r"E:\tmp\tachie-work")          # <set>.txt (1x pbd) files
PNG = Path(r"E:\tmp\sanoba-png")           # character folders with 1x pngs
OUT = Path(r"E:\Go Project\lolicount\Lolicount\assets\theme")

# character set -> (theme name, source png folder)
CHARS = [
    ("寧々a", "sanoba-nene", "１－寧々"),
    ("めぐるa", "sanoba-meguru", "２－めぐる"),
    ("紬a", "sanoba-tsumugi", "３－紬"),
    ("憧子a", "sanoba-douko", "４－憧子"),
    ("和奏a", "sanoba-wakura", "５－和奏"),
    ("七緒a", "sanoba-nao", "６－七緒"),
    ("佳苗a", "sanoba-kanae", "７－佳苗"),
    ("秀明a", "sanoba-hideaki", "８－秀明"),
    ("太一a", "sanoba-taichi", "９－太一"),
    ("アカギa", "sanoba-akagi", "１０－アカギ"),
    ("越路a", "sanoba-koshiji", "１１－越路"),
]

EXCLUDE = ("裸", "発情", "乳")

def parse_pbd(txt_path):
    rows = []
    for line in open(txt_path, encoding="utf-8"):
        if line.startswith("#"):
            continue
        toks = line.rstrip("\n").split("\t")
        if len(toks) < 11:
            continue
        try:
            rows.append({
                "type": toks[0], "name": toks[1],
                "left": int(toks[2]) if toks[2] else 0,
                "top": int(toks[3]) if toks[3] else 0,
                "w": int(toks[4]) if toks[4] else 0,
                "h": int(toks[5]) if toks[5] else 0,
                "vis": toks[8], "id": int(toks[9]) if toks[9] else 0,
            })
        except ValueError:
            continue
    canvas = rows[0]
    return rows, canvas["w"], canvas["h"]

def classify(rows):
    dresses, arm_diffs, bangs_default, bangs_map, exprs, hls, effects, cheeks, skipped = (
        {}, {}, None, {}, {}, {}, {}, [], [])
    for r in rows:
        if r["type"] != "0" or not r["id"] or r["w"] == 0:
            continue
        n = r["name"]
        if any(x in n for x in EXCLUDE):
            skipped.append((n, "excluded-content"))
            continue
        if n == "前髪":
            bangs_default = r
        elif n.endswith("用前髪") or n.endswith("用補正"):
            key = n.replace("用前髪", "").replace("用補正", "")
            bangs_map.setdefault(key, []).append(r)
        elif "腕差分独立" in n:
            # "independent arm" variant is a complete standalone body
            dresses[n] = r
        elif "腕差分" in n:
            arm_diffs[n] = r
        elif n.endswith("HL"):
            hls[n[:-2]] = r
        elif n.endswith("用効果"):
            effects[n[:-3]] = r
        elif n.startswith("頬"):
            cheeks.append(r)
        elif r["h"] > 800:
            # body-class layer (dress base): standing bodies are tall
            dresses[n] = r
        elif 120 <= r["w"] <= 700 and not n.startswith("前髪"):
            exprs[n] = r
        else:
            skipped.append((n, f"unclassified w={r['w']}"))
    return dresses, arm_diffs, bangs_default, bangs_map, exprs, hls, effects, cheeks, skipped

def load_img(folder, setname, lid):
    p = PNG / folder / f"{setname}_0_{lid}.png"
    return Image.open(p).convert("RGBA") if p.exists() else None

def parse_sinfo_dresses(path):
    """Parse sinfo dress rules -> {(dress, diff): [layer names]} (game-exact)."""
    groups = {}
    for line in open(path, encoding="utf-8"):
        toks = line.rstrip("\n").split("\t")
        if len(toks) >= 4 and toks[0] == "dress" and toks[2] == "diff":
            key = (toks[1], toks[3])
            groups.setdefault(key, []).append(toks[4] if len(toks) > 4 else toks[-1])
    return groups

def opaque_count(img):
    return sum(1 for p in img.getdata() if p[3] > 30)

def composite_at(canvas_size, parts):
    """Paste (img, left, top) list onto a canvas, return cropped img + (left, top)."""
    canvas = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    for img, left, top in parts:
        canvas.alpha_composite(img, (left, top))
    bbox = canvas.getbbox()
    if not bbox:
        return None, (0, 0)
    return canvas.crop(bbox), (bbox[0], bbox[1])

for setname, theme, folder in CHARS:
    rows, cw, ch = parse_pbd(SRC / f"{setname}_0.txt")
    (dresses, arm_diffs, bangs_default, bangs_map, exprs, hls, effects, cheeks, skipped) = classify(rows)

    out_dir = OUT / theme
    ren_dir = out_dir / "ren"
    ren_dir.mkdir(parents=True, exist_ok=True)
    manifest = [{"name": "placeholder", "left": 0, "top": 0, "width": 0, "height": 0, "visible": 1, "layer_id": 0, "group_layer_id": 0}]
    ranges = {}
    new_id = 1
    all_boxes = []

    def add_layer(cat, img, left, top, label):
        global new_id
        w, h = img.size
        img.save(ren_dir / f"{new_id}.webp", "WEBP", quality=90, method=6)
        manifest.append({
            "name": f"{cat}_{new_id}", "left": left, "top": top,
            "width": w, "height": h, "visible": 1,
            "layer_id": new_id, "group_layer_id": new_id,
        })
        ranges.setdefault(cat, [new_id, new_id])
        ranges[cat] = [ranges[cat][0], new_id]
        all_boxes.append((left, top, left + w, top + h))
        new_id += 1

    # --- lass: dress composites driven by sinfo rules (diff1/diff2 are
    # alternative arm poses in the game, so each becomes its own candidate) ---
    n_dress = 0
    dress_rules = parse_sinfo_dresses(SRC / f"{setname}.sinfo.txt")
    name_to_row = {r["name"]: r for r in rows}
    for (dress_name, diff_no), layer_names in sorted(dress_rules.items()):
        parts = []
        ok = True
        for ln in layer_names:
            r = name_to_row.get(ln)
            if r is None:
                continue
            img = load_img(folder, setname, r["id"])
            if img is None:
                if r["h"] > 800:  # missing body part kills this candidate
                    ok = False
                    break
                continue
            parts.append((img, r["left"], r["top"]))
        if not ok or not parts:
            continue
        img, (lx, ly) = composite_at((cw, ch), parts)
        if img and img.height > 400:
            add_layer("lass", img, lx, ly, f"{dress_name}{diff_no}")
            n_dress += 1

    # --- eye: expression composites (expr + HL + effect) ---
    n_expr = 0
    for ename, e in exprs.items():
        parts = [(load_img(folder, setname, e["id"]), e["left"], e["top"])]
        if ename in hls:
            hl = hls[ename]
            parts.append((load_img(folder, setname, hl["id"]), hl["left"], hl["top"]))
        if ename in effects:
            ef = effects[ename]
            parts.append((load_img(folder, setname, ef["id"]), ef["left"], ef["top"]))
        parts = [p for p in parts if p[0]]
        if not parts:
            continue
        img, (lx, ly) = composite_at((cw, ch), parts)
        # sparse mixed-eye overlays look expressionless on a counter; only
        # keep faces with real content (full faces measure 2900-4700
        # opaque px, sparse mixed overlays ~1000)
        if img and opaque_count(img) >= 1500:
            add_layer("eye", img, lx, ly, ename)
            n_expr += 1

    # --- face: cheeks ---
    n_cheek = 0
    for c in cheeks:
        img = load_img(folder, setname, c["id"])
        if img:
            add_layer("face", img, c["left"], c["top"], c["name"])
            n_cheek += 1

    # write manifest/config/display
    ren_json = [
        {"name": m["name"], "left": m["left"], "top": m["top"], "width": m["width"],
         "height": m["height"], "visible": m["visible"], "layer_id": m["layer_id"],
         "group_layer_id": m["group_layer_id"]}
        for m in manifest
    ]
    (out_dir / "ren.json").write_text(json.dumps(ren_json, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    cfg_ranges = {k: {"first": v[0], "last": v[1]} for k, v in ranges.items()}
    (out_dir / "config.json").write_text(json.dumps(
        {"canvasW": cw, "canvasH": ch, "ranges": cfg_ranges}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if all_boxes:
        x0 = min(b[0] for b in all_boxes); y0 = min(b[1] for b in all_boxes)
        x1 = max(b[2] for b in all_boxes); y1 = max(b[3] for b in all_boxes)
        crop = {"left": x0, "top": y0, "width": x1 - x0, "height": y1 - y0}
        (out_dir / "display.json").write_text(json.dumps(
            {"size": 400, "crop": crop}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{theme}: {n_dress} dresses, {n_expr} expressions, {n_cheek} cheeks"
          + (f" | skipped: {skipped[:4]}" if skipped else ""))
