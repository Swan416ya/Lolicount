import struct

MASK32 = 0xFFFFFFFF
IMMED = 0x100

# CxByteCode enum values (order matters)
NOP, RETN, MOV_EDI_ARG, PUSH_EBX, POP_EBX, PUSH_ECX, POP_ECX, MOV_EAX_EBX, MOV_EBX_EAX, MOV_ECX_EBX, MOV_EAX_CONTROL_BLOCK, MOV_EAX_EDI, MOV_EAX_INDIRECT, ADD_EAX_EBX, SUB_EAX_EBX, IMUL_EAX_EBX, AND_ECX_0F, SHR_EBX_1, SHL_EAX_1, SHR_EAX_CL, SHL_EAX_CL, OR_EAX_EBX, NOT_EAX, NEG_EAX, DEC_EAX, INC_EAX = range(26)
MOV_EAX_IMMED, AND_EBX_IMMED, AND_EAX_IMMED, XOR_EAX_IMMED, ADD_EAX_IMMED, SUB_EAX_IMMED = range(IMMED+1, IMMED+7)

class HxSplittableRandom:
    def __init__(self, seed):
        self.seed = seed & 0xFFFFFFFFFFFFFFFF
    def next(self):
        self.seed = (self.seed + 0x9e3779b97f4a7c15) & 0xFFFFFFFFFFFFFFFF
        z = self.seed
        z ^= z >> 30; z = (z * 0xbf58476d1ce4e5b9) & 0xFFFFFFFFFFFFFFFF
        z ^= z >> 27; z = (z * 0x94d049bb133111eb) & 0xFFFFFFFFFFFFFFFF
        z ^= z >> 31
        return z

