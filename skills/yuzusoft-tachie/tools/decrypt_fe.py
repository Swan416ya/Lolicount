# -*- coding: utf-8 -*-
# Decrypt Yuzusoft fe-fe text format (CryptMode 1: pairwise bit swap)
import sys, os, glob
sys.stdout.reconfigure(encoding='utf-8')

def decrypt(path):
    d = open(path, 'rb').read()
    assert d[0] == 0xfe and d[1] == 0xfe, 'bad magic'
    mode = d[2]
    if mode == 1:
        body = d[5:]
        n = len(body)//2
        out = []
        for i in range(n):
            ch = body[2*i] | (body[2*i+1] << 8)
            ch = ((ch & 0xaaaa) >> 1) | ((ch & 0x5555) << 1)
            out.append(ch)
        return mode, ''.join(chr(c) for c in out)
    elif mode == 2:
        import struct, zlib
        compressed, uncompressed = struct.unpack_from('<QQ', d, 5)
        raw = zlib.decompress(d[21:21+compressed])
        return mode, raw.decode('utf-16-le', 'replace')
    else:
        return mode, None

for f in [r'E:\tmp\sanoba-final\94D4A97C61498621\寧々.stand',
          r'E:\tmp\sanoba-final\94D4A97C61498621\standlevel.tjs',
          r'E:\tmp\sanoba-final\94D4A97C61498621\facezoom.csv']:
    m, t = decrypt(f)
    print('=====', os.path.basename(f), 'mode', m)
    print(t[:1500])
    print()
