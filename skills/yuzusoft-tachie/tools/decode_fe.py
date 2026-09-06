import os, sys

FE_MAGIC = bytes([0xFE, 0xFE, 0x01, 0xFF, 0xFE])

def decode_fe(data):
    body = data[5:]
    out = []
    for i in range(0, len(body) - 1, 2):
        c = body[i] | (body[i + 1] << 8)
        c = ((c & 0xAAAA) >> 1) | ((c & 0x5555) << 1)
        out.append(c)
    return "".join(chr(c) for c in out)

def decode_any(data):
    if data[:5] == FE_MAGIC:
        return decode_fe(data), True
    if data[:2] in (bytes([0xFF, 0xFE]), bytes([0xFE, 0xFF])):
        return data.decode("utf-16"), False
    return None, False

if __name__ == "__main__":
    for p in sys.argv[1:]:
        data = open(p, "rb").read()
        text, is_fe = decode_any(data)
        if text is None:
            print(f"{p}: unknown format {data[:8].hex()}")
            continue
        print(f"=== {os.path.basename(p)} ({chr(39)}FE-decrypted{chr(39) if False else chr(39)}{chr(39)} plain={chr(39)}{is_fe}{chr(39)}) ===")
        print(text[:3000])
        print()
