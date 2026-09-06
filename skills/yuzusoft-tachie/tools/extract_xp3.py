"""Extract + decrypt all entries of a 千恋万花 xp3 into out_dir, classify by magic."""
import sys, zlib, collections
from pathlib import Path
from list_entries import load
from cxdec import Cxdec

def sniff(data):
    if data[:5] == b'TLG5.0' or data[:5] == b'TLG6.0': return 'tlg'
    if data[:5] == b'\xfe\xfe\x01\xff\xfe': return 'sinfo'
    if data[:3] == b'PBD' or data[:4] == b'\x00PBD': return 'pbd?'
    if data[:8] == b'PSB(\x00\x00\x00': return 'psb'
    if data[:4] == b'\x89PNG': return 'png'
    if data[:3] == b'OggS': return 'ogg'
    if data[:2] == b'BM': return 'bmp'
    if data[:3] == b'ID3' or data[:2] == b'\xff\xfb': return 'mp3'
    if data[:4] == b'RIFF': return 'wav'
    if data[:2] == b'\x1f\x8b': return 'gz'
    if data[:4] == b'PK\x03\x04': return 'zip'
    return 'text' if all(32 <= b < 127 or b in (9,10,13) for b in data[:200]) else 'unknown'

def main(xp3_path, out_dir):
    out = Path(out_dir); out.mkdir(parents=True, exist_ok=True)
    dec = Cxdec()
    entries = load(xp3_path)
    stats = collections.Counter()
    manifest = []
    with open(xp3_path, 'rb') as fp:
        for i, (name, h, segs) in enumerate(entries):
            data = bytearray()
            for comp, off, size, pk in segs:
                fp.seek(off)
                seg = fp.read(pk)
                if comp:
                    seg = zlib.decompress(seg)
                data += seg
            dec.decrypt(h, 0, data)
            kind = sniff(bytes(data[:200]))
            stats[kind] += 1
            ext = {'tlg':'tlg','sinfo':'sinfo','png':'png','ogg':'ogg','psb':'psb'}.get(kind, 'bin')
            (out / f"{name}.{ext}").write_bytes(data)
            manifest.append((name, h, kind, len(data)))
            if (i+1) % 400 == 0: print(f"{i+1}/{len(entries)}...", flush=True)
    import json
    json.dump(manifest, open(out / '_manifest.json', 'w'), ensure_ascii=False)
    print(dict(stats))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