class HxProgram:
    LIMIT = 0x80
    def __init__(self, seed, control_block, random_method):
        self.random_method = random_method
        self.control_block = control_block
        self.seed = seed & MASK32
        self.code = []
        self.length = 0
        s = self.seed
        s = (s & MASK32) | ((~s & MASK32) << 32)
        r = HxSplittableRandom(s)
        self.m_seed = [r.next(), r.next()]

    def get_random(self):
        if self.random_method == 0:
            return self._old_random()
        return self._new_random()

    def _old_random(self):
        a, b = self.m_seed
        c_lo = u32((a >> 32) ^ (b >> 32))
        c_hi = u32((a & MASK32) ^ (b & MASK32))
        e_lo, e_hi = c_hi, c_lo
        t = ((c_hi << 21) & 0xFFFFFFFFFFFFFFFF) ^ (a >> 15) ^ c_hi
        new0_lo = u32(t)
        t = u32(((a >> 32) >> 15) | ((a & MASK32) << 17)) ^ (u32((e_hi << 48) | (e_lo >> 16)) if False else 0)
        # NOTE: old random not needed (RandomType=1)
        raise NotImplementedError

    def _new_random(self):
        a, b = self.m_seed
        a_lo, a_hi = a & MASK32, (a >> 32) & MASK32
        b_lo, b_hi = b & MASK32, (b >> 32) & MASK32
        c_lo = u32(a_lo ^ b_lo)
        c_hi = u32(a_hi ^ b_hi)
        t = u32(((a_lo << 24) | (a_hi >> 8)) & MASK32)
        t = u32(t ^ u32((c_lo << 16) & MASK32) ^ c_lo)
        new0_lo = t
        c_u64 = (c_hi << 32) | c_lo
        t = u32((c_u64 >> 16) ^ (a >> 8) ^ c_hi)
        new0_hi = t
        new1_hi = u32(((c_hi >> 27) | (c_lo << 5)) & MASK32)
        new1_lo = u32(c_u64 >> 27)
        self.m_seed = [(new0_hi << 32) | new0_lo, (new1_hi << 32) | new1_lo]
        d = (5 * a) & 0xFFFFFFFFFFFFFFFF
        t = u32((((d >> 32) >> 25) | (d << 7)) & MASK32)
        t = u32(t * 9)
        return t

    def emit_nop(self, count):
        if self.length + count > self.LIMIT: return False
        self.length += count
        return True

    def emit(self, code, length=1):
        if self.length + length > self.LIMIT: return False
        self.length += length
        self.code.append(code)
        return True

    def emit_u32(self, x):
        if self.length + 4 > self.LIMIT: return False
        self.length += 4
        self.code.append(x & MASK32)
        return True

    def emit_random(self):
        return self.emit_u32(self.get_random())

    def clear(self):
        self.length = 0
        self.code = []

    def execute(self, h):
        h &= MASK32
        eax = ebx = ecx = edi = 0
        stack = []
        immed = 0
        i = 0
        code = self.code
        n = len(code)
        while i < n:
            bc = code[i]
            i += 1
            if bc & IMMED == IMMED and bc != NOP:
                if i >= n: raise ValueError('incomplete IMMED')
                immed = code[i]
                i += 1
            if bc == NOP: pass
            elif bc == MOV_EDI_ARG: edi = h
            elif bc == PUSH_EBX: stack.append(ebx)
            elif bc == POP_EBX: ebx = stack.pop()
            elif bc == PUSH_ECX: stack.append(ecx)
            elif bc == POP_ECX: ecx = stack.pop()
            elif bc == MOV_EBX_EAX: ebx = eax
            elif bc == MOV_EAX_EDI: eax = edi
            elif bc == MOV_ECX_EBX: ecx = ebx
            elif bc == MOV_EAX_EBX: eax = ebx
            elif bc == AND_ECX_0F: ecx &= 0x0f
            elif bc == SHR_EBX_1: ebx = u32(ebx >> 1)
            elif bc == SHL_EAX_1: eax = u32(eax << 1)
            elif bc == SHR_EAX_CL: eax = u32(eax >> (ecx & 31))
            elif bc == SHL_EAX_CL: eax = u32(eax << (ecx & 31))
            elif bc == OR_EAX_EBX: eax |= ebx
            elif bc == NOT_EAX: eax = ~eax & MASK32
            elif bc == NEG_EAX: eax = u32(-eax)
            elif bc == DEC_EAX: eax = u32(eax - 1)
            elif bc == INC_EAX: eax = u32(eax + 1)
            elif bc == ADD_EAX_EBX: eax = u32(eax + ebx)
            elif bc == SUB_EAX_EBX: eax = u32(eax - ebx)
            elif bc == IMUL_EAX_EBX: eax = u32(eax * ebx)
            elif bc == ADD_EAX_IMMED: eax = u32(eax + immed)
            elif bc == SUB_EAX_IMMED: eax = u32(eax - immed)
            elif bc == AND_EBX_IMMED: ebx &= immed
            elif bc == AND_EAX_IMMED: eax &= immed
            elif bc == XOR_EAX_IMMED: eax ^= immed
            elif bc == MOV_EAX_IMMED: eax = immed
            elif bc == MOV_EAX_INDIRECT:
                if eax >= len(self.control_block): raise ValueError('OOB')
                eax = ~self.control_block[eax] & MASK32
            elif bc == RETN:
                if stack: raise ValueError('imbalanced stack')
                return eax
            else:
                raise ValueError('bad bytecode %d' % bc)
        raise ValueError('no RETN')

def u32(x): return x & MASK32

