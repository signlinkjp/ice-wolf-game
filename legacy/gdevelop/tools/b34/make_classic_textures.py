#!/usr/bin/env python3
"""ICE WOLF v1.2.0 Build 34 — the Classic arena's surfaces, second pass.

Build 33 gave the Classic arena a set of its own (bright ice, a skate-marked
rink, snow-capped bricks), but the device recording still read the stage as a
flat white room: the camera looks down at the arena, so most of what a player
sees of a wall is its *top*, and the top was plain snow with a few faint dots.

This redraws the three Classic surfaces for a top-down camera:

    assets/cap_classic.png     512x512  the top of a wall: a snow-capped ice
                                       block with a lit edge, soft drifts and
                                       sparkle, so a wall reads as a block
    assets/wall_classic.png    512x512  the sides: deep ice bricks, snow on each
                                       course, dark mortar
    assets/floor_classic.png   512x512  the rink: deeper, colder ice with crisp
                                       skate marks under the toys

Nothing here uses a linear gradient as the base: a tile of a gradient repeats as
a visible band, and the arena is a floor of repeated tiles. Every base is a
noise field that wraps, so the seams do not show.

    python3 tools/b34/make_classic_textures.py [--preview=path.png]
"""
from __future__ import annotations

import os
import random
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import make_stage_textures as base  # noqa: E402

SIZE = base.SIZE
ASSETS = base.ASSETS


def _sparkle(image: Image.Image, count: int, seed: int, strength: float = 0.6) -> Image.Image:
    random.seed(seed)
    spots = []
    for _ in range(count):
        spots.append((random.uniform(0, SIZE), random.uniform(0, SIZE),
                      random.uniform(1.4, 3.0), random.uniform(1.4, 3.0)))
    return base.blend_spots(image, (245, 253, 255), spots, blur=1.1, strength=strength)


def _soft_base(colour, waves):
    """A flat base painted with wrapping waves. No linear gradient anywhere: a
    gradient tiled across the arena reads as a band every 160px."""
    image = Image.new("RGB", (SIZE, SIZE), colour)
    for field_waves, tint, strength, blur in waves:
        image = base.paint_field(image, base.wave_field(field_waves, softness=0.62),
                                 tint, strength=strength, blur=blur)
    return image


def build_classic_cap() -> Image.Image:
    """The top of a wall: a snow-covered block, seen from above."""
    # a wrapping base of snow, lit from the top-left corner of the block
    image = _soft_base((92, 142, 182), [
        ([(2, 1, 0.30, 0.0), (3, 2, 0.20, 1.3)], (250, 254, 255), 0.46, 10.0),
        ([(1, 2, 0.26, 0.8), (4, 3, 0.14, 2.1)], (46, 96, 140), 0.34, 11.0)
    ])

    # soft drifts: blurred, elongated heaps of snow - no circles, the top of a
    # block is a surface, not a heap of bubbles
    random.seed(4401)
    heaps = []
    for _ in range(5):
        heaps.append((random.uniform(0, SIZE), random.uniform(0, SIZE),
                      random.uniform(110, 190), random.uniform(34, 62)))
    light = base.spot_mask([(x, y, rx, ry) for x, y, rx, ry in heaps], blur=30)
    warm = Image.new("RGB", (SIZE, SIZE), (255, 255, 255))
    image = Image.composite(warm, image, light.point(lambda v: int(v * 0.55)))
    cool_spots = []
    for x, y, rx, ry in heaps:
        cool_spots.append((x + rx * 0.5, y + ry * 0.55, rx * 0.8, ry * 0.55))
    image = base.darken_spots(image, cool_spots, blur=34, strength=0.12)

    draw = ImageDraw.Draw(image, "RGBA")
    # No rim is painted here on purpose: the tile repeats along a 1520px border
    # wall, so a rim in the picture would draw a frame every 160px and the wall
    # would read as a row of trays. The thickness comes from the snow cap's own
    # sides in the 3D scene (tools/b34/stage_extra.js) instead.
    # wind-cut lines: thin, broken, following the light
    random.seed(4403)
    for _ in range(8):
        y = random.uniform(26, SIZE - 26)
        points = [(x, y + random.uniform(-4, 4)) for x in range(-10, SIZE + 20, 24)]
        base.line(draw, points, (255, 255, 255, 80), 2)
    for _ in range(3):
        x = random.uniform(70, SIZE - 70)
        y = random.uniform(50, SIZE - 50)
        points = [(x, y)]
        for _ in range(3):
            x += random.uniform(-26, 26)
            y += random.uniform(-20, 20)
            points.append((x, y))
        base.line(draw, points, (146, 188, 218, 80), 2)

    return _sparkle(image, 80, 4405, 0.45)


