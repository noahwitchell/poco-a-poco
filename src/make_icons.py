# Home-screen icon: solid cobalt field with a saffron speech bubble and a tilde, drawn at 4x and box-downsampled.
import zlib, struct, os, math
os.chdir(os.path.dirname(os.path.abspath(__file__)) + '/..')
COB = (39, 69, 196); SAF = (227, 150, 26); PAPER = (238, 241, 248); INK = (20, 29, 69)

def color(x, y):  # x, y in 0..1
    c = COB  # solid cobalt field
    # speech bubble: rounded box + tail
    bx0, by0, bx1, by1, r = .2, .24, .8, .66, .12
    qx = min(max(x, bx0 + r), bx1 - r); qy = min(max(y, by0 + r), by1 - r)
    inbox = bx0 <= x <= bx1 and by0 <= y <= by1 and math.hypot(x - qx, y - qy) <= r
    tail = .62 <= y <= .8 and .3 <= x <= .46 and (x - .3) <= (.8 - y) * .9
    if inbox or tail: c = SAF
    # tilde across the bubble
    tx = (x - .3) / .4
    if 0 <= tx <= 1:
        ty = .45 - .055 * math.sin(tx * 2 * math.pi)
        if abs(y - ty) < .035: c = INK
    return c

def png(path, S):
    k = 4; raw = b''
    for y in range(S):
        row = bytearray(b'\x00')
        for x in range(S):
            acc = [0, 0, 0]
            for sy in range(k):
                for sx in range(k):
                    c = color((x + (sx + .5) / k) / S, (y + (sy + .5) / k) / S)
                    acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]
            row += bytes(v // (k * k) for v in acc)
        raw += bytes(row)
    ch = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', S, S, 8, 2, 0, 0, 0)) + ch(b'IDAT', zlib.compress(raw, 9)) + ch(b'IEND', b''))

os.makedirs('docs', exist_ok=True)
png('docs/icon-192.png', 192); png('docs/icon-512.png', 512); png('docs/apple-touch-icon.png', 180)
print('icons written')
