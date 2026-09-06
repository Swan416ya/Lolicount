import struct, sys, zlib

def read_index(fp):
    fp.seek(0)
    magic = fp.read(11)
    assert magic == b"XP3\r\n \n\x1a\x8bg\x01", magic
    fp.seek(0x0b); dir_off = struct.unpack('<q', fp.read(8))[0]
    fp.seek(dir_off)
    if struct.unpack('<I', fp.read(4))[0] == 0x80:
        fp.seek(dir_off + 9); dir_off = struct.unpack('<q', fp.read(8))[0]
        fp.seek(dir_off)
    ht = fp.read(1)[0]
    if ht == 0:
        size = struct.unpack('<q', fp.read(8))[0]
        return fp.read(size)
    packed = struct.unpack('<q', fp.read(8))[0]
    fp.read(8)
    return zlib.decompress(fp.read(packed))

def parse_entries(index):
    entries = []
    p = 0
    d = index
    while p < len(d):
        sig, esize = struct.unpack_from('<Iq', d, p)
        p += 12
        end = p + esize
        if sig == 0x656C6946:  # File
            name, segments, entry_hash = "", [], 0
            while p < end:
                section, ssize = struct.unpack_from('<Iq', d, p)
                p += 12
                sec_end = p + ssize
                if section == 0x6F666E69:  # info
                    p += 4; p += 8; p += 8
                    ns = struct.unpack_from('<H', d, p)[0]; p += 2
                    if 0 < ns <= 0x100:
                        name = d[p:p+ns*2].decode('utf-16-le', 'replace')
                    p = sec_end
                elif section == 0x6D676573:  # segm
                    for _ in range(ssize // 0x1C):
                        comp, off, size, pk = struct.unpack_from('<iQQQ', d, p)
                        p += 0x1C
                        segments.append((comp, off, size, pk))
                    p = sec_end
                elif section == 0x726C6461:  # adlr
                    if ssize == 4:
                        entry_hash = struct.unpack_from('<I', d, p)[0]
                    p = sec_end
                else:
                    p = sec_end
            if name:
                entries.append((name, entry_hash, segments))
        p = end
    return entries

def load(path):
    with open(path, 'rb') as fp:
        return parse_entries(read_index(fp))

if __name__ == '__main__':
    import json
    entries = load(sys.argv[1])
    print(f"{sys.argv[1]}: {len(entries)} entries")
    for name, h, segs in entries[:20]:
        print(f"  {name} hash={h:#x} segs={len(segs)}")
    if len(sys.argv) > 2:
        with open(sys.argv[2], 'w', encoding='utf-8') as f:
            json.dump(entries, f, ensure_ascii=False)