def build_classic_wall() -> Image.Image:
    """The sides of a wall: deep ice bricks with snow on every course."""
    image = _soft_base((30, 82, 130), [
        ([(2, 2, 0.22, 0.4)], (168, 220, 246), 0.14, 9.0)
    ])
    draw = ImageDraw.Draw(image, "RGBA")
    rows = 4
    height = SIZE // rows
    for row in range(rows):
        y0 = row * height
        offset = 0 if row % 2 == 0 else SIZE // 8
        for column in range(5):
            x0 = column * (SIZE // 4) + offset - SIZE // 4
            x1 = x0 + SIZE // 4
            base.box(draw, x0 + 4, y0 + 4, x1 - 4, y0 + height - 4,
                     fill=(48, 118, 168, 190), outline=(108, 178, 218, 100), width=2)
            # lit lip at the top of the brick, dark foot under it
            base.line(draw, [(x0 + 7, y0 + 7), (x1 - 7, y0 + 7)], (186, 226, 246, 120), 3)
            base.line(draw, [(x0 + 7, y0 + height - 8), (x1 - 7, y0 + height - 8)], (10, 38, 64, 160), 5)
            # snow caught on the lip
            base.line(draw, [(x0 + 6, y0 + 11), (x1 - 6, y0 + 11)], (240, 251, 255, 190), 5)
            base.dot(draw, (x0 + x1) / 2, y0 + height * 0.62, 3, (198, 234, 252, 90))
    for row in range(rows):
        y = row * height
        base.line(draw, [(0, y), (SIZE, y)], (10, 40, 66, 140), 3)
        base.line(draw, [(0, y + 5), (SIZE, y + 5)], (228, 246, 255, 55), 2)
    random.seed(4407)
    for _ in range(10):
        x = random.uniform(4, SIZE - 4)
        y = random.uniform(4, SIZE - 4)
        base.line(draw, [(x, y), (x, y + random.uniform(12, 30))], (234, 250, 255, 120), 2)
    return image


def build_classic_floor() -> Image.Image:
    """The rink: deeper, colder ice, crisp skate marks, calm in the lanes."""
    image = _soft_base((44, 116, 162), [
        ([(2, 1, 0.26, 0.0), (3, 2, 0.18, 1.1), (5, 3, 0.11, 2.2)], (170, 222, 244), 0.30, 5.0),
        ([(1, 2, 0.24, 0.6), (4, 3, 0.14, 2.4)], (10, 52, 90), 0.30, 6.0)
    ])
    draw = ImageDraw.Draw(image, "RGBA")
    for offset in (0, SIZE // 2):
        base.line(draw, [(offset, 0), (offset, SIZE)], (222, 246, 255, 55), 3)
        base.line(draw, [(0, offset), (SIZE, offset)], (222, 246, 255, 55), 3)
    random.seed(3401)
    for _ in range(18):
        x = random.uniform(0, SIZE)
        y = random.uniform(0, SIZE)
        radius = random.uniform(44, 150)
        start = random.uniform(0, 360)
        sweep = random.uniform(40, 130)
        base.arc(draw, x - radius, y - radius, x + radius, y + radius, start, start + sweep,
                 (18, 58, 92, 36), 4)
        base.arc(draw, x - radius - 1, y - radius - 1, x + radius + 1, y + radius + 1, start, start + sweep,
                 (242, 252, 255, random.randint(56, 92)), 2)
    for _ in range(5):
        x = random.uniform(20, SIZE - 20)
        y = random.uniform(20, SIZE - 20)
        points = [(x, y)]
        for _ in range(3):
            x += random.uniform(-40, 40)
            y += random.uniform(-30, 30)
            points.append((x, y))
        base.line(draw, points, (18, 58, 92, 55), 2)
    image = _sparkle(image, 90, 3403, 0.45)
    dark = []
    for x in (0, SIZE // 2, SIZE):
        for y in (0, SIZE // 2, SIZE):
            dark.append((x, y, 96, 96))
    image = base.darken_spots(image, dark, blur=70, strength=0.08)
    return image


BUILDERS = {
    "cap_classic.png": build_classic_cap,
    "wall_classic.png": build_classic_wall,
    "floor_classic.png": build_classic_floor,
}


def main() -> None:
    os.makedirs(ASSETS, exist_ok=True)
    for name, builder in BUILDERS.items():
        base.save(builder(), name)
    previews = [arg.split("=", 1)[1] for arg in sys.argv[1:] if arg.startswith("--preview=")]
    for path in previews:
        images = [BUILDERS[name]() for name in BUILDERS]
        labels = ["B34 cap (wall top)", "B34 wall side", "B34 floor"]
        images += [base.tiled(images[0], 3), base.tiled(images[2], 3)]
        labels += ["cap tiled", "floor tiled"]
        base.contact_sheet(images, 2, labels, cell=420).save(path)
        print(f"preview: {path}")


if __name__ == "__main__":
    main()
