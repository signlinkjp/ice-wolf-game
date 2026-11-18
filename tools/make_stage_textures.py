#!/usr/bin/env python3
"""Generate the ICE WOLF v1.1.0 stage textures.

Run from the repository root:

    python3 tools/make_stage_textures.py

Every stage in the selector gets its own wall / cap / floor set, so a stage is
recognisable at a glance instead of being the frost lab with a colour on it.
The Classic arena keeps the 1.0.0 frost-lab textures and is not produced here.

    assets/wall_<stage>.png    512x512  the four sides of a wall
    assets/cap_<stage>.png     512x512  the top face of a wall (what the camera sees)
    assets/floor_<stage>.png   512x512  the floor

Every texture tiles seamlessly. Drawing goes through wrap helpers that plot each
shape on the eight neighbouring tiles as well; the water-light and mist fields
are sums of sines with whole-number frequencies, which wrap by construction.
Files are quantised to a 256-colour palette so fifteen of them stay small enough
for the HTML5 build. Everything is deterministic (fixed seeds), so re-running
the script produces the same bytes and the repository stays diff-stable.
"""

from __future__ import annotations

import math
import os
import random

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

SIZE = 512
ASSETS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets")

NEIGHBOURS = (-SIZE, 0, SIZE)


# --------------------------------------------------------------------- helpers
def dot(draw, x, y, radius, fill):
    for dx in NEIGHBOURS:
        for dy in NEIGHBOURS:
            draw.ellipse(
                [x + dx - radius, y + dy - radius, x + dx + radius, y + dy + radius],
                fill=fill,
            )


def ring(draw, x, y, radius, fill=None, outline=None, width=1):
    for dx in NEIGHBOURS:
        for dy in NEIGHBOURS:
            draw.ellipse(
                [x + dx - radius, y + dy - radius, x + dx + radius, y + dy + radius],
                fill=fill,
                outline=outline,
                width=width,
            )


def line(draw, points, fill, width=1, joint="curve"):
    for dx in NEIGHBOURS:
        for dy in NEIGHBOURS:
            draw.line([(x + dx, y + dy) for (x, y) in points], fill=fill, width=width, joint=joint)


def poly(draw, points, fill=None, outline=None, width=1):
    for dx in NEIGHBOURS:
        for dy in NEIGHBOURS:
            draw.polygon([(x + dx, y + dy) for (x, y) in points], fill=fill, outline=outline, width=width)


def box(draw, x0, y0, x1, y1, fill=None, outline=None, width=1):
    for dx in NEIGHBOURS:
        for dy in NEIGHBOURS:
            draw.rectangle([x0 + dx, y0 + dy, x1 + dx, y1 + dy], fill=fill, outline=outline, width=width)


def arc(draw, x0, y0, x1, y1, start, end, fill, width=2):
    for dx in NEIGHBOURS:
        for dy in NEIGHBOURS:
            draw.arc([x0 + dx, y0 + dy, x1 + dx, y1 + dy], start, end, fill=fill, width=width)


def pie(draw, x0, y0, x1, y1, start, end, fill):
    for dx in NEIGHBOURS:
        for dy in NEIGHBOURS:
            draw.pieslice([x0 + dx, y0 + dy, x1 + dx, y1 + dy], start, end, fill=fill)


def vertical_gradient(top, bottom):
    image = Image.new("RGB", (SIZE, SIZE), top)
    draw = ImageDraw.Draw(image)
    for y in range(SIZE):
        f = y / (SIZE - 1.0)
        draw.line([(0, y), (SIZE, y)], fill=tuple(int(top[i] + (bottom[i] - top[i]) * f) for i in range(3)))
    return image


def mix(a, b, f):
    return tuple(int(a[i] + (b[i] - a[i]) * f) for i in range(3))


def shade(colour, f):
    """f > 0 lightens toward white, f < 0 darkens toward black."""
    if f >= 0:
        return mix(colour, (255, 255, 255), f)
    return mix(colour, (0, 0, 0), -f)


def wave_field(waves, size=SIZE, softness=0.42):
    """A seamless light-field: 1.0 on the bright cell walls, 0.0 inside a cell.

    Each wave is (n, m, amplitude, phase); whole-number n and m make the sum
    periodic over the tile, so the pattern wraps without a seam.
    """
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    u = xx / float(size) * 2.0 * math.pi
    v = yy / float(size) * 2.0 * math.pi
    total = np.zeros_like(u)
    for n, m, amp, phase in waves:
        total += amp * np.sin(n * u + m * v + phase)
    return np.exp(-(total ** 2) / (2.0 * softness ** 2))


def paint_field(image, field, colour, strength=0.6, blur=1.4, gamma=1.0):
    mask = np.clip(field, 0.0, 1.0) ** gamma
    mask_image = Image.fromarray((mask * 255).astype(np.uint8), "L")
    mask_image = wrapped_blur(mask_image, blur)
    mask_image = mask_image.point(lambda v: int(v * strength))
    layer = Image.new("RGB", image.size, colour)
    return Image.composite(layer, image, mask_image)


def wrapped_blur(layer: Image.Image, blur: float) -> Image.Image:
    """Blur across the tile edges: replicate 3x3, blur, crop the middle back.

    PIL blurs against the canvas border as if it were black, which would leave a
    dark rim on every texture edge. Replicating the tile first makes the blur see
    the same content it would see in the middle of the picture.
    """
    if blur <= 0:
        return layer
    big = Image.new(layer.mode, (SIZE * 3, SIZE * 3))
    for dx in (0, SIZE, SIZE * 2):
        for dy in (0, SIZE, SIZE * 2):
            big.paste(layer, (dx, dy))
    return big.filter(ImageFilter.GaussianBlur(blur)).crop((SIZE, SIZE, SIZE * 2, SIZE * 2))


def blurred_ellipses(colour, spots, blur):
    layer = Image.new("RGB", (SIZE, SIZE), (0, 0, 0))
    draw = ImageDraw.Draw(layer)
    for cx, cy, rx, ry in spots:
        for dx in NEIGHBOURS:
            for dy in NEIGHBOURS:
                draw.ellipse([cx + dx - rx, cy + dy - ry, cx + dx + rx, cy + dy + ry], fill=colour)
    return wrapped_blur(layer, blur)


def spot_mask(spots, blur):
    """A soft 0..1 mask of wrapped ellipses, for tinting or shadowing a region."""
    layer = Image.new("L", (SIZE, SIZE), 0)
    draw = ImageDraw.Draw(layer)
    for cx, cy, rx, ry in spots:
        for dx in NEIGHBOURS:
            for dy in NEIGHBOURS:
                draw.ellipse([cx + dx - rx, cy + dy - ry, cx + dx + rx, cy + dy + ry], fill=255)
    return wrapped_blur(layer, blur)


def blend_spots(image, colour, spots, blur, strength):
    """Blend `colour` into `image` through a soft elliptical mask (no clipping)."""
    return Image.composite(Image.new("RGB", image.size, colour), image,
                           spot_mask(spots, blur).point(lambda v: int(v * strength)))


