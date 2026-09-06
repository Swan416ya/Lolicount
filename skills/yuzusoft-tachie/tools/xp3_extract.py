"""Extract PSB files from Yuzusoft XP3 archives (YuzuCrypt scheme).

Ported from GARbro's ArcXP3.cs + CryptAlgorithms.cs (YuzuCrypt):
index = standard KiriKiri XP3 table (optionally zlib-packed), file data
= zlib per-segment then XOR with a hash-derived byte.
"""
import struct
import sys
import zlib
from pathlib import Path

XP3_MAGIC = b"XP3\r\n \n\x1a\x8bg\x01"


def yuzu_key(entry_hash: int) -> int:
    h = (entry_hash ^ 0x1DDB6E7A) & 0xFFFFFFFF
    key = (h ^ (h >> 8) ^ (h >> 16) ^ (h >> 24)) & 0xFF
    return 0xD0 if key == 0 else key


class Reader:
    def __init__(self, data: bytes):
        self.d = data
        self.p = 0

    def u16(self):
        v = struct.unpack_from("<H", self.d, self.p)[0]
        self.p += 2
        return v

    def u32(self):
        v = struct.unpack_from("<I", self.d, self.p)[0]
        self.p += 4
        return v

    def i64(self):
        v = struct.unpack_from("<q", self.d, self.p)[0]
        self.p += 8
        return v

    def i32(self):
        v = struct.unpack_from("<i", self.d, self.p)[0]
        self.p += 4
        return v

    def raw(self, n):
        v = self.d[self.p:self.p + n]
        self.p += n
        return v

    def eof(self):
        return self.p >= len(self.d)


def read_index(fp):
    fp.seek(0)
    magic = fp.read(11)
    assert magic == XP3_MAGIC, f"not an XP3 archive: {magic!r}"
    dir_offset = struct.unpack("<q", fp.read(8))[0]
    fp.seek(dir_offset)
    if struct.unpack("<I", fp.read(4))[0] == 0x80:
        # XP3 v2 minor-version redirect: int64 at dir_offset+9.
        fp.seek(dir_offset + 9)
        dir_offset = struct.unpack("<q", fp.read(8))[0]
        fp.seek(dir_offset)
    header_type = fp.read(1)[0]
    if header_type == 0:
        size = struct.unpack("<q", fp.read(8))[0]
        return fp.read(size)
    packed = struct.unpack("<q", fp.read(8))[0]
    fp.read(8)  # unpacked size
    return zlib.decompress(fp.read(packed))


def parse_entries(index: bytes):
    r = Reader(index)
    entries = []
    while not r.eof():
        sig = r.u32()
        entry_size = r.i64()
        entry_end = r.p + entry_size
        if sig == 0x656C6946:  # "File"
            name, segments, entry_hash = "", [], 0
            while r.p < entry_end:
                section = r.u32()
                section_size = r.i64()
                if section == 0x6F666E69 and section_size > entry_end - r.p:  # info w/ wrong size
                    section_size = entry_end - r.p
                sec_end = r.p + section_size
                if section == 0x6F666E69:  # "info"
                    r.u32()  # encrypted flag
                    r.i64()  # file size
                    r.i64()  # packed size
                    name_size = r.u16()
                    if 0 < name_size <= 0x100:
                        name = r.raw(name_size * 2).decode("utf-16-le")
                elif section == 0x6D676573:  # "segm"
                    for _ in range(section_size // 0x1C):
                        compressed = r.i32()
                        offset = r.i64()
                        size = r.i64()
                        packed = r.i64()
                        segments.append((compressed, offset, size, packed))
                elif section == 0x726C6461:  # "adlr"
                    if section_size == 4:
                        entry_hash = r.u32()
                r.p = sec_end
            if name and segments:
                entries.append((name, entry_hash, segments))
        r.p = entry_end
    return entries


def extract(fp, entries, out_dir: Path, suffix=".psb"):
    out_dir.mkdir(parents=True, exist_ok=True)
    count = 0
    for name, entry_hash, segments in entries:
        if not name.lower().endswith(suffix):
            continue
        key = yuzu_key(entry_hash)
        data = bytearray()
        for compressed, offset, size, packed in segments:
            fp.seek(offset)
            seg = fp.read(packed)
            if compressed:
                seg = zlib.decompress(seg)
            data += bytes(b ^ key for b in seg)
        safe = name.replace("\\", "/")
        target = out_dir / safe
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        count += 1
        print(f"{safe}  {len(data) // 1024}KB")
    return count


def main():
    src = Path(sys.argv[1])
    out = Path(sys.argv[2])
    suffix = sys.argv[3] if len(sys.argv) > 3 else ".psb"
    with open(src, "rb") as fp:
        index = read_index(fp)
        entries = parse_entries(index)
        print(f"index: {len(entries)} entries")
        n = extract(fp, entries, out, suffix)
        print(f"extracted {n} files")


main()
