"""Python port of 千恋＊万花 cxdec, ported from 补丁/解密补丁/xp3filter.tjs
(semantics cross-checked against GARbro KiriKiriCx.cs). All uint32 arithmetic."""
import re, struct

M = 0xFFFFFFFF
def u32(x): return x & M

TJS_PATH = r"E:\Downloads\千恋＊万花\千恋＊万花\补丁\解密补丁\xp3filter.tjs"

def load_control_block():
    text = open(TJS_PATH, encoding='ascii').read()
    m = re.search(r'var tempBlock = \[(.*?)\];', text, re.S)
    vals = [int(x, 16) for x in re.findall(r'0x[0-9A-Fa-f]+', m.group(1))]
    assert len(vals) == 4096, len(vals)
    return [struct.unpack_from('<I', bytes(vals[i:i+4]))[0] for i in range(0, 4096, 4)]

CB = load_control_block()

class CxProgram:
    LIMIT = 128
    MOV_VAL, MOV_REG, NOT, NEG, INC, DEC, ADD_VAL, SUB_VAL, XOR_VAL, \
    ADD_REG, SUB_REG, PUSH, POP, SHR_REG, SHL_REG, IMUL_REG, LOAD_ARG, \
    INTERLACE, TABLE_ECB = range(19)

    def __init__(self, seed, cb):
        self.cb = cb
        self.seed = u32(seed)
        self.code = []
        self.length = 0

    def get_random(self):
        seed = self.seed
        self.seed = u32(1103515245 * seed + 12345)
        return u32(self.seed ^ u32(seed << 16) ^ (seed >> 16))

    def _push(self, n, op, imm=None):
        self.length += n
        if self.length > self.LIMIT:
            return False
        self.code.append((op, imm))
        return True

    def emit_prolog(self):
        c = self.get_random() % 3
        if c == 2:
            self.length += 7
            if self.length > self.LIMIT: return False
            return self._push(4, self.MOV_VAL, self.cb[self.get_random() & 0x3ff])
        elif c == 1:
            self.length += 1
            if self.length > self.LIMIT: return False
            return self._push(4, self.MOV_VAL, self.get_random())
        else:
            return self._push(2, self.LOAD_ARG)

    def emit_stage0(self, stage):
        if stage == 1:
            return self.emit_prolog()
        stage -= 1
        if self.get_random() & 1:
            if not self.emit_stage1(stage): return False
        else:
            if not self.emit_stage0(stage): return False
        c = self.get_random() & 7
        if c == 5:   return self._push(2, self.NOT)
        elif c == 4: return self._push(2, self.NEG)
        elif c == 2: return self._push(1, self.INC)
        elif c == 6: return self._push(1, self.DEC)
        elif c == 7: return self._push(21, self.INTERLACE)
        elif c == 3:
            self.length += 1
            if self.length > self.LIMIT: return False
            return self._push(4, self.XOR_VAL, self.get_random())
        elif c == 0:
            self.length += 1
            if self.length > self.LIMIT: return False
            if self.get_random() & 1:
                return self._push(4, self.ADD_VAL, self.get_random())
            return self._push(4, self.SUB_VAL, self.get_random())
        else:
            return self._push(13, self.TABLE_ECB)

    def emit_stage1(self, stage):
        if stage == 1:
            return self.emit_prolog()
        stage -= 1
        if not self._push(1, self.PUSH): return False
        if self.get_random() & 1:
            if not self.emit_stage1(stage): return False
        else:
            if not self.emit_stage0(stage): return False
        if not self._push(2, self.MOV_REG): return False
        if self.get_random() & 1:
            if not self.emit_stage1(stage): return False
        else:
            if not self.emit_stage0(stage): return False
        c = self.get_random() % 6
        if c == 2:   ok = self._push(2, self.ADD_REG)
        elif c == 5: ok = self._push(2, self.SUB_REG)
        elif c == 0: ok = self._push(2, self.NEG) and self._push(2, self.ADD_REG)
        elif c == 3: ok = self._push(3, self.IMUL_REG)
        elif c == 1: ok = self._push(9, self.SHL_REG)
        else:        ok = self._push(9, self.SHR_REG)
        return ok and self._push(1, self.POP)

    def build(self):
        for stage in range(5, 0, -1):
            self.length = 9  # xcode limit init = 5 + 4
            self.code = []
            if self.emit_stage1(stage) and self.length + 5 + 1 <= self.LIMIT:
                return
        raise ValueError('overly large bytecode')

    def execute(self, arg):
        reg = 0; reg2 = 0
        stack = []
        for op, imm in self.code:
            if op == self.MOV_VAL: reg = imm
            elif op == self.LOAD_ARG: reg = arg
            elif op == self.MOV_REG: reg2 = reg
            elif op == self.NOT: reg = u32(~reg)
            elif op == self.NEG: reg = u32(-reg)
            elif op == self.INC: reg = u32(reg + 1)
            elif op == self.DEC: reg = u32(reg - 1)
            elif op == self.ADD_VAL: reg = u32(reg + imm)
            elif op == self.SUB_VAL: reg = u32(reg - imm)
            elif op == self.XOR_VAL: reg = u32(reg ^ imm)
            elif op == self.ADD_REG: reg = u32(reg + reg2)
            elif op == self.SUB_REG: reg = u32(reg - reg2)
            elif op == self.PUSH: stack.append(reg2)
            elif op == self.POP: reg2 = stack.pop()
            elif op == self.SHR_REG: reg = reg >> (reg2 & 0xF)
            elif op == self.SHL_REG: reg = u32(reg << (reg2 & 0xF))
            elif op == self.IMUL_REG: reg = u32(reg * reg2)
            elif op == self.TABLE_ECB: reg = self.cb[reg & 0x3FF]
            elif op == self.INTERLACE:
                reg = ((reg & 0xAAAAAAAA) >> 1) | u32((reg & 0x55555555) << 1)
            else:
                raise ValueError('bad op %d' % op)
        return reg

