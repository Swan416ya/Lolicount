"""Stage 1x TLGs under md5 names, batch-convert to PNG, rename back to real names."""
import sys, json, subprocess, shutil
from pathlib import Path

sys.path.insert(0, '.')
from list_entries import load, read_index
from yuznames import read_sen_blob, parse_yuz

XP3 = r'E:\Downloads\千恋＊万花\千恋＊万花\fgimage1080.xp3'
CONV = r'E:\tmp\garbro2\Image.Convert.exe'

with open(XP3, 'rb') as fp:
    idx = read_index(fp)
    blob = read_sen_blob(fp, idx)
hash2name = {h: n for n, h in parse_yuz(blob).items()}
entries = load(XP3)
# md5 stem -> real name
md5_to_real = {}
for md5name, h, segs in entries:
    md5_to_real[md5name] = hash2name[h]

stage = Path('png-stage'); stage.mkdir(exist_ok=True)
out = Path('png-out'); out.mkdir(exist_ok=True)

# collect 1x tlg files (real names ending _0_<id>.tlg)
todo = []
for md5name, real in md5_to_real.items():
    if not real.endswith('.tlg') or '_0_' not in real:
        continue
    src = Path('fg1080') / real
    if not src.exists():
        continue
    dst = stage / (md5name + '.tlg')
    if not dst.exists():
        shutil.copyfile(src, dst)
    todo.append(md5name)
print(f"staged {len(todo)} 1x TLGs")

BATCH = 200
done = 0
for i in range(0, len(todo), BATCH):
    batch = todo[i:i+BATCH]
    subprocess.run([CONV, '-t', 'png'] + [str((stage / b).with_suffix('.tlg')) for b in batch],
                   cwd=out, check=True, capture_output=True)
    done += len(batch)
    print(f"converted {done}/{len(todo)}", flush=True)

# rename md5.png -> real name
n = 0
for md5name in todo:
    src = out / (md5name + '.png')
    if src.exists():
        real = md5_to_real[md5name].replace('.tlg', '.png')
        src.rename(out / real)
        n += 1
print(f"renamed {n} PNGs")
missing = [m for m in todo if not (out / md5_to_real[m].replace('.tlg', '.png')).exists()]
print("missing:", len(missing), missing[:5])