def darken_spots(image, spots, blur, strength):
    """Multiply a region down toward a cool shadow, without crushing it."""
    array = np.asarray(image, dtype=np.float32)
    mask = np.asarray(spot_mask(spots, blur), dtype=np.float32) / 255.0
    factor = 1.0 - (mask * strength)[:, :, None]
    return Image.fromarray(np.clip(array * factor, 0, 255).astype(np.uint8), "RGB")


def metal_frame(draw, inner, edge, highlight, thickness=14):
    box(draw, 0, 0, SIZE - 1, SIZE - 1, fill=None, outline=edge, width=thickness + 4)
    box(draw, 0, 0, SIZE - 1, SIZE - 1, fill=None, outline=inner, width=thickness)
    box(draw, thickness, thickness, SIZE - 1 - thickness, SIZE - 1 - thickness,
        fill=None, outline=highlight, width=3)
    for t in range(0, SIZE, 128):
        dot(draw, t + thickness // 2, thickness // 2, 3, highlight)
        dot(draw, SIZE - thickness // 2, t + thickness // 2, 3, highlight)


def fish(draw, x, y, length, body, belly, s=1):
    """A side-on fish: round body, forked tail, dorsal fin, eye. s=1 faces +x."""
    rx, ry = 0.34 * length, 0.21 * length
    pts = []
    for i in range(18):
        a = 2 * math.pi * i / 18
        pts.append((x + math.cos(a) * rx * s, y + math.sin(a) * ry))
    poly(draw, pts, fill=body)
    # forked tail behind the body
    poly(draw, [(x - 0.26 * length * s, y), (x - 0.58 * length * s, y - 0.30 * length),
                (x - 0.46 * length * s, y), (x - 0.58 * length * s, y + 0.30 * length)], fill=body)
    poly(draw, [(x - 0.30 * length * s, y - 0.05 * length), (x - 0.44 * length * s, y - 0.20 * length),
                (x - 0.36 * length * s, y - 0.02 * length)], fill=shade(body, 0.18))
    # dorsal fin
    poly(draw, [(x - 0.10 * length * s, y - 0.18 * length),
                (x + 0.04 * length * s, y - 0.36 * length),
                (x + 0.16 * length * s, y - 0.16 * length)], fill=shade(body, 0.24))
    # belly highlight
    poly(draw, [(x + 0.16 * length * s, y + 0.07 * length),
                (x - 0.12 * length * s, y + 0.10 * length),
                (x - 0.06 * length * s, y + 0.17 * length),
                (x + 0.14 * length * s, y + 0.14 * length)], fill=belly)
    dot(draw, x + 0.19 * length * s, y - 0.05 * length, max(1.5, length * 0.05), (246, 252, 255))
    dot(draw, x + 0.19 * length * s, y - 0.05 * length, max(1.0, length * 0.025), (16, 30, 44))


def jellyfish(draw, x, y, radius, dome, light):
    for i in range(6):
        line(draw, [(x - radius + i * radius * 0.4, y + radius * 0.5),
                    (x - radius + i * radius * 0.4 + math.sin(i) * 6, y + radius * 1.3),
                    (x - radius + i * radius * 0.4 - math.sin(i) * 5, y + radius * 2.0)], light, width=2)
    pie(draw, x - radius, y - radius, x + radius, y + radius, 180, 360, dome)
    arc(draw, x - radius, y - radius * 0.55, x + radius, y + radius * 1.45, 195, 345, light, width=3)


def coral_branch(draw, x, y, height, colour, rng, depth=2):
    line(draw, [(x, y), (x + rng.uniform(-4, 4), y - height)], colour, width=max(3, int(height * 0.12)))
    dot(draw, x, y - height, max(3, int(height * 0.09)), shade(colour, 0.28))
    if depth <= 0:
        return
    for side in (-1, 1):
        bx = x + side * height * 0.16
        by = y - height * rng.uniform(0.45, 0.7)
        coral_branch(draw, bx, by, height * rng.uniform(0.45, 0.62), colour, rng, depth - 1)


# ------------------------------------------------------------------- aquarium
AQUA_GLASS = (14, 118, 150)


AQUA_WAVES = [(3, 1, 1.0, 0.0), (1, -3, 0.85, 1.9), (4, 2, 0.6, 0.7), (-2, 4, 0.5, 2.4)]


def build_aquarium_wall() -> Image.Image:
    """A glass tank panel.

    The tile is composed symmetrically about its middle line: a wall shows one
    whole tile, and the engine maps one of the two broad faces with v reversed,
    so anything with a top and a bottom would hang upside down on one side. The
    sand, the coral and the light are therefore repeated at both edges and the
    fish swim in the middle band.
    """
    rng = random.Random(1101)
    image = vertical_gradient((22, 118, 152), (16, 92, 124))
    shade_layer = vertical_gradient((0, 0, 0), (0, 0, 0))
    shade_draw = ImageDraw.Draw(shade_layer)
    for y in range(SIZE):
        f = abs(y / (SIZE - 1.0) - 0.5) * 2.0
        tone = int(40 * f ** 2)
        shade_draw.line([(0, y), (SIZE, y)], fill=(tone, tone, tone))
    image = ImageChops.subtract(image, shade_layer)
    # Shafts of light through the water, mirrored top and bottom.
    shafts = blurred_ellipses((26, 104, 128),
                              [(60, -40, 90, 260), (240, -60, 70, 300), (420, -30, 84, 280),
                               (60, SIZE + 40, 90, 260), (240, SIZE + 60, 70, 300),
                               (420, SIZE + 30, 84, 280)], 42)
    image = ImageChops.add(image, shafts, scale=1.2)
    image = paint_field(image, wave_field(AQUA_WAVES, softness=0.30), (150, 238, 250), strength=0.35, blur=5.0)
    image = paint_field(image, wave_field(AQUA_WAVES, softness=0.17), (196, 248, 255), strength=0.28, blur=2.6)
    image = paint_field(image, wave_field(AQUA_WAVES, softness=0.26), (30, 110, 140), strength=0.28, blur=7)

    draw = ImageDraw.Draw(image)
    # Sand banks at both edges of the panel, mirrored.
    for flip in (False, True):
        def y_of(v):
            return SIZE - v if flip else v
        poly(draw, [(0, y_of(SIZE)), (0, y_of(SIZE - 34)), (110, y_of(SIZE - 50)),
                    (230, y_of(SIZE - 30)), (350, y_of(SIZE - 48)), (450, y_of(SIZE - 32)),
                    (SIZE, y_of(SIZE - 46)), (SIZE, y_of(SIZE))], fill=(214, 192, 142))
        poly(draw, [(0, y_of(SIZE)), (0, y_of(SIZE - 16)), (160, y_of(SIZE - 24)),
                    (320, y_of(SIZE - 12)), (SIZE, y_of(SIZE - 20)), (SIZE, y_of(SIZE))],
             fill=(238, 222, 176))
        for _ in range(20):
            dot(draw, rng.uniform(0, SIZE), y_of(SIZE - rng.uniform(4, 26)), rng.choice((1, 2)),
                (206, 186, 142))
        # Coral and weed rooted in that bank.
        for x, h, c in ((40, 62, (236, 116, 104)), (446, 54, (230, 126, 190)),
                        (196, 44, (248, 170, 96)), (300, 50, (206, 108, 186))):
            coral_branch(draw, x, y_of(SIZE - 22), h, c, rng)
        for x in (110, 260, 372):
            line(draw, [(x, y_of(SIZE - 20)), (x + 8, y_of(SIZE - 74)), (x + 2, y_of(SIZE - 112))],
                 (46, 148, 110), width=5)
            line(draw, [(x + 8, y_of(SIZE - 74)), (x + 26, y_of(SIZE - 98))], (52, 164, 118), width=4)

    # The fish and the jellyfish live in the middle band, where the panel is
    # water on either way up.
    fish(draw, 150, 190, 112, (8, 44, 70), (178, 212, 226), s=1)
    fish(draw, 360, 236, 88, (12, 56, 84), (170, 204, 220), s=-1)
    fish(draw, 300, 300, 70, (26, 88, 116), (206, 232, 242), s=1)
    jellyfish(draw, 250, 256, 24, (232, 156, 228), (255, 222, 250))
    for _ in range(34):
        bx = rng.uniform(22, SIZE - 22)
        by = rng.uniform(60, SIZE - 60)
        r = rng.choice((2, 3, 4, 5))
        ring(draw, bx, by, r, outline=(208, 242, 252), width=1)
        dot(draw, bx - 1, by - 1, max(1, r - 2), (242, 253, 255))

    # Tank mullions on the tile edges, so the panels join into one tank.
    metal_frame(draw, (214, 246, 255), (8, 40, 60), (150, 232, 250), thickness=12)
    return image.filter(ImageFilter.SMOOTH)


def build_aquarium_cap() -> Image.Image:
    rng = random.Random(1102)
    image = vertical_gradient((92, 212, 234), (26, 124, 160))
    big = wave_field(AQUA_WAVES, softness=0.17)
    fine = wave_field([(5, 2, 1.0, 0.2), (-3, 6, 0.8, 1.9), (7, 1, 0.6, 0.7)], softness=0.22)
    image = paint_field(image, big, (168, 236, 250), strength=0.3, blur=8)
    image = paint_field(image, big, (242, 254, 255), strength=0.6, blur=2.6)
    image = paint_field(image, fine, (255, 255, 255), strength=0.22, blur=1.4)

    draw = ImageDraw.Draw(image)
    for _ in range(80):
        dot(draw, rng.uniform(0, SIZE), rng.uniform(0, SIZE), rng.choice((1, 1, 2)), (246, 254, 255))
    # A couple of leaves drifting on the surface.
    for x, y, s in ((110, 168, 1), (340, 400, -1)):
        poly(draw, [(x, y), (x + 30 * s, y - 14), (x + 52 * s, y + 6), (x + 20 * s, y + 16)],
             fill=(26, 112, 88))
        line(draw, [(x, y), (x + 46 * s, y + 2)], (14, 78, 62), width=2)
    metal_frame(draw, (222, 250, 255), (8, 40, 60), (176, 244, 254), thickness=12)
    return image.filter(ImageFilter.SMOOTH)


def build_aquarium_floor() -> Image.Image:
    rng = random.Random(1103)
    image = vertical_gradient((32, 108, 130), (14, 66, 88))
    # Sand patches, soft-edged.
    image = blend_spots(image, (62, 120, 128),
                        [(90, 120, 120, 70), (330, 300, 150, 84), (200, 430, 130, 76), (430, 90, 90, 60)],
                        28, 0.5)
    # The bright caustic ripples over the tank floor.
    big = wave_field(AQUA_WAVES, softness=0.19)
    fine = wave_field([(6, 2, 1.0, 0.5), (-4, 7, 0.8, 1.8), (8, 1, 0.6, 2.9)], softness=0.24)
    image = paint_field(image, big, (86, 172, 186), strength=0.35, blur=8)
    image = paint_field(image, big, (206, 250, 255), strength=0.45, blur=3.2)
    image = paint_field(image, fine, (238, 255, 255), strength=0.2, blur=1.4)

    draw = ImageDraw.Draw(image)
    for _ in range(46):
        dot(draw, rng.uniform(0, SIZE), rng.uniform(0, SIZE), rng.choice((2, 3, 4)),
            rng.choice([(46, 100, 112), (70, 128, 136), (34, 84, 98)]))
    # Sand ripples.
    for i in range(5):
        y0 = 40 + i * 100
        pts = [(x, y0 + math.sin(x / 46.0 + i) * 12) for x in range(0, SIZE + 1, 16)]
        line(draw, pts, (72, 132, 140), width=3)
    # A starfish and two shells per tile.
    sx, sy = 402, 140
    for i in range(5):
        a = math.radians(-90 + i * 72)
        line(draw, [(sx, sy), (sx + math.cos(a) * 30, sy + math.sin(a) * 30)], (246, 138, 96), width=11)
    dot(draw, sx, sy, 12, (252, 176, 126))
    for cx, cy in ((110, 330), (300, 430)):
        pie(draw, cx - 18, cy - 18, cx + 18, cy + 18, 180, 360, (226, 210, 184))
        for k in range(4):
            line(draw, [(cx - 14 + k * 9, cy), (cx - 16 + k * 9, cy - 16)], (198, 180, 154), width=2)
    return image.filter(ImageFilter.SMOOTH)


# ----------------------------------------------------------------------- park
PARK_STRIPES = [(252, 232, 198), (236, 96, 160), (124, 78, 198), (250, 178, 94)]


def build_park_wall() -> Image.Image:
    rng = random.Random(2201)
    image = Image.new("RGB", (SIZE, SIZE), (232, 96, 160))
    draw = ImageDraw.Draw(image)
    width = SIZE // 8
    for i in range(8):
        base = PARK_STRIPES[i % len(PARK_STRIPES)]
        x0 = i * width
        for x in range(x0, x0 + width):
            f = (x - x0) / float(width)
            draw.line([(x, 0), (x, SIZE)], fill=shade(base, 0.18 * math.sin(f * math.pi) - 0.12))
        line(draw, [(x0 + width * 0.5, 0), (x0 + width * 0.5, SIZE)], shade(base, -0.2), width=2)
        # the seam between two stripe panels sits exactly on the boundary, so the
        # left edge of one stripe and the right edge of the previous one match
        line(draw, [(x0, 0), (x0, SIZE)], (120, 40, 96), width=3)
        line(draw, [(x0 + 4, 0), (x0 + 4, SIZE)], shade(base, -0.3), width=2)

    # Drape shading: darker toward the top and bottom of the panel.
    drape = vertical_gradient((0, 0, 0), (0, 0, 0))
    drape_draw = ImageDraw.Draw(drape)
    for y in range(SIZE):
        f = abs(y / (SIZE - 1.0) - 0.5) * 2.0
        tone = int(52 * f ** 2.2)
        drape_draw.line([(0, y), (SIZE, y)], fill=(tone, tone, tone))
    image = ImageChops.subtract(image, drape)

    draw = ImageDraw.Draw(image)
    # Scalloped valance at both edges of the panel (the tile is symmetric about
    # its middle line, so it reads the same whichever way the face is mapped).
    for top in (False, True):
        base = width // 2 if top else SIZE - width // 2
        for i in range(8):
            cx = i * width + width // 2
            start, end = (0, 180) if top else (180, 360)
            pie(draw, cx - width // 2, base - width // 2, cx + width // 2, base + width // 2,
                start, end, (252, 240, 218))
            arc(draw, cx - width // 2, base - width // 2, cx + width // 2, base + width // 2,
                start, end, (206, 96, 150), width=4)
            dot(draw, cx, base + (-1 if top else 1) * width // 4, 4, (255, 220, 120))
        line(draw, [(0, base), (SIZE, base)], (188, 74, 132), width=5)
        line(draw, [(0, base + (-5 if top else 5)), (SIZE, base + (-5 if top else 5))],
             (255, 214, 160), width=2)

    # A string of carnival bulbs at both edges too.
    bulb_glow = Image.new("RGB", (SIZE, SIZE), (0, 0, 0))
    bulb_draw = ImageDraw.Draw(bulb_glow)
    for top in (False, True):
        string_y = 66 if top else SIZE - 66
        sign = 1 if top else -1
        line(draw, [(0, string_y), (SIZE, string_y)], (58, 24, 66), width=4)
        for bx in range(22, SIZE, 44):
            by = string_y + sign * (12 + 8 * math.sin(bx / 60.0))
            line(draw, [(bx, string_y), (bx, by)], (58, 24, 66), width=2)
            dot(draw, bx, by + sign * 7, 8, (255, 238, 168))
            dot(bulb_draw, bx, by + sign * 7, 11, (255, 198, 96))
    image = ImageChops.add(image, wrapped_blur(bulb_glow, 7), scale=1.25)

    draw = ImageDraw.Draw(image)
    for top in (False, True):
        string_y = 66 if top else SIZE - 66
        sign = 1 if top else -1
        for bx in range(22, SIZE, 44):
            by = string_y + sign * (12 + 8 * math.sin(bx / 60.0))
            dot(draw, bx, by + sign * 7, 5, (255, 252, 226))
    return image.filter(ImageFilter.SMOOTH)


def build_park_cap() -> Image.Image:
    rng = random.Random(2202)
    image = Image.new("RGB", (SIZE, SIZE), (236, 96, 160))
    draw = ImageDraw.Draw(image)
    # Tent canopy from above: stripes fanning out from the tile centre.
    band = SIZE // 12
    for i in range(-18, 18):
        colour = PARK_STRIPES[i % len(PARK_STRIPES)]
        poly(draw, [(SIZE // 2 + i * band, 0), (SIZE // 2 + (i + 1) * band, 0),
                    (SIZE // 2 + (i + 1) * band * 2.4, SIZE), (SIZE // 2 + i * band * 2.4, SIZE)],
             fill=colour)
    overlay = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    ImageDraw.Draw(overlay).rectangle([0, 0, SIZE, SIZE], fill=(60, 10, 60, 28))
    image = Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")
    # Rope seams and bulbs where they cross.
    bulb_glow = Image.new("RGB", (SIZE, SIZE), (0, 0, 0))
    glow_draw = ImageDraw.Draw(bulb_glow)
    for t in (0, SIZE // 2):
        for k in range(9):
            dot(glow_draw, t + 6, 32 + k * 56, 10, (255, 206, 110))
            dot(glow_draw, 32 + k * 56, t + 6, 10, (255, 206, 110))
    image = ImageChops.add(image, wrapped_blur(bulb_glow, 7), scale=1.3)
    draw = ImageDraw.Draw(image)
    for t in (0, SIZE // 2):
        line(draw, [(t, 0), (t, SIZE)], (86, 34, 78), width=8)
        line(draw, [(t + 4, 0), (t + 4, SIZE)], (232, 178, 216), width=2)
        line(draw, [(0, t), (SIZE, t)], (86, 34, 78), width=8)
        line(draw, [(0, t + 4), (SIZE, t + 4)], (232, 178, 216), width=2)
        for k in range(9):
            dot(draw, t + 6, 32 + k * 56, 5, (255, 250, 220))
            dot(draw, 32 + k * 56, t + 6, 5, (255, 250, 220))
    return image.filter(ImageFilter.SMOOTH)


def build_park_floor() -> Image.Image:
    rng = random.Random(2203)
    cell = SIZE // 4
    image = Image.new("RGB", (SIZE, SIZE), (96, 70, 136))
    draw = ImageDraw.Draw(image)
    for j in range(4):
        for i in range(4):
            dark = (j + i) % 2 == 0
            colour = (92, 66, 138) if dark else (242, 228, 202)
            x0, y0 = i * cell, j * cell
            box(draw, x0, y0, x0 + cell, y0 + cell, fill=colour)
            poly(draw, [(x0 + 6, y0 + 6), (x0 + cell - 8, y0 + 6),
                        (x0 + cell - 28, y0 + 32), (x0 + 6, y0 + 32)], fill=shade(colour, 0.16))
            box(draw, x0 + 4, y0 + 4, x0 + cell - 4, y0 + cell - 4, fill=None,
                outline=shade(colour, -0.2), width=1)
    # Grout lines on the cell boundaries (drawn wrapped, so the tile edge matches).
    for t in range(0, SIZE, cell):
        line(draw, [(t, 0), (t, SIZE)], (62, 36, 84), width=4)
        line(draw, [(0, t), (SIZE, t)], (62, 36, 84), width=4)

    # Neon strip along the tile grid.
    neon = Image.new("RGB", (SIZE, SIZE), (0, 0, 0))
    neon_draw = ImageDraw.Draw(neon)
    for t in (0, SIZE // 2):
        neon_draw.line([(0, t), (SIZE, t)], (255, 96, 196), width=6)
        neon_draw.line([(t, 0), (t, SIZE)], (255, 96, 196), width=6)
    image = ImageChops.add(image, wrapped_blur(neon, 9), scale=1.25)
    draw = ImageDraw.Draw(image)
    for t in (0, SIZE // 2):
        line(draw, [(0, t), (SIZE, t)], (255, 196, 238), width=2)
        line(draw, [(t, 0), (t, SIZE)], (255, 196, 238), width=2)

    # Painted star and confetti, the fairground floor.
    sx, sy, r = 330, 120, 34
    star = []
    for i in range(10):
        a = math.radians(-90 + i * 36)
        rr = r if i % 2 == 0 else r * 0.45
        star.append((sx + math.cos(a) * rr, sy + math.sin(a) * rr))
    poly(draw, star, fill=(255, 232, 140))
    for _ in range(80):
        x = rng.uniform(0, SIZE)
        y = rng.uniform(0, SIZE)
        c = rng.choice([(255, 232, 140), (120, 255, 224), (255, 128, 196), (252, 252, 252)])
        box(draw, x, y, x + rng.choice((4, 5, 7)), y + rng.choice((4, 5, 7)), fill=c)
    return image.filter(ImageFilter.SMOOTH)


# ---------------------------------------------------------------------- lodge
def build_lodge_wall() -> Image.Image:
    rng = random.Random(3301)
    image = Image.new("RGB", (SIZE, SIZE), (74, 44, 24))
    draw = ImageDraw.Draw(image)
    rows = 6
    height = SIZE // rows
    row_shades = [rng.uniform(-0.12, 0.10) for _ in range((rows + 1) // 2 + 1)]
    for row in range(rows + 1):
        y0 = row * height
        # mirrored rows share a shade, so the panel reads the same upside down
        base = shade((156, 100, 54), row_shades[min(row, rows - row)])
        for y in range(y0, y0 + height):
            f = (y - y0) / float(height)
            # round log: bright along the middle, deep shadow at both joins
            colour = shade(base, 0.18 - 0.52 * abs(f - 0.5) ** 1.4)
            for dy in NEIGHBOURS:
                draw.line([(0, y0 + dy + (y - y0)), (SIZE, y0 + dy + (y - y0))], fill=colour)
        for dy in NEIGHBOURS:
            draw.line([(0, y0 + dy), (SIZE, y0 + dy)], fill=(38, 22, 12), width=5)
            draw.line([(0, y0 + dy + 5), (SIZE, y0 + dy + 5)], fill=(110, 84, 54), width=2)
        for _ in range(5):
            gx = rng.uniform(0, SIZE)
            gy = y0 + rng.uniform(height * 0.3, height * 0.7)
            line(draw, [(gx, gy), (gx + rng.uniform(60, 200), gy + rng.uniform(-5, 5))],
                 shade(base, -0.24), width=2)
        for _ in range(2):
            kx = rng.uniform(30, SIZE - 30)
            ky = y0 + height * 0.45
            for r, c in ((13, (78, 46, 24)), (8, (46, 26, 13)), (3, (24, 12, 6))):
                for dx in NEIGHBOURS:
                    draw.ellipse([kx + dx - r, ky - r * 0.7, kx + dx + r, ky + r * 0.7], fill=c)

    # A shuttered window with warm light behind it, centred so the panel hangs
    # the same way up whichever broad face the engine maps.
    wx, wy = 300, 256
    box(draw, wx - 78, wy - 70, wx + 78, wy + 70, fill=(56, 32, 16))
    box(draw, wx - 66, wy - 58, wx + 66, wy + 58, fill=(255, 208, 124))
    for i in range(4):
        line(draw, [(wx - 66, wy - 58 + i * 29), (wx + 66, wy - 58 + i * 29)], (88, 54, 28), width=4)
    line(draw, [(wx, wy - 58), (wx, wy + 58)], (88, 54, 28), width=5)
    # Snow lying on both sills.
    for sign in (-1, 1):
        sy = wy + sign * 62
        box(draw, wx - 84, min(sy, sy + sign * 12), wx + 84, max(sy, sy + sign * 12),
            fill=(232, 242, 252))
        for i in range(11):
            cx = wx - 82 + i * 16
            if sign > 0:
                pie(draw, cx - 10, sy - 14, cx + 10, sy + 12, 180, 360, (240, 248, 255))
            else:
                pie(draw, cx - 10, sy - 12, cx + 10, sy + 14, 0, 180, (240, 248, 255))
    # A pair of lanterns, mirrored about the middle line.
    for ly in (110, SIZE - 110):
        line(draw, [(96, ly - 30), (96, ly)], (58, 34, 18), width=3)
        box(draw, 80, ly, 112, ly + 40, fill=(255, 198, 108))
        box(draw, 80, ly, 112, ly + 6, fill=(92, 58, 30))
        box(draw, 80, ly + 34, 112, ly + 40, fill=(92, 58, 30))
        box(draw, 86, ly + 12, 106, ly + 30, fill=(255, 240, 190))

    # Snow dust and the warm hearth glow.
    for _ in range(50):
        dot(draw, rng.uniform(0, SIZE), rng.uniform(0, SIZE), rng.choice((1, 2)), (232, 240, 250))
    image = blend_spots(image, (120, 58, 16),
                        [(96, 200, 160, 130), (96, SIZE - 200, 160, 130),
                         (300, 256, 150, 110)], 62, 0.45)
    return image.filter(ImageFilter.SMOOTH)


def build_lodge_cap() -> Image.Image:
    rng = random.Random(3302)
    image = vertical_gradient((250, 253, 255), (206, 224, 242))
    # Wind-blown snow: soft dune crests with a cool shadow behind them.
    dunes = [(1, 2, 1.0, 0.3), (3, -1, 0.8, 1.7), (2, 3, 0.6, 0.9)]
    image = darken_spots(image, [(80, 110, 150, 60), (300, 90, 170, 56), (200, 320, 190, 70)], 28, 0.22)
    image = paint_field(image, wave_field(dunes, softness=0.30), (196, 214, 236), strength=0.55, blur=6)
    image = paint_field(image, wave_field(dunes, softness=0.34), (255, 255, 255), strength=0.75, blur=3.5)
    draw = ImageDraw.Draw(image)
    # Log ends showing through the snow along the panel edge.
    for t in (0, SIZE // 2):
        box(draw, t - 6, 0, t + 34, SIZE, fill=(140, 90, 48))
        box(draw, t + 2, 0, t + 26, SIZE, fill=(104, 62, 32))
        box(draw, t - 6, 0, t + 34, SIZE, fill=None, outline=(64, 36, 16), width=2)
        for i in range(4):
            ring(draw, t + 14, 64 + i * 128, 11, outline=(78, 46, 22), width=2)
            ring(draw, t + 14, 64 + i * 128, 5, outline=(60, 34, 16), width=1)
    # Snow caught on the near edge of each log.
    for t in (0, SIZE // 2):
        box(draw, t - 10, 0, t + 38, SIZE, fill=None)
    for t in (0, SIZE // 2):
        box(draw, t - 10, 0, t - 2, SIZE, fill=(238, 246, 255))
    # Footprints.
    for x, y in ((150, 200), (182, 226), (214, 252), (370, 120), (402, 146)):
        ring(draw, x, y, 7, fill=(198, 214, 234))
        dot(draw, x, y - 4, 2, (232, 240, 250))
    for _ in range(90):
        dot(draw, rng.uniform(0, SIZE), rng.uniform(0, SIZE), rng.choice((1, 1, 2)), (255, 255, 255))
    return image.filter(ImageFilter.SMOOTH)


def build_lodge_floor() -> Image.Image:
    rng = random.Random(3303)
    image = Image.new("RGB", (SIZE, SIZE), (126, 78, 42))
    draw = ImageDraw.Draw(image)
    rows = 8
    height = SIZE // rows
    for row in range(rows):
        y0 = row * height
        base = shade((158, 106, 60), rng.uniform(-0.16, 0.12))
        for y in range(y0, y0 + height):
            f = (y - y0) / float(height)
            for dy in NEIGHBOURS:
                draw.line([(0, y0 + dy + (y - y0)), (SIZE, y0 + dy + (y - y0))],
                          fill=shade(base, 0.10 - abs(f - 0.35) * 0.32))
        for dy in NEIGHBOURS:
            draw.line([(0, y0 + dy), (SIZE, y0 + dy)], fill=(54, 32, 16), width=4)
            draw.line([(0, y0 + dy + 4), (SIZE, y0 + dy + 4)], fill=(198, 150, 100), width=1)
        offset = (row % 2) * 140
        for bx in (offset + 90, offset + 350):
            for dy in NEIGHBOURS:
                draw.line([(bx, y0 + dy), (bx, y0 + height + dy)], fill=(54, 32, 16), width=3)
            dot(draw, bx + 10, y0 + height // 2, 2, (208, 162, 110))
            dot(draw, bx - 10, y0 + height // 2, 2, (208, 162, 110))
        for _ in range(4):
            gx = rng.uniform(0, SIZE)
            gy = y0 + rng.uniform(height * 0.25, height * 0.8)
            line(draw, [(gx, gy), (gx + rng.uniform(50, 170), gy + rng.uniform(-4, 4))],
                 shade(base, -0.26), width=1)
        for _ in range(1):
            kx = rng.uniform(30, SIZE - 30)
            for r, c in ((11, (80, 46, 24)), (6, (48, 28, 14))):
                for dx in NEIGHBOURS:
                    draw.ellipse([kx + dx - r, y0 + height * 0.45 - r * 0.7,
                                  kx + dx + r, y0 + height * 0.45 + r * 0.7], fill=c)

    # Snow blown in from the door, cool and light.
    image = blend_spots(image, (226, 237, 248),
                        [(70, 120, 110, 54), (330, 300, 130, 64), (180, 440, 120, 50),
                         (440, 90, 80, 44)], 26, 0.55)
    draw = ImageDraw.Draw(image)
    for _ in range(70):
        dot(draw, rng.uniform(0, SIZE), rng.uniform(0, SIZE), rng.choice((1, 2)), (240, 247, 255))
    return image.filter(ImageFilter.SMOOTH)


# --------------------------------------------------------------------- school
def build_school_wall() -> Image.Image:
    """A classroom wall: plaster, a green chalkboard, and a green dado at both
    edges (the panel is symmetric about its middle line, so it reads upright
    whichever broad face the engine maps)."""
    rng = random.Random(4401)
    image = vertical_gradient((226, 214, 186), (192, 178, 148))
    image = darken_spots(image, [(60, 300, 60, 40), (430, 60, 50, 36)], 24, 0.16)
    draw = ImageDraw.Draw(image)

    # The dado rail and the green wainscot, at both edges.
    for top in (False, True):
        y0, y1 = (0, 96) if top else (SIZE - 96, SIZE)
        box(draw, 0, y0, SIZE - 1, y1, fill=(46, 80, 58))
        for y in range(y0, y1):
            f = (y - y0) / float(y1 - y0)
            if top:
                f = 1.0 - f
            draw.line([(0, y), (SIZE, y)], fill=mix((58, 96, 68), (28, 50, 36), f))
        rail = 96 if top else SIZE - 112
        box(draw, 0, rail, SIZE - 1, rail + 16, fill=(126, 84, 46))
        box(draw, 0, rail + (11 if top else 0), SIZE - 1, rail + (16 if top else 5), fill=(170, 124, 74))
        box(draw, 0, rail + (0 if top else 11), SIZE - 1, rail + (5 if top else 16), fill=(76, 48, 24))
        for i in range(2):
            x0 = 24 + i * 248
            box(draw, x0, y0 + 22, x0 + 216, y1 - 22, fill=None, outline=(76, 116, 84), width=4)
            box(draw, x0 + 8, y0 + 30, x0 + 208, y1 - 30, fill=None, outline=(32, 56, 40), width=2)

    # The chalkboard, centred on the panel.
    bx0, bx1 = 54, 458
    by0, by1 = 140, 372
    box(draw, bx0 - 12, by0 - 12, bx1 + 12, by1 + 12, fill=(126, 86, 48))
    box(draw, bx0 - 12, by0 - 12, bx1 + 12, by0 - 6, fill=(164, 120, 76))
    box(draw, bx0, by0, bx1, by1, fill=(28, 52, 42))
    for _ in range(140):
        dot(draw, rng.uniform(bx0 + 6, bx1 - 6), rng.uniform(by0 + 6, by1 - 6),
            rng.choice((1, 1, 2)), (44, 72, 60))
    # Chalk writing: a title, sums, a ticked answer and a lesson sketch.
    line(draw, [(82, 180), (200, 172), (212, 182)], (228, 234, 228), width=3)
    line(draw, [(82, 204), (152, 200)], (204, 212, 206), width=2)
    for i, w in enumerate((62, 46, 54)):
        line(draw, [(82, 240 + i * 26), (82 + w, 238 + i * 26)], (214, 222, 216), width=2)
    line(draw, [(238, 260), (302, 260)], (222, 230, 224), width=2)
    line(draw, [(274, 242), (274, 278)], (222, 230, 224), width=2)
    ring(draw, 346, 268, 26, outline=(234, 240, 232), width=3)
    line(draw, [(332, 268), (344, 280), (364, 250)], (234, 240, 232), width=3)
    line(draw, [(82, 314), (150, 308), (210, 320)], (198, 208, 202), width=2)
    line(draw, [(330, 322), (356, 304), (382, 326)], (198, 208, 202), width=2)
    # The chalk tray under the board.
    box(draw, bx0 - 12, by1 + 12, bx1 + 12, by1 + 22, fill=(98, 64, 36))
    for _ in range(16):
        dot(draw, rng.uniform(bx0, bx1), by1 + 16, 2, (238, 240, 236))

    # Hairline cracks in the plaster band.
    for _ in range(7):
        x = rng.uniform(20, SIZE - 20)
        y = rng.uniform(110, 150)
        pts = [(x, y)]
        for _i in range(6):
            x += rng.uniform(-22, 22)
            y += rng.uniform(-12, 20)
            pts.append((x, y))
        line(draw, pts, (176, 164, 138), width=1)
    return image.filter(ImageFilter.SMOOTH)


def build_school_cap() -> Image.Image:
    rng = random.Random(4402)
    image = vertical_gradient((208, 198, 170), (184, 172, 144))
    # Mottled plaster, then the damp patches near the window end of the room.
    mottle = wave_field([(4, 3, 1.0, 0.4), (2, -5, 0.85, 2.1), (6, 1, 0.6, 0.8)], softness=0.3)
    image = paint_field(image, mottle, (196, 184, 156), strength=0.5, blur=7)
    image = darken_spots(image, [(140, 150, 96, 60), (380, 380, 104, 74)], 30, 0.14)
    image = blend_spots(image, (222, 214, 188), [(130, 120, 80, 50), (400, 350, 90, 60)], 24, 0.6)
    draw = ImageDraw.Draw(image)
    # Ceiling-board joints and cracks.
    for t in (0, SIZE // 2):
        line(draw, [(0, t), (SIZE, t)], (162, 150, 122), width=2)
        line(draw, [(0, t + 2), (SIZE, t + 2)], (218, 208, 180), width=1)
        line(draw, [(t, 0), (t, SIZE)], (162, 150, 122), width=2)
        line(draw, [(t + 2, 0), (t + 2, SIZE)], (218, 208, 180), width=1)
    for _ in range(9):
        x = rng.uniform(0, SIZE)
        y = rng.uniform(0, SIZE)
        pts = [(x, y)]
        for _i in range(7):
            x += rng.uniform(-30, 30)
            y += rng.uniform(-20, 24)
            pts.append((x, y))
        line(draw, pts, (158, 146, 118), width=2)
    # A green-black dado band on the tile edge.
    box(draw, 0, 0, SIZE - 1, SIZE - 1, fill=None, outline=(64, 94, 68), width=12)
    box(draw, 0, 0, SIZE - 1, SIZE - 1, fill=None, outline=(30, 50, 38), width=4)
    for _ in range(90):
        dot(draw, rng.uniform(0, SIZE), rng.uniform(0, SIZE), rng.choice((1, 1, 2)), (196, 186, 158))
    return image.filter(ImageFilter.SMOOTH)


def build_school_floor() -> Image.Image:
    rng = random.Random(4403)
    image = Image.new("RGB", (SIZE, SIZE), (146, 100, 58))
    draw = ImageDraw.Draw(image)
    rows = 6
    height = SIZE // rows
    for row in range(rows):
        y0 = row * height
        base = shade((164, 116, 68), rng.uniform(-0.18, 0.10))
        for y in range(y0, y0 + height):
            f = (y - y0) / float(height)
            for dy in NEIGHBOURS:
                draw.line([(0, y0 + dy + (y - y0)), (SIZE, y0 + dy + (y - y0))],
                          fill=shade(base, 0.10 - abs(f - 0.4) * 0.3))
        for dy in NEIGHBOURS:
            draw.line([(0, y0 + dy), (SIZE, y0 + dy)], fill=(66, 42, 22), width=4)
            draw.line([(0, y0 + dy + 4), (SIZE, y0 + dy + 4)], fill=(200, 158, 110), width=1)
        offset = (row % 2) * 170
        for bx in (offset + 60, offset + 300, offset + 470):
            for dy in NEIGHBOURS:
                draw.line([(bx, y0 + dy), (bx, y0 + height + dy)], fill=(66, 42, 22), width=3)
        for _ in range(6):
            gx = rng.uniform(0, SIZE)
            gy = y0 + rng.uniform(height * 0.2, height * 0.85)
            line(draw, [(gx, gy), (gx + rng.uniform(40, 150), gy + rng.uniform(-3, 3))],
                 shade(base, -0.22), width=1)
        for _ in range(2):
            sx = rng.uniform(0, SIZE)
            sy = y0 + rng.uniform(6, height - 6)
            line(draw, [(sx, sy), (sx + rng.uniform(14, 40), sy)], (210, 194, 174), width=2)
    for _ in range(70):
        dot(draw, rng.uniform(0, SIZE), rng.uniform(0, SIZE), rng.choice((1, 1, 2)), (206, 196, 178))
    for cx, cy, r in ((120, 300, 34), (400, 120, 22)):
        for dx in NEIGHBOURS:
            for dy in NEIGHBOURS:
                draw.ellipse([cx + dx - r, cy + dy - r * 0.5, cx + dx + r, cy + dy + r * 0.5],
                             fill=(106, 82, 58))
    return image.filter(ImageFilter.SMOOTH)


# ---------------------------------------------------------------------- space
STEEL = (58, 72, 90)


def build_space_wall() -> Image.Image:
    rng = random.Random(5501)
    image = Image.new("RGB", (SIZE, SIZE), (44, 56, 72))
    draw = ImageDraw.Draw(image)
    for j in range(2):
        for i in range(2):
            x0, y0 = i * 256, j * 256
            box(draw, x0 + 4, y0 + 4, x0 + 251, y0 + 251, fill=(52, 66, 84))
            # Brushed metal streaks.
            for _ in range(30):
                sx = rng.uniform(x0 + 14, x0 + 240)
                sy = rng.uniform(y0 + 14, y0 + 236)
                line(draw, [(sx, sy), (sx + rng.uniform(24, 96), sy)],
                     shade((52, 66, 84), rng.uniform(-0.24, 0.3)), width=1)
            box(draw, x0 + 4, y0 + 4, x0 + 251, y0 + 251, fill=None, outline=(126, 150, 176), width=3)
            box(draw, x0 + 11, y0 + 11, x0 + 244, y0 + 244, fill=None, outline=(22, 30, 40), width=3)
            box(draw, x0 + 4, y0 + 236, x0 + 251, y0 + 251, fill=(30, 40, 52))
            box(draw, x0 + 4, y0 + 4, x0 + 251, y0 + 8, fill=(84, 104, 128))
            box(draw, x0 + 4, y0 + 247, x0 + 251, y0 + 251, fill=(84, 104, 128))
            # Every panel carries the same details, centred on its own middle, so
            # the tile reads the same upside down.
            for sign in (-1, 1):
                for k in range(4):
                    gy = y0 + 128 + sign * (58 + k * 16)
                    box(draw, x0 + 64, gy, x0 + 192, gy + 7, fill=(22, 30, 40))
                    box(draw, x0 + 64, gy + 7, x0 + 192, gy + 10, fill=(74, 92, 114))
            cx, cy = x0 + 128, y0 + 128
            for k in range(6):
                a = math.radians(60 * k)
                a2 = math.radians(60 * (k + 1))
                line(draw, [(cx + math.cos(a) * 44, cy + math.sin(a) * 44),
                            (cx + math.cos(a2) * 44, cy + math.sin(a2) * 44)], (108, 132, 158), width=5)
            line(draw, [(cx - 16, cy - 14), (cx + 14, cy - 14)], (108, 132, 158), width=4)
            line(draw, [(cx - 16, cy + 2), (cx + 4, cy + 2)], (86, 108, 132), width=4)
            for bx in (x0 + 24, x0 + 230):
                for by in (y0 + 24, y0 + 230):
                    dot(draw, bx, by, 6, (26, 34, 44))
                    dot(draw, bx - 1, by - 1, 3, (140, 164, 190))

    # Telemetry strips: cyan along the panel seam, orange hazard chevrons.
    strip = Image.new("RGB", (SIZE, SIZE), (0, 0, 0))
    strip_draw = ImageDraw.Draw(strip)
    strip_draw.line([(0, 256), (SIZE, 256)], (44, 226, 255), width=8)
    strip_draw.line([(0, 256), (SIZE, 256)], (44, 226, 255), width=16)
    image = ImageChops.add(image, wrapped_blur(strip, 9), scale=1.35)
    draw = ImageDraw.Draw(image)
    line(draw, [(0, 256), (SIZE, 256)], (164, 246, 255), width=2)
    line(draw, [(0, 251), (SIZE, 251)], (18, 26, 36), width=3)
    for i in range(4):
        x0 = 34 + i * 128
        for row in (0, 1):
            for sign in (-1, 1):
                y0 = 256 + sign * (44 + row * 46)
                poly(draw, [(x0, y0), (x0 + 28, y0), (x0 + 14, y0 + 32), (x0 - 14, y0 + 32)],
                     fill=(255, 146, 52))
    for _ in range(50):
        dot(draw, rng.uniform(0, SIZE), rng.uniform(0, SIZE), rng.choice((1, 1, 2)), (120, 144, 168))
    return image.filter(ImageFilter.SMOOTH)


def build_space_cap() -> Image.Image:
    rng = random.Random(5502)
    image = Image.new("RGB", (SIZE, SIZE), (74, 88, 108))
    draw = ImageDraw.Draw(image)
    # Diamond tread plate from above.
    for j in range(0, SIZE, 32):
        for i in range(0, SIZE, 32):
            off = 16 if (i // 32 + j // 32) % 2 else 0
            poly(draw, [(i + 2 + off, j + 16), (i + 16 + off, j + 2),
                        (i + 30 + off, j + 16), (i + 16 + off, j + 30)], fill=(44, 54, 70))
            poly(draw, [(i + 6 + off, j + 16), (i + 16 + off, j + 6),
                        (i + 26 + off, j + 16), (i + 16 + off, j + 26)], fill=(112, 130, 152))
    for j in range(0, SIZE, 256):
        for i in range(0, SIZE, 256):
            box(draw, i + 2, j + 2, i + 253, j + 253, fill=None, outline=(26, 34, 44), width=5)
            box(draw, i + 7, j + 7, i + 248, j + 248, fill=None, outline=(126, 148, 172), width=2)
    seam = Image.new("RGB", (SIZE, SIZE), (0, 0, 0))
    seam_draw = ImageDraw.Draw(seam)
    for t in (0, 256):
        seam_draw.line([(0, t), (SIZE, t)], (36, 210, 248), width=10)
        seam_draw.line([(t, 0), (t, SIZE)], (36, 210, 248), width=10)
    image = ImageChops.add(image, wrapped_blur(seam, 10), scale=1.35)
    draw = ImageDraw.Draw(image)
    for t in (0, 256):
        line(draw, [(0, t), (SIZE, t)], (172, 244, 255), width=3)
        line(draw, [(t, 0), (t, SIZE)], (172, 244, 255), width=3)
    for i in range(4):
        x0 = 10 + i * 128
        box(draw, x0, 232, x0 + 54, 248, fill=(255, 150, 54))
        box(draw, x0, 264, x0 + 54, 280, fill=(255, 150, 54))
    for bx in (24, 232, 280, 488):
        dot(draw, bx, 24, 5, (24, 32, 42))
        dot(draw, bx, 488, 5, (24, 32, 42))
    for _ in range(60):
        dot(draw, rng.uniform(0, SIZE), rng.uniform(0, SIZE), 1, (150, 172, 196))
    return image.filter(ImageFilter.SMOOTH)


def build_space_floor() -> Image.Image:
    rng = random.Random(5503)
    image = Image.new("RGB", (SIZE, SIZE), (44, 54, 68))
    draw = ImageDraw.Draw(image)
    # Grated deck: staggered slots over a dark void, with a raised frame.
    for j in range(0, SIZE, 32):
        for i in range(0, SIZE, 64):
            off = 32 if (j // 32) % 2 else 0
            for k in range(2):
                x0 = i + off + k * 26
                box(draw, x0, j + 6, x0 + 18, j + 26, fill=(14, 20, 28))
                box(draw, x0, j + 6, x0 + 18, j + 9, fill=(78, 94, 114))
                box(draw, x0, j + 25, x0 + 18, j + 26, fill=(26, 34, 44))
        line(draw, [(0, j), (SIZE, j)], (78, 94, 114), width=3)
        line(draw, [(0, j + 3), (SIZE, j + 3)], (20, 28, 38), width=2)
    for i in range(0, SIZE, 128):
        line(draw, [(i, 0), (i, SIZE)], (84, 100, 122), width=3)
        line(draw, [(i + 3, 0), (i + 3, SIZE)], (22, 30, 40), width=2)
    seam = Image.new("RGB", (SIZE, SIZE), (0, 0, 0))
    seam_draw = ImageDraw.Draw(seam)
    for t in (0, 128, 256, 384):
        seam_draw.line([(0, t), (SIZE, t)], (30, 190, 224), width=6)
    image = ImageChops.add(image, wrapped_blur(seam, 8), scale=1.3)
    draw = ImageDraw.Draw(image)
    for i in range(6):
        x0 = 268 + i * 22
        poly(draw, [(x0, 396), (x0 + 14, 396), (x0 - 6, 448), (x0 - 20, 448)], fill=(248, 156, 52))
    for bx in (16, 240, 272, 496):
        dot(draw, bx, 16, 5, (176, 196, 214))
        dot(draw, bx, 496, 5, (176, 196, 214))
    for _ in range(50):
        dot(draw, rng.uniform(0, SIZE), rng.uniform(0, SIZE), rng.choice((1, 1, 2)), (90, 108, 128))
    return image.filter(ImageFilter.SMOOTH)


# ----------------------------------------------------------------------- main
BUILDERS = {
    "wall_aquarium.png": build_aquarium_wall,
    "cap_aquarium.png": build_aquarium_cap,
    "floor_aquarium.png": build_aquarium_floor,
    "wall_park.png": build_park_wall,
    "cap_park.png": build_park_cap,
    "floor_park.png": build_park_floor,
    "wall_lodge.png": build_lodge_wall,
    "cap_lodge.png": build_lodge_cap,
    "floor_lodge.png": build_lodge_floor,
    "wall_school.png": build_school_wall,
    "cap_school.png": build_school_cap,
    "floor_school.png": build_school_floor,
    "wall_space.png": build_space_wall,
    "cap_space.png": build_space_cap,
    "floor_space.png": build_space_floor,
}


def save(image: Image.Image, name: str) -> None:
    path = os.path.join(ASSETS, name)
    quantised = image.convert("RGB").quantize(method=Image.MEDIANCUT, dither=Image.FLOYDSTEINBERG)
    quantised.save(path, "PNG", optimize=True)
    print(f"{name}: {image.size[0]}x{image.size[1]} {os.path.getsize(path) // 1024} KB")


def main() -> None:
    os.makedirs(ASSETS, exist_ok=True)
    for name, builder in BUILDERS.items():
        save(builder(), name)


if __name__ == "__main__":
    main()