class Cxdec:
    MASK = 0x134
    OFFSET = 0x736
    def __init__(self, cb=None):
        self.cb = cb if cb is not None else CB
        self.programs = {}

    def execute_xcode(self, hash_):
        seed = hash_ & 0x7f
        if seed not in self.programs:
            p = CxProgram(seed, self.cb)
            p.build()
            self.programs[seed] = p
        h = hash_ >> 7
        return (self.programs[seed].execute(h),
                self.programs[seed].execute(u32(~h)))

    def _decode(self, key, offset, buf, pos, count):
        r1, r2 = self.execute_xcode(key)
        key1 = r2 >> 16
        key2 = r2 & 0xffff
        key3 = r1 & 0xff
        if key1 == key2:
            key2 = u32(key2 + 1)
        if key3 == 0:
            key3 = 1
        if offset <= key2 < offset + count:
            buf[pos + key2 - offset] ^= (r1 >> 16) & 0xff
        if offset <= key1 < offset + count:
            buf[pos + key1 - offset] ^= (r1 >> 8) & 0xff
        kb = bytes([key3]) * count
        mv = memoryview(buf)
        for i in range(count):
            mv[pos + i] ^= key3

    def decrypt(self, hash_, offset, buf, pos=0, count=None):
        """buf: bytearray; offset: absolute position of buf[pos] in the file stream."""
        if count is None:
            count = len(buf) - pos
        key = u32(hash_)
        boundary = (key & self.MASK) + self.OFFSET
        if offset < boundary:
            base_length = min(boundary - offset, count)
            self._decode(key, offset, buf, pos, base_length)
            offset += base_length
            pos += base_length
            count -= base_length
        if count > 0:
            self._decode(u32((key >> 16) ^ key), offset, buf, pos, count)

if __name__ == '__main__':
    import sys
    # self-test: decrypt first few entries of fgimage1080 and check magic
    sys.path.insert(0, '.')
    from list_entries import read_index, parse_entries
    import zlib
    path = r"E:\Downloads\千恋＊万花\千恋＊万花\fgimage1080.xp3"
    dec = Cxdec()
    with open(path, 'rb') as fp:
        idx = read_index(fp)
        entries = parse_entries(idx)
        for name, h, segs in entries[:8]:
            data = bytearray()
            for comp, off, size, pk in segs:
                fp.seek(off)
                seg = fp.read(pk)
                if comp:
                    seg = zlib.decompress(seg)
                data += seg
            dec.decrypt(h, 0, data)
            print(f"{name} hash={h:#010x} -> {data[:16].hex()} {data[:4]}")