class CxEngine:
    def __init__(self, control_block, prolog_order, odd_order, even_order, random_type, mask, offset, filter_key):
        self.control_block = control_block
        self.prolog_order = prolog_order
        self.odd_order = odd_order
        self.even_order = even_order
        self.random_type = random_type
        self.mask = mask
        self.offset = offset
        self.filter_key = filter_key
        self.programs = {}

    def generate_program(self, seed):
        # NOTE: C# reuses the same program object across stage retries; Clear()
        # does NOT reset the RNG state, so generation continues from where the
        # failed stage left off. We must replicate that behavior exactly.
        for stage in range(5, 0, -1):
            if stage == 5:
                p = HxProgram(seed, self.control_block, self.random_type)
            if self.emit_code(p, stage):
                return p
            p.clear()
        raise ValueError('program gen failed')

    def emit_code(self, p, stage):
        return (p.emit_nop(5) and p.emit(MOV_EDI_ARG, 4)
                and self.emit_body(p, stage)
                and p.emit_nop(5) and p.emit(RETN))

    def emit_body(self, p, stage):
        if stage == 1: return self.emit_prolog(p)
        if not p.emit(PUSH_EBX): return False
        if p.get_random() & 1:
            if not self.emit_body(p, stage-1): return False
        else:
            if not self.emit_body2(p, stage-1): return False
        if not p.emit(MOV_EBX_EAX, 2): return False
        if p.get_random() & 1:
            if not self.emit_body(p, stage-1): return False
        else:
            if not self.emit_body2(p, stage-1): return False
        return self.emit_odd_branch(p) and p.emit(POP_EBX)

    def emit_body2(self, p, stage):
        if stage == 1: return self.emit_prolog(p)
        if p.get_random() & 1:
            rc = self.emit_body(p, stage-1)
        else:
            rc = self.emit_body2(p, stage-1)
        return rc and self.emit_even_branch(p)

    def emit_prolog(self, p):
        c = self.prolog_order[p.get_random() % 3]
        if c == 2:
            return (p.emit_nop(5) and p.emit(MOV_EAX_IMMED, 2)
                    and p.emit_u32(p.get_random() & 0x3ff)
                    and p.emit(MOV_EAX_INDIRECT, 0))
        elif c == 1:
            return p.emit(MOV_EAX_EDI, 2)
        else:
            return p.emit(MOV_EAX_IMMED) and p.emit_random()

    def emit_even_branch(self, p):
        c = self.even_order[p.get_random() & 7]
        if c == 0: return p.emit(NOT_EAX, 2)
        elif c == 1: return p.emit(DEC_EAX)
        elif c == 2: return p.emit(NEG_EAX, 2)
        elif c == 3: return p.emit(INC_EAX)
        elif c == 4:
            return (p.emit_nop(5) and p.emit(AND_EAX_IMMED)
                    and p.emit_u32(0x3ff) and p.emit(MOV_EAX_INDIRECT, 3))
        elif c == 5:
            return (p.emit(PUSH_EBX) and p.emit(MOV_EBX_EAX, 2)
                    and p.emit(AND_EBX_IMMED, 2) and p.emit_u32(0xaaaaaaaa)
                    and p.emit(AND_EAX_IMMED) and p.emit_u32(0x55555555)
                    and p.emit(SHR_EBX_1, 2) and p.emit(SHL_EAX_1, 2)
                    and p.emit(OR_EAX_EBX, 2) and p.emit(POP_EBX))
        elif c == 6:
            return p.emit(XOR_EAX_IMMED) and p.emit_random()
        elif c == 7:
            if p.get_random() & 1:
                rc = p.emit(ADD_EAX_IMMED)
            else:
                rc = p.emit(SUB_EAX_IMMED)
            return rc and p.emit_random()
        return False

    def emit_odd_branch(self, p):
        c = self.odd_order[p.get_random() % 6]
        if c == 0:
            return (p.emit(PUSH_ECX) and p.emit(MOV_ECX_EBX, 2)
                    and p.emit(AND_ECX_0F, 3) and p.emit(SHR_EAX_CL, 2)
                    and p.emit(POP_ECX))
        elif c == 1:
            return (p.emit(PUSH_ECX) and p.emit(MOV_ECX_EBX, 2)
                    and p.emit(AND_ECX_0F, 3) and p.emit(SHL_EAX_CL, 2)
                    and p.emit(POP_ECX))
        elif c == 2: return p.emit(ADD_EAX_EBX, 2)
        elif c == 3: return p.emit(NEG_EAX, 2) and p.emit(ADD_EAX_EBX, 2)
        elif c == 4: return p.emit(IMUL_EAX_EBX, 3)
        elif c == 5: return p.emit(SUB_EAX_EBX, 2)
        return False

    def execute_xcode(self, h):
        h &= MASK32
        seed = h & 0x7f
        if seed not in self.programs:
            self.programs[seed] = self.generate_program(seed)
        h >>= 7
        r1 = self.programs[seed].execute(h)
        r2 = self.programs[seed].execute(~h & MASK32)
        return r1, r2

