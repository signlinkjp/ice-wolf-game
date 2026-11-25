# ICE WOLF v1.2.0 (Build 32) — the visual refresh

The release the brief asked for: the game on the ice now looks like the icon,
the wolf the round opens with is a wolf the whole time, and SETTINGS carries
three new choices (text size, vibration, the control). Everything the 1.1.0
build shipped — the twelve languages, the six stages, online rooms, Pro, the
camera, the numbers a player feels — is still there and still passes its tests.

## The characters are the generated pictures

`icewolf-human-1-explorer`, `icewolf-human-2-runner` and
`icewolf-oni-1-classic` are cut out of their studio background and become
**18 sprite sheets**, one per stage outfit (six) for each of the three bodies:

| file | who |
| --- | --- |
| `assets/chr_h1_<outfit>.png` | the boy (the player, and the even roster letters) |
| `assets/chr_h2_<outfit>.png` | the girl (the odd roster letters) |
| `assets/chr_w1_<outfit>.png` | the red-horned wolf |

Each sheet is `800x200`: **four 200px cells of a run cycle**, transparent, one
texture per picture. The run cycle advances with the distance walked
(`STEPS_PER_FRAME = 15`), so the feet keep up with the floor; a body that stands
still holds frame 0. The billboard is mirrored when the body walks the other
way.

On the ice each body is **one `THREE.Sprite`**, hung inside the body's own cube
through a holder that undoes the cube's non-uniform scale — the same trick the
ice shell uses. The cube's faces are hidden only after the picture is standing,
and put back if the loader fails, so a device without the 3D renderer keeps the
old solid cube instead of an empty room. A soft blob shadow (one 64px canvas
gradient, made once) grounds the figure.

