import struct, zlib

MASK32 = 0xFFFFFFFF

def u32(x): return x & MASK32

class Chacha:
    def __init__(self, key, nonce, seed):
        self.state = bytearray(64)
        self.state[0:16] = b'expand 32-byte k'
        self.state[16:32] = key[0:16]
        self.state[32:48] = key[16:32]
        struct.pack_into('<I', self.state, 48, seed[0] & MASK32)
        struct.pack_into('<I', self.state, 52, seed[1] & MASK32)
        self.state[56:64] = nonce[0:8]

    @staticmethod
    def rotl(v, c):
        return u32((v << c) | (v >> (32 - c)))

    def transform(self, src):
        z = list(struct.unpack_from('<16I', src, 0))
        for _ in range(10):
            z[0]=u32(z[0]+z[4]); z[12]=self.rotl(z[12]^z[0],16)
            z[8]=u32(z[8]+z[12]); z[4]=self.rotl(z[4]^z[8],12)
            z[0]=u32(z[0]+z[4]); z[12]=self.rotl(z[12]^z[0],8)
            z[8]=u32(z[8]+z[12]); z[4]=self.rotl(z[4]^z[8],7)
            z[1]=u32(z[1]+z[5]); z[13]=self.rotl(z[13]^z[1],16)
            z[9]=u32(z[9]+z[13]); z[5]=self.rotl(z[5]^z[9],12)
            z[1]=u32(z[1]+z[5]); z[13]=self.rotl(z[13]^z[1],8)
            z[9]=u32(z[9]+z[13]); z[5]=self.rotl(z[5]^z[9],7)
            z[2]=u32(z[2]+z[6]); z[14]=self.rotl(z[14]^z[2],16)
            z[10]=u32(z[10]+z[14]); z[6]=self.rotl(z[6]^z[10],12)
            z[2]=u32(z[2]+z[6]); z[14]=self.rotl(z[14]^z[2],8)
            z[10]=u32(z[10]+z[14]); z[6]=self.rotl(z[6]^z[10],7)
            z[3]=u32(z[3]+z[7]); z[15]=self.rotl(z[15]^z[3],16)
            z[11]=u32(z[11]+z[15]); z[7]=self.rotl(z[7]^z[11],12)
            z[3]=u32(z[3]+z[7]); z[15]=self.rotl(z[15]^z[3],8)
            z[11]=u32(z[11]+z[15]); z[7]=self.rotl(z[7]^z[11],7)
            z[0]=u32(z[0]+z[5]); z[15]=self.rotl(z[15]^z[0],16)
            z[10]=u32(z[10]+z[15]); z[5]=self.rotl(z[5]^z[10],12)
            z[0]=u32(z[0]+z[5]); z[15]=self.rotl(z[15]^z[0],8)
            z[10]=u32(z[10]+z[15]); z[5]=self.rotl(z[5]^z[10],7)
            z[1]=u32(z[1]+z[6]); z[12]=self.rotl(z[12]^z[1],16)
            z[11]=u32(z[11]+z[12]); z[6]=self.rotl(z[6]^z[11],12)
            z[1]=u32(z[1]+z[6]); z[12]=self.rotl(z[12]^z[1],8)
            z[11]=u32(z[11]+z[12]); z[6]=self.rotl(z[6]^z[11],7)
            z[2]=u32(z[2]+z[7]); z[13]=self.rotl(z[13]^z[2],16)
            z[8]=u32(z[8]+z[13]); z[7]=self.rotl(z[7]^z[8],12)
            z[2]=u32(z[2]+z[7]); z[13]=self.rotl(z[13]^z[2],8)
            z[8]=u32(z[8]+z[13]); z[7]=self.rotl(z[7]^z[8],7)
            z[3]=u32(z[3]+z[4]); z[14]=self.rotl(z[14]^z[3],16)
            z[9]=u32(z[9]+z[14]); z[4]=self.rotl(z[4]^z[9],12)
            z[3]=u32(z[3]+z[4]); z[14]=self.rotl(z[14]^z[3],8)
            z[9]=u32(z[9]+z[14]); z[4]=self.rotl(z[4]^z[9],7)
        return struct.pack('<16I', *z)

    def decrypt(self, data):
        out = bytearray()
        nblocks = len(data) // 64
        pos = 0
        for i in range(nblocks):
            ks = self.transform(self.state)
            block = bytearray(data[pos:pos+64])
            for j in range(0, 64, 4):
                s0 = struct.unpack_from('<I', self.state, j)[0]
                s1 = struct.unpack_from('<I', ks, j)[0]
                v = struct.unpack_from('<I', block, j)[0]
                struct.pack_into('<I', block, j, u32(v ^ u32(s0 + s1)))
            out += block
            pos += 64
            # increment counter (bytes 48..55)
            k = 0
            while True:
                self.state[48+k] = u32(self.state[48+k] + 1) & 0xFF
                if self.state[48+k] != 0:
                    break
                k += 1
                if k == 8:
                    break
        rem = len(data) & 63
        if rem > 0:
            ks = self.transform(self.state)
            temp = bytearray(64)
            for i in range(0, 64, 4):
                s0 = struct.unpack_from('<I', self.state, i)[0]
                s1 = struct.unpack_from('<I', ks, i)[0]
                struct.pack_into('<I', temp, i, u32(s0 + s1))
            for i in range(rem):
                out.append(data[pos+i] ^ temp[i])
        return bytes(out)

def decrypt_hx_index(hx, key1, key2):
    chacha = Chacha(key1, key2, [1, 0])
    dec = chacha.decrypt(hx[16:])
    return zlib.decompress(dec[4:])

if __name__ == '__main__':
    hx = open(r'E:\tmp\sanoba-work\hx_index.bin','rb').read()
    key1 = bytes.fromhex('E6662EA4B50CCD083D56E13E0BD52EF3A75048052CCC77D57D1BC5A873E0BF14')
    key2 = bytes.fromhex('FEFE820B57060E50B7CC2580DB04D993')
    out = decrypt_hx_index(hx, key1, key2)
    open(r'E:\tmp\sanoba-work\hx_index_dec.bin','wb').write(out)
    print('decompressed', len(out))
    print(out[:64].hex(' '))