def make_filter_keys(engine, entry_key):
    entry_key &= 0xFFFFFFFFFFFFFFFF
    if entry_key & 0x100000000 == 0:
        pass
    # CreateFilter already applied FilterKey by caller
    k0 = engine.execute_xcode(u32(entry_key & MASK32))
    k1 = engine.execute_xcode(u32((entry_key >> 32) & MASK32))
    key0 = (k0[0] & MASK32) | ((k0[1] & MASK32) << 32)
    key1 = (k1[0] & MASK32) | ((k1[1] & MASK32) << 32)
    split = (engine.offset + ((entry_key >> 16) & engine.mask)) & MASK32
    header_key_seed = (~entry_key) & 0xFFFFFFFFFFFFFFFF
    k3 = engine.execute_xcode(u32(header_key_seed & MASK32))
    v5 = ((k3[0] & MASK32) | ((k3[1] & MASK32) << 32))
    v5 = (~v5) & 0xFFFFFFFFFFFFFFFF
    hk = bytearray(16)
    for i in range(8):
        hk[i] = (v5 >> (56 - i*8)) & 0xFF
    k3 = engine.execute_xcode(u32(v5 & MASK32))
    v5b = ((k3[0] & MASK32) | ((k3[1] & MASK32) << 32))
    v5b = (~v5b) & 0xFFFFFFFFFFFFFFFF
    for i in range(8):
        hk[i+8] = (v5b >> (56 - i*8)) & 0xFF
    return key0, key1, split, bytes(hk)

class SpanDecryptor:
    def __init__(self, key, flag=False):
        self.decrypt_key = u32(((key >> 8) & 0xFF) | ((key >> 8) & 0xFF00))
        self.span_pos = [(key >> 48) & 0xFFFF, (key >> 32) & 0xFFFF]
        self.first_key = u32(key & 0xFF)
        if self.span_pos[0] == self.span_pos[1]:
            self.span_pos[1] += 1
        if flag:
            self.decrypt_key = 0
        if not flag and self.first_key == 0:
            self.first_key = 0xA5
        self.first_key = u32(self.first_key * 0x1010101)

    def decrypt(self, data, pos):
        # pos: absolute position of data[0] in file
        kb = struct.pack('<I', self.first_key)
        for i in range(len(data)):
            data[i] ^= kb[(pos + i) & 3]
        key1 = self.decrypt_key & 0xFF
        key2 = (self.decrypt_key >> 8) & 0xFF
        if key1 != 0 and self.span_pos[0] >= pos and self.span_pos[0] < pos + len(data):
            data[self.span_pos[0] - pos] ^= key1
        if key2 != 0 and self.span_pos[1] >= pos and self.span_pos[1] < pos + len(data):
            data[self.span_pos[1] - pos] ^= key2

class HxFilter:
    def __init__(self, key0, key1, split, header_key):
        self.spans = [SpanDecryptor(key0), SpanDecryptor(key1)]
        self.split = split
        self.header_key = header_key

    def decrypt(self, pos, data):
        n = len(data)
        # header decrypt [0,16)
        if pos < 16:
            start = max(pos, 0)
            end = min(pos + n, 16)
            for i in range(start, end):
                data[i - pos] ^= self.header_key[i]
        if self.split > pos:
            if self.split < pos + n:
                cut = self.split - pos
                # NOTE: bytearray slicing copies; decrypt in place via memoryview
                self.spans[0].decrypt(memoryview(data)[:cut], pos)
                self.spans[1].decrypt(memoryview(data)[cut:], self.split)
            else:
                self.spans[0].decrypt(data, pos)
        else:
            self.spans[1].decrypt(data, pos)

if __name__ == '__main__':
    cb = [int(x, 16) for x in open(r'E:\tmp\sanoba-work\control_block.txt').read().split()]
    engine = CxEngine(cb, [2,0,1], [5,0,1,2,4,3], [1,6,3,7,0,4,2,5], 1, 550, 456, 0xa0f42326e03092d9)
    import json
    entries = json.load(open(r'E:\tmp\sanoba-work\hx_entries.json', encoding='utf-8'))
    # verify with first file '倁' = facezoom.csv (entry in fgimage)
    # build filters for all
    out = {}
    for uname, (path, name, eid, ekey) in entries.items():
        ek = ekey & 0xFFFFFFFFFFFFFFFF
        if (eid & 0x100000000) == 0:
            ek ^= engine.filter_key
        k0, k1, split, hk = make_filter_keys(engine, ek)
        out[uname] = [k0, k1, split, hk.hex()]
    json.dump(out, open(r'E:\tmp\sanoba-work\hx_filters.json','w'))
    print('filters built for', len(out))
