import sys, glob
from pathlib import Path

def decode_sinfo(path):
    d = Path(path).read_bytes()
    assert d[:5] == b'\xfe\xfe\x01\xff\xfe', d[:5]
    out = []
    for i in range(5, len(d) - 1, 2):
        ch = d[i] | (d[i+1] << 8)
        ch = ((ch & 0xaaaa) >> 1) | ((ch & 0x5555) << 1)
        out.append(chr(ch))
    return ''.join(out)

if __name__ == '__main__':
    for p in sorted(glob.glob('fg1080/*.sinfo'))[:6]:
        print('=' * 20, p)
        print(decode_sinfo(p)[:2000])
