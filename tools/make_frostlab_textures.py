#!/usr/bin/env python3
"""Generate the lightweight ICE WOLF frost-lab textures.

Run from the repository root:

    python3 tools/make_frostlab_textures.py

Outputs (all seamlessly tileable, small enough for the HTML5 build):
    assets/floor_frostlab.png   256x256  tiled ice-lab floor
    assets/wall_frostlab.png    256x256  tiled tech panel wall
    assets/ice_freeze.png       256x256  cracked ice used by frozen actors

Everything is deterministic (fixed seed) so re-running the script produces the
same bytes and the repository stays diff-stable.
"""

from __future__ import annotations

import math
import os
import random

from PIL import Image, ImageChops, ImageDraw, ImageFilter

SIZE = 256
ASSETS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets")


def _wrap_points(points):
    """Yield the point set replicated on the 3x3 neighbour tiles (toroidal draw)."""
    for dx in (-SIZE, 0, SIZE):
        for dy in (-SIZE, 0, SIZE):
            yield [(x + dx, y + dy) for (x, y) in points], dx, dy


def _dot(draw, x, y, radius, fill):
    for dx in (-SIZE, 0, SIZE):
        for dy in (-SIZE, 0, SIZE):
            draw.ellipse(
                [x + dx - radius, y + dy - radius, x + dx + radius, y + dy + radius],
                fill=fill,
            )


def _line(draw, points, fill, width=1):
    for shifted, _dx, _dy in _wrap_points(points):
        draw.line(shifted, fill=fill, width=width, joint="curve")


def _polygon(draw, points, fill):
    for shifted, _dx, _dy in _wrap_points(points):
        draw.polygon(shifted, fill=fill)


def _crack_path(rng, x, y, angle, length, depth):
    """Return the point list of a branching crack."""
    points = [(x, y)]
    step = 9.0
    travelled = 0.0
    while travelled < length:
        angle += rng.uniform(-0.55, 0.55)
        x += math.cos(angle) * step
        y += math.sin(angle) * step
        points.append((x, y))
        travelled += step
        if depth > 0 and rng.random() < 0.16:
            branch_len = length * rng.uniform(0.25, 0.5)
            points.extend(
                _crack_path(rng, x, y, angle + rng.choice((-1.1, 1.1)), branch_len, depth - 1)
            )
    return points


def build_floor() -> Image.Image:
    rng = random.Random(1106)
    image = Image.new("RGB", (SIZE, SIZE), (100, 132, 162))
    draw = ImageDraw.Draw(image)

    cell = 128
    # Cool inner sheen inside every tile cell (kept fully inside the cell so it tiles).
    sheen_mask = Image.radial_gradient("L").resize((cell, cell))
    sheen_mask = sheen_mask.point(lambda v: max(0, int((1 - v / 255.0) * 62)))
    sheen = Image.new("RGB", (cell, cell), (150, 182, 208))
    for cy in (0, cell):
        for cx in (0, cell):
            region = image.crop((cx, cy, cx + cell, cy + cell))
            image.paste(Image.composite(sheen, region, sheen_mask), (cx, cy))
    draw = ImageDraw.Draw(image)

    # Tile seams.
    for pos in (0, cell):
        draw.line([(pos, 0), (pos, SIZE)], fill=(74, 106, 136), width=2)
        draw.line([(0, pos), (SIZE, pos)], fill=(74, 106, 136), width=2)
        for off in (1, 2):
            draw.line([(pos + off, 0), (pos + off, SIZE)], fill=(168, 200, 226), width=1)
            draw.line([(0, pos + off), (SIZE, pos + off)], fill=(168, 200, 226), width=1)

    # Frost speckles and short hairline cracks (wrapped so the tile repeats cleanly).
    for _ in range(170):
        x = rng.uniform(0, SIZE)
        y = rng.uniform(0, SIZE)
        r = rng.choice((0, 0, 0, 1, 1, 2))
        tone = rng.randint(176, 226)
        _dot(draw, x, y, r, (tone, min(255, tone + 16), 255))

    for _ in range(9):
        x = rng.uniform(0, SIZE)
        y = rng.uniform(0, SIZE)
        angle = rng.uniform(0, math.tau)
        points = _crack_path(rng, x, y, angle, rng.uniform(14, 34), 0)
        _line(draw, points, (204, 228, 246), width=1)

    # Recessed corner rivets on each cell corner.
    for cy in (0, cell):
        for cx in (0, cell):
            _dot(draw, cx + 10, cy + 10, 3, (68, 100, 128))
            _dot(draw, cx + 9, cy + 9, 1, (186, 216, 240))

    return image.filter(ImageFilter.SMOOTH)


