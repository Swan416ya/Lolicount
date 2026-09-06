# -*- coding: utf-8 -*-
"""Generate per-character multi-layer themes from Senren Banka (千恋＊万花) sinfo layers.

Each character set becomes one theme:
  lass = costume body layer (each 腕差分 arm pose is an alternative, not stacked)
  eye  = expression layer (pre-combined brow/eye/mouth images; sparse overlays filtered)
  face = cheek/blush layer
Excluded for the public repo: 裸/下着 (nude/underwear) and 発情 variants.
"""
import json, sys
from pathlib import Path
from PIL import Image

sys.path.insert(0, '.')
from decode_sinfo import decode_sinfo

SRC = Path('fg1080')     # <set>_0.txt coordinate tables + tlg source
PNG = Path('png-out')    # <set>_0_<layer_id>.png (1x)
OUT = Path(r'E:\Go Project\lolicount\Lolicount\assets\theme')

CHARS = [
    ("芳乃a", "senren-yoshino"),
    ("芳乃b", "senren-yoshino-b"),
    ("茉子a", "senren-mako"),
    ("茉子b", "senren-mako-b"),
    ("ムラサメa", "senren-murasame"),
    ("ムラサメb", "senren-murasame-b"),
    ("レナa", "senren-rena"),
    ("レナb", "senren-rena-b"),
    ("芦花a", "senren-roka"),
    ("芦花b", "senren-roka-b"),
    ("小春a", "senren-koharu"),
    ("小春b", "senren-koharu-b"),
    ("比奈実a", "senren-hinami"),
    ("みづはa", "senren-mizuha"),
    ("心子a", "senren-kokoro"),
    ("安晴a", "senren-yasuharu"),
    ("廉太郎a", "senren-rentaro"),
    ("玄十郎a", "senren-genjiro"),
    ("白狗a", "senren-haku"),
]

EXCLUDE = ("裸", "発情", "乳", "下着")

def parse_rows(setname):
    rows = []
    for line in decode_sinfo(SRC / f"{setname}_0.txt").splitlines():
        t = line.split('\t')
        if len(t) > 10 and t[0] != '#':
            try:
                rows.append({'name': t[1],
                             'left': int(t[2]) if t[2] else 0, 'top': int(t[3]) if t[3] else 0,
                             'w': int(t[4]) if t[4] else 0, 'h': int(t[5]) if t[5] else 0,
                             'id': int(t[9]) if t[9] else 0})
            except ValueError:
                pass
    return rows

def png_for(setname, lid):
    p = PNG / f"{setname}_0_{lid}.png"
    return Image.open(p).convert('RGBA') if p.exists() else None

def opaque_count(img):
    return sum(1 for p in img.getdata() if p[3] > 30)

def classify(rows, setname):
    lass, eye, face, skipped = [], [], [], []
    for r in rows:
        if r['w'] == 0 or not r['id']:
            continue
        n = r['name']
        if any(x in n for x in EXCLUDE):
            skipped.append((n, 'excluded-content')); continue
        img = png_for(setname, r['id'])
        if img is None:
            continue
        if r['h'] > 800:
            if '装飾' in n or '飾り' in n:
                skipped.append((n, 'deco-only')); continue
            lass.append((r, img))
        elif n.startswith('頬'):
            face.append((r, img))
        elif ('髪かぶせ' in n or 'ケモミミ' in n or n.endswith('HL') or n == '表情'
              or n.endswith('(結合)')):
            skipped.append((n, 'overlay'))
        elif 100 <= r['w'] <= 450 and r['h'] < 500:
            if opaque_count(img) >= 1500:
                eye.append((r, img))
            else:
                skipped.append((n, 'sparse-overlay'))
        else:
            skipped.append((n, f'unclassified {r["w"]}x{r["h"]}'))
    return lass, eye, face, skipped

for setname, theme in CHARS:
    rows = parse_rows(setname)
    cw = rows[0]['w'] if rows[0]['w'] else None
    ch = rows[0]['h']
    # canvas row is the first row (name empty)
    canvas_row = next(r for r in rows if r['name'] == '' and r['w'] and r['h'])
    layers = [r for r in rows if r is not canvas_row]
    lass, eye, face, skipped = classify(layers, setname)

    out_dir = OUT / theme
    ren_dir = out_dir / 'ren'
    ren_dir.mkdir(parents=True, exist_ok=True)
    manifest = [{"name": "placeholder", "left": 0, "top": 0, "width": 0, "height": 0,
                 "visible": 1, "layer_id": 0, "group_layer_id": 0}]
    ranges = {}
    new_id = 1
    all_boxes = []

    def add_layer(cat, img, left, top):
        global new_id
        w, h = img.size
        img.save(ren_dir / f"{new_id}.webp", "WEBP", quality=90, method=6)
        manifest.append({"name": f"{cat}_{new_id}", "left": left, "top": top,
                         "width": w, "height": h, "visible": 1,
                         "layer_id": new_id, "group_layer_id": new_id})
        ranges.setdefault(cat, [new_id, new_id])
        ranges[cat][1] = new_id
        all_boxes.append((left, top, left + w, top + h))
        new_id += 1

    for r, img in lass:
        add_layer('lass', img, r['left'], r['top'])
    for r, img in eye:
        add_layer('eye', img, r['left'], r['top'])
    for r, img in face:
        add_layer('face', img, r['left'], r['top'])

    (out_dir / 'ren.json').write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding='utf-8')
    cfg = {"canvasW": canvas_row['w'], "canvasH": canvas_row['h'],
           "ranges": {k: {"first": v[0], "last": v[1]} for k, v in ranges.items()}}
    (out_dir / 'config.json').write_text(
        json.dumps(cfg, ensure_ascii=False, indent=2) + "\n", encoding='utf-8')
    if all_boxes:
        x0 = min(b[0] for b in all_boxes); y0 = min(b[1] for b in all_boxes)
        x1 = max(b[2] for b in all_boxes); y1 = max(b[3] for b in all_boxes)
        (out_dir / 'display.json').write_text(json.dumps(
            {"size": 400, "crop": {"left": x0, "top": y0, "width": x1 - x0, "height": y1 - y0}},
            ensure_ascii=False, indent=2) + "\n", encoding='utf-8')
    print(f"{theme} ({setname}): canvas {canvas_row['w']}x{canvas_row['h']}, "
          f"lass={len(lass)} eye={len(eye)} face={len(face)} skipped={len(skipped)}"
          + (f" | skip: {skipped[:3]}" if skipped else ""))
