import struct
import zlib
from collections import deque
from pathlib import Path


INPUT = Path("project/images/logo-before-transparent.png")
OUTPUT = Path("project/images/logo.png")


def read_chunks(data: bytes):
    pos = 8
    while pos < len(data):
        length = struct.unpack(">I", data[pos : pos + 4])[0]
        chunk_type = data[pos + 4 : pos + 8]
        chunk_data = data[pos + 8 : pos + 8 + length]
        pos += 12 + length
        yield chunk_type, chunk_data


def paeth(a: int, b: int, c: int) -> int:
    p = a + b - c
    pa = abs(p - a)
    pb = abs(p - b)
    pc = abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    if pb <= pc:
        return b
    return c


def unfilter(raw: bytes, width: int, height: int, bpp: int) -> bytearray:
    stride = width * bpp
    out = bytearray(height * stride)
    src = 0
    dst = 0

    for _ in range(height):
        filt = raw[src]
        src += 1
        row = bytearray(raw[src : src + stride])
        src += stride

        prev_row_start = max(0, dst - stride)
        prev = out[prev_row_start:dst] if dst >= stride else bytearray(stride)

        if filt == 1:
            for i in range(stride):
                left = row[i - bpp] if i >= bpp else 0
                row[i] = (row[i] + left) & 0xFF
        elif filt == 2:
            for i in range(stride):
                row[i] = (row[i] + prev[i]) & 0xFF
        elif filt == 3:
            for i in range(stride):
                left = row[i - bpp] if i >= bpp else 0
                row[i] = (row[i] + ((left + prev[i]) >> 1)) & 0xFF
        elif filt == 4:
            for i in range(stride):
                left = row[i - bpp] if i >= bpp else 0
                up = prev[i]
                up_left = prev[i - bpp] if i >= bpp else 0
                row[i] = (row[i] + paeth(left, up, up_left)) & 0xFF

        out[dst : dst + stride] = row
        dst += stride

    return out


def write_png(width: int, height: int, rgba: bytes, output_path: Path):
    stride = width * 4
    filtered = bytearray()
    for y in range(height):
        filtered.append(0)
        start = y * stride
        filtered.extend(rgba[start : start + stride])

    compressed = zlib.compress(bytes(filtered), level=9)

    def chunk(chunk_type: bytes, chunk_data: bytes) -> bytes:
        return (
            struct.pack(">I", len(chunk_data))
            + chunk_type
            + chunk_data
            + struct.pack(">I", zlib.crc32(chunk_type + chunk_data) & 0xFFFFFFFF)
        )

    png = bytearray(b"\x89PNG\r\n\x1a\n")
    png.extend(
        chunk(
            b"IHDR",
            struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0),
        )
    )
    png.extend(chunk(b"IDAT", compressed))
    png.extend(chunk(b"IEND", b""))
    output_path.write_bytes(png)


data = INPUT.read_bytes()
if not data.startswith(b"\x89PNG\r\n\x1a\n"):
    raise SystemExit("Input file is not PNG")

width = height = None
bit_depth = color_type = None
idat_parts = []

for chunk_type, chunk_data in read_chunks(data):
    if chunk_type == b"IHDR":
        width, height, bit_depth, color_type, compression, filt, interlace = struct.unpack(
            ">IIBBBBB", chunk_data
        )
        if bit_depth != 8 or interlace != 0 or color_type not in (2, 6):
            raise SystemExit("Unsupported PNG format for this cleanup")
    elif chunk_type == b"IDAT":
        idat_parts.append(chunk_data)

if width is None or height is None:
    raise SystemExit("Broken PNG")

bpp = 3 if color_type == 2 else 4
raw = zlib.decompress(b"".join(idat_parts))
pixels = unfilter(raw, width, height, bpp)


def rgb_at(x: int, y: int):
    i = (y * width + x) * bpp
    return pixels[i], pixels[i + 1], pixels[i + 2]


def is_bg(x: int, y: int) -> bool:
    r, g, b = rgb_at(x, y)
    return r > 235 and g > 235 and b > 235 and max(abs(r - g), abs(r - b), abs(g - b)) < 18


background = [False] * (width * height)
q = deque()


def push(x: int, y: int):
    idx = y * width + x
    if not background[idx] and is_bg(x, y):
        background[idx] = True
        q.append((x, y))


for x in range(width):
    push(x, 0)
    push(x, height - 1)
for y in range(height):
    push(0, y)
    push(width - 1, y)

while q:
    x, y = q.popleft()
    for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
        if 0 <= nx < width and 0 <= ny < height:
            push(nx, ny)

rgba = bytearray(width * height * 4)
min_x, min_y = width, height
max_x, max_y = 0, 0

for y in range(height):
    for x in range(width):
        src = (y * width + x) * bpp
        dst = (y * width + x) * 4
        r, g, b = pixels[src], pixels[src + 1], pixels[src + 2]
        is_background = background[y * width + x]

        rgba[dst] = r
        rgba[dst + 1] = g
        rgba[dst + 2] = b

        if is_background:
            whiteness = max(r, g, b)
            alpha = max(0, min(255, (255 - whiteness) * 7))
            rgba[dst + 3] = alpha
        else:
            rgba[dst + 3] = 255
            min_x = min(min_x, x)
            min_y = min(min_y, y)
            max_x = max(max_x, x)
            max_y = max(max_y, y)

if min_x >= max_x or min_y >= max_y:
    raise SystemExit("Could not isolate logo content")

pad = 4
crop_x = max(0, min_x - pad)
crop_y = max(0, min_y - pad)
crop_w = min(width - crop_x, (max_x - min_x + 1) + pad * 2)
crop_h = min(height - crop_y, (max_y - min_y + 1) + pad * 2)

cropped = bytearray(crop_w * crop_h * 4)
for y in range(crop_h):
    src_start = ((crop_y + y) * width + crop_x) * 4
    src_end = src_start + crop_w * 4
    dst_start = y * crop_w * 4
    cropped[dst_start : dst_start + crop_w * 4] = rgba[src_start:src_end]

write_png(crop_w, crop_h, bytes(cropped), OUTPUT)
print(f"Transparent logo saved to {OUTPUT}")