def build_wall() -> Image.Image:
    rng = random.Random(6502)
    image = Image.new("RGB", (SIZE, SIZE), (48, 74, 100))
    draw = ImageDraw.Draw(image)

    # Brushed metal streaks (vertical, wrapped).
    for _ in range(220):
        x = rng.uniform(0, SIZE)
        tone = rng.randint(-14, 14)
        base = (48 + tone, 74 + tone, 100 + tone)
        _line(draw, [(x, 0), (x, SIZE)], base, width=rng.choice((1, 1, 2)))

    cell = 128
    for cy in (0, cell):
        for cx in (0, cell):
            # Panel bevel.
            draw.line([(cx + 4, cy + 4), (cx + cell - 4, cy + 4)], fill=(86, 120, 150), width=2)
            draw.line([(cx + 4, cy + 4), (cx + 4, cy + cell - 4)], fill=(80, 114, 144), width=2)
            draw.line(
                [(cx + 4, cy + cell - 4), (cx + cell - 4, cy + cell - 4)],
                fill=(26, 46, 66),
                width=3,
            )
            draw.line(
                [(cx + cell - 4, cy + 4), (cx + cell - 4, cy + cell - 4)],
                fill=(26, 46, 66),
                width=3,
            )
            # Inner tech strip.
            draw.rectangle(
                [cx + 22, cy + cell - 40, cx + cell - 22, cy + cell - 32],
                fill=(32, 58, 82),
            )
            draw.line(
                [(cx + 26, cy + cell - 36), (cx + cell - 30, cy + cell - 36)],
                fill=(110, 200, 235),
                width=2,
            )

    # Cyan seam glow along the panel grid: additive so the panel detail survives.
    glow = Image.new("RGB", (SIZE, SIZE), (0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    for pos in (0, cell):
        glow_draw.line([(pos, 0), (pos, SIZE)], fill=(46, 150, 190), width=4)
        glow_draw.line([(0, pos), (SIZE, pos)], fill=(46, 150, 190), width=4)
    glow = glow.filter(ImageFilter.GaussianBlur(2.6))
    image = ImageChops.add(image, glow, scale=1.35)

    draw = ImageDraw.Draw(image)
    # Crisp seam lines on top of the glow.
    for pos in (0, cell):
        draw.line([(pos, 0), (pos, SIZE)], fill=(94, 226, 255), width=1)
        draw.line([(0, pos), (SIZE, pos)], fill=(94, 226, 255), width=1)

    # Rivets and frost dusting.
    for cy in (0, cell):
        for cx in (0, cell):
            for rx, ry in ((14, 14), (cell - 14, 14), (14, cell - 14), (cell - 14, cell - 14)):
                _dot(draw, cx + rx, cy + ry, 3, (16, 36, 54))
                _dot(draw, cx + rx - 1, cy + ry - 1, 1, (140, 214, 240))
    for _ in range(240):
        x = rng.uniform(0, SIZE)
        y = rng.uniform(0, SIZE)
        _dot(draw, x, y, rng.choice((0, 0, 1)), (190, 220, 240))

    return image


def build_ice() -> Image.Image:
    rng = random.Random(9091)
    image = Image.new("RGB", (SIZE, SIZE), (232, 248, 255))
    draw = ImageDraw.Draw(image)

    # Frozen haze inside the block.
    for _ in range(60):
        x = rng.uniform(0, SIZE)
        y = rng.uniform(0, SIZE)
        radius = rng.uniform(14, 40)
        tone = rng.randint(210, 244)
        for dx in (-SIZE, 0, SIZE):
            for dy in (-SIZE, 0, SIZE):
                draw.ellipse(
                    [x + dx - radius, y + dy - radius, x + dx + radius, y + dy + radius],
                    fill=(tone, min(255, tone + 8), 255),
                )

    # Crack network.
    for _ in range(26):
        x = rng.uniform(0, SIZE)
        y = rng.uniform(0, SIZE)
        angle = rng.uniform(0, math.tau)
        points = _crack_path(rng, x, y, angle, rng.uniform(40, 110), 1)
        _line(draw, points, (136, 214, 246), width=2)
        _line(draw, points, (255, 255, 255), width=1)

    # Air bubbles.
    for _ in range(120):
        x = rng.uniform(0, SIZE)
        y = rng.uniform(0, SIZE)
        r = rng.choice((1, 1, 2, 3))
        _dot(draw, x, y, r, (196, 232, 252))
        _dot(draw, x - 1, y - 1, max(1, r - 1), (255, 255, 255))

    return image.filter(ImageFilter.SMOOTH)


def main() -> None:
    os.makedirs(ASSETS, exist_ok=True)
    for name, builder in (
        ("floor_frostlab.png", build_floor),
        ("wall_frostlab.png", build_wall),
        ("ice_freeze.png", build_ice),
    ):
        path = os.path.join(ASSETS, name)
        image = builder()
        image.save(path, "PNG", optimize=True)
        print(f"{name}: {image.size[0]}x{image.size[1]} {os.path.getsize(path)} bytes")


if __name__ == "__main__":
    main()
