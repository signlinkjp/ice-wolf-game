#!/usr/bin/env python3
"""ICE WOLF v1.2.0 — the character sprites and the refreshed stage surfaces.

Builds, from the four generated pictures in `downloads/`:

  * assets/chr_h1_<outfit>.png  the explorer boy, six stage outfits
  * assets/chr_h2_<outfit>.png  the runner girl, six stage outfits
  * assets/chr_w1_<outfit>.png  the red-horned wolf, six stage accents

Each file is one horizontal run cycle: four 200px cells, feet on the same
baseline, transparent background. The game draws a cell with a THREE sprite
whose map covers a quarter of the texture, so a whole cycle is one texture and
one draw call per character.

Outfits are a hue move on the clothes only (skin, hair and the dark trousers
keep their own colour), which is what a player reads at 40-70px on a phone.
The stage surfaces (floor / wall / cap) are rebuilt with a finer ice, tile,
sawdust, plank, lino and hull-plate pattern.

The script is deterministic: same input pictures, same bytes out. Run it from
the repository root:

  python3 tools/make_v120_assets.py
"""
from __future__ import annotations

import colorsys
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOWNLOADS = os.path.join(os.path.dirname(ROOT), "..", "downloads")
ASSETS = os.path.join(ROOT, "assets")

CELL = 200          # one animation cell
FRAMES = 4
BASELINE = 194      # feet sit here inside a cell
OUTFITS = ["classic", "aquarium", "park", "lodge", "school", "space"]

# hue, saturation factor, value factor — applied to the clothes only.
HUMAN_TINT = {
    "classic": None,
    "aquarium": (0.52, 1.00, 0.98),
    "park": (0.86, 1.05, 1.02),
    "lodge": (0.02, 0.92, 0.94),
    "school": (0.62, 0.70, 0.86),
    "space": (0.55, 0.22, 1.18),
}
WOLF_TINT = {
    "classic": None,
    "aquarium": (0.52, 1.00, 1.04),
    "park": (0.86, 1.05, 1.04),
    "lodge": (0.05, 0.98, 1.02),
    "school": (0.58, 0.55, 0.94),
    "space": (0.72, 0.80, 1.10),
}


def cut_out(image: Image.Image) -> Image.Image:
    """Drop the white studio background, keeping every lit fur and hair edge."""
    image = image.convert("RGBA")
    width, height = image.size
    pixels = image.load()
    seen = bytearray(width * height)
    stack = []
    for x in range(width):
        stack.append((x, 0))
        stack.append((x, height - 1))
    for y in range(height):
        stack.append((0, y))
        stack.append((width - 1, y))
    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= width or y >= height:
            continue
        index = y * width + x
        if seen[index]:
            continue
        r, g, b, _ = pixels[x, y]
        if min(r, g, b) < 236:
            continue
        seen[index] = 1
        pixels[x, y] = (r, g, b, 0)
        stack.append((x + 1, y))
        stack.append((x - 1, y))
        stack.append((x, y + 1))
        stack.append((x, y - 1))
    # A one-pixel feather so the cut edge does not look like scissors.
    alpha = image.split()[3]
    soft = alpha.filter(ImageFilter.GaussianBlur(0.8))
    image.putalpha(soft)
    return image


def tint(image: Image.Image, hue: float, sat: float, val: float, red_only: bool = False) -> Image.Image:
    """Move the colour of the clothes; leave skin, hair and the dark leggings."""
    image = image.convert("RGBA")
    pixels = image.load()
    width, height = image.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a < 24:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
            if red_only:
                # the wolf: only the red cape, horns and eyes follow the stage
                if not (s > 0.55 and v > 0.22 and (h < 0.045 or h > 0.94)):
                    continue
            else:
                if not (s > 0.34 and v > 0.34):
                    continue
                # warm skin sits at the yellow end (0.03-0.16) and is never
                # as saturated as the orange outdoor gear; that keeps the face
                if 0.03 <= h <= 0.16 and s < 0.80 and v > 0.45:
                    continue
            nh = hue
            ns = min(1.0, s * sat)
            nv = min(1.0, v * val)
            nr, ng, nb = colorsys.hsv_to_rgb(nh % 1.0, ns, nv)
            pixels[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255), a)
    return image


def fit(image: Image.Image, height_ratio: float) -> Image.Image:
    bbox = image.split()[3].getbbox()
    if bbox:
        image = image.crop(bbox)
    height = int(round((BASELINE - 10) * height_ratio))
    width = max(1, int(round(image.width * height / image.height)))
    return image.resize((width, height), Image.LANCZOS)


def frame(sprite: Image.Image, index: int) -> Image.Image:
    """One cell of the run: a bob, a lean and a breath of squash."""
    cell = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    lean = (-1.6, 1.2, -0.6, 0.9)[index]
    lift = (0, 3, 0, 2)[index]
    squash = (1.0, 0.995, 1.0, 0.997)[index]
    turned = sprite.rotate(lean, resample=Image.BICUBIC, expand=True)
    if squash != 1.0:
        turned = turned.resize((turned.width, max(1, int(turned.height * squash))), Image.BICUBIC)
    x = (CELL - turned.width) // 2
    y = BASELINE - turned.height - lift
    cell.alpha_composite(turned, (x, y))
    return cell


def sheet(sprite: Image.Image) -> Image.Image:
    out = Image.new("RGBA", (CELL * FRAMES, CELL), (0, 0, 0, 0))
    for i in range(FRAMES):
        out.alpha_composite(frame(sprite, i), (i * CELL, 0))
    return out


