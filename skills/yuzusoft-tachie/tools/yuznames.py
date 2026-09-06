"""Extract the 'sen:' name list from a Senren Banka xp3 and build md5->realname map."""
import sys, struct, zlib, hashlib, json

def read_sen_blob(fp, index):
    p = 0
    while p < len(index) - 12:
        sig, esize = struct.unpack_from('<Iq', index, p)
        tag = sig.to_bytes(4, 'little')
        if tag == b'sen:':
            off = struct.unpack_from('<q', index, p + 12)[0]
            _unpacked, size = struct.unpack_from('<II', index, p + 20)
            fp.seek(off)
            return fp.read(size)
        p += 12 + esize
    return None

def parse_yuz(blob):
    data = zlib.decompress(blob)
    names = {}
    p = 0
    while p < len(data) - 12:
        sig, esize = struct.unpack_from('<Iq', data, p)
        p += 12
        end = p + esize
        if end > len(data) + 6: break
        _hash = struct.unpack_from('<I', data, p)[0]
        nsize = struct.unpack_from('<h', data, p + 4)[0]
        p += 6
        if nsize > 0 and p + nsize * 2 <= end + 6:
            name = data[p:p + nsize*2].decode('utf-16-le')
            names[name] = _hash
        p = end
    return names

def md5_of(name):
    return hashlib.md5(name.lower().encode('utf-16-le')).hexdigest()

def build_map(xp3_path):
    sys.path.insert(0, '.')
    from list_entries import read_index
    with open(xp3_path, 'rb') as fp:
        idx = read_index(fp)
        blob = read_sen_blob(fp, idx)
    names = parse_yuz(blob)
    m = {}
    for name in names:
        m[md5_of(name)] = name
    return m

if __name__ == '__main__':
    m = build_map(sys.argv[1])
    print(len(m), "mapped names")
    for k, v in list(m.items())[:30]:
        print(f"  {k} -> {v}")
    if len(sys.argv) > 2:
        json.dump(m, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
