#!/usr/bin/env python3
"""Generate the ICE WOLF v1.2.0 Build 33 Classic arena textures.

The Classic Ice Arena was the frost lab: a near-black navy brick wall and a
grey-blue floor. The Build 33 play-test could not tell a runner from that floor,
and the arena read as an empty room. This draws the arena its own set instead -
bright ice, a skate-marked rink and snow-capped bricks - so the first stage is
as much a place as the five that came after it.

Run from the repository root:

    python3 tools/make_classic_textures.py

    assets/wall_classic.png    512x512  the four sides of a wall
    assets/cap_classic.png     512x512  the top face of a wall
    assets/floor_classic.png   512x512  the floor

Same rules as tools/make_stage_textures.py: every texture tiles seamlessly, the
floor stays calm enough to read the toys on (a wide seam, no busy pattern), the
files are quantised, and the drawing is deterministic so a re-run is diff-stable.
"""
from __future__ import annotations

import os
import random
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_stage_textures as base  # noqa: E402

SIZE = base.SIZE
ASSETS = base.ASSETS


def build_classic_floor() -> Image.Image:
    image = base.vertical_gradient((106, 178, 216), (58, 122, 162)).convert("RGB")
    # the ice sheet: slow bands of colder blue
    field = base.wave_field([(2, 1, 0.26, 0.0), (3, 2, 0.18, 1.1), (5, 3, 0.10, 2.2)], softness=0.5)
    image = base.paint_field(image, field, (196, 234, 250), strength=0.30, blur=3.0)
    field2 = base.wave_field([(1, 2, 0.22, 0.6), (4, 3, 0.12, 2.4)], softness=0.6)
    image = base.paint_field(image, field2, (36, 92, 130), strength=0.20, blur=4.0)
    draw = ImageDraw.Draw(image, "RGBA")
    # the rink seams: one wide, calm grid, the tiles the walls stand on
    for offset in (0, SIZE // 2):
        base.line(draw, [(offset, 0), (offset, SIZE)], (222, 246, 255, 60), 3)
        base.line(draw, [(0, offset), (SIZE, offset)], (222, 246, 255, 60), 3)
        base.line(draw, [(offset + 2, 0), (offset + 2, SIZE)], (24, 74, 108, 40), 2)
        base.line(draw, [(0, offset + 2), (SIZE, offset + 2)], (24, 74, 108, 40), 2)
    # skate marks: thin arcs, laid flat, never crossing the middle of a lane
    random.seed(3301)
    for _ in range(16):
        x = random.uniform(0, SIZE)
        y = random.uniform(0, SIZE)
        radius = random.uniform(40, 130)
        start = random.uniform(0, 360)
        base.arc(draw, x - radius, y - radius, x + radius, y + radius, start, start + random.uniform(40, 130),
                 (240, 252, 255, random.randint(28, 54)), 2)
    # frost sparkle, tiny and sparse
    spots = []
    for _ in range(90):
        spots.append((random.uniform(0, SIZE), random.uniform(0, SIZE), random.uniform(1.5, 3.6), random.uniform(1.5, 3.6)))
    image = base.blend_spots(image, (238, 250, 255), spots, blur=1.2, strength=0.55)
    # a breath of depth at the tile corners
    dark = []
    for x in (0, SIZE // 2, SIZE):
        for y in (0, SIZE // 2, SIZE):
            dark.append((x, y, 90, 90))
    image = base.darken_spots(image, dark, blur=70, strength=0.10)
    return image


def build_classic_wall() -> Image.Image:
    image = base.vertical_gradient((78, 156, 198), (34, 92, 132)).convert("RGB")
    draw = ImageDraw.Draw(image, "RGBA")
    rows = 4
    height = SIZE // rows
    for row in range(rows):
        y0 = row * height
        offset = 0 if row % 2 == 0 else SIZE // 8
        for column in range(4):
            x0 = column * (SIZE // 4) + offset
            shade = 205 + (row % 2) * 10
            base.box(draw, x0 + 5, y0 + 5, x0 + SIZE // 4 - 5, y0 + height - 5,
                     fill=(70, 146, 190, 120), outline=(150, 216, 244, 120), width=3)
            # the bevel: a light top edge and a dark foot, which is what makes a
            # brick read as ice and not as a painted rectangle
            base.line(draw, [(x0 + 8, y0 + 8), (x0 + SIZE // 4 - 8, y0 + 8)], (206, 240, 255, 90), 3)
            base.line(draw, [(x0 + 8, y0 + height - 8), (x0 + SIZE // 4 - 8, y0 + height - 8)],
                      (18, 62, 94, 110), 4)
            base.dot(draw, x0 + SIZE // 8, y0 + height // 2, 3, (226, 248, 255, shade - 140))
    # snow in the mortar lines, and a few icicles hanging off the bevels
    random.seed(3303)
    for row in range(rows):
        y = row * height
        base.line(draw, [(0, y), (SIZE, y)], (226, 246, 255, 70), 2)
    for _ in range(14):
        x = random.uniform(4, SIZE - 4)
        y = random.uniform(4, SIZE - 4)
        base.line(draw, [(x, y), (x, y + random.uniform(10, 26))], (232, 250, 255, 150), 2)
        base.dot(draw, x, y + 18, 2, (245, 253, 255, 190))
    image = base.paint_field(image, base.wave_field([(2, 2, 0.3, 0.4)], softness=0.5), (150, 214, 244),
                             strength=0.18, blur=6.0)
    return image


def build_classic_cap() -> Image.Image:
    image = base.vertical_gradient((232, 248, 255), (186, 226, 245)).convert("RGB")
    draw = ImageDraw.Draw(image, "RGBA")
    random.seed(3305)
    for _ in range(40):
        x = random.uniform(0, SIZE)
        y = random.uniform(0, SIZE)
        radius = random.uniform(10, 34)
        base.dot(draw, x, y, radius, (255, 255, 255, random.randint(40, 90)))
    for _ in range(10):
        x = random.uniform(0, SIZE)
        y = random.uniform(0, SIZE)
        base.arc(draw, x - 26, y - 20, x + 26, y + 20, random.uniform(0, 360), random.uniform(0, 360),
                 (160, 206, 232, 120), 2)
    # the wind's ripples, so the top does not read as blank paper
    image = base.paint_field(image, base.wave_field([(3, 1, 0.4, 0.0), (1, 3, 0.3, 1.7)], softness=0.55),
                             (255, 255, 255), strength=0.25, blur=5.0)
    return image


BUILDERS = {
    "wall_classic.png": build_classic_wall,
    "cap_classic.png": build_classic_cap,
    "floor_classic.png": build_classic_floor,
}


def main() -> None:
    os.makedirs(ASSETS, exist_ok=True)
    for name, builder in BUILDERS.items():
        base.save(builder(), name)
    previews = [arg.split("=", 1)[1] for arg in sys.argv[1:] if arg.startswith("--preview=")]
    for path in previews:
        images = [BUILDERS[name]() for name in BUILDERS]
        labels = ["CLASSIC wall", "CLASSIC wall top", "CLASSIC floor"]
        images += [base.tiled(images[0]), base.tiled(images[2])]
        labels += ["wall, tiled 3x3", "floor, tiled 3x3"]
        base.contact_sheet(images, 2, labels, cell=420).save(path)
        print(f"preview: {path}")


if __name__ == "__main__":
    main()