def save_sheet(image: Image.Image, name: str) -> None:
    path = os.path.join(ASSETS, name)
    image.save(path, "PNG", optimize=True)
    print(f"  {name}  {image.width}x{image.height}  {os.path.getsize(path) // 1024} KB")


# ---------------------------------------------------------------- surfaces
def noise_tile(size: int, base: tuple[int, int, int], seed: int) -> Image.Image:
    import random

    rng = random.Random(seed)
    image = Image.new("RGB", (size, size), base)
    draw = ImageDraw.Draw(image, "RGBA")
    for _ in range(size * 2):
        x, y = rng.randrange(size), rng.randrange(size)
        r = rng.randint(1, 3)
        draw.ellipse((x - r, y - r, x + r, y + r),
                     fill=(255, 255, 255, rng.randint(6, 22)))
    return image


def ice_floor() -> Image.Image:
    size = 256
    image = noise_tile(size, (74, 118, 158), 11)
    draw = ImageDraw.Draw(image, "RGBA")
    # a frozen sheet split into four panes, with seams catching the light
    for x in range(0, size + 1, size // 2):
        draw.line((x, 0, x, size), fill=(196, 232, 255, 120), width=1)
        draw.line((x + 1, 0, x + 1, size), fill=(22, 48, 74, 90), width=1)
    for y in range(0, size + 1, size // 2):
        draw.line((0, y, size, y), fill=(196, 232, 255, 120), width=1)
        draw.line((0, y + 1, size, y + 1), fill=(22, 48, 74, 90), width=1)
    # frost feathers and trapped bubbles
    import random
    rng = random.Random(5)
    for _ in range(26):
        x, y = rng.randrange(size), rng.randrange(size)
        length = rng.randint(10, 30)
        angle = rng.uniform(0, math.pi)
        points = [(x + math.cos(angle) * t * 0.5, y + math.sin(angle) * t * 0.9) for t in range(0, length, 4)]
        for px, py in points:
            draw.ellipse((px - 1, py - 1, px + 1, py + 1), fill=(226, 246, 255, 90))
    for _ in range(18):
        x, y = rng.randrange(size), rng.randrange(size)
        r = rng.randint(2, 5)
        draw.ellipse((x - r, y - r, x + r, y + r), outline=(210, 240, 255, 110), width=1)
    return image


def block_wall(base: tuple[int, int, int], seam: tuple[int, int, int], brick: int = 64) -> Image.Image:
    size = 256
    image = Image.new("RGB", (size, size), base)
    draw = ImageDraw.Draw(image, "RGBA")
    for row in range(0, size, brick):
        offset = (row // brick % 2) * (brick // 2)
        for col in range(-brick, size + brick, brick):
            x = col + offset
            draw.rectangle((x, row, x + brick - 2, row + brick - 2), fill=seam + (46,))
            draw.line((x + 2, row + 2, x + 2, row + brick - 4), fill=(255, 255, 255, 24), width=1)
    return image


def main() -> int:
    src = {
        "h1": os.path.join(DOWNLOADS, "icewolf-human-1-explorer.png"),
        "h2": os.path.join(DOWNLOADS, "icewolf-human-2-runner.png"),
        "w1": os.path.join(DOWNLOADS, "icewolf-oni-1-classic.png"),
    }
    for key, path in src.items():
        if not os.path.exists(path):
            print(f"missing source picture: {path}", file=sys.stderr)
            return 1

    os.makedirs(ASSETS, exist_ok=True)
    print("characters:")
    for key, path in src.items():
        base = cut_out(Image.open(path))
        base = fit(base, 0.90 if key == "w1" else 0.98)
        for outfit in OUTFITS:
            tint_table = WOLF_TINT if key == "w1" else HUMAN_TINT
            spec = tint_table[outfit]
            if spec is None:
                drawn = base
            else:
                drawn = tint(base, spec[0], spec[1], spec[2], red_only=(key == "w1"))
            save_sheet(sheet(drawn), f"chr_{key}_{outfit}.png")

    print("icon:")
    icon_path = os.path.join(DOWNLOADS, "icewolf-icon-1-icechase.png")
    icon = Image.open(icon_path).convert("RGB")
    side = min(icon.size)
    left = (icon.width - side) // 2
    top = (icon.height - side) // 2
    icon = icon.crop((left, top, left + side, top + side))
    ios_icon = os.path.join(ROOT, "ios", "App", "App", "Assets.xcassets", "AppIcon.appiconset", "AppIcon-512@2x.png")
    icon.resize((1024, 1024), Image.LANCZOS).save(ios_icon, "PNG", optimize=True)
    print(f"  AppIcon-512@2x.png 1024x1024 {os.path.getsize(ios_icon) // 1024} KB")
    hero = os.path.join(ASSETS, "menu_hero.png")
    icon.resize((512, 512), Image.LANCZOS).save(hero, "PNG", optimize=True)
    print(f"  menu_hero.png 512x512 {os.path.getsize(hero) // 1024} KB")

    print("surfaces:")
    ice_floor().save(os.path.join(ASSETS, "floor_frostlab.png"), "PNG", optimize=True)
    block_wall((46, 60, 82), (18, 26, 38)).save(os.path.join(ASSETS, "wall_frostlab.png"), "PNG", optimize=True)
    print("  floor_frostlab.png / wall_frostlab.png")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