Cost: 10 bodies = 10 sprites + 10 shadows + 10 ice shells, at most **three
sheet textures** per stage (h1, h2, w1 of that stage's outfit). No per-frame
geometry, no per-frame texture, no DOM.

The outfits are a hue move on the clothes only — skin, hair and the dark
trousers keep their colour — which is what reads at 40–70px on a phone:

1. 氷のアリーナ Classic — the original winter gear
2. 深海アクアリウム Aquarium — teal wetsuit, blue trim
3. 霧の遊園地 Amusement Park — magenta neon
4. 雪山ロッジ Mountain Lodge — red knit, warm cream
5. 廃校 School — navy blazer
6. 宇宙船 Spaceship — silver suit, cyan visor

The wolf follows the stage with its cape and horns (aquarium cyan, park
magenta, lodge ember, school navy, space violet) while its charcoal fur stays
charcoal.

## The rule change

`WolfOrigin` says where a wolf came from. The deal leaves it empty (`initial`
once written); the trap switch writes `trap`; an infection writes `infect` /
`cpu`.

* **the wolf the round opens with is a wolf for the whole match** — empty or
  `initial` origin, wolf body whether its mode is running or not;
* **a wolf made during the round is a person outside its five seconds** — it
  turns only for the length of its wolf mode;
* a human never shows the wolf, and a wolf-role body walking as a person still
  cannot rescue (the rescue button reads the role, not the picture).

The rule is a pure function in the character block
(`iceWolfLooksLikeWolf`, `iceWolfIsOpeningWolf`, `iceWolfLooksLikeWolfFor`) and
`tests/pro/v120-build32.test.mjs` holds it to these cases.

**Online, one caveat.** The host's snapshot carries each seat's role and its
wolf-mode flag, but not `WolfOrigin` — so on a guest's phone an empty origin
means "not known", not "the opening wolf". The guest therefore keeps the
previous look (a person until its mode) instead of painting every wolf it is
told about as a permanent wolf. Carrying the origin on the wire is the next
step for a guest to see exactly what the host sees; it is deliberately not in
this build, because guessing would reveal a recruited wolf as a permanent one.

## SETTINGS

Three rows were added at the end of the sheet, all remembered between launches:

* **文字サイズ 標準 / 大 / 特大** — the menu sheets scale as a whole (`zoom` on
  the card, with the card's width divided by the same zoom so it still fits the
  phone), the GDevelop HUD text grows from the size it shipped with, and the
  head bubbles follow through `PlayerTextScale`;
* **バイブ オン / オフ** — a freeze, a wolf mode, a switch, a gate and a rescue
  each give one short buzz, through Capacitor Haptics when the native shell has
  it, otherwise `navigator.vibrate`;
* **移動 スティック / 直接タッチ** — the shipped stick is untouched; the second
  mode is the DOROKEI control (touch anywhere on the ice, drag from the finger,
  a ring under the thumb), writing the same `JoystickActive/X/Y` the movement
  block already reads.

The settings sheet itself is now three compact columns on a landscape phone so
the rows (players, wolves, switches, correct, role, time, trap, sound, Pro,
language, camera, movement, text size, vibration) are reachable without a long
scroll.

## The opening

A 1.9 second chase: the wolf bursts in, the two humans run ahead, snow crosses,
the title lands, then a 0.3s fade and the element is **removed from the
document**. A tap anywhere skips it, and the gesture is consumed
(`stopPropagation`) so the menu button underneath never sees it. CSS only — no
canvas, no per-frame script.

## The icon

`downloads/icewolf-icon-1-icechase.png` → `AppIcon-512@2x.png` (1024×1024, RGB,
no alpha) for the iOS asset catalogue, and the same picture at 512px as
`assets/menu_hero.png`. `python3 tools/make_v120_assets.py` regenerates all of
it (characters, icon, and the refreshed ice floor / frost wall) from the
pictures in `downloads/`.

## What the tests say

`npm test` — **285 tests, 285 pass**. The v1.2.0 file
(`tests/pro/v120-build32.test.mjs`) covers the rule, the 18 sheets (size,
transparency, four distinct frames), the settings constants and their twelve
languages, the opening, the icon, the sheet order, and the release number. The
older suites keep their own guarantees; the only expectations that moved are the
version/build number and the position of the two new blocks at the end of the
sheet.

`python3 scripts/ios/verify-ios-project.py` — **ALL CHECKS PASSED** (the icon is
1024×1024 with no alpha, the marketing version is 1.2.0, the build is 32).

## Build 33 — step 2 of the play-test

The four findings of the Build 32 device recording, and the stage work behind
them, are written up in `docs/v120-build33-changes.md`. In one line each: the
menu sheet takes its own taps at the root (SETTINGS and PRO open after a
match), a body is 112 against the 160 wall and runs with a lean, a bounce and
snow, the camera came in and the HUD stays inside the safe area, and every stage
- the Classic arena included, with a set of its own - now has a light rig, a
backdrop and one more prop kit, with a new action layer (`v1.3.0 アクション演出`)
for the switches, pads, ice, rescue and the wolf's aura.

`npm test` — **293 tests, 293 pass** (`tests/pro/v120-build33.test.mjs` adds
eight). `python3 scripts/ios/verify-ios-project.py` — **ALL CHECKS PASSED**,
build 33. The GDevelop export and the Playwright pass were not re-run for this
commit (they are not part of the tests); the next build does them.

## Build 34 — the device recording, answered

The three findings of the Build 33 recording and the play-test's fourth ask are
written up in `docs/v120-build34-changes.md`. In one line each: the direct-touch
overlay no longer covers the canvas and a touch on a HUD control is handed to
the game, so `[ rescue ]` presses again; a body is 122 tall, a stride is
eighteen pixels (the four poses hold long enough to be seen) and the stride
squashes and stretches it; the light rig is down to a bounce, a key and a rim so
the walls, the snow and the ice keep their colour, every wall carries a merged
snow cap and every stage has weather in one Points mesh; and the play screen's
lines are redrawn as a pop HUD from the same translated strings.

`npm test` — **303 tests, 303 pass** (`tests/pro/v120-build34.test.mjs` adds
ten). `python3 scripts/ios/verify-ios-project.py` — **ALL CHECKS PASSED**,
build 34. The real build was exported with GDevelop 5.6.282
(`EXPORT_HTML5_EXTERNAL`, the same path `ios-testflight.yml` uses) and walked in
Chromium: 22 checks, all passing, with the evidence in `downloads/icewolf-b34-*.png`.
